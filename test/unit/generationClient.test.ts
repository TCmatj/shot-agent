import { describe, expect, it, vi } from 'vitest';
import type { CanvasView } from '../../src/app/canvasWorkspace';
import type { ProviderConfig } from '../../src/domain/provider';
import {
  buildGenerationRequest,
  collectGenerationInputAssetIds,
  getEffectiveNodeOutputText,
  listVideoGenerationTasks,
  parseAnthropicStreamTextDelta,
  parseOpenAIStreamTextDelta,
  queryGenerationTask,
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
    {
      canonicalModelId: 'seedance-sora',
      providerModelId: 'sora-2',
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
    {
      canonicalModelId: 'seedance2.0-fast',
      providerModelId: 'doubao-seedance-2-0-fast-260128',
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

  it('lists succeeded video generation tasks from volcengine with pagination', async () => {
    const fetcher: GenerationFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 25,
        items: [
          {
            id: 'task_1',
            model: 'doubao-seedance-2-0-260128',
            status: 'succeeded',
            created_at: 1_717_799_003,
            updated_at: 1_717_799_123,
            content: {
              video_url: 'https://example.com/video.mp4',
              last_frame_url: 'https://example.com/cover.png',
            },
            usage: {
              completion_tokens: 3456,
              total_tokens: 3456,
            },
            ratio: '16:9',
            duration: 5,
          },
        ],
      }),
    });

    const result = await listVideoGenerationTasks({
      provider: seedanceProvider,
      token: 'token',
      pageIndex: 2,
      pageSize: 20,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks?page_num=2&page_size=20&filter.status=succeeded',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      total: 25,
      pageIndex: 2,
      pageSize: 20,
      items: [
        {
          taskId: 'task_1',
          model: 'doubao-seedance-2-0-260128',
          status: 'succeeded',
          videoUrl: 'https://example.com/video.mp4',
          lastFrameUrl: 'https://example.com/cover.png',
          completionTokens: 3456,
          totalTokens: 3456,
          ratio: '16:9',
          durationSeconds: 5,
        },
      ],
    });
    if (result.ok) {
      expect(result.items[0].createdAt).toBe('2024-06-07T22:23:23.000Z');
      expect(result.items[0].updatedAt).toBe('2024-06-07T22:25:23.000Z');
    }
  });

  it('rejects history queries for non-volcengine providers', async () => {
    await expect(
      listVideoGenerationTasks({
        provider: openaiProvider,
        token: 'token',
      }),
    ).resolves.toEqual({
      ok: false,
      error: '当前供应商不支持历史任务查询：openai-compatible',
    });
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
      quality: 'high',
    });
  });

  it('builds image requests with selected resolution, ratio, and quality', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_1'
            ? {
                ...node,
                imageResolutionTier: '4k',
                imageAspectRatio: '16:9',
                imageQuality: 'medium',
              }
            : node,
        ),
      },
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      prompt: 'A ceramic cup',
      size: '3840x2160',
      quality: 'medium',
    });
  });

  it('supports automatic image size selection', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_1'
            ? { ...node, imageResolutionTier: '2k', imageAspectRatio: 'auto' }
            : node,
        ),
      },
      nodeId: 'image_1',
      provider: openaiProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      size: 'auto',
      quality: 'high',
    });
  });


  it('replaces upstream text prompt references inline', () => {
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
      prompt: 'A ceramic cup use a clean studio background',
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
    expect(result.ok && (result.request.body as FormData).get('size')).toBe('1024x1024');
    expect(result.ok && (result.request.body as FormData).get('quality')).toBe('high');
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
      ratio: '16:9',
      content: [
        { type: 'text', text: 'Slow camera orbit 「图片 1」' },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,aW1hZ2U=',
          },
          role: 'reference_image',
        },
      ],
    });
  });

  it('builds a Sora video task request for the Seedance-Sora model option', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                title: 'seedance-sora',
                modelId: 'seedance-sora',
                providerModelId: 'sora-2',
                videoDurationSeconds: 5,
                videoResolution: '1080p',
                videoRatio: '16:9',
                videoSeed: 12345,
              }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    expect(result).toMatchObject({
      ok: true,
      request: {
        url: 'https://api.openai.com/v1/videos',
        method: 'POST',
        headers: {
          Authorization: 'Bearer openai-token',
        },
        responseKind: 'video-task',
      },
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    expect(formData.get('prompt')).toBe('Slow camera orbit 「图片 1」');
    expect(formData.get('model')).toBe('sora-2');
    expect(formData.get('seconds')).toBe('5');
    expect(formData.get('size')).toBeNull();
    expect(formData.get('input_reference')).toBeNull();
    expect(JSON.parse(String(formData.get('metadata')))).toMatchObject({
      resolution: '1080p',
      ratio: '16:9',
      seed: 12345,
    });
  });

  it('uses the selected OpenAI compatible provider model for Seedance-Sora requests', () => {
    const customSoraProvider = {
      ...openaiProvider,
      models: [
        {
          providerModelId: 'custom-sora-gateway-model',
          canonicalModelId: 'custom-sora-gateway-model',
          enabled: true,
        },
      ],
    };

    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                modelId: 'seedance-sora',
                videoModelFormat: 'seedance-sora',
                providerModelId: 'custom-sora-gateway-model',
              }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: customSoraProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    expect(result.ok).toBe(true);
    expect(formData.get('model')).toBe('custom-sora-gateway-model');
  });

  it('requires an explicit provider model for Seedance-Sora requests', () => {
    const customSoraProvider = {
      ...openaiProvider,
      models: [
        {
          providerModelId: 'custom-sora-gateway-model',
          canonicalModelId: 'custom-sora-gateway-model',
          enabled: true,
        },
      ],
    };

    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                modelId: 'seedance-sora',
                videoModelFormat: 'seedance-sora',
                providerModelId: undefined,
              }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: customSoraProvider,
      token: 'openai-token',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Sora 格式调用必须选择供应商模型',
    });
  });

  it('builds Sora-CH1 first and last frame references with refrenceImage metadata', () => {
    const lastFrameAsset = {
      id: 'image_asset_2',
      title: 'Last frame',
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: 120,
      assetName: 'last.png',
      assetDataUrl: 'https://assets.example.com/last.png',
      assetMimeType: 'image/png',
    };
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  modelId: 'seedance-sora',
                  videoModelFormat: 'sora-ch1' as const,
                  providerModelId: 'sora-fast',
                  seedanceScenario: 'image_to_video_first_last_frame' as const,
                }
              : node,
          )
          .concat(lastFrameAsset),
        edges: [
          { id: 'edge_first_frame', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'first_frame_image' },
          { id: 'edge_last_frame', fromNodeId: 'image_asset_2', toNodeId: 'video_1', toPortId: 'last_frame_image' },
        ],
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    const metadata = JSON.parse(String(formData.get('metadata')));

    expect(result.ok).toBe(true);
    expect(formData.get('prompt')).toBe('【图片1】为首帧，【图片2】为尾帧。Slow camera orbit 「图片 1」');
    expect(formData.get('model')).toBe('sora-fast');
    expect(metadata.refrenceImage).toEqual([
      'data:image/png;base64,aW1hZ2U=',
      'https://assets.example.com/last.png',
    ]);
    expect(metadata.content).toBeUndefined();
  });

  it('builds Sora-CH1 first frame references with an image prompt prefix', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                modelId: 'seedance-sora',
                videoModelFormat: 'sora-ch1' as const,
                providerModelId: 'sora-fast',
                seedanceScenario: 'image_to_video_first_frame' as const,
              }
            : node,
        ),
        edges: [
          { id: 'edge_first_frame', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'first_frame_image' },
        ],
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    const metadata = JSON.parse(String(formData.get('metadata')));

    expect(result.ok).toBe(true);
    expect(formData.get('prompt')).toBe('【图片1】为首帧。Slow camera orbit 「图片 1」');
    expect(metadata.refrenceImage).toEqual(['data:image/png;base64,aW1hZ2U=']);
    expect(metadata.content).toBeUndefined();
  });

  it('builds Sora-CH1 multimodal image and video references with metadata arrays', () => {
    const videoAsset = {
      id: 'video_asset_1',
      title: 'Reference Video',
      modelId: 'asset-video',
      kind: 'videoAsset' as const,
      x: 0,
      y: 120,
      assetName: 'reference.mp4',
      assetDataUrl: 'https://assets.example.com/reference.mp4',
      assetMimeType: 'video/mp4',
    };
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt: 'Make it cinematic @image:image_asset_1 @video:video_asset_1',
                  modelId: 'seedance-sora',
                  videoModelFormat: 'sora-ch1' as const,
                  providerModelId: 'sora-fast',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(videoAsset),
        edges: [
          { id: 'edge_image_ref', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'reference_image' },
          { id: 'edge_video_ref', fromNodeId: 'video_asset_1', toNodeId: 'video_1', toPortId: 'reference_video' },
        ],
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    const metadata = JSON.parse(String(formData.get('metadata')));

    expect(result.ok).toBe(true);
    expect(metadata.refrenceImage).toEqual(['data:image/png;base64,aW1hZ2U=']);
    expect(metadata.refrenceVideo).toEqual(['https://assets.example.com/reference.mp4']);
    expect(metadata.content).toBeUndefined();
  });

  it('keeps all Sora-CH1 image references without a local image count limit', () => {
    const imageAssets = Array.from({ length: 5 }, (_, index) => ({
      id: `image_asset_extra_${index}`,
      title: `Reference ${index}`,
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: index * 100,
      assetName: `reference-${index}.png`,
      assetDataUrl: `https://assets.example.com/reference-${index}.png`,
      assetMimeType: 'image/png',
    }));
    const prompt = imageAssets
      .map((asset) => `@image:${asset.id}`)
      .join(' ');
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt,
                  modelId: 'seedance-sora',
                  videoModelFormat: 'sora-ch1' as const,
                  providerModelId: 'sora-fast',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(imageAssets),
        edges: imageAssets.map((asset) => ({
          id: `edge_${asset.id}`,
          fromNodeId: asset.id,
          toNodeId: 'video_1',
          toPortId: 'reference_image',
        })),
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    const metadata = JSON.parse(String(formData.get('metadata')));

    expect(result.ok).toBe(true);
    expect(metadata.refrenceImage).toEqual(
      imageAssets.map((asset) => asset.assetDataUrl),
    );
  });

  it('rejects Sora-CH1 requests that exceed video reference limits', () => {
    const videoAssets = Array.from({ length: 4 }, (_, index) => ({
      id: `video_asset_extra_${index}`,
      title: `Reference Video ${index}`,
      modelId: 'asset-video',
      kind: 'videoAsset' as const,
      x: 0,
      y: index * 100,
      assetName: `reference-${index}.mp4`,
      assetDataUrl: `https://assets.example.com/reference-${index}.mp4`,
      assetMimeType: 'video/mp4',
    }));
    const prompt = videoAssets
      .map((asset) => `@video:${asset.id}`)
      .join(' ');
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt,
                  modelId: 'seedance-sora',
                  videoModelFormat: 'sora-ch1' as const,
                  providerModelId: 'sora-fast',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(videoAssets),
        edges: videoAssets.map((asset) => ({
          id: `edge_${asset.id}`,
          fromNodeId: asset.id,
          toNodeId: 'video_1',
          toPortId: 'reference_video',
        })),
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    expect(result).toEqual({
      ok: false,
      error: 'sora-ch1 最多支持 3 个参考视频',
    });
  });

  it('queries Seedance-Sora video task status with the Sora videos endpoint', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          id: 'video_123',
          model: 'sora-2',
          status: 'succeeded',
          url: 'https://example.com/video.mp4',
        }),
        text: async () => '',
      }) as Response,
    );

    const result = await queryGenerationTask({
      provider: openaiProvider,
      taskId: 'video_123',
      token: 'openai-token',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.openai.com/v1/videos/video_123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer openai-token',
        }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      output: {
        kind: 'video-task',
        taskId: 'video_123',
        status: 'succeeded',
        videoUrl: 'https://example.com/video.mp4',
      },
    });
  });

  it('parses completed Sora compatible task responses with metadata video urls', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          id: 'task_123',
          object: 'video',
          status: 'completed',
          metadata: {
            url: 'https://example.com/completed.mp4',
          },
        }),
        text: async () => '',
      }) as Response,
    );

    const result = await queryGenerationTask({
      provider: openaiProvider,
      taskId: 'task_123',
      token: 'openai-token',
      fetcher,
    });

    expect(result).toMatchObject({
      ok: true,
      output: {
        kind: 'video-task',
        taskId: 'task_123',
        status: 'completed',
        videoUrl: 'https://example.com/completed.mp4',
      },
    });
  });

  it('uses landscape 16:9 as the default Seedance-Sora video ratio', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                modelId: 'seedance-sora',
                providerModelId: 'sora-2',
                videoResolution: '720p',
              }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: openaiProvider,
      token: 'openai-token',
    });

    const formData = result.ok ? result.request.body as FormData : new FormData();
    expect(JSON.parse(String(formData.get('metadata')))).toMatchObject({
      resolution: '720p',
      ratio: '16:9',
    });
  });

  it('builds first-last-frame seedance requests', () => {
    const secondImage = {
      id: 'image_asset_2',
      title: 'Second Reference',
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: -120,
      assetName: 'second.png',
      assetDataUrl: 'data:image/png;base64,c2Vjb25k',
      assetMimeType: 'image/png',
    };
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt: 'Keep the camera slow @image:image_asset_1 @image:image_asset_2',
                  seedanceScenario: 'image_to_video_first_last_frame' as const,
                  videoResolution: '720p' as const,
                  videoDurationSeconds: 5,
                }
              : node,
          )
          .concat(secondImage),
        edges: [
          { id: 'edge_first_frame', fromNodeId: 'image_asset_2', toNodeId: 'video_1', toPortId: 'first_frame_image' },
          { id: 'edge_last_frame', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'last_frame_image' },
        ],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      resolution: '720p',
      duration: 5,
      content: [
        { type: 'text', text: 'Keep the camera slow 「图片 1」 「图片 2」' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,c2Vjb25k' },
          role: 'first_frame',
        },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
          role: 'last_frame',
        },
      ],
    });
    expect(result.ok && JSON.parse(result.request.body as string).framespersecond).toBeUndefined();
  });

  it('rejects Seedance blob URLs before sending the provider request', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'image_asset_1'
            ? { ...node, assetDataUrl: 'blob:http://localhost/local-image' }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('blob:');
  });

  it('rejects Seedance durations outside the official range', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1'
            ? {
                ...node,
                videoDurationSeconds: 16,
              }
            : node,
        ),
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('4~15');
  });

  it('rejects Seedance ratios outside the official range', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === 'video_1' ? ({ ...node, videoRatio: '2:1' } as never) : node,
        ),
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('2:1');
  });

  it('collects complete generation history inputs for first-last-frame mode', () => {
    const secondImage = {
      id: 'image_asset_2',
      title: 'Second Reference',
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: -120,
      assetName: 'second.png',
      assetDataUrl: 'data:image/png;base64,c2Vjb25k',
      assetMimeType: 'image/png',
    };

    expect(
      collectGenerationInputAssetIds({
        canvas: {
          ...canvas,
          nodes: canvas.nodes
            .map((node) =>
              node.id === 'video_1'
                ? {
                    ...node,
                    prompt: 'Keep the camera slow @text:text_1',
                    seedanceScenario: 'image_to_video_first_last_frame' as const,
                  }
                : node,
            )
            .concat(secondImage),
          edges: [
            { id: 'edge_text_video', fromNodeId: 'text_1', toNodeId: 'video_1', toPortId: 'text' },
            { id: 'edge_first_frame', fromNodeId: 'image_asset_2', toNodeId: 'video_1', toPortId: 'first_frame_image' },
            { id: 'edge_last_frame', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'last_frame_image' },
          ],
        },
        nodeId: 'video_1',
      }),
    ).toEqual(['text_1', 'image_asset_2', 'image_asset_1']);
  });

  it('uses provider video urls for downstream video references', () => {
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: [
          ...canvas.nodes.filter((node) => node.id !== 'video_1'),
          {
            id: 'video_local',
            title: '鏈湴瑙嗛',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 0,
            y: 120,
            outputUrl: 'https://example.com/remote.mp4',
            outputPath: 'assets/videos/local.mp4',
            outputDataUrl: 'blob:local-video',
          },
          {
            id: 'video_1',
            title: 'Video',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 320,
            y: 0,
            prompt: '@video:video_local use motion reference',
            seedanceScenario: 'multimodal_reference_video',
          },
        ],
        edges: [{ id: 'edge_video_ref', fromNodeId: 'video_local', toNodeId: 'video_1', toPortId: 'reference_video' }],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string).content).toEqual([
      { type: 'text', text: '「视频 1」 use motion reference' },
      {
        type: 'video_url',
        video_url: { url: 'https://example.com/remote.mp4' },
        role: 'reference_video',
      },
    ]);
  });

  it('builds multimodal seedance requests with referenced audio assets', () => {
    const audioAsset = {
      id: 'audio_asset_1',
      title: 'Audio Reference',
      modelId: 'asset-audio',
      kind: 'audioAsset' as const,
      x: 0,
      y: 240,
      assetName: 'sound.mp3',
      assetDataUrl: 'data:audio/mpeg;base64,YXVkaW8=',
      assetMimeType: 'audio/mpeg',
    };

    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt: 'Make it cinematic @audio:audio_asset_1',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(audioAsset),
        edges: [{ id: 'edge_audio_ref', fromNodeId: 'audio_asset_1', toNodeId: 'video_1', toPortId: 'reference_audio' }],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string).content).toEqual([
      { type: 'text', text: 'Make it cinematic 「音频 1」' },
      {
        type: 'audio_url',
        audio_url: { url: 'data:audio/mpeg;base64,YXVkaW8=' },
        role: 'reference_audio',
      },
    ]);
  });

  it('builds multimodal seedance requests from role ports', () => {
    const videoAsset = {
      id: 'video_asset_1',
      title: 'Video Reference',
      modelId: 'asset-video',
      kind: 'videoAsset' as const,
      x: 0,
      y: 120,
      assetName: 'clip.mp4',
      assetDataUrl: 'data:video/mp4;base64,dmlkZW8=',
      assetMimeType: 'video/mp4',
    };
    const audioAsset = {
      id: 'audio_asset_1',
      title: 'Audio Reference',
      modelId: 'asset-audio',
      kind: 'audioAsset' as const,
      x: 0,
      y: 240,
      assetName: 'sound.mp3',
      assetDataUrl: 'data:audio/mpeg;base64,YXVkaW8=',
      assetMimeType: 'audio/mpeg',
    };
    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt: 'Make it cinematic @image:image_asset_1 @video:video_asset_1',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(videoAsset, audioAsset),
        edges: [
          { id: 'edge_image_ref', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'reference_image' },
          { id: 'edge_video_ref', fromNodeId: 'video_asset_1', toNodeId: 'video_1', toPortId: 'reference_video' },
          { id: 'edge_audio_ref', fromNodeId: 'audio_asset_1', toNodeId: 'video_1', toPortId: 'reference_audio' },
        ],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toMatchObject({
      content: [
        { type: 'text', text: 'Make it cinematic 「图片 1」 「视频 1」' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
          role: 'reference_image',
        },
        {
          type: 'video_url',
          video_url: { url: 'data:video/mp4;base64,dmlkZW8=' },
          role: 'reference_video',
        },
      ],
    });
  });

  it('uploads only referenced multimodal assets except frame inputs', () => {
    const extraImageAsset = {
      id: 'image_asset_2',
      title: 'Unused Image Reference',
      modelId: 'asset-image',
      kind: 'imageAsset' as const,
      x: 0,
      y: -120,
      assetName: 'unused.png',
      assetDataUrl: 'data:image/png;base64,dW51c2Vk',
      assetMimeType: 'image/png',
    };
    const extraVideoAsset = {
      id: 'video_asset_2',
      title: 'Unused Video Reference',
      modelId: 'asset-video',
      kind: 'videoAsset' as const,
      x: 0,
      y: 180,
      assetName: 'unused.mp4',
      assetDataUrl: 'data:video/mp4;base64,dW51c2Vk',
      assetMimeType: 'video/mp4',
    };

    const result = buildGenerationRequest({
      canvas: {
        ...canvas,
        nodes: canvas.nodes
          .map((node) =>
            node.id === 'video_1'
              ? {
                  ...node,
                  prompt: 'Make it cinematic @image:image_asset_1',
                  seedanceScenario: 'multimodal_reference_video' as const,
                }
              : node,
          )
          .concat(extraImageAsset, extraVideoAsset),
        edges: [
          { id: 'edge_image_ref_1', fromNodeId: 'image_asset_1', toNodeId: 'video_1', toPortId: 'reference_image' },
          { id: 'edge_image_ref_2', fromNodeId: 'image_asset_2', toNodeId: 'video_1', toPortId: 'reference_image' },
          { id: 'edge_video_ref_2', fromNodeId: 'video_asset_2', toNodeId: 'video_1', toPortId: 'reference_video' },
        ],
      },
      nodeId: 'video_1',
      provider: seedanceProvider,
      token: 'token',
    });

    expect(result.ok && JSON.parse(result.request.body as string)).toEqual({
      model: 'doubao-seedance-2-0-260128',
      ratio: '16:9',
      content: [
        { type: 'text', text: 'Make it cinematic 「图片 1」' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
          role: 'reference_image',
        },
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
            ? { ...node, prompt: '@image:image_asset_1 is the subject, @image:image_asset_2 is the background reference' }
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
      { type: 'text', text: '「图片 1」 is the subject, 「图片 2」 is the background reference' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,aW1hZ2U=',
        },
        role: 'reference_image',
      },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,c2Vjb25k',
        },
        role: 'reference_image',
      },
    ]);
  });

  it('renders explicit image references as ordered readable labels before provider calls', () => {
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
            ? {
                ...node,
                prompt:
                  '@image:image_asset_2 is the person, @image:image_asset_1 is the indoor scene',
              }
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

    expect(result.ok && JSON.parse(result.request.body as string).content[0]).toEqual({
      type: 'text',
      text: '「图片 1」 is the person, 「图片 2」 is the indoor scene',
    });
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
                'Rewrite this prompt use a clean studio background 图片一',
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
                'Rewrite this prompt use a clean studio background 图片一',
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

    const result = buildGenerationRequest({
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
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('20');
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

  it('parses settled token usage from seedance task responses', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'task_1',
        status: 'succeeded',
        content: {
          video_url: 'https://example.com/video.mp4',
          last_frame_url: 'https://example.com/last-frame.png',
        },
        usage: { completion_tokens: 108900, total_tokens: 108900 },
      }),
    }));

    await expect(
      submitGenerationNode({
        canvas,
        nodeId: 'video_1',
        provider: seedanceProvider,
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      output: {
        kind: 'video-task',
        taskId: 'task_1',
        status: 'succeeded',
        videoUrl: 'https://example.com/video.mp4',
        lastFrameUrl: 'https://example.com/last-frame.png',
        completionTokens: 108900,
        totalTokens: 108900,
        rawResponse: {
          id: 'task_1',
          status: 'succeeded',
          content: {
            video_url: 'https://example.com/video.mp4',
            last_frame_url: 'https://example.com/last-frame.png',
          },
          usage: { completion_tokens: 108900, total_tokens: 108900 },
        },
      },
    });
  });

  it('rejects malformed seedance submit responses without task id or video url', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'queued',
        content: {},
      }),
    }));

    await expect(
      submitGenerationNode({
        canvas,
        nodeId: 'video_1',
        provider: seedanceProvider,
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: false,
      error: '视频生成响应缺少任务 ID 或视频地址',
      rawResponse: {
        status: 'queued',
        content: {},
      },
    });
  });

  it('queries seedance task status through the polling endpoint', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'task_1',
        status: 'running',
        content: {
          video_url: 'https://example.com/video.mp4',
        },
        usage: { completion_tokens: 54000, total_tokens: 54000 },
      }),
    }));

    await expect(
      queryGenerationTask({
        provider: seedanceProvider,
        taskId: 'task_1',
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      output: {
        kind: 'video-task',
        taskId: 'task_1',
        status: 'running',
        videoUrl: 'https://example.com/video.mp4',
        lastFrameUrl: undefined,
        completionTokens: 54000,
        totalTokens: 54000,
        rawResponse: {
          id: 'task_1',
          status: 'running',
          content: {
            video_url: 'https://example.com/video.mp4',
          },
          usage: { completion_tokens: 54000, total_tokens: 54000 },
        },
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/task_1',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('keeps failed seedance task error code and message from polling responses', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'task_failed',
        status: 'failed',
        error: {
          code: 'InvalidParameter',
          message: 'content[1].image_url is not valid',
        },
      }),
    }));

    await expect(
      queryGenerationTask({
        provider: seedanceProvider,
        taskId: 'task_failed',
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      output: {
        kind: 'video-task',
        taskId: 'task_failed',
        status: 'failed',
        videoUrl: undefined,
        lastFrameUrl: undefined,
        completionTokens: undefined,
        totalTokens: undefined,
        error: {
          code: 'InvalidParameter',
          message: 'content[1].image_url is not valid',
        },
        rawResponse: {
          id: 'task_failed',
          status: 'failed',
          error: {
            code: 'InvalidParameter',
            message: 'content[1].image_url is not valid',
          },
        },
      },
    });
  });

  it('rejects malformed seedance polling responses without status information', async () => {
    const fetcher = vi.fn<GenerationFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'task_1',
        content: {},
      }),
    }));

    await expect(
      queryGenerationTask({
        provider: seedanceProvider,
        taskId: 'task_1',
        token: 'token',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: false,
      error: '视频任务查询响应缺少状态信息',
      rawResponse: {
        id: 'task_1',
        content: {},
      },
    });
  });

  it('parses OpenAI chat completion stream deltas', () => {
    expect(
      parseOpenAIStreamTextDelta(
        'data: {"choices":[{"delta":{"content":"he"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n' +
          'data: [DONE]\n\n',
      ),
    ).toEqual(['he', 'llo']);
  });

  it('parses Anthropic messages stream text deltas', () => {
    expect(
      parseAnthropicStreamTextDelta(
        'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"he"}}\n\n' +
          'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"llo"}}\n\n',
      ),
    ).toEqual(['he', 'llo']);
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
        modelOutputText: '妯″瀷杈撳嚭',
        outputText: '淇敼杈撳嚭',
      }),
    ).toBe('淇敼杈撳嚭');
  });
});
