import { describe, expect, it, vi } from 'vitest';
import type { CanvasView } from '../../src/app/canvasWorkspace';
import type { ProviderConfig } from '../../src/domain/provider';
import {
  buildGenerationRequest,
  getEffectiveNodeOutputText,
  parseAnthropicStreamTextDelta,
  parseOpenAIStreamTextDelta,
  resolveProviderToken,
  streamChatGenerationNode,
  submitGenerationNode,
  type GenerationFetch,
} from '../../src/models/generationClient';

const openaiProvider: ProviderConfig = {
  id: 'provider_openai',
  name: 'OpenAI',
  protocol: 'openai-compatible',
  baseURL: 'https://api.openai.com',
  apiTokenRef: 'secret_openai',
  enabled: true,
  models: [
    {
      canonicalModelId: 'gpt-image-2',
      providerModelId: 'gpt-image-2',
      enabled: true,
    },
    {
      canonicalModelId: 'gpt-image-2',
      providerModelId: 'custom-image-model',
      enabled: true,
    },
    {
      canonicalModelId: 'gpt-5.4-mini',
      providerModelId: 'gpt-5.4-mini',
      enabled: true,
    },
  ],
};

const seedanceProvider: ProviderConfig = {
  id: 'provider_seedance',
  name: 'Seedance',
  protocol: 'volcengine',
  baseURL: 'https://ark.cn-beijing.volces.com',
  apiTokenRef: 'secret_seedance',
  enabled: true,
  models: [
    {
      canonicalModelId: 'seedance2.0',
      providerModelId: 'doubao-seedance-2-0-260128',
      enabled: true,
    },
  ],
};

const anthropicProvider: ProviderConfig = {
  id: 'provider_anthropic',
  name: 'Anthropic',
  protocol: 'anthropic-compatible',
  baseURL: 'https://api.anthropic.com/v1',
  apiTokenRef: 'secret_anthropic',
  enabled: true,
  models: [
    {
      canonicalModelId: 'claude-sonnet-4-5',
      providerModelId: 'claude-sonnet-4-5',
      enabled: true,
    },
  ],
};

const canvas: CanvasView = {
  id: 'canvas_1',
  name: 'Canvas',
  updatedAt: 'now',
  nodes: [
    {
      id: 'text_1',
      title: 'Text',
      modelId: 'asset-text',
      kind: 'textAsset',
      x: 0,
      y: 0,
      textContent: 'use a clean studio background',
    },
    {
      id: 'image_asset_1',
      title: 'Reference',
      modelId: 'asset-image',
      kind: 'imageAsset',
      x: 0,
      y: 0,
      assetName: 'reference.png',
      assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
      assetMimeType: 'image/png',
    },
    {
      id: 'image_1',
      title: 'Image',
      modelId: 'gpt-image-2',
      providerModelId: 'custom-image-model',
      kind: 'image',
      x: 0,
      y: 0,
      prompt: 'A ceramic cup',
    },
    {
      id: 'video_1',
      title: 'Video',
      modelId: 'seedance2.0',
      kind: 'video',
      x: 0,
      y: 0,
      prompt: 'Slow camera orbit @image:image_asset_1',
    },
    {
      id: 'chat_1',
      title: 'Chat',
      modelId: 'gpt-5.4-mini',
      kind: 'chat',
      x: 0,
      y: 0,
      prompt: 'Rewrite this prompt @text:text_1 @image:image_asset_1',
    },
  ],
  edges: [
    { id: 'edge_text_image', fromNodeId: 'text_1', toNodeId: 'image_1' },
    { id: 'edge_image_video', fromNodeId: 'image_asset_1', toNodeId: 'video_1' },
    { id: 'edge_text_chat', fromNodeId: 'text_1', toNodeId: 'chat_1' },
    { id: 'edge_image_chat', fromNodeId: 'image_asset_1', toNodeId: 'chat_1' },
  ],
};

