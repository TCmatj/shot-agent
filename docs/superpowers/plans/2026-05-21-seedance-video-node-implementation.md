# Seedance 视频生成节点实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `seedance2.0` 与 `seedance2.0-fast` 补齐场景预设视频生成节点，包括动态参数展示、完整请求适配、5 秒轮询、token 双显示与本地视频保存。

**Architecture:** 以现有 `CanvasNodeView` 和 `generationClient` 为中心扩展，先在 `domain/` 中定义 Seedance 场景与能力矩阵，再把视频请求与轮询逻辑拆进 `models/`，最后由 `App.tsx` 驱动节点面板与任务状态展示。文件存储继续复用 `browserFolderStore`，新增面向视频结果下载与落盘的专用入口。

**Tech Stack:** TypeScript、React 19、Vite、Vitest、File System Access API

---

## 文件结构

本次实现预计涉及以下文件。

**Create:**

- `src/domain/seedance.ts`
- `src/models/seedanceTaskTracker.ts`
- `test/unit/seedance.test.ts`
- `test/unit/seedanceTaskTracker.test.ts`
- `docs/superpowers/plans/2026-05-21-seedance-video-node-implementation.md`

**Modify:**

- `src/app/canvasWorkspace.ts`
- `src/models/generationClient.ts`
- `src/storage/browserFolderStore.ts`
- `src/app/App.tsx`
- `src/app/App.css`
- `test/unit/generationClient.test.ts`
- `test/unit/browserFolderStore.test.ts`
- `test/unit/App.test.tsx`

**Why these files:**

- `seedance.ts`：集中放场景、参数、能力矩阵、token 预估与请求映射规则
- `canvasWorkspace.ts`：扩展节点持久化字段，让视频节点能保存场景、参数、usage、本地路径
- `generationClient.ts`：从当前简化版 Seedance 请求升级到完整场景映射与查询结果解析
- `seedanceTaskTracker.ts`：承接 5 秒轮询，避免把定时器散在 `App.tsx`
- `browserFolderStore.ts`：把查询成功的视频与末帧保存到 `assets/videos` / `assets/covers`
- `App.tsx` / `App.css`：视频节点参数面板、usage 展示、状态更新与保存流程接入

### Task 1: 补齐 Seedance 领域模型与能力矩阵

**Files:**

- Create: `src/domain/seedance.ts`
- Modify: `src/app/canvasWorkspace.ts`
- Test: `test/unit/seedance.test.ts`

- [ ] **Step 1: 先写能力矩阵与 token 预估的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  estimateSeedanceTokens,
  getSeedanceCapabilities,
  getVisibleSeedanceFields,
} from '../../src/domain/seedance';

describe('seedance capabilities', () => {
  it('hides 1080p for seedance2.0-fast', () => {
    expect(getSeedanceCapabilities('seedance2.0-fast').supportedResolutions).toEqual([
      '480p',
      '720p',
    ]);
  });

  it('shows first and last frame fields for first-last-frame scenario', () => {
    expect(
      getVisibleSeedanceFields({
        model: 'seedance2.0',
        scenario: 'image_to_video_first_last_frame',
      }),
    ).toContain('lastFrame');
  });

  it('estimates more tokens for 720p than 480p at the same duration', () => {
    const low = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '480p',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });
    const high = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '720p',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });

    expect(high).toBeGreaterThan(low);
  });
});
```

- [ ] **Step 2: 运行测试，确认能力模块还不存在**

Run: `npm test -- test/unit/seedance.test.ts`  
Expected: FAIL，提示 `Cannot find module '../../src/domain/seedance'`

- [ ] **Step 3: 新建 `seedance.ts`，定义场景、能力矩阵和字段可见性规则**

```ts
export type SeedanceModelId = 'seedance2.0' | 'seedance2.0-fast';

export type SeedanceScenario =
  | 'text_to_video'
  | 'image_to_video_first_frame'
  | 'image_to_video_first_last_frame'
  | 'multimodal_reference_video';

