import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import {
  createCanvasEdge,
  createWorkspaceState,
  serializeWorkspaceState,
  type CanvasWorkspaceState,
} from '../../src/app/canvasWorkspace';

const workspaceStorageKey = 'shot-agent:canvas-workspace';
const providerStorageKey = 'shot-agent:providers';

function createDefaultVideoWorkspaceState(): CanvasWorkspaceState {
  return {
    ...createWorkspaceState([
      {
        id: 'canvas_default_video',
        name: '默认画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_video_1',
            title: '视频生成',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 520,
            y: 240,
          },
        ],
        edges: [],
      },
    ]),
  };
}

function seedDefaultVideoWorkspace() {
  window.localStorage.setItem(
    workspaceStorageKey,
    serializeWorkspaceState(createDefaultVideoWorkspaceState()),
  );
}

async function openNodeInspectorByTitle(title: string) {
  const headings = await screen.findAllByRole('heading', { name: title });
  const canvasHeading = headings.find((heading) => heading.closest('article'));

  expect(canvasHeading).toBeTruthy();

  const nodeCard = canvasHeading!.closest('article');
  expect(nodeCard).toBeTruthy();

  await userEvent.click(within(nodeCard!).getByRole('button', { name: '打开节点配置' }));
  return nodeCard!;
}

function setPromptEditorValue(editor: HTMLDivElement, value: string) {
  editor.focus();
  editor.textContent = value;

  const selection = window.getSelection();
  const range = document.createRange();
  if (editor.firstChild) {
    range.setStart(editor.firstChild, value.length);
  } else {
    range.selectNodeContents(editor);
  }
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

  fireEvent.input(editor);
}

describe('App image preview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'PointerEvent',
      class PointerEvent extends MouseEvent {
        pointerId: number;

        constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
        }
      },
    );

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('keeps asset panel wheel events scrollable inside the canvas', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '资产' }));

    const assetPanel = document.querySelector('.canvas-asset-sidebar');
    expect(assetPanel).toBeTruthy();

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });

    assetPanel!.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
  });

  it('opens the shared image preview modal when a node image is double-clicked', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_images',
          name: '图片画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'asset_1',
              title: '素材图',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'image_1',
              title: '生成图',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 360,
              y: 0,
              outputDataUrl: 'data:image/png;base64,b3V0cHV0',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));
    expect(document.querySelector('.prompt-reference-image-modal img')?.getAttribute('src')).toBe(
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();

    fireEvent.pointerDown(document.querySelector('.prompt-reference-image-backdrop')!);

    fireEvent.doubleClick(await screen.findByAltText('生成图 输出'));
    expect(document.querySelector('.prompt-reference-image-modal img')?.getAttribute('src')).toBe(
      'data:image/png;base64,b3V0cHV0',
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });

  it('supports zooming the preview image with wheel and toolbar controls', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_images',
          name: '图片画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'asset_1',
              title: '素材图',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));

    const zoomOutButton = screen.getByRole('button', { name: '缩小图片' });
    const zoomInButton = screen.getByRole('button', { name: '放大图片' });
    const resetZoomButton = screen.getByRole('button', { name: '重置图片缩放' });
    const previewStage = document.querySelector('.prompt-reference-image-stage') as HTMLDivElement;
    const previewImage = document.querySelector('.prompt-reference-image-preview') as HTMLImageElement;
    vi.spyOn(previewStage, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(previewStage, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(previewStage, 'clientHeight', { configurable: true, value: 300 });
    previewStage.scrollLeft = 20;
    previewStage.scrollTop = 10;

    expect(screen.getByRole('button', { name: '当前缩放 100%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('100%');

    fireEvent.wheel(previewStage, { deltaY: -48, clientX: 100, clientY: 50 });
    expect(screen.getByRole('button', { name: '当前缩放 110%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('110%');
    expect(previewStage.scrollLeft).toBe(32);
    expect(previewStage.scrollTop).toBe(16);

    await userEvent.click(zoomInButton);
    expect(screen.getByRole('button', { name: '当前缩放 120%' })).toBeTruthy();

    await userEvent.click(zoomOutButton);
    expect(screen.getByRole('button', { name: '当前缩放 110%' })).toBeTruthy();

    for (let index = 0; index < 60; index += 1) {
      fireEvent.wheel(previewStage!, { deltaY: -48 });
    }
    expect(screen.getByRole('button', { name: '当前缩放 500%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('500%');

    for (let index = 0; index < 80; index += 1) {
      fireEvent.wheel(previewStage!, { deltaY: 48 });
    }
    expect(screen.getByRole('button', { name: '当前缩放 50%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('50%');

    await userEvent.click(resetZoomButton);
    expect(screen.getByRole('button', { name: '当前缩放 100%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('100%');
  });

  it('supports dragging a zoomed image and requesting fullscreen preview', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_images',
          name: '图片画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'asset_1',
              title: '素材图',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));

    const previewStage = document.querySelector('.prompt-reference-image-stage') as HTMLDivElement;
    Object.defineProperty(previewStage, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(previewStage, 'clientHeight', { configurable: true, value: 300 });

    await userEvent.click(screen.getByRole('button', { name: '放大图片' }));
    await userEvent.click(screen.getByRole('button', { name: '放大图片' }));

    previewStage.scrollLeft = 120;
    previewStage.scrollTop = 80;

    fireEvent.pointerDown(previewStage, { pointerId: 1, button: 0, clientX: 120, clientY: 80 });
    fireEvent.pointerMove(previewStage, { pointerId: 1, clientX: 90, clientY: 60 });

    expect(previewStage.scrollLeft).toBe(150);
    expect(previewStage.scrollTop).toBe(100);

    fireEvent.pointerUp(previewStage, { pointerId: 1, clientX: 90, clientY: 60 });

    await userEvent.click(screen.getByRole('button', { name: '全屏查看图片' }));
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalled();
  });

  it('shows succeeded video generation history in provider manager for volcengine providers', async () => {
    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_seedance',
          name: '火山方舟',
          protocol: 'volcengine',
          baseURL: 'https://ark.cn-beijing.volces.com',
          apiTokenRef: 'sk-test-seedance',
          enabled: true,
          models: [
            {
              providerModelId: 'doubao-seedance-2-0-260128',
              canonicalModelId: 'seedance2.0',
              enabled: true,
            },
          ],
        },
      ]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            total: 1,
            tasks: [
              {
                id: 'task_history_1',
                model: 'doubao-seedance-2-0-260128',
                status: 'succeeded',
                created_at: 1_717_799_003,
                updated_at: 1_717_799_123,
                content: {
                  video_url: 'https://example.com/history.mp4',
                  last_frame_url: 'https://example.com/history.png',
                },
                usage: {
                  completion_tokens: 3456,
                },
                ratio: '16:9',
                duration: 5,
              },
            ],
          },
        }),
      }),
    );

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '供应商管理' }));

    expect(await screen.findByText('视频生成历史')).toBeTruthy();
    expect(await screen.findByText('共 1 条成功任务')).toBeTruthy();
    expect(await screen.findByText(/task_history_1/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '打开视频' }).getAttribute('href')).toBe(
      'https://example.com/history.mp4',
    );
    expect(screen.getByText('第 1 / 1 页')).toBeTruthy();
  });
});