describe('generation client request building', () => {
  it('uses a direct provider API key when the token field contains one', () => {
    expect(
      resolveProviderToken({
        ...openaiProvider,
        apiTokenRef: 'sk-test-direct-token',
      }),
    ).toBe('sk-test-direct-token');
  });

  it('resolves provider token references from environment variables', () => {
    expect(resolveProviderToken(openaiProvider, { secret_openai: 'env-token' })).toBe(
      'env-token',
    );
  });

  it('rejects asset nodes before any provider call', () => {
    expect(
      buildGenerationRequest({
        canvas,
        nodeId: 'text_1',
        provider: openaiProvider,
        token: 'token',
      }),
    ).toEqual({
      ok: false,
      error: '资产节点不能直接提交生成请求',
    });
  });

  it('rejects missing prompt because model calls are expensive', () => {
    expect(
      buildGenerationRequest({
        canvas: {
          ...canvas,
          nodes: [{ id: 'image_1', title: 'Image', modelId: 'gpt-image-2', kind: 'image', x: 0, y: 0 }],
          edges: [],
        },
        nodeId: 'image_1',
        provider: openaiProvider,
        token: 'token',
      }),
    ).toEqual({
      ok: false,
      error: '提交前必须填写提示词',
    });
  });

  it('does not automatically append connected text inputs without prompt references', () => {
    const result = buildGenerationRequest({
      canvas,
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://api.openai.com/v1/images/generations',
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        responseKind: 'image',
      },
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toEqual({
      model: 'custom-image-model',
      prompt: 'A ceramic cup',
      n: 1,
      size: '1024x1024',
    });
  });

  it('builds an OpenAI image request with upstream text prompt references appended', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_1'
            ? { ...node, prompt: 'A ceramic cup @text:text_1' }
            : node,
        ),
      },
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      model: 'custom-image-model',
      prompt: 'A ceramic cup @text:text_1\n\n参考文本：\n- use a clean studio background',
    });
  });

  it('ignores prompt references that are not connected upstream', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_1'
            ? { ...node, prompt: 'A ceramic cup @image:image_asset_1' }
            : node,
        ),
      },
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      prompt: 'A ceramic cup @image:image_asset_1',
    });
  });

  it('uses OpenAI image edits when an upstream image is referenced', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_1'
            ? { ...node, prompt: 'A ceramic cup @image:image_asset_1' }
            : node,
        ),
        edges: [
          ...canvas.edges,
          { id: 'edge_image_asset_to_image', fromNodeId: 'image_asset_1', toNodeId: 'image_1' },
        ],
      },
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://api.openai.com/v1/images/edits',
        responseKind: 'image',
      },
    });
    expect(result.ok && result.request.body).toBeInstanceOf(FormData);
  });

  it('rejects OpenAI image references that cannot be uploaded as local data', () => {
    expect(
      buildGenerationRequest({
        canvas: {
          ...canvas,
          nodes: canvas.nodes.map((node) =>
            node.id === 'image_asset_1'
              ? { ...node, assetDataUrl: 'https://cdn.example.com/reference.png' }
              : node.id === 'image_1'
                ? { ...node, prompt: 'A ceramic cup @image:image_asset_1' }
                : node,
          ),
          edges: [
            ...canvas.edges,
            { id: 'edge_image_asset_to_image', fromNodeId: 'image_asset_1', toNodeId: 'image_1' },
          ],
        },
        nodeId: 'image_1',
        provider: openaiProvider,
        token: 'token',
      }),
    ).toEqual({
      ok: false,
      error: '图片生成的 @图片 引用当前需要本地图片数据，暂不支持直接引用远程 URL',
    });
  });

  it('builds a Seedance video task request with reference images', () => {
    const result = buildGenerationRequest({
      canvas,
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'seedance-token',
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
        method: 'POST',
        headers: {
          Authorization: 'Bearer seedance-token',
          'Content-Type': 'application/json',
        },
        responseKind: 'video-task',
      },
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toEqual({
      model: 'doubao-seedance-2-0-260128',
      content: [
        { type: 'text', text: 'Slow camera orbit @image:image_asset_1' },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,aW1hZ2U=',
            role: 'reference_image',
          },
        },
      ],
    });
  });

  it('resolves Chinese image placeholders to upstream images by prompt order', () => {
    const secondImage = {
      id: 'image_asset_2',
      title: 'Second Reference',
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: 180,
      assetName: 'second.png',
      assetDataUrl: 'data:image/png;base64,c2Vjb25k',
      assetMimeType: 'image/png',
    };
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? { ...node, prompt: '@图片 是主体，@图片 做背景参考' }
            : node,
        ).concat(secondImage),
        edges: [
          ...canvas.edges,
          { id: 'edge_image_second_video', fromNodeId: 'image_asset_2', toNodeId: 'video_1' },
        ],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'seedance-token',
    });

    expect(result.ok && JSON.parse(result.request.body as string).content).toEqual([
      { type: 'text', text: '@图片 是主体，@图片 做背景参考' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,aW1hZ2U=',
          role: 'reference_image',
        },
      },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,c2Vjb25k',
          role: 'reference_image',
        },
      },
    ]);
  });

  it('builds text generation requests with stream enabled when requested', () => {
    const result = buildGenerationRequest({
      canvas,
      nodeId: 'chat_1',
      provider: openaiProvider,
      token: 'token',
      stream: true,
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://api.openai.com/v1/chat/completions',
        responseKind: 'text',
      },
    });
    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Rewrite this prompt @text:text_1 @image:image_asset_1\n\n' +
                '引用文本：\n' +
                '1. @text:text_1\nuse a clean studio background',
            },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
            },
          ],
        },
      ],
      stream: true,
    });
  });

  it('builds Anthropic messages requests when the chat node selects Anthropic format', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'chat_1'
            ? { ...node, chatFormat: 'anthropic', modelId: 'claude-sonnet-4-5' }
            : node,
        ),
      },
      nodeId: 'chat_1',
      provider: anthropicProvider,
      token: 'anthropic-token',
      stream: true,
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://api.anthropic.com/v1/messages',
        responseKind: 'text',
        streamProtocol: 'anthropic',
        headers: {
          'x-api-key': 'anthropic-token',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      },
    });
    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Rewrite this prompt @text:text_1 @image:image_asset_1\n\n' +
                '引用文本：\n' +
                '1. @text:text_1\nuse a clean studio background',
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'aW1hZ2U=',
              },
            },
          ],
        },
      ],
      stream: true,
    });
  });

  it('rejects chat requests with more than 20 image inputs', () => {
    const imageNodes = Array.from({ length: 21 }, (_, index) => ({
      id: `image_asset_${index + 1}`,
      title: `Reference ${index + 1}`,
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: 0,
      assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
      assetMimeType: 'image/png',
    }));
    const chatNode = {
      id: 'chat_many_images',
      title: 'Chat',
      modelId: 'gpt-5.4-mini',
      kind: 'chat' as const,
      x: 0,
      y: 0,
      prompt: imageNodes.map((node) => `@image:${node.id}`).join(' '),
    };

    expect(
      buildGenerationRequest({
        canvas: {
          id: 'canvas_many_images',
          name: 'Canvas',
          updatedAt: 'now',
          nodes: [...imageNodes, chatNode],
          edges: imageNodes.map((node) => ({
            id: `edge_${node.id}_chat`,
            fromNodeId: node.id,
            toNodeId: chatNode.id,
          })),
        },
        nodeId: chatNode.id,
        provider: openaiProvider,
        token: 'token',
      }),
    ).toEqual({
      ok: false,
      error: '对话节点最多支持 20 张图片输入',
    });
  });

  it('rejects synchronous text generation submissions', async () => {
    const fetcher = vi.fn<GenerationFetch>();

    await expect(
      submitGenerationNode({
        canvas,
        nodeId: 'chat_1',
        provider: openaiProvider,
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: false,
      error: '文本生成必须使用流式接口',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('submits and normalizes image outputs', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ b64_json: 'abc123' }],
      }),
    }));

    await expect(
      submitGenerationNode({
        canvas,
        nodeId: 'image_1',
        provider: openaiProvider,
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      output: {
        kind: 'image',
        dataUrl: 'data:image/png;base64,abc123',
        rawResponse: { data: [{ b64_json: 'abc123' }] },
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('parses OpenAI chat completion stream deltas', () => {
    expect(
      parseOpenAIStreamTextDelta(
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n' +
          'data: [DONE]\n\n',
      ),
    ).toEqual(['你', '好']);
  });

  it('parses Anthropic messages stream text deltas', () => {
    expect(
      parseAnthropicStreamTextDelta(
        'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你"}}\n\n' +
          'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"好"}}\n\n',
      ),
    ).toEqual(['你', '好']);
  });

  it('emits stream deltas as CRLF-delimited chunks arrive', async () => {
    const encoder = new TextEncoder();
    let pushSecondChunk: (() => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\r\n\r\n'),
        );
        pushSecondChunk = () => {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"lo"}}]}\r\n\r\n' +
                'data: [DONE]\r\n\r\n',
            ),
          );
          controller.close();
        };
      },
    });
    const deltas: string[] = [];
    const fullTexts: string[] = [];
    const resultPromise = streamChatGenerationNode({
      canvas,
      nodeId: 'chat_1',
      provider: openaiProvider,
      token: 'token',
      fetcher: vi.fn(async () => new Response(stream, { status: 200 })),
      onDelta(delta, fullText) {
        deltas.push(delta);
        fullTexts.push(fullText);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deltas).toEqual(['Hel']);
    expect(fullTexts).toEqual(['Hel']);

    pushSecondChunk?.();
    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      output: {
        kind: 'text',
        text: 'Hello',
      },
    });
    expect(deltas).toEqual(['Hel', 'lo']);
    expect(fullTexts).toEqual(['Hel', 'Hello']);
  });

  it('uses edited output text before original model output text', () => {
    expect(
      getEffectiveNodeOutputText({
        id: 'chat_1',
        title: 'Chat',
        modelId: 'gpt-5.4-mini',
        kind: 'chat',
        x: 0,
        y: 0,
        modelOutputText: '模型输出',
        outputText: '修改输出',
      }),
    ).toBe('修改输出');
  });
});
