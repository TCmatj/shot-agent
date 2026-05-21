import type { CanvasNodeView, CanvasView } from '../app/canvasWorkspace';
import { getEffectiveOutputText } from '../domain/outputVersions';
import {
  mapCanonicalModelToProviderModel,
  type ProviderConfig,
} from '../domain/provider';

type ModelNodeKind = 'image' | 'video' | 'chat';

type InputAsset = {
  node: CanvasNodeView;
  role: 'text' | 'reference_image' | 'reference_video';
  content: string;
  token?: string;
  mimeType?: string;
};

export type GenerationRequest = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: BodyInit;
  responseKind: 'image' | 'video-task' | 'text';
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
    provider.protocol === 'volcengine' ? 'VITE_SEEDANCE_API_KEY' : 'VITE_OPENAI_API_KEY';

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
    mapCanonicalModelToProviderModel(input.provider, node.modelId);
  if (!providerModelId) {
    return { ok: false, error: `供应商未配置模型映射：${node.modelId}` };
  }

  const prompt = buildPrompt(node, input.canvas);
  if (!prompt.trim()) {
    return { ok: false, error: '提交前必须填写提示词' };
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

  if (input.provider.protocol !== 'openai-compatible') {
    return { ok: false, error: `暂不支持的供应商协议：${input.provider.protocol}` };
  }

  if (node.kind === 'video') {
    return { ok: false, error: 'OpenAI-compatible 供应商当前不处理视频节点' };
  }

  if (node.kind === 'chat') {
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

  return {
    ok: true,
    request: buildOpenAIImageRequest(input.provider, input.token, providerModelId, prompt),
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

    for (const delta of parseOpenAIStreamTextDelta(events.join('\n\n'))) {
      fullText += delta;
      input.onDelta(delta, fullText);
    }
  }

  for (const delta of parseOpenAIStreamTextDelta(pendingChunk)) {
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

function buildOpenAIImageRequest(
  provider: ProviderConfig,
  token: string,
  model: string,
  prompt: string,
): GenerationRequest {
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
      size: '1024x1024',
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
  const mediaContent = collectInputAssets(node, canvas)
    .filter((asset) => asset.role === 'reference_image' || asset.role === 'reference_video')
    .map((asset) =>
      asset.role === 'reference_image'
        ? {
            type: 'image_url',
            image_url: {
              url: asset.content,
              role: 'reference_image',
            },
          }
        : {
            type: 'video_url',
            video_url: {
              url: asset.content,
              role: 'reference_video',
            },
          },
    );

  return {
    url: `${normalizeBaseURL(provider.baseURL, false)}/api/v3/contents/generations/tasks`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      content: [{ type: 'text', text: prompt }, ...mediaContent],
    }),
    responseKind: 'video-task',
  };
}

function buildPrompt(node: CanvasNodeView, canvas: CanvasView): string {
  const ownPrompt = node.prompt?.trim() ?? '';
  const textInputs = collectInputAssets(node, canvas).filter(
    (asset) => asset.role === 'text' && asset.content.trim(),
  );

  if (textInputs.length === 0) {
    return ownPrompt;
  }

  if (node.kind !== 'chat') {
    return `${ownPrompt}\n\n参考文本：\n${textInputs
      .map((asset) => `- ${asset.content.trim()}`)
      .join('\n')}`;
  }

  return `${ownPrompt}\n\n引用文本：\n${textInputs
    .map((asset, index) => `${index + 1}. ${asset.token ?? asset.node.id}\n${asset.content.trim()}`)
    .join('\n\n')}`;
}

function collectInputAssets(node: CanvasNodeView, canvas: CanvasView): InputAsset[] {
  if (node.kind === 'chat') {
    return collectPromptReferencedInputs(node, canvas);
  }

  const upstreamNodeIds = canvas.edges
    .filter((edge) => edge.toNodeId === node.id)
    .map((edge) => edge.fromNodeId);
  const upstreamNodes = upstreamNodeIds
    .map((nodeId) => canvas.nodes.find((current) => current.id === nodeId))
    .filter((current): current is CanvasNodeView => Boolean(current));

  return upstreamNodes.flatMap<InputAsset>((inputNode) => {
    if (inputNode.kind === 'textAsset') {
      return inputNode.textContent
        ? [{ node: inputNode, role: 'text', content: inputNode.textContent }]
        : [];
    }

    if (inputNode.kind === 'imageAsset' && inputNode.assetDataUrl) {
      return [
        {
          node: inputNode,
          role: 'reference_image',
          content: inputNode.assetDataUrl,
          mimeType: inputNode.assetMimeType,
        },
      ];
    }

    if (inputNode.kind === 'videoAsset' && inputNode.assetDataUrl) {
      return [
        {
          node: inputNode,
          role: 'reference_video',
          content: inputNode.assetDataUrl,
          mimeType: inputNode.assetMimeType,
        },
      ];
    }

    if ((inputNode.outputDataUrl || inputNode.outputUrl) && inputNode.kind === 'image') {
      return [
        {
          node: inputNode,
          role: 'reference_image',
          content: inputNode.outputDataUrl ?? inputNode.outputUrl!,
        },
      ];
    }

    if ((inputNode.outputDataUrl || inputNode.outputUrl) && inputNode.kind === 'video') {
      return [
        {
          node: inputNode,
          role: 'reference_video',
          content: inputNode.outputDataUrl ?? inputNode.outputUrl!,
        },
      ];
    }

    const outputText = getEffectiveNodeOutputText(inputNode);
    if (outputText) {
      return [{ node: inputNode, role: 'text', content: outputText }];
    }

    return [];
  });
}

function collectPromptReferencedInputs(node: CanvasNodeView, canvas: CanvasView): InputAsset[] {
  const references = Array.from((node.prompt ?? '').matchAll(/@(text|image):([a-zA-Z0-9_-]+)/g));

  return references.flatMap<InputAsset>((match) => {
    const kind = match[1];
    const nodeId = match[2];
    const referencedNode = canvas.nodes.find((current) => current.id === nodeId);

    if (!referencedNode) {
      return [];
    }

    if (kind === 'text') {
      const text =
        referencedNode.kind === 'textAsset'
          ? referencedNode.textContent
          : getEffectiveNodeOutputText(referencedNode);

      return text ? [{ node: referencedNode, role: 'text', content: text, token: match[0] }] : [];
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
              token: match[0],
              mimeType: referencedNode.assetMimeType,
            },
          ]
        : [];
    }

    return [];
  });
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

function videoTask(rawResponse: unknown): { taskId?: string; status?: string; videoUrl?: string } {
  if (!isRecord(rawResponse)) {
    return {};
  }

  const data = isRecord(rawResponse.data) ? rawResponse.data : rawResponse;

  return {
    taskId: stringField(data, ['id', 'task_id']),
    status: stringField(data, ['status']),
    videoUrl: stringField(data, ['video_url', 'url']),
  };
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

function isModelNodeKind(kind: CanvasNodeView['kind']): kind is ModelNodeKind {
  return kind === 'image' || kind === 'video' || kind === 'chat';
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