describe('App object storage settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('does not show Cloudflare configuration in the application UI', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /供应商管理/ }));

    expect(screen.queryByRole('button', { name: /Cloudflare/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Cloudflare/ })).toBeNull();
    expect(screen.queryByLabelText(/Bucket/)).toBeNull();
  });
});

describe('App empty startup', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('starts without a default canvas for new users', () => {
    render(<App />);

    expect(screen.getAllByText('暂无画布').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /新建画布/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('默认画布')).toBeNull();
  });

  it('removes legacy starter canvases from stored browser state', () => {
    const state = createWorkspaceState([
      {
        id: 'canvas_default',
        name: '默认画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_image',
            title: '图片生成',
            modelId: 'gpt-image-2',
            kind: 'image',
            x: 0,
            y: 0,
          },
          {
            id: 'node_video',
            title: '视频生成',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 360,
            y: 0,
          },
          {
            id: 'node_chat',
            title: '文本生成',
            modelId: 'gpt-4o-mini',
            kind: 'chat',
            x: 720,
            y: 0,
          },
        ],
        edges: [],
      },
      {
        id: 'canvas_product',
        name: '产品短片',
        updatedAt: '示例',
        nodes: [],
        edges: [],
      },
      {
        id: 'canvas_user',
        name: '用户画布',
        updatedAt: 'now',
        nodes: [],
        edges: [],
      },
    ]);

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    expect(screen.queryByText('默认画布')).toBeNull();
    expect(screen.queryByText('产品短片')).toBeNull();
    expect(screen.getAllByText('用户画布').length).toBeGreaterThan(0);
  });
});