export type SeedanceVisibleField =
  | 'prompt'
  | 'firstFrame'
  | 'lastFrame'
  | 'referenceImages'
  | 'referenceVideos'
  | 'referenceAudios'
  | 'resolution'
  | 'ratio'
  | 'duration'
  | 'framespersecond'
  | 'seed'
  | 'generateAudio'
  | 'returnLastFrame'
  | 'priority';

const capabilities = {
  'seedance2.0': {
    supportedResolutions: ['480p', '720p', '1080p'] as const,
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
  'seedance2.0-fast': {
    supportedResolutions: ['480p', '720p'] as const,
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
} as const;

export function getSeedanceCapabilities(model: SeedanceModelId) {
  return capabilities[model];
}

export function getVisibleSeedanceFields(input: {
  model: SeedanceModelId;
  scenario: SeedanceScenario;
}): SeedanceVisibleField[] {
  const base: SeedanceVisibleField[] = [
    'prompt',
    'resolution',
    'ratio',
    'duration',
    'framespersecond',
    'seed',
    'returnLastFrame',
  ];

  if (capabilities[input.model].supportsGenerateAudio) {
    base.push('generateAudio');
  }
  if (capabilities[input.model].supportsPriority) {
    base.push('priority');
  }
  if (input.scenario === 'image_to_video_first_frame') {
    return [...base, 'firstFrame'];
  }
  if (input.scenario === 'image_to_video_first_last_frame') {
    return [...base, 'firstFrame', 'lastFrame'];
  }
  if (input.scenario === 'multimodal_reference_video') {
    return [...base, 'referenceImages', 'referenceVideos', 'referenceAudios'];
  }

  return base;
}

export function estimateSeedanceTokens(input: {
  model: SeedanceModelId;
  resolution: '480p' | '720p' | '1080p';
  duration: number;
  framespersecond: number;
  scenario: SeedanceScenario;
  generateAudio: boolean;
  multimodalCount: number;
}): number {
  const resolutionFactor = input.resolution === '1080p' ? 2.1 : input.resolution === '720p' ? 1.4 : 1;
  const fpsFactor = input.framespersecond / 24;
  const audioFactor = input.generateAudio ? 1.1 : 1;
  const scenarioFactor =
    input.scenario === 'multimodal_reference_video'
      ? 1.2
      : input.scenario === 'image_to_video_first_last_frame'
        ? 1.1
        : 1;

  return Math.round(
    Math.max(
      1,
      9000 * input.duration * resolutionFactor * fpsFactor * audioFactor * scenarioFactor +
        input.multimodalCount * 1200,
    ),
  );
}
```

- [ ] **Step 4: 在 `canvasWorkspace.ts` 为视频节点增加场景、参数与 usage 字段**

```ts
export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  seedanceScenario?: 'text_to_video' | 'image_to_video_first_frame' | 'image_to_video_first_last_frame' | 'multimodal_reference_video';
  videoResolution?: '480p' | '720p' | '1080p';
  videoRatio?: string;
  videoDurationSeconds?: number;
  videoFramesPerSecond?: number;
  videoSeed?: number;
  videoGenerateAudio?: boolean;
  videoReturnLastFrame?: boolean;
  videoPriority?: number;
  estimatedTokenCost?: number;
  settledCompletionTokens?: number;
  settledTotalTokens?: number;
  outputCoverPath?: string;
  outputCoverDataUrl?: string;
};
```

- [ ] **Step 5: 运行测试，确认领域模型通过**

Run: `npm test -- test/unit/seedance.test.ts`  
Expected: PASS

- [ ] **Step 6: 提交本任务**

```bash
git add src/domain/seedance.ts src/app/canvasWorkspace.ts test/unit/seedance.test.ts
git commit -m "feat: 增加 Seedance 场景与能力矩阵"
```

### Task 2: 用 TDD 扩展 Seedance 请求映射与查询结果解析

**Files:**

- Modify: `src/models/generationClient.ts`
- Modify: `test/unit/generationClient.test.ts`
- Reference: `src/domain/seedance.ts`

- [ ] **Step 1: 先补失败测试，覆盖场景映射、1080p 限制和 usage 解析**

```ts
it('builds first-last-frame seedance requests', () => {
  const result = buildGenerationRequest({
    canvas: {
      ...canvas,
      nodes: canvas.nodes.map((node) =>
        node.id === 'video_1'
          ? {
              ...node,
              prompt: 'Keep the camera slow',
              seedanceScenario: 'image_to_video_first_last_frame',
              videoResolution: '720p',
              videoDurationSeconds: 5,
              videoFramesPerSecond: 24,
            }
          : node,
      ),
      edges: [
        { id: 'edge_first', fromNodeId: 'image_asset_1', toNodeId: 'video_1' },
        { id: 'edge_last', fromNodeId: 'image_asset_2', toNodeId: 'video_1' },
      ],
    },
    nodeId: 'video_1',
    provider: seedanceProvider,
    token: 'token',
  });

  expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
    resolution: '720p',
    duration: 5,
    framespersecond: 24,
    content: [
      { type: 'text', text: 'Keep the camera slow' },
      { type: 'image_url', image_url: { role: 'first_frame' } },
      { type: 'image_url', image_url: { role: 'last_frame' } },
    ],
  });
});

