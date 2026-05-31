import { getUpstreamNodeIds, type CanvasNodeView, type CanvasView } from '../app/canvasWorkspace';
import {
  defaultImageQuality,
  getImageGenerationSize,
} from '../domain/imageGenerationOptions';
import { getEffectiveOutputText } from '../domain/outputVersions';
import {
  parsePromptReferences,
  replacePromptReferences,
  type PromptReferenceResolution,
} from '../domain/promptReferences';
import {
  mapCanonicalModelToProviderModel,
  type ProviderConfig,
} from '../domain/provider';
import {
  getDefaultSeedanceRatio,
  getSeedanceCapabilities,
  type SeedanceInputPortId,
  type SeedanceModelId,
  type SeedanceScenario,
} from '../domain/seedance';

type ModelNodeKind = 'image' | 'video' | 'chat';

type InputAsset = {
  node: CanvasNodeView;
  role: 'text' | 'reference_image' | 'reference_video' | 'reference_audio';
  content: string;
  token?: string;
  mimeType?: string;
};

type SeedanceConnectedAsset = {
  node: CanvasNodeView;
  portId?: SeedanceInputPortId | 'default';
  content: string;
  mimeType?: string;
};

const chatImageInputLimit = 20;

export type GenerationRequest = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: BodyInit;
  responseKind: 'image' | 'video-task' | 'text';
  streamProtocol?: 'openai' | 'anthropic';
};

export type BuildGenerationRequestInput = {
  canvas: CanvasView;
  nodeId: string;
  provider: ProviderConfig;
  token?: string;
  stream?: boolean;
};

export type BuildGenerationRequestResult =
  | {
      ok: true;
      request: GenerationRequest;
    }
  | {
      ok: false;
      error: string;
    };

export type GenerationOutput =
  | {
      kind: 'image';
      url?: string;
      dataUrl?: string;
      rawResponse: unknown;
    }
  | {
      kind: 'video-task';
      taskId?: string;
      status?: string;
      videoUrl?: string;
      lastFrameUrl?: string;
      completionTokens?: number;
      totalTokens?: number;
      error?: {
        code?: string;
        message?: string;
      };
      rawResponse: unknown;
    }
  | {
      kind: 'text';
      text: string;
      rawResponse: unknown;
    };

export type SubmitGenerationNodeInput = BuildGenerationRequestInput & {
  fetcher?: GenerationFetch;
};

export type QueryGenerationTaskInput = {
  provider: ProviderConfig;
  taskId: string;
  token?: string;
  fetcher?: GenerationFetch;
};

export type QueryGenerationTaskResult =
  | {
      ok: true;
      output: Extract<GenerationOutput, { kind: 'video-task' }>;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      rawResponse?: unknown;
    };

export type VideoGenerationHistoryItem = {
  taskId: string;
  status?: string;
  model?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  completionTokens?: number;
  totalTokens?: number;
  createdAt?: string;
  updatedAt?: string;
  succeededAt?: string;
  durationSeconds?: number;
  ratio?: string;
  rawRecord: unknown;
};

export type ListVideoGenerationTasksInput = {
  provider: ProviderConfig;
  token?: string;
  pageIndex?: number;
  pageSize?: number;
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  fetcher?: GenerationFetch;
};

export type ListVideoGenerationTasksResult =
  | {
      ok: true;
      items: VideoGenerationHistoryItem[];
      pageIndex: number;
      pageSize: number;
      total: number;
      rawResponse: unknown;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      rawResponse?: unknown;
    };

export type StreamGenerationNodeInput = BuildGenerationRequestInput & {
  fetcher?: typeof fetch;
  onDelta(delta: string, fullText: string): void;
};

export type SubmitGenerationNodeResult =
  | {
      ok: true;
      output: GenerationOutput;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      rawResponse?: unknown;
    };

export type GenerationFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}>;

export function getEffectiveNodeOutputText(node: CanvasNodeView): string | undefined {
  return getEffectiveOutputText(node);
}

export function collectGenerationInputAssetIds(input: {
  canvas: CanvasView;
  nodeId: string;
}): string[] {
  const node = input.canvas.nodes.find((current) => current.id === input.nodeId);
  if (!node || !isModelNodeKind(node.kind)) {
    return [];
  }

  const promptInputIds = collectInputAssets(node, input.canvas).map((asset) => asset.node.id);
  const connectedVideoInputIds =
    node.kind === 'video'
      ? collectConnectedVideoHistoryAssetIds(node, input.canvas)
      : [];

  return uniqueAssetIds([...promptInputIds, ...connectedVideoInputIds]);
}