describe('App video node inspector', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_ASSET_UPLOAD_ENDPOINT', '');
    vi.stubEnv('VITE_R2_ACCOUNT_ID', '');
    vi.stubEnv('VITE_R2_BUCKET_NAME', '');
    vi.stubEnv('VITE_R2_ACCESS_KEY_ID', '');
    vi.stubEnv('VITE_R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('VITE_R2_ENDPOINT', '');
    vi.stubEnv('VITE_R2_PUBLIC_BASE_URL', '');
    window.localStorage.clear();
    seedDefaultVideoWorkspace();

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('shows scene preset controls for video nodes', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    expect(screen.getByLabelText('类型')).toBeTruthy();
    expect(screen.queryByText('节点名称')).toBeNull();
    expect(screen.getAllByText('模式').length).toBeGreaterThan(0);
  });

  it('does not show 1080p for seedance2.0-fast', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await userEvent.selectOptions(screen.getByLabelText('模型'), 'seedance2.0-fast');

    expect(screen.queryByRole('option', { name: '1080p' })).toBeNull();
  });

  it('renders estimated and settled token usage for video nodes', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    expect(screen.getByText(/预计消耗：/)).toBeTruthy();
    expect(screen.getByText(/实际消耗：等待官方结算/)).toBeTruthy();
  });

  it('renders duration slider, auto-duration toggle, ratio options, and fixed fps', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationInput = screen.getByLabelText('时长');
    const ratioSelect = screen.getByLabelText('比例') as HTMLSelectElement;
    const autoDurationToggle = screen.getByLabelText('自动时长') as HTMLInputElement;

    expect(durationInput.getAttribute('type')).toBe('range');
    expect(durationInput.className).toContain('video-duration-range');
    expect(durationInput.getAttribute('min')).toBe('4');
    expect(durationInput.getAttribute('max')).toBe('15');
    expect(durationInput.getAttribute('step')).toBe('1');
    expect(autoDurationToggle.checked).toBe(false);
    expect(autoDurationToggle.getAttribute('title')).toBe('自动时长');
    expect(screen.queryByText('自动时长')).toBeNull();
    expect(screen.queryByText('4s')).toBeNull();
    expect(screen.queryByText('15s')).toBeNull();
    expect(
      Array.from(ratioSelect.options).map((option) => option.value),
    ).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);
    expect(screen.getByLabelText('帧率 24fps（官方固定）')).toBeTruthy();
  });

  it('keeps the duration label and current value on one line without slider edge markers', async () => {
    const { container } = render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationRow = container.querySelector('.video-duration-row') as HTMLDivElement | null;
    const durationLabel = container.querySelector(
      '.video-duration-label',
    ) as HTMLLabelElement | null;

    expect(durationRow).toBeTruthy();
    expect(durationLabel).toBeTruthy();
    expect(screen.queryByText('15s')).toBeNull();
    expect(durationRow?.textContent).toContain('时长');
    expect(durationRow?.textContent).toContain('5s');
  });

  it('disables the duration slider when auto duration is enabled', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationInput = screen.getByLabelText('时长') as HTMLInputElement;
    const autoDurationToggle = screen.getByLabelText('自动时长') as HTMLInputElement;

    expect(durationInput.disabled).toBe(false);
    await userEvent.click(autoDurationToggle);
    expect(autoDurationToggle.checked).toBe(true);
    expect(durationInput.disabled).toBe(true);
  });

  it('shows selected video settings on the node card outside the inspector', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_meta',
          name: '视频参数画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              videoResolution: '1080p',
              videoRatio: '21:9',
              videoDurationSeconds: -1,
              videoFramesPerSecond: 24,
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const badgeRegion = container.querySelector(
      '.canvas-node-video .node-video-settings-meta',
    ) as HTMLDivElement | null;

    expect(badgeRegion).toBeTruthy();
    expect(within(badgeRegion!).getByText('1080p')).toBeTruthy();
    expect(within(badgeRegion!).getByText('21:9')).toBeTruthy();
    expect(within(badgeRegion!).getByText('Auto 时长')).toBeTruthy();
    expect(within(badgeRegion!).getByText('24fps')).toBeTruthy();
  });

  it('shows saved video storage status on the node card and in the inspector', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_storage',
          name: '视频存储画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              outputUrl: 'https://example.com/video.mp4',
              outputPath: 'assets/videos/task_1.mp4',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    expect(screen.getByText('已保存到本地')).toBeTruthy();

    await openNodeInspectorByTitle('视频生成');
    expect(screen.getByText('保存状态：已保存到本地 · assets/videos/task_1.mp4')).toBeTruthy();
  });

  it('shows the submitted Seedance generation id below the generate button', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_generation_id',
          name: '视频生成 ID 画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              generationId: 'task_1',
              generationStatus: 'running',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const videoNode = screen.getByRole('heading', { name: '视频生成' }).closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('生成ID：task_1')).toBeTruthy();
  });

  it('shows role-based input ports for first-last-frame mode', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await userEvent.selectOptions(screen.getByLabelText('类型'), 'image_to_video_first_last_frame');

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('尾帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });

  it('shows multimodal prompt guidance for text, image, video, and audio references', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await userEvent.selectOptions(screen.getByLabelText('类型'), 'multimodal_reference_video');

    expect(
      screen.getByText(
        '多模态参考视频模式下，连线用于提供可引用的参考素材范围；提示词中使用 @文本 / @图片 / @视频 / @音频 引用到的内容才会参与本次请求上传。',
      ),
    ).toBeTruthy();

    const videoPromptEditor = document.querySelector(
      '.canvas-node-video .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(videoPromptEditor?.dataset.placeholder).toBe(
      '输入提示词，支持 @文本 / @图片 / @视频 / @音频；连线仅提供可引用范围，只有提示词中引用的图片、视频和音频才会上传',
    );
  });

  it('keeps the selected scenario after clearing incompatible edges', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_mode',
          name: '视频模式画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_asset_1',
              title: '图片素材',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 320,
              y: 0,
              seedanceScenario: 'image_to_video_first_last_frame',
            },
          ],
          edges: [createCanvasEdge('image_asset_1', 'video_1', 'first_frame_image')],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText('类型'), 'text_to_video');

    expect((screen.getByLabelText('类型') as HTMLSelectElement).value).toBe('text_to_video');
    expect(within(videoNode!).queryByText('首帧图')).toBeNull();
    expect(within(videoNode!).queryByText('尾帧图')).toBeNull();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });

  it('opens inspector only from the config button instead of clicking the node body', async () => {
    render(<App />);

    const headings = await screen.findAllByRole('heading', { name: '视频生成' });
    const canvasHeading = headings.find((heading) => heading.closest('article'));
    expect(canvasHeading).toBeTruthy();

    await userEvent.click(canvasHeading!);
    expect(document.querySelector('.node-inspector')).toBeNull();

    const card = canvasHeading!.closest('article');
    expect(card).toBeTruthy();
    await userEvent.click(within(card!).getByRole('button', { name: '打开节点配置' }));

    expect(document.querySelector('.node-inspector')).toBeTruthy();
    expect(screen.getByLabelText('类型')).toBeTruthy();
  });

  it('defaults to multimodal mode when creating a Seedance node from an image connection', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_add_video',
          name: '新增视频节点',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_asset_1',
              title: '图片素材',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const imageNode = screen.getByRole('heading', { name: '图片素材' }).closest('article');

    expect(canvas).toBeTruthy();
    expect(imageNode).toBeTruthy();

    fireEvent.pointerDown(within(imageNode!).getByRole('button', { name: '从此节点连线' }), {
      button: 0,
      pointerId: 1,
      clientX: 180,
      clientY: 120,
    });
    fireEvent.pointerMove(canvas!, {
      pointerId: 1,
      clientX: 360,
      clientY: 180,
    });
    fireEvent.pointerUp(canvas!, {
      pointerId: 1,
      clientX: 360,
      clientY: 180,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));
    await openNodeInspectorByTitle('视频生成');

    expect((screen.getByLabelText('类型') as HTMLSelectElement).value).toBe(
      'multimodal_reference_video',
    );
  });

  it('hides Seedance-Sora from the model dropdown when object storage is not configured', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    expect(screen.queryByRole('option', { name: 'seedance-sora' })).toBeNull();
    expect(screen.queryByText(/当前模型使用 Sora 格式调用/)).toBeNull();
  });

  it('selects Seedance-Sora from the Seedance video node model dropdown when object storage is configured', async () => {
    vi.stubEnv('VITE_ASSET_UPLOAD_ENDPOINT', 'http://localhost:8787/api/assets/reference-upload');
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    expect(screen.queryByRole('button', { name: 'seedance-sora' })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));

    expect(screen.getByRole('heading', { name: '视频生成' })).toBeTruthy();
    await openNodeInspectorByTitle('视频生成');
    expect(screen.getByLabelText('模型')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('模型'), 'seedance-sora');
    expect((screen.getByLabelText('模型') as HTMLSelectElement).value).toBe('seedance-sora');
    expect((screen.getByLabelText('比例') as HTMLSelectElement).value).toBe('16:9');
    const durationInput = screen.getByLabelText('时长');
    expect(durationInput.getAttribute('min')).toBe('4');
    expect(durationInput.getAttribute('max')).toBe('15');
    expect(screen.getByLabelText('自动时长')).toBeTruthy();
    expect(
      Array.from((screen.getByLabelText('比例') as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);
    expect(screen.queryByText('预计消耗：0 tokens（本地预估）')).toBeNull();
    expect(screen.queryByText('调用格式')).toBeNull();
    expect(screen.getByText(/当前模型使用 Sora 格式调用/)).toBeTruthy();
  });

  it('grows model node width with prompt length and caps it at three times the base width', () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_node_width',
          name: '节点宽度',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_short',
              title: '短提示图片节点',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 0,
              y: 0,
              prompt: '短提示',
            },
            {
              id: 'image_long',
              title: '长提示图片节点',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 360,
              y: 0,
              prompt: '这是一个很长的提示词 '.repeat(40),
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const shortNode = screen.getByRole('heading', { name: '短提示图片节点' }).closest('article');
    const longNode = screen.getByRole('heading', { name: '长提示图片节点' }).closest('article');

    expect(shortNode).toBeTruthy();
    expect(longNode).toBeTruthy();

    const shortWidth = Number.parseFloat(shortNode!.style.width);
    const longWidth = Number.parseFloat(longNode!.style.width);

    expect(shortWidth).toBe(320);
    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeLessThanOrEqual(960);
  });

  it('supports wheel and keyboard selection in the @ reference menu', async () => {
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_reference_menu',
          name: '引用菜单',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'text_1',
              title: '文本素材',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 0,
              y: 0,
              textContent: '这是一段可引用文本',
            },
            {
              id: 'image_asset_1',
              title: '图片素材',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 180,
              assetName: 'reference.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'chat_1',
              title: '提示词整理',
              modelId: 'gpt-5.4-mini',
              kind: 'chat',
              x: 360,
              y: 60,
              prompt: '',
            },
          ],
          edges: [
            createCanvasEdge('text_1', 'chat_1'),
            createCanvasEdge('image_asset_1', 'chat_1'),
          ],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    await openNodeInspectorByTitle('提示词整理');

    const editor = document.querySelector(
      '.node-inspector .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(editor).toBeTruthy();

    setPromptEditorValue(editor!, '@');

    const menu = document.querySelector('.prompt-reference-menu') as HTMLDivElement | null;
    expect(menu).toBeTruthy();

    const buttons = within(menu!).getAllByRole('button');
    expect(buttons[0].className).toContain('is-active');
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.wheel(menu!, { deltaY: 48 });
    expect(buttons[1].className).toContain('is-active');
    expect(screen.getByText('100%')).toBeTruthy();
    expect(scrollIntoViewMock).toHaveBeenCalled();

    fireEvent.keyDown(editor!, { key: 'ArrowUp' });
    fireEvent.keyUp(editor!, { key: 'ArrowUp' });
    expect(buttons[0].className).toContain('is-active');

    fireEvent.keyDown(editor!, { key: 'ArrowDown' });
    fireEvent.keyUp(editor!, { key: 'ArrowDown' });
    expect(buttons[1].className).toContain('is-active');

    fireEvent.mouseEnter(buttons[0]);
    expect(buttons[1].className).toContain('is-active');

    fireEvent.pointerMove(menu!);
    fireEvent.mouseEnter(buttons[0]);
    expect(buttons[0].className).toContain('is-active');

    fireEvent.keyDown(editor!, { key: 'Enter' });
    expect(document.querySelector('.prompt-reference-menu')).toBeNull();
    expect(editor!.querySelector('.prompt-reference-token')).toBeTruthy();
  });
});

describe('App canvas dragging', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    vi.stubGlobal(
      'PointerEvent',
      class PointerEvent extends MouseEvent {
        pointerId: number;

        constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
        }
      },
    );

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('applies node drag deltas from the latest pointer position inside a single batch', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_drag',
          name: '拖动画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_text_1',
              title: '文本节点',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 0,
              y: 0,
              textContent: '拖动测试',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const header = container.querySelector('.canvas-node header') as HTMLElement | null;
    const node = container.querySelector('.canvas-node') as HTMLElement | null;

    expect(canvas).toBeTruthy();
    expect(header).toBeTruthy();
    expect(node).toBeTruthy();

    act(() => {
      fireEvent.pointerDown(header!, {
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      canvas!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          clientX: 110,
          clientY: 100,
        }),
      );
      canvas!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          clientX: 120,
          clientY: 100,
        }),
      );
      canvas!.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 1,
          clientX: 120,
          clientY: 100,
        }),
      );
    });

    expect(node!.style.transform).toContain('translate(20px, 0px)');
  });
});