it('rejects 1080p for seedance2.0-fast', () => {
  const result = buildGenerationRequest({
    canvas: {
      ...canvas,
      nodes: canvas.nodes.map((node) =>
        node.id === 'video_1'
          ? { ...node, modelId: 'seedance2.0-fast', videoResolution: '1080p' }
          : node,
      ),
    },
    nodeId: 'video_1',
    provider: seedanceProvider,
    token: 'token',
  });

  expect(result).toEqual({
    ok: false,
    error: '当前模型不支持所选视频分辨率：1080p',
  });
});

it('parses settled token usage from seedance task responses', async () => {
  const fetcher = vi.fn<GenerationFetch>(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'task_1',
      status: 'succeeded',
      content: { video_url: 'https://example.com/video.mp4' },
      usage: { completion_tokens: 108900, total_tokens: 108900 },
    }),
  }));

  const result = await submitGenerationNode({
    canvas,
    nodeId: 'video_1',
    provider: seedanceProvider,
    token: 'token',
    fetcher,
  });

  expect(result).toMatchObject({
    ok: true,
    output: {
      kind: 'video-task',
      taskId: 'task_1',
      status: 'succeeded',
      videoUrl: 'https://example.com/video.mp4',
      completionTokens: 108900,
      totalTokens: 108900,
    },
  });
});
```

- [ ] **Step 2: 运行单测，确认当前简化实现失败**

Run: `npm test -- test/unit/generationClient.test.ts`  
Expected: FAIL，至少出现“缺少 role 映射”或“输出结构不包含 completionTokens”

- [ ] **Step 3: 在 `generationClient.ts` 补齐视频节点请求体与返回值类型**

```ts
type SeedanceVideoTaskOutput = {
  kind: 'video-task';
  taskId?: string;
  status?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  completionTokens?: number;
  totalTokens?: number;
  rawResponse: unknown;
};

function buildSeedanceVideoTaskRequest(
  provider: ProviderConfig,
  token: string,
  providerModelId: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
): GenerationRequest {
  const scenario = node.seedanceScenario ?? 'text_to_video';
  const requestBody = buildSeedanceRequestBody({ providerModelId, prompt, node, canvas, scenario });

  return {
    url: `${normalizeBaseURL(provider.baseURL, false)}/api/v3/contents/generations/tasks`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    responseKind: 'video-task',
  };
}

function videoTask(rawResponse: unknown) {
  const data = isRecord(rawResponse) && isRecord(rawResponse.data) ? rawResponse.data : rawResponse;
  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : undefined;
  const content = isRecord(data) && isRecord(data.content) ? data.content : undefined;

  return {
    taskId: isRecord(data) ? stringField(data, ['id', 'task_id']) : undefined,
    status: isRecord(data) ? stringField(data, ['status']) : undefined,
    videoUrl: content ? stringField(content, ['video_url', 'url']) : undefined,
    lastFrameUrl: content ? stringField(content, ['last_frame_url']) : undefined,
    completionTokens:
      usage && typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined,
    totalTokens: usage && typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
  };
}
```

- [ ] **Step 4: 加入模型能力校验与场景内容组装**

```ts
if (node.kind === 'video') {
  const resolution = node.videoResolution ?? '720p';
  const capabilities = getSeedanceCapabilities(node.modelId as 'seedance2.0' | 'seedance2.0-fast');

  if (!capabilities.supportedResolutions.includes(resolution)) {
    return { ok: false, error: `当前模型不支持所选视频分辨率：${resolution}` };
  }
}