export function resolveProviderToken(
  provider: ProviderConfig,
  env: Record<string, string | undefined> = getViteEnv(),
): string | undefined {
  const directToken = provider.apiTokenRef.trim();
  if (looksLikeDirectToken(directToken)) {
    return directToken;
  }

  const explicit = env[provider.apiTokenRef];
  if (explicit) {
    return explicit;
  }

  const normalizedRef = provider.apiTokenRef
    .replace(/^secret_/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase();
  const protocolKey =
    provider.protocol === 'volcengine'
      ? 'VITE_SEEDANCE_API_KEY'
      : provider.protocol === 'anthropic-compatible'
        ? 'VITE_ANTHROPIC_API_KEY'
        : 'VITE_OPENAI_API_KEY';

  return env[`VITE_${normalizedRef}_API_KEY`] ?? env[protocolKey];
}

function looksLikeDirectToken(value: string): boolean {
  return (
    value.startsWith('sk-') ||
    value.startsWith('ak-') ||
    value.startsWith('Bearer ') ||
    value.length >= 32
  );
}

export function buildGenerationRequest(
  input: BuildGenerationRequestInput,
): BuildGenerationRequestResult {
  const node = input.canvas.nodes.find((current) => current.id === input.nodeId);

  if (!node) {
    return { ok: false, error: '未找到要提交的节点' };
  }

  if (!isModelNodeKind(node.kind)) {
    return { ok: false, error: '资产节点不能直接提交生成请求' };
  }

  if (!input.provider.enabled) {
    return { ok: false, error: '供应商未启用' };
  }

  if (!input.token?.trim()) {
    return { ok: false, error: `缺少供应商密钥：${input.provider.apiTokenRef}` };
  }

  const providerModelId =
    node.providerModelId ??
    mapCanonicalModelToProviderModel(
      input.provider,
      node.modelId,
      getNodeChatFormat(node),
      node.kind === 'chat' ? 'chat' : undefined,
    );
  if (!providerModelId) {
    return { ok: false, error: `供应商未配置模型映射：${node.modelId}` };
  }

  const prompt = buildPrompt(node, input.canvas);
  if (!prompt.trim()) {
    return { ok: false, error: '提交前必须填写提示词' };
  }

  if (node.kind === 'video' && input.provider.protocol === 'volcengine') {
    const validationError = validateSeedanceVideoNode(node, input.canvas);
    if (validationError) {
      return { ok: false, error: validationError };
    }
  }

  if (input.provider.protocol === 'volcengine') {
    if (node.kind !== 'video') {
      return { ok: false, error: '火山方舟当前仅用于视频节点提交' };
    }

    return {
      ok: true,
      request: buildSeedanceVideoTaskRequest(input.provider, input.token, providerModelId, prompt, node, input.canvas),
    };
  }

  if (node.kind === 'chat') {
    const chatImageInputs = collectInputAssets(node, input.canvas).filter(
      (asset) => asset.role === 'reference_image',
    );
    if (chatImageInputs.length > chatImageInputLimit) {
      return {
        ok: false,
        error: `对话节点最多支持 ${chatImageInputLimit} 张图片输入`,
      };
    }

    if (input.provider.protocol === 'anthropic-compatible') {
      return {
        ok: true,
        request: buildAnthropicMessagesRequest(
          input.provider,
          input.token,
          providerModelId,
          prompt,
          node,
          input.canvas,
          input.stream ?? false,
        ),
      };
    }

    if (input.provider.protocol !== 'openai-compatible') {
      return { ok: false, error: `暂不支持的供应商协议：${input.provider.protocol}` };
    }

    return {
      ok: true,
      request: buildOpenAIChatRequest(
        input.provider,
        input.token,
        providerModelId,
        prompt,
        node,
        input.canvas,
        input.stream ?? false,
      ),
    };
  }

  if (input.provider.protocol !== 'openai-compatible') {
    return { ok: false, error: `暂不支持的供应商协议：${input.provider.protocol}` };
  }

  if (node.kind === 'video') {
    return {
      ok: true,
      request: buildOpenAIVideoTaskRequest(input.provider, input.token, providerModelId, prompt, node, input.canvas),
    };
  }

  const imageInputs = collectInputAssets(node, input.canvas).filter(
    (asset) => asset.role === 'reference_image',
  );
  if (imageInputs.some((asset) => !isDataUrl(asset.content))) {
    return {
      ok: false,
      error: '图片生成的 @图片 引用当前需要本地图片数据，暂不支持直接引用远程 URL',
    };
  }

  return {
    ok: true,
    request: buildOpenAIImageRequest(input.provider, input.token, providerModelId, prompt, node, input.canvas),
  };
}

export async function submitGenerationNode(
  input: SubmitGenerationNodeInput,
): Promise<SubmitGenerationNodeResult> {
  const built = buildGenerationRequest(input);
  if (!built.ok) {
    return built;
  }

  if (built.request.responseKind === 'text') {
    return {
      ok: false,
      error: '文本生成必须使用流式接口',
    };
  }

  const fetcher = input.fetcher ?? fetch;
  let response: Awaited<ReturnType<GenerationFetch>>;

  try {
    response = await fetcher(built.request.url, {
      method: built.request.method,
      headers: built.request.headers,
      body: built.request.body,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '提交生成请求失败',
    };
  }

  const rawResponse = await readResponse(response);
  if (!response.ok) {
    return {
      ok: false,
      error: extractErrorMessage(rawResponse) ?? `生成请求失败，HTTP ${response.status}`,
      status: response.status,
      rawResponse,
    };
  }

  return normalizeOutput(built.request.responseKind, rawResponse);
}

export async function queryGenerationTask(
  input: QueryGenerationTaskInput,
): Promise<QueryGenerationTaskResult> {
  if (!input.token?.trim()) {
    return { ok: false, error: `缺少供应商密钥：${input.provider.apiTokenRef}` };
  }

  if (input.provider.protocol !== 'volcengine' && input.provider.protocol !== 'openai-compatible') {
    return { ok: false, error: `当前供应商不支持任务查询：${input.provider.protocol}` };
  }

  const fetcher = input.fetcher ?? fetch;
  let response: Awaited<ReturnType<GenerationFetch>>;
  const taskUrl =
    input.provider.protocol === 'volcengine'
      ? `${normalizeBaseURL(input.provider.baseURL, false)}/api/v3/contents/generations/tasks/${input.taskId}`
      : `${normalizeBaseURL(input.provider.baseURL)}/videos/${input.taskId}`;
  const headers: Record<string, string> =
    input.provider.protocol === 'volcengine'
      ? {
          Authorization: `Bearer ${input.token}`,
          'Content-Type': 'application/json',
        }
      : {
          Authorization: `Bearer ${input.token}`,
        };

  try {
    response = await fetcher(taskUrl, {
      method: 'GET',
      headers,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '查询生成任务失败',
    };
  }

  const rawResponse = await readResponse(response);
  if (!response.ok) {
    return {
      ok: false,
      error: extractErrorMessage(rawResponse) ?? `请求失败（${response.status}）`,
      status: response.status,
      rawResponse,
    };
  }

  const normalized = normalizeOutput('video-task', rawResponse);
  if (!normalized.ok || normalized.output.kind !== 'video-task') {
    return {
      ok: false,
      error: normalized.ok ? '视频任务查询响应格式错误' : normalized.error,
      rawResponse,
    };
  }

  if (!normalized.output.status && !normalized.output.videoUrl) {
    return {
      ok: false,
      error: '视频任务查询响应缺少状态信息',
      rawResponse,
    };
  }

  return { ok: true, output: normalized.output };
}

export async function listVideoGenerationTasks(
  input: ListVideoGenerationTasksInput,
): Promise<ListVideoGenerationTasksResult> {
  if (!input.token?.trim()) {
    return { ok: false, error: `缺少供应商密钥：${input.provider.apiTokenRef}` };
  }

  if (input.provider.protocol !== 'volcengine') {
    return { ok: false, error: `当前供应商不支持历史任务查询：${input.provider.protocol}` };
  }

  const pageIndex = Math.max(1, Math.floor(input.pageIndex ?? 1));
  const pageSize = Math.max(1, Math.floor(input.pageSize ?? 20));
  const status = input.status ?? 'succeeded';
  const fetcher = input.fetcher ?? fetch;
  const query = new URLSearchParams({
    page_num: String(pageIndex),
    page_size: String(pageSize),
    'filter.status': status,
  });

  let response: Awaited<ReturnType<GenerationFetch>>;

  try {
    response = await fetcher(
      `${normalizeBaseURL(input.provider.baseURL, false)}/api/v3/contents/generations/tasks?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.token}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '查询视频生成历史失败',
    };
  }

  const rawResponse = await readResponse(response);
  if (!response.ok) {
    return {
      ok: false,
      error: extractErrorMessage(rawResponse) ?? `请求失败（${response.status}）`,
      status: response.status,
      rawResponse,
    };
  }

  return {
    ok: true,
    items: normalizeVideoTaskHistoryItems(rawResponse),
    pageIndex,
    pageSize,
    total: readVideoTaskHistoryTotal(rawResponse),
    rawResponse,
  };
}

export async function streamChatGenerationNode(
  input: StreamGenerationNodeInput,
): Promise<SubmitGenerationNodeResult> {
  const built = buildGenerationRequest({ ...input, stream: true });
  if (!built.ok) {
    return built;
  }

  const fetcher = input.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(built.request.url, {
      method: built.request.method,
      headers: built.request.headers,
      body: built.request.body,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '提交生成请求失败',
    };
  }

  if (!response.ok) {
    const rawResponse = await readResponse(response);
    return {
      ok: false,
      error: extractErrorMessage(rawResponse) ?? `生成请求失败，HTTP ${response.status}`,
      status: response.status,
      rawResponse,
    };
  }

  if (!response.body) {
    return {
      ok: false,
      error: '流式响应缺少可读取内容',
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let pendingChunk = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    pendingChunk += decoder.decode(value, { stream: true });
    const events = pendingChunk.split(/\r?\n\r?\n/);
    pendingChunk = events.pop() ?? '';

    for (const delta of parseStreamTextDelta(events.join('\n\n'), built.request.streamProtocol)) {
      fullText += delta;
      input.onDelta(delta, fullText);
    }
  }

  for (const delta of parseStreamTextDelta(pendingChunk, built.request.streamProtocol)) {
    fullText += delta;
    input.onDelta(delta, fullText);
  }

  return {
    ok: true,
    output: {
      kind: 'text',
      text: fullText,
      rawResponse: null,
    },
  };
}

export function parseOpenAIStreamTextDelta(chunk: string): string[] {
  return chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .flatMap((line) => {
      const payload = line.slice('data: '.length);

      if (payload === '[DONE]') {
        return [];
      }

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const content = parsed.choices?.[0]?.delta?.content;
        return content ? [content] : [];
      } catch {
        return [];
      }
    });
}

export function parseAnthropicStreamTextDelta(chunk: string): string[] {
  return chunk
    .split(/\r?\n\r?\n/)
    .flatMap((event) =>
      event
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data: '))
        .flatMap((line) => {
          const payload = line.slice('data: '.length);

          try {
            const parsed = JSON.parse(payload) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };

            return parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta.text
              ? [parsed.delta.text]
              : [];
          } catch {
            return [];
          }
        }),
    );
}

function parseStreamTextDelta(
  chunk: string,
  streamProtocol: GenerationRequest['streamProtocol'] = 'openai',
): string[] {
  return streamProtocol === 'anthropic'
    ? parseAnthropicStreamTextDelta(chunk)
    : parseOpenAIStreamTextDelta(chunk);
}

function buildOpenAIImageRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
): GenerationRequest {
  const imageInputs = collectInputAssets(node, canvas).filter(
    (asset) => asset.role === 'reference_image',
  );
  const size = getImageGenerationSize(node.imageResolutionTier, node.imageAspectRatio);
  const quality = node.imageQuality ?? defaultImageQuality;

  if (imageInputs.length > 0) {
    const body = new FormData();
    body.set('model', model);
    body.set('prompt', prompt);
    body.set('n', '1');
    body.set('size', size);
    body.set('quality', quality);
    imageInputs.forEach((asset, index) => {
      const blob = dataUrlToBlob(asset.content, asset.mimeType);
      if (blob) {
        body.append('image[]', blob, `${asset.node.id || `image_${index}`}.png`);
      }
    });

    return {
      url: `${normalizeBaseURL(provider.baseURL)}/images/edits`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
      responseKind: 'image',
    };
  }

  return {
    url: `${normalizeBaseURL(provider.baseURL)}/images/generations`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality,
    }),
    responseKind: 'image',
  };
}

function buildOpenAIChatRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
  stream: boolean,
): GenerationRequest {
  const imageInputs = collectInputAssets(node, canvas).filter(
    (asset) => asset.role === 'reference_image',
  );
  const content =
    imageInputs.length > 0
      ? [
          { type: 'text', text: prompt },
          ...imageInputs.map((asset) => ({
            type: 'image_url',
            image_url: { url: asset.content },
          })),
        ]
      : prompt;

  return {
    url: `${normalizeBaseURL(provider.baseURL)}/chat/completions`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      ...(stream ? { stream: true } : {}),
    }),
    responseKind: 'text',
    streamProtocol: 'openai',
  };
}

function buildOpenAIVideoTaskRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
): GenerationRequest {
  const body = new FormData();
  const metadata = buildOpenAIVideoMetadata(node, canvas);
  const referenceImage = collectOpenAIVideoReferenceImages(node, canvas)[0];

  body.set('prompt', prompt);
  body.set('model', model);
  body.set('seconds', String(getOpenAIVideoSeconds(node)));
  body.set('size', getOpenAIVideoSize(node));

  if (referenceImage) {
    if (isDataUrl(referenceImage.content)) {
      const blob = dataUrlToBlob(referenceImage.content, referenceImage.mimeType);
      if (blob) {
        body.set(
          'input_reference',
          blob,
          getOpenAIVideoReferenceFilename(referenceImage.node, referenceImage.mimeType),
        );
      }
    } else if (isRemoteUrl(referenceImage.content) && !metadata.img_url) {
      metadata.img_url = referenceImage.content;
    }
  }

  if (Object.keys(metadata).length > 0) {
    body.set('metadata', JSON.stringify(metadata));
  }

  return {
    url: `${normalizeBaseURL(provider.baseURL)}/videos`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
    responseKind: 'video-task',
  };
}

function buildOpenAIVideoMetadata(
  node: CanvasNodeView,
  canvas: CanvasView,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const imageAssets = collectConnectedSeedanceAssets(node, canvas).filter(
    (asset) => asset.node.kind === 'image' || asset.node.kind === 'imageAsset',
  );

  for (const asset of imageAssets) {
    if (!isRemoteUrl(asset.content)) {
      continue;
    }

    if (asset.portId === 'first_frame_image') {
      metadata.first_frame_url = asset.content;
    } else if (asset.portId === 'last_frame_image') {
      metadata.last_frame_url = asset.content;
    } else if (!metadata.img_url) {
      metadata.img_url = asset.content;
    }
  }

  return metadata;
}

function collectOpenAIVideoReferenceImages(
  node: CanvasNodeView,
  canvas: CanvasView,
): InputAsset[] {
  const promptImages = collectInputAssets(node, canvas).filter(
    (asset) => asset.role === 'reference_image',
  );

  if (promptImages.length > 0) {
    return promptImages;
  }

  return collectConnectedSeedanceAssets(node, canvas)
    .filter((asset) => asset.node.kind === 'image' || asset.node.kind === 'imageAsset')
    .map((asset) => ({
      node: asset.node,
      role: 'reference_image' as const,
      content: asset.content,
      mimeType: asset.mimeType,
    }));
}

function getOpenAIVideoSeconds(node: CanvasNodeView): number {
  const seconds = node.videoDurationSeconds;

  if (typeof seconds === 'number' && seconds > 0) {
    return Math.round(seconds);
  }

  return 4;
}

function getOpenAIVideoSize(node: CanvasNodeView): string {
  const { width, height } = getOpenAIVideoDimensions(node);
  return `${width}x${height}`;
}

function getOpenAIVideoDimensions(node: CanvasNodeView): { width: number; height: number } {
  const resolution = node.videoResolution ?? '720p';
  const ratio = node.videoRatio && node.videoRatio !== 'adaptive' ? node.videoRatio : '16:9';
  const sizes: Record<string, Record<string, { width: number; height: number }>> = {
    '480p': {
      '16:9': { width: 854, height: 480 },
      '9:16': { width: 480, height: 854 },
      '1:1': { width: 480, height: 480 },
      '4:3': { width: 640, height: 480 },
      '3:4': { width: 480, height: 640 },
      '21:9': { width: 1120, height: 480 },
    },
    '720p': {
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 720, height: 720 },
      '4:3': { width: 960, height: 720 },
      '3:4': { width: 720, height: 960 },
      '21:9': { width: 1680, height: 720 },
    },
    '1080p': {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1080, height: 1080 },
      '4:3': { width: 1440, height: 1080 },
      '3:4': { width: 1080, height: 1440 },
      '21:9': { width: 2520, height: 1080 },
    },
  };

  return sizes[resolution]?.[ratio] ?? { width: 1280, height: 720 };
}

function getOpenAIVideoReferenceFilename(node: CanvasNodeView, mimeType?: string): string {
  if (node.assetName) {
    return node.assetName;
  }

  const extension =
    mimeType === 'image/jpeg'
      ? '.jpg'
      : mimeType === 'image/webp'
        ? '.webp'
        : '.png';

  return `${node.id}${extension}`;
}

function buildAnthropicMessagesRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
  stream: boolean,
): GenerationRequest {
  const imageInputs = collectInputAssets(node, canvas).filter(
    (asset) => asset.role === 'reference_image',
  );
  const content = [
    { type: 'text', text: prompt },
    ...imageInputs.flatMap((asset) => {
      const source = toAnthropicImageSource(asset.content, asset.mimeType);

      return source ? [{ type: 'image', source }] : [];
    }),
  ];

  return {
    url: `${normalizeBaseURL(provider.baseURL)}/messages`,
    method: 'POST',
    headers: {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
      ...(stream ? { stream: true } : {}),
    }),
    responseKind: 'text',
    streamProtocol: 'anthropic',
  };
}

function toAnthropicImageSource(
  content: string,
  mimeType?: string,
): { type: 'base64'; media_type: string; data: string } | null {
  const dataUrlMatch = content.match(/^data:([^;,]+);base64,(.+)$/);

  if (!dataUrlMatch) {
    return null;
  }

  return {
    type: 'base64',
    media_type: mimeType ?? dataUrlMatch[1],
    data: dataUrlMatch[2],
  };
}

function buildSeedanceVideoTaskRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
): GenerationRequest {
  const scenario = node.seedanceScenario ?? 'text_to_video';
  const body = buildSeedanceRequestBody({
    providerModelId: model,
    prompt,
    node,
    canvas,
    scenario,
  });

  return {
    url: `${normalizeBaseURL(provider.baseURL, false)}/api/v3/contents/generations/tasks`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    responseKind: 'video-task',
  };
}

function validateSeedanceVideoNode(node: CanvasNodeView, canvas: CanvasView): string | null {
  const modelId = node.modelId as SeedanceModelId;
  const resolution = node.videoResolution ?? '720p';
  const capabilities = getSeedanceCapabilities(modelId);

  if (!capabilities.supportedResolutions.includes(resolution)) {
    return `当前模型不支持所选视频分辨率：${resolution}`;
  }

  const ratio = node.videoRatio ?? getDefaultSeedanceRatio(modelId);
  if (!capabilities.supportedRatios.includes(ratio)) {
    return `当前模型不支持所选视频比例：${ratio}`;
  }

  if (typeof node.videoDurationSeconds === 'number') {
    const duration = node.videoDurationSeconds;
    const supportsAuto = capabilities.durationRangeSeconds.supportsAuto;
    const inRange =
      Number.isInteger(duration) &&
      ((supportsAuto && duration === -1) ||
        (duration >= capabilities.durationRangeSeconds.min &&
          duration <= capabilities.durationRangeSeconds.max));

    if (!inRange) {
      return `当前模型的视频时长仅支持 ${
        supportsAuto
          ? `-1 或 ${capabilities.durationRangeSeconds.min}~${capabilities.durationRangeSeconds.max}`
          : `${capabilities.durationRangeSeconds.min}~${capabilities.durationRangeSeconds.max}`
      } 秒`;
    }
  }

  if (collectConnectedSeedanceAssets(node, canvas).some((asset) => asset.content.startsWith('blob:'))) {
    return '视频生成的上游素材不能使用 blob: 临时地址，请重新导入素材或重新打开画布后再试。';
  }

  return null;
}

function buildSeedanceRequestBody(input: {
  providerModelId: string;
  prompt: string;
  node: CanvasNodeView;
  canvas: CanvasView;
  scenario: SeedanceScenario;
}): Record<string, unknown> {
  return {
    model: input.providerModelId,
    content: [
      { type: 'text', text: input.prompt },
      ...collectSeedanceScenarioAssets(input.node, input.canvas, input.scenario),
    ],
    ...(input.node.videoResolution ? { resolution: input.node.videoResolution } : {}),
    ratio: input.node.videoRatio ?? getDefaultSeedanceRatio(input.node.modelId as SeedanceModelId),
    ...(typeof input.node.videoDurationSeconds === 'number'
      ? { duration: input.node.videoDurationSeconds }
      : {}),
    ...(typeof input.node.videoSeed === 'number' ? { seed: input.node.videoSeed } : {}),
    ...(typeof input.node.videoReturnLastFrame === 'boolean'
      ? { return_last_frame: input.node.videoReturnLastFrame }
      : {}),
    ...(typeof input.node.videoGenerateAudio === 'boolean'
      ? { generate_audio: input.node.videoGenerateAudio }
      : {}),
    ...(typeof input.node.videoPriority === 'number' ? { priority: input.node.videoPriority } : {}),
  };
}

function collectSeedanceScenarioAssets(
  node: CanvasNodeView,
  canvas: CanvasView,
  scenario: SeedanceScenario,
): Array<Record<string, unknown>> {
  let assets = collectConnectedSeedanceAssets(node, canvas);
  const hasRolePorts = assets.some((asset) => asset.portId && asset.portId !== 'default');

  if (scenario === 'multimodal_reference_video') {
    assets = filterReferencedSeedanceAssets(node, canvas, assets);
  }

  if (hasRolePorts) {
    return collectRoleBasedSeedanceAssets(assets);
  }

  const imageAssets = assets.filter((asset) => asset.node.kind === 'image' || asset.node.kind === 'imageAsset');
  const videoAssets = assets.filter((asset) => asset.node.kind === 'video' || asset.node.kind === 'videoAsset');

  if (scenario === 'image_to_video_first_frame') {
    return imageAssets
      .slice(0, 1)
      .map((asset) => createSeedanceImageContent(asset.content, 'first_frame'));
  }

  if (scenario === 'image_to_video_first_last_frame') {
    return imageAssets
      .slice(0, 2)
      .map((asset, index) =>
        createSeedanceImageContent(asset.content, index === 0 ? 'first_frame' : 'last_frame'),
      );
  }

  if (scenario === 'multimodal_reference_video') {
    return [
      ...imageAssets.map((asset) => createSeedanceImageContent(asset.content, 'reference_image')),
      ...videoAssets.map((asset) => createSeedanceVideoContent(asset.content, 'reference_video')),
    ];
  }

  return [
    ...imageAssets.map((asset) => createSeedanceImageContent(asset.content, 'reference_image')),
    ...videoAssets.map((asset) => createSeedanceVideoContent(asset.content, 'reference_video')),
  ];
}

function filterReferencedSeedanceAssets(
  node: CanvasNodeView,
  canvas: CanvasView,
  assets: SeedanceConnectedAsset[],
): SeedanceConnectedAsset[] {
  const references = parsePromptReferences(
    node.prompt ?? '',
    getPromptReferenceResolution(node, canvas),
  );
  const referencedNodeIds = {
    image: new Set(
      references.filter((reference) => reference.kind === 'image').map((reference) => reference.assetId),
    ),
    video: new Set(
      references.filter((reference) => reference.kind === 'video').map((reference) => reference.assetId),
    ),
    audio: new Set(
      references.filter((reference) => reference.kind === 'audio').map((reference) => reference.assetId),
    ),
  };

  return assets.filter((asset) => {
    if (asset.portId === 'first_frame_image' || asset.portId === 'last_frame_image') {
      return true;
    }

    if (asset.portId === 'reference_image') {
      return referencedNodeIds.image.has(asset.node.id);
    }

    if (asset.portId === 'reference_video') {
      return referencedNodeIds.video.has(asset.node.id);
    }

    if (asset.portId === 'reference_audio') {
      return referencedNodeIds.audio.has(asset.node.id);
    }

    if (asset.node.kind === 'image' || asset.node.kind === 'imageAsset') {
      return referencedNodeIds.image.has(asset.node.id);
    }

    if (asset.node.kind === 'video' || asset.node.kind === 'videoAsset') {
      return referencedNodeIds.video.has(asset.node.id);
    }

    if (asset.node.kind === 'audioAsset') {
      return referencedNodeIds.audio.has(asset.node.id);
    }

    return false;
  });
}

function collectRoleBasedSeedanceAssets(
  assets: SeedanceConnectedAsset[],
): Array<Record<string, unknown>> {
  return assets.flatMap<Record<string, unknown>>((asset) => {
    if (asset.portId === 'first_frame_image') {
      return [createSeedanceImageContent(asset.content, 'first_frame')];
    }

    if (asset.portId === 'last_frame_image') {
      return [createSeedanceImageContent(asset.content, 'last_frame')];
    }

    if (asset.portId === 'reference_image') {
      return [createSeedanceImageContent(asset.content, 'reference_image')];
    }

    if (asset.portId === 'reference_video') {
      return [createSeedanceVideoContent(asset.content, 'reference_video')];
    }

    if (asset.portId === 'reference_audio') {
      return [createSeedanceAudioContent(asset.content, 'reference_audio')];
    }

    return [];
  });
}

function createSeedanceImageContent(
  url: string,
  role: 'first_frame' | 'last_frame' | 'reference_image',
): Record<string, unknown> {
  return {
    type: 'image_url',
    image_url: { url },
    role,
  };
}

function createSeedanceVideoContent(
  url: string,
  role: 'reference_video',
): Record<string, unknown> {
  return {
    type: 'video_url',
    video_url: { url },
    role,
  };
}

function createSeedanceAudioContent(
  url: string,
  role: 'reference_audio',
): Record<string, unknown> {
  return {
    type: 'audio_url',
    audio_url: { url },
    role,
  };
}

function collectConnectedSeedanceAssets(node: CanvasNodeView, canvas: CanvasView): SeedanceConnectedAsset[] {
  return canvas.edges
    .filter((edge) => edge.toNodeId === node.id)
    .map((edge) => ({
      edge,
      node: canvas.nodes.find((candidate) => candidate.id === edge.fromNodeId),
    }))
    .filter(
      (
        value,
      ): value is {
        edge: CanvasView['edges'][number];
        node: CanvasNodeView;
      } => Boolean(value.node),
    )
    .sort((first, second) => first.node.y - second.node.y || first.node.x - second.node.x)
    .flatMap<SeedanceConnectedAsset>(({ edge, node: connectedNode }) => {
      if (connectedNode.kind === 'imageAsset') {
        return connectedNode.assetDataUrl
          ? [{
              node: connectedNode,
              portId: edge.toPortId,
              content: connectedNode.assetDataUrl,
              mimeType: connectedNode.assetMimeType,
            }]
          : [];
      }

      if (connectedNode.kind === 'image') {
        const imageUrl = connectedNode.outputDataUrl ?? connectedNode.outputUrl;
        return imageUrl
          ? [{
              node: connectedNode,
              portId: edge.toPortId,
              content: imageUrl,
              mimeType: connectedNode.assetMimeType,
            }]
          : [];
      }

      if (connectedNode.kind === 'videoAsset') {
        return connectedNode.assetDataUrl
          ? [{
              node: connectedNode,
              portId: edge.toPortId,
              content: connectedNode.assetDataUrl,
              mimeType: connectedNode.assetMimeType,
            }]
          : [];
      }

      if (connectedNode.kind === 'video') {
        const videoUrl = connectedNode.outputUrl ?? connectedNode.outputDataUrl;
        return videoUrl
          ? [{
              node: connectedNode,
              portId: edge.toPortId,
              content: videoUrl,
              mimeType: connectedNode.assetMimeType,
            }]
          : [];
      }

      if (connectedNode.kind === 'audioAsset') {
        return connectedNode.assetDataUrl
          ? [{
              node: connectedNode,
              portId: edge.toPortId,
              content: connectedNode.assetDataUrl,
              mimeType: connectedNode.assetMimeType,
            }]
          : [];
      }

      return [];
    });
}

function collectConnectedVideoHistoryAssetIds(node: CanvasNodeView, canvas: CanvasView): string[] {
  const scenario = node.seedanceScenario ?? 'text_to_video';
  const assets = collectConnectedSeedanceAssets(node, canvas);

  if (scenario === 'multimodal_reference_video') {
    return uniqueAssetIds(filterReferencedSeedanceAssets(node, canvas, assets).map((asset) => asset.node.id));
  }

  if (scenario === 'image_to_video_first_frame') {
    return uniqueAssetIds(
      assets
        .filter((asset) => asset.portId === 'first_frame_image')
        .map((asset) => asset.node.id),
    );
  }

  if (scenario === 'image_to_video_first_last_frame') {
    return uniqueAssetIds(
      assets
        .filter(
          (asset) =>
            asset.portId === 'first_frame_image' || asset.portId === 'last_frame_image',
        )
        .map((asset) => asset.node.id),
    );
  }

  return [];
}

function buildPrompt(node: CanvasNodeView, canvas: CanvasView): string {
  const inputAssets = collectInputAssets(node, canvas);
  return renderPromptForModel(node.prompt?.trim() ?? '', node, canvas, inputAssets);
}

function renderPromptForModel(
  prompt: string,
  node: CanvasNodeView,
  canvas: CanvasView,
  inputAssets: InputAsset[],
): string {
  const labelQueues = buildPromptReferenceLabelQueues(
    inputAssets,
    node.kind === 'video' ? 'seedance' : 'chinese',
  );

  return replacePromptReferences(
    prompt,
    getPromptReferenceResolution(node, canvas),
    (reference) => {
      if (reference.kind === 'text') {
        return inputAssets.find(
          (asset) =>
            asset.role === 'text' &&
            asset.node.id === reference.assetId &&
            asset.token === reference.token,
        )?.content.trim();
      }

      const queue = labelQueues.get(getPromptReferenceKey(reference.kind, reference.assetId, reference.token));

      return queue?.shift();
    },
  );
}

function buildPromptReferenceLabelQueues(
  inputAssets: InputAsset[],
  style: 'chinese' | 'seedance',
): Map<string, string[]> {
  const kindCounts: Record<'image' | 'video' | 'audio', number> = {
    image: 0,
    video: 0,
    audio: 0,
  };
  const queues = new Map<string, string[]>();

  inputAssets.forEach((asset) => {
    const kind = getInputAssetKind(asset);
    if (kind === 'text') {
      return;
    }

    kindCounts[kind] += 1;
    const label = getReferenceLabel(kind, kindCounts[kind], style);
    const key = getPromptReferenceKey(kind, asset.node.id, asset.token);
    const queue = queues.get(key) ?? [];

    queue.push(label);
    queues.set(key, queue);
  });

  return queues;
}

function getInputAssetKind(asset: InputAsset): 'image' | 'video' | 'audio' | 'text' {
  if (asset.role === 'reference_image') {
    return 'image';
  }

  if (asset.role === 'reference_video') {
    return 'video';
  }

  if (asset.role === 'reference_audio') {
    return 'audio';
  }

  return 'text';
}

function getPromptReferenceKey(kind: string, assetId: string, token?: string): string {
  return `${kind}:${assetId}:${token ?? ''}`;
}

function getReferenceLabel(
  kind: 'image' | 'video' | 'audio' | 'text',
  index: number,
  style: 'chinese' | 'seedance',
): string {
  const prefix =
    kind === 'image'
      ? '图片'
      : kind === 'video'
        ? '视频'
        : kind === 'audio'
          ? '音频'
          : '文本';

  if (style === 'seedance') {
    return `「${prefix} ${index}」`;
  }

  return `${prefix}${formatChineseIndex(index)}`;
}

function formatChineseIndex(index: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  if (index <= 10) {
    return index === 10 ? '十' : digits[index];
  }

  if (index < 20) {
    return `十${digits[index - 10]}`;
  }

  if (index < 100) {
    const tens = Math.floor(index / 10);
    const ones = index % 10;

    return `${digits[tens]}十${ones === 0 ? '' : digits[ones]}`;
  }

  return String(index);
}

function collectInputAssets(node: CanvasNodeView, canvas: CanvasView): InputAsset[] {
  return collectPromptReferencedInputs(node, canvas);
}

function collectPromptReferencedInputs(node: CanvasNodeView, canvas: CanvasView): InputAsset[] {
  const upstreamNodeIds = new Set(getUpstreamNodeIds(canvas, node.id));
  const references = parsePromptReferences(
    node.prompt ?? '',
    getPromptReferenceResolution(node, canvas),
  );

  return references.flatMap<InputAsset>((match) => {
    const kind = match.kind;
    const nodeId = match.assetId;

    if (!upstreamNodeIds.has(nodeId)) {
      return [];
    }

    const referencedNode = canvas.nodes.find((current) => current.id === nodeId);

    if (!referencedNode) {
      return [];
    }

    if (kind === 'text') {
      const text =
        referencedNode.kind === 'textAsset'
          ? referencedNode.textContent
          : getEffectiveNodeOutputText(referencedNode);

      return text ? [{ node: referencedNode, role: 'text', content: text, token: match.token }] : [];
    }

    if (kind === 'image') {
      const imageUrl =
        referencedNode.kind === 'imageAsset'
          ? referencedNode.assetDataUrl
          : referencedNode.kind === 'image'
            ? referencedNode.outputDataUrl ?? referencedNode.outputUrl
            : undefined;

      return imageUrl
        ? [
            {
              node: referencedNode,
              role: 'reference_image',
              content: imageUrl,
              token: match.token,
              mimeType: referencedNode.assetMimeType,
            },
          ]
        : [];
    }

    if (kind === 'video') {
      const videoUrl =
        referencedNode.kind === 'videoAsset'
          ? referencedNode.assetDataUrl
          : referencedNode.kind === 'video'
            ? referencedNode.outputUrl ?? referencedNode.outputDataUrl
            : undefined;

      return videoUrl
        ? [
            {
              node: referencedNode,
              role: 'reference_video',
              content: videoUrl,
              token: match.token,
              mimeType: referencedNode.assetMimeType,
            },
          ]
        : [];
    }

    if (kind === 'audio') {
      const audioUrl =
        referencedNode.kind === 'audioAsset'
          ? referencedNode.assetDataUrl
          : undefined;

      return audioUrl
        ? [
            {
              node: referencedNode,
              role: 'reference_audio',
              content: audioUrl,
              token: match.token,
              mimeType: referencedNode.assetMimeType,
            },
          ]
        : [];
    }

    return [];
  });
}

function getPromptReferenceResolution(
  node: CanvasNodeView,
  canvas: CanvasView,
): PromptReferenceResolution {
  const upstreamNodeIds = getUpstreamNodeIds(canvas, node.id);
  const upstreamNodes = upstreamNodeIds
    .map((nodeId) => canvas.nodes.find((current) => current.id === nodeId))
    .filter((current): current is CanvasNodeView => Boolean(current));

  return {
    text: upstreamNodes
      .filter(
        (current) =>
          current.kind === 'textAsset' || Boolean(getEffectiveNodeOutputText(current)),
      )
      .map((current) => current.id),
    image: upstreamNodes
      .filter(
        (current) =>
          current.kind === 'imageAsset' ||
          (current.kind === 'image' && Boolean(current.outputDataUrl ?? current.outputUrl)),
      )
      .map((current) => current.id),
    video: upstreamNodes
      .filter(
        (current) =>
          current.kind === 'videoAsset' ||
          (current.kind === 'video' && Boolean(current.outputUrl ?? current.outputDataUrl)),
      )
      .map((current) => current.id),
    audio: upstreamNodes
      .filter((current) => current.kind === 'audioAsset' && Boolean(current.assetDataUrl))
      .map((current) => current.id),
  };
}

function dataUrlToBlob(dataUrl: string, fallbackMimeType?: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: fallbackMimeType ?? match[1] });
}

function isDataUrl(value: string): boolean {
  return /^data:[^;,]+;base64,/.test(value);
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

function normalizeOutput(
  responseKind: GenerationRequest['responseKind'],
  rawResponse: unknown,
): SubmitGenerationNodeResult {
  if (responseKind === 'image') {
    const image = firstImage(rawResponse);
    if (!image) {
      return { ok: false, error: '图片生成响应缺少图片 URL 或 base64 数据', rawResponse };
    }

    return {
      ok: true,
      output: {
        kind: 'image',
        ...image,
        rawResponse,
      },
    };
  }

  if (responseKind === 'text') {
    const text = firstText(rawResponse);
    if (!text) {
      return { ok: false, error: '文本生成响应缺少内容', rawResponse };
    }

    return {
      ok: true,
      output: {
        kind: 'text',
        text,
        rawResponse,
      },
    };
  }

  const task = videoTask(rawResponse);
  if (!task.taskId && !task.videoUrl && !task.error) {
    return {
      ok: false,
      error: '视频生成响应缺少任务 ID 或视频地址',
      rawResponse,
    };
  }

  return {
    ok: true,
    output: {
      kind: 'video-task',
      ...task,
      rawResponse,
    },
  };
}

function firstImage(rawResponse: unknown): { url?: string; dataUrl?: string } | null {
  if (!isRecord(rawResponse)) {
    return null;
  }

  const data = rawResponse.data;
  if (!Array.isArray(data) || !isRecord(data[0])) {
    return null;
  }

  if (typeof data[0].url === 'string') {
    return { url: data[0].url };
  }

  if (typeof data[0].b64_json === 'string') {
    return { dataUrl: `data:image/png;base64,${data[0].b64_json}` };
  }

  return null;
}

function firstText(rawResponse: unknown): string | null {
  if (!isRecord(rawResponse)) {
    return null;
  }

  const choices = rawResponse.choices;
  if (Array.isArray(choices) && isRecord(choices[0])) {
    const message = choices[0].message;
    if (isRecord(message) && typeof message.content === 'string') {
      return message.content;
    }
  }

  if (typeof rawResponse.output_text === 'string') {
    return rawResponse.output_text;
  }

  return null;
}

function videoTask(rawResponse: unknown): {
  taskId?: string;
  status?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  completionTokens?: number;
  totalTokens?: number;
  error?: {
    code?: string;
    message?: string;
  };
} {
  if (!isRecord(rawResponse)) {
    return {};
  }

  const data = isRecord(rawResponse.data) ? rawResponse.data : rawResponse;
  const content = isRecord(data.content) ? data.content : undefined;
  const usage = isRecord(data.usage) ? data.usage : undefined;
  const videoUrl = content
    ? stringField(content, ['video_url', 'url'])
    : stringField(data, ['video_url', 'url']);
  const status = stringField(data, ['status']) ?? (videoUrl ? 'succeeded' : undefined);
  const error = taskError(data);

  return {
    taskId: stringField(data, ['id', 'task_id']),
    status,
    videoUrl,
    lastFrameUrl: content ? stringField(content, ['last_frame_url']) : undefined,
    completionTokens:
      usage && typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined,
    totalTokens: usage && typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
    ...(error ? { error } : {}),
  };
}

function normalizeVideoTaskHistoryItems(rawResponse: unknown): VideoGenerationHistoryItem[] {
  const records = readVideoTaskHistoryRecords(rawResponse);

  return records.flatMap<VideoGenerationHistoryItem>((record) => {
    const task = videoTask(record);
    const taskId = task.taskId;

    if (!taskId) {
      return [];
    }

    return [
      {
        taskId,
        status: task.status,
        model: stringField(record, ['model', 'model_id']),
        videoUrl: task.videoUrl,
        lastFrameUrl: task.lastFrameUrl,
        completionTokens: task.completionTokens,
        totalTokens: task.totalTokens,
        createdAt: readIsoDate(record, ['created_at', 'create_time']),
        updatedAt: readIsoDate(record, ['updated_at', 'update_time']),
        succeededAt: readIsoDate(record, ['finished_at', 'completed_at', 'succeeded_at']),
        durationSeconds: numberField(record, ['duration', 'duration_seconds']),
        ratio: stringField(record, ['ratio']),
        rawRecord: record,
      },
    ];
  });
}

function readVideoTaskHistoryRecords(rawResponse: unknown): Array<Record<string, unknown>> {
  if (!isRecord(rawResponse)) {
    return [];
  }

  if (Array.isArray(rawResponse.items)) {
    return rawResponse.items.filter(isRecord);
  }

  if (Array.isArray(rawResponse.data)) {
    return rawResponse.data.filter(isRecord);
  }

  if (isRecord(rawResponse.data)) {
    const data = rawResponse.data;

    if (Array.isArray(data.items)) {
      return data.items.filter(isRecord);
    }

    if (Array.isArray(data.tasks)) {
      return data.tasks.filter(isRecord);
    }

    if (Array.isArray(data.list)) {
      return data.list.filter(isRecord);
    }
  }

  if (Array.isArray(rawResponse.tasks)) {
    return rawResponse.tasks.filter(isRecord);
  }

  if (Array.isArray(rawResponse.list)) {
    return rawResponse.list.filter(isRecord);
  }

  return [];
}

function readVideoTaskHistoryTotal(rawResponse: unknown): number {
  if (!isRecord(rawResponse)) {
    return 0;
  }

  const direct = numberField(rawResponse, ['total', 'total_count']);
  if (typeof direct === 'number') {
    return direct;
  }

  if (isRecord(rawResponse.data)) {
    const nested = numberField(rawResponse.data, ['total', 'total_count']);
    if (typeof nested === 'number') {
      return nested;
    }

    if (isRecord(rawResponse.data.pagination)) {
      return (
        numberField(rawResponse.data.pagination, ['total', 'total_count']) ??
        readVideoTaskHistoryRecords(rawResponse).length
      );
    }
  }

  return readVideoTaskHistoryRecords(rawResponse).length;
}

function taskError(data: Record<string, unknown>): { code?: string; message?: string } | undefined {
  const error = data.error;

  if (typeof error === 'string') {
    return { message: error };
  }

  if (!isRecord(error)) {
    return undefined;
  }

  const code = typeof error.code === 'string' ? error.code : undefined;
  const message = typeof error.message === 'string' ? error.message : undefined;

  return code || message ? { code, message } : undefined;
}

async function readResponse(response: Awaited<ReturnType<GenerationFetch>>): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return response.text ? await response.text() : null;
    } catch {
      return null;
    }
  }
}

function extractErrorMessage(rawResponse: unknown): string | undefined {
  if (typeof rawResponse === 'string') {
    return rawResponse;
  }

  if (!isRecord(rawResponse)) {
    return undefined;
  }

  if (typeof rawResponse.message === 'string') {
    return rawResponse.message;
  }

  const error = rawResponse.error;
  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return undefined;
}

function stringField(record: Record<string, unknown>, fields: string[]): string | undefined {
  for (const field of fields) {
    if (typeof record[field] === 'string') {
      return record[field];
    }
  }

  return undefined;
}

function numberField(record: Record<string, unknown>, fields: string[]): number | undefined {
  for (const field of fields) {
    if (typeof record[field] === 'number' && Number.isFinite(record[field])) {
      return record[field];
    }
  }

  return undefined;
}

function readIsoDate(record: Record<string, unknown>, fields: string[]): string | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
      return new Date(milliseconds).toISOString();
    }
  }

  return undefined;
}

function uniqueAssetIds(assetIds: string[]): string[] {
  return assetIds.filter((assetId, index) => assetIds.indexOf(assetId) === index);
}

function isModelNodeKind(kind: CanvasNodeView['kind']): kind is ModelNodeKind {
  return kind === 'image' || kind === 'video' || kind === 'chat';
}

function getNodeChatFormat(node: CanvasNodeView): 'openai' | 'anthropic' {
  return node.chatFormat ?? 'openai';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeBaseURL(baseURL: string, ensureV1 = true): string {
  const trimmed = baseURL.replace(/\/+$/, '');

  if (!ensureV1 || trimmed.endsWith('/v1')) {
    return trimmed;
  }

  return `${trimmed}/v1`;
}

function getViteEnv(): Record<string, string | undefined> {
  return ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
}