function buildSeedanceRequestBody(input: {
  providerModelId: string;
  prompt: string;
  node: CanvasNodeView;
  canvas: CanvasView;
  scenario: SeedanceScenario;
}) {
  const content = [{ type: 'text', text: input.prompt }];
  const references = collectSeedanceScenarioAssets(input.node, input.canvas, input.scenario);

  return {
    model: input.providerModelId,
    content: [...content, ...references],
    resolution: input.node.videoResolution ?? '720p',
    ratio: input.node.videoRatio,
    duration: input.node.videoDurationSeconds ?? 5,
    framespersecond: input.node.videoFramesPerSecond ?? 24,
    seed: input.node.videoSeed,
    return_last_frame: input.node.videoReturnLastFrame ?? false,
    generate_audio: input.node.videoGenerateAudio ?? true,
    priority: input.node.videoPriority,
  };
}
```

- [ ] **Step 5: 重新运行请求映射测试**

Run: `npm test -- test/unit/generationClient.test.ts`  
Expected: PASS

- [ ] **Step 6: 提交本任务**

```bash
git add src/models/generationClient.ts test/unit/generationClient.test.ts
git commit -m "feat: 扩展 Seedance 视频请求与结果解析"
```

### Task 3: 新增 5 秒轮询控制层

**Files:**

- Create: `src/models/seedanceTaskTracker.ts`
- Create: `test/unit/seedanceTaskTracker.test.ts`

- [ ] **Step 1: 先写失败测试，固定 5 秒轮询与终态停止**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSeedanceTaskTracker } from '../../src/models/seedanceTaskTracker';

describe('seedance task tracker', () => {
  it('polls every 5 seconds and stops on succeeded', async () => {
    vi.useFakeTimers();
    const getTask = vi
      .fn()
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'succeeded', videoUrl: 'https://example.com/video.mp4' });
    const onFinished = vi.fn();

    const tracker = createSeedanceTaskTracker({ getTask });
    tracker.start({ taskId: 'task_1', onUpdate: vi.fn(), onFinished, onFailed: vi.fn() });

    await vi.advanceTimersByTimeAsync(15000);

    expect(getTask).toHaveBeenCalledTimes(3);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
    tracker.stop();
  });
});
```

- [ ] **Step 2: 运行测试，确认 tracker 尚不存在**

Run: `npm test -- test/unit/seedanceTaskTracker.test.ts`  
Expected: FAIL，提示模块不存在

- [ ] **Step 3: 实现最小轮询控制器**

```ts
export function createSeedanceTaskTracker(input: {
  getTask(taskId: string): Promise<{ status?: string; [key: string]: unknown }>;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function tick(options: {
    taskId: string;
    onUpdate(task: { status?: string; [key: string]: unknown }): void;
    onFinished(task: { status?: string; [key: string]: unknown }): void;
    onFailed(task: { status?: string; [key: string]: unknown }): void;
  }) {
    if (stopped) {
      return;
    }

    const task = await input.getTask(options.taskId);
    options.onUpdate(task);

    if (task.status === 'succeeded') {
      options.onFinished(task);
      return;
    }
    if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired') {
      options.onFailed(task);
      return;
    }

    timer = setTimeout(() => {
      void tick(options);
    }, 5000);
  }

  return {
    start(options: Parameters<typeof tick>[0]) {
      stopped = false;
      void tick(options);
    },
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
```

- [ ] **Step 4: 运行轮询测试**

Run: `npm test -- test/unit/seedanceTaskTracker.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add src/models/seedanceTaskTracker.ts test/unit/seedanceTaskTracker.test.ts
git commit -m "feat: 增加 Seedance 任务轮询控制器"
```

### Task 4: 扩展本地文件保存，支持视频结果与末帧封面

**Files:**

- Modify: `src/storage/browserFolderStore.ts`
- Modify: `test/unit/browserFolderStore.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖视频 blob 保存和封面目录**

```ts
it('saves fetched video output into assets/videos', async () => {
  const result = await saveGeneratedMediaBlobToCanvasFolder(rootHandle, canvas, {
    blob: new Blob(['video'], { type: 'video/mp4' }),
    fileName: 'task_1.mp4',
    kind: 'video',
  });

  expect(result.assetPath).toBe('assets/videos/task_1.mp4');
});

it('saves last frame cover into assets/covers', async () => {
  const result = await saveGeneratedMediaBlobToCanvasFolder(rootHandle, canvas, {
    blob: new Blob(['image'], { type: 'image/png' }),
    fileName: 'task_1.png',
    kind: 'cover',
  });

  expect(result.assetPath).toBe('assets/covers/task_1.png');
});
```

- [ ] **Step 2: 运行存储测试，确认 `cover` 类型未实现**

Run: `npm test -- test/unit/browserFolderStore.test.ts`  
Expected: FAIL，提示类型不兼容或路径错误

- [ ] **Step 3: 在 `browserFolderStore.ts` 新增通用生成结果保存入口**

```ts
export async function saveGeneratedMediaBlobToCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  input: {
    blob: Blob;
    fileName: string;
    kind: 'image' | 'video' | 'cover';
  },
): Promise<{ assetName: string; assetPath: string; mimeType: string }> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  const mediaDirName =
    input.kind === 'video' ? 'videos' : input.kind === 'cover' ? 'covers' : 'images';
  const mediaDir = await assetsDir.getDirectoryHandle(mediaDirName, { create: true });
  const extension = getExtensionFromMimeType(input.blob.type, input.kind === 'video' ? 'video' : 'image');
  const assetName = await makeUniqueFileName(mediaDir, ensureFileExtension(input.fileName, extension));
  const fileHandle = await mediaDir.getFileHandle(assetName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(input.blob);
  await writable.close();

  return {
    assetName,
    assetPath: `assets/${mediaDirName}/${assetName}`,
    mimeType: input.blob.type,
  };
}
```

- [ ] **Step 4: 运行存储测试**

Run: `npm test -- test/unit/browserFolderStore.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add src/storage/browserFolderStore.ts test/unit/browserFolderStore.test.ts
git commit -m "feat: 支持 Seedance 视频结果本地保存"
```

### Task 5: 接入视频节点 UI、场景预设面板与 token 展示

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`
- Modify: `test/unit/App.test.tsx`
- Reference: `src/domain/seedance.ts`
- Reference: `src/models/seedanceTaskTracker.ts`

- [ ] **Step 1: 先写组件失败测试，覆盖场景切换、1080p 隐藏和 usage 展示**

```tsx
it('shows scene preset controls for video nodes', async () => {
  render(<App />);
  await userEvent.click(screen.getByText('seedance2.0 生成节点'));

  expect(screen.getByRole('button', { name: '文生视频' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '首尾帧图生视频' })).toBeInTheDocument();
});

it('does not show 1080p for seedance2.0-fast', async () => {
  render(<App />);
  await userEvent.click(screen.getByText('seedance2.0 生成节点'));
  await userEvent.selectOptions(screen.getByLabelText('模型'), 'seedance2.0-fast');

  expect(screen.queryByRole('option', { name: '1080p' })).not.toBeInTheDocument();
});

it('renders estimated and settled token usage for video nodes', async () => {
  render(<App />);
  expect(screen.getByText(/预计消耗：/)).toBeInTheDocument();
  expect(screen.getByText(/实际消耗：等待官方结算/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行组件测试，确认新面板不存在**

Run: `npm test -- test/unit/App.test.tsx`  
Expected: FAIL，提示按钮或文案不存在

- [ ] **Step 3: 在 `App.tsx` 为视频节点增加场景预设状态与字段过滤**

```tsx
const visibleVideoFields =
  activeNode?.kind === 'video'
    ? getVisibleSeedanceFields({
        model: (activeNode.modelId as 'seedance2.0' | 'seedance2.0-fast') ?? 'seedance2.0',
        scenario: activeNode.seedanceScenario ?? 'text_to_video',
      })
    : [];

function updateVideoNode(nodeId: string, patch: Partial<CanvasNodeView>) {
  setWorkspace((current) => ({
    ...current,
    canvases: current.canvases.map((canvas) =>
      canvas.id !== activeCanvas.id
        ? canvas
        : {
            ...canvas,
            nodes: canvas.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
          },
    ),
  }));
}

function refreshEstimatedVideoTokens(node: CanvasNodeView) {
  return estimateSeedanceTokens({
    model: (node.modelId as 'seedance2.0' | 'seedance2.0-fast') ?? 'seedance2.0',
    resolution: node.videoResolution ?? '720p',
    duration: node.videoDurationSeconds ?? 5,
    framespersecond: node.videoFramesPerSecond ?? 24,
    scenario: node.seedanceScenario ?? 'text_to_video',
    generateAudio: node.videoGenerateAudio ?? true,
    multimodalCount: countVideoReferences(node),
  });
}
```

- [ ] **Step 4: 在视频节点面板中渲染场景按钮、动态字段与 token 区**

```tsx
<div className="video-scene-picker" role="tablist" aria-label="视频生成场景">
  {[
    ['text_to_video', '文生视频'],
    ['image_to_video_first_frame', '首帧图生视频'],
    ['image_to_video_first_last_frame', '首尾帧图生视频'],
    ['multimodal_reference_video', '多模态参考视频'],
  ].map(([value, label]) => (
    <button
      key={value}
      type="button"
      className={activeNode.seedanceScenario === value ? 'is-active' : ''}
      onClick={() =>
        updateVideoNode(activeNode.id, {
          seedanceScenario: value as CanvasNodeView['seedanceScenario'],
        })
      }
    >
      {label}
    </button>
  ))}
</div>

<p className="video-usage-line">预计消耗：{activeNode.estimatedTokenCost ?? 0} tokens（本地预估）</p>
<p className="video-usage-line">
  实际消耗：
  {typeof activeNode.settledTotalTokens === 'number'
    ? `${activeNode.settledCompletionTokens} completion tokens / ${activeNode.settledTotalTokens} total tokens`
    : '等待官方结算'}
</p>
```

- [ ] **Step 5: 在 `App.css` 补齐场景切换与 usage 样式**

```css
.video-scene-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.video-scene-picker button {
  min-height: 34px;
  border-radius: 8px;
}

.video-scene-picker button.is-active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.video-usage-line {
  margin: 6px 0 0;
  font-size: 12px;
  color: #475569;
}
```

- [ ] **Step 6: 运行组件测试**

Run: `npm test -- test/unit/App.test.tsx`  
Expected: PASS

- [ ] **Step 7: 提交本任务**

```bash
git add src/app/App.tsx src/app/App.css test/unit/App.test.tsx
git commit -m "feat: 增加 Seedance 视频节点场景预设面板"
```

### Task 6: 串起提交、轮询、落盘与最终状态回写

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `test/unit/App.test.tsx`
- Reference: `src/models/seedanceTaskTracker.ts`
- Reference: `src/storage/browserFolderStore.ts`

- [ ] **Step 1: 先写失败测试，覆盖“提交后轮询并保存本地视频”主链路**

```tsx
it('polls seedance tasks and saves local video on success', async () => {
  const submitGenerationNodeMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      output: { kind: 'video-task', taskId: 'task_1', status: 'queued', rawResponse: {} },
    });
  const getTaskMock = vi
    .fn()
    .mockResolvedValueOnce({ status: 'running' })
    .mockResolvedValueOnce({
      status: 'succeeded',
      videoUrl: 'https://example.com/video.mp4',
      completionTokens: 108900,
      totalTokens: 108900,
    });
  const saveGeneratedMediaBlobToCanvasFolderMock = vi.fn().mockResolvedValue({
    assetPath: 'assets/videos/task_1.mp4',
    assetName: 'task_1.mp4',
    mimeType: 'video/mp4',
  });

  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => {
    expect(screen.getByText(/实际消耗：108900 completion tokens/)).toBeInTheDocument();
  });
  expect(saveGeneratedMediaBlobToCanvasFolderMock).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行主链路测试，确认现在没有轮询与保存回写**

Run: `npm test -- test/unit/App.test.tsx`  
Expected: FAIL，提示未调用保存函数或文案未更新

- [ ] **Step 3: 在 `App.tsx` 接入 tracker，并在成功后下载视频与末帧**

```tsx
const seedanceTrackerRef = useRef(createSeedanceTaskTracker({ getTask: querySeedanceTask }));

async function handleSeedanceTaskSuccess(node: CanvasNodeView, task: SeedanceTaskResult) {
  const videoBlob = task.videoUrl ? await (await fetch(task.videoUrl)).blob() : null;
  const savedVideo =
    videoBlob && rootDirectoryHandle
      ? await saveGeneratedMediaBlobToCanvasFolder(rootDirectoryHandle, activeCanvas, {
          blob: videoBlob,
          fileName: `${task.taskId}.mp4`,
          kind: 'video',
        })
      : null;

  updateVideoNode(node.id, {
    generationStatus: 'succeeded',
    outputUrl: task.videoUrl,
    outputPath: savedVideo?.assetPath,
    settledCompletionTokens: task.completionTokens,
    settledTotalTokens: task.totalTokens,
  });
}

function trackSeedanceNode(node: CanvasNodeView, taskId: string) {
  seedanceTrackerRef.current.start({
    taskId,
    onUpdate(task) {
      updateVideoNode(node.id, {
        generationStatus: task.status === 'queued' ? 'running' : (task.status as CanvasNodeView['generationStatus']),
      });
    },
    onFinished(task) {
      void handleSeedanceTaskSuccess(node, task as SeedanceTaskResult);
    },
    onFailed(task) {
      updateVideoNode(node.id, {
        generationStatus: 'failed',
        generationError: task.error?.message ?? '视频生成失败',
      });
    },
  });
}
```

- [ ] **Step 4: 提交动作中写回预估 token，并在拿到 taskId 后启动轮询**

```tsx
if (result.ok && result.output.kind === 'video-task' && result.output.taskId) {
  updateVideoNode(node.id, {
    generationStatus: 'running',
    generationId: result.output.taskId,
    estimatedTokenCost: refreshEstimatedVideoTokens(node),
  });
  trackSeedanceNode(node, result.output.taskId);
}
```

- [ ] **Step 5: 运行组件测试与主链路测试**

Run: `npm test -- test/unit/App.test.tsx`  
Expected: PASS

- [ ] **Step 6: 跑一轮完整类型检查与单测**

Run: `npm run lint && npm test`  
Expected: TypeScript 通过，Vitest 全绿

- [ ] **Step 7: 提交本任务**

```bash
git add src/app/App.tsx test/unit/App.test.tsx
git commit -m "feat: 串起 Seedance 视频轮询与本地保存流程"
```

## Spec 覆盖检查

- 场景预设面板：Task 1 + Task 5
- 模型能力矩阵：Task 1
- 完整请求映射：Task 2
- 5 秒轮询：Task 3 + Task 6
- 本地预估 token：Task 1 + Task 5 + Task 6
- 官方结算 token：Task 2 + Task 6
- 视频保存到本地：Task 4 + Task 6
- `seedance2.0-fast` 不显示 `1080p`：Task 1 + Task 2 + Task 5
- 错误态与终态处理：Task 2 + Task 3 + Task 6

## 自检结论

- 已覆盖 spec 中的所有核心要求
- 计划中未保留 `TODO`、`TBD`、占位描述
- 类型名在任务之间保持一致：
  - `SeedanceScenario`
  - `getSeedanceCapabilities`
  - `estimateSeedanceTokens`
  - `createSeedanceTaskTracker`
  - `saveGeneratedMediaBlobToCanvasFolder`
