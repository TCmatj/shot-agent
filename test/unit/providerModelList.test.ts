import { describe, expect, it, vi } from 'vitest';
import {
  buildProviderModelListRequest,
  fetchProviderModelList,
  mergeFetchedProviderModels,
  parseProviderModelList,
} from '../../src/models/providerModelList';
import type { ProviderConfig } from '../../src/domain/provider';

const provider: ProviderConfig = {
  id: 'provider_openai',
  name: 'OpenAI',
  protocol: 'openai-compatible',
  baseURL: 'https://api.openai.com',
  apiTokenRef: 'sk-test',
  enabled: true,
  models: [],
};

describe('provider model list', () => {
  it('builds model list requests for common provider protocols', () => {
    expect(buildProviderModelListRequest(provider)).toEqual({
      headers: { Authorization: 'Bearer sk-test' },
      url: 'https://api.openai.com/v1/models',
    });
    expect(
      buildProviderModelListRequest({
        ...provider,
        id: 'provider_anthropic',
        protocol: 'anthropic-compatible',
        baseURL: 'https://api.anthropic.com/v1',
      }),
    ).toEqual({
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': 'sk-test',
      },
      url: 'https://api.anthropic.com/v1/models',
    });
    expect(
      buildProviderModelListRequest({
        ...provider,
        id: 'provider_ollama',
        baseURL: 'http://localhost:11434',
        apiTokenRef: '',
      }),
    ).toEqual({
      headers: {},
      url: 'http://localhost:11434/v1/models',
    });
  });

  it('parses common model list response shapes into provider model mappings', () => {
    expect(
      parseProviderModelList(provider, {
        data: [
          { id: 'gpt-5.4-mini' },
          { id: 'gpt-image-2', name: 'GPT Image 2' },
          { id: 'text-embedding-3-large' },
        ],
      }),
    ).toEqual([
      {
        id: 'model_provider_openai_gpt-5_4-mini',
        providerModelId: 'gpt-5.4-mini',
        canonicalModelId: 'gpt-5.4-mini',
        displayName: 'gpt-5.4-mini',
        enabled: true,
      },
      {
        id: 'model_provider_openai_gpt-image-2',
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        displayName: 'GPT Image 2',
        enabled: true,
      },
    ]);
    expect(
      parseProviderModelList(
        { ...provider, id: 'provider_google' },
        {
          models: [
            {
              displayName: 'Gemini Flash',
              name: 'models/gemini-2.5-flash',
            },
          ],
        },
      ),
    ).toEqual([
      {
        id: 'model_provider_google_gemini-2_5-flash',
        providerModelId: 'gemini-2.5-flash',
        canonicalModelId: 'gemini-2.5-flash',
        displayName: 'Gemini Flash',
        enabled: true,
      },
    ]);
  });

  it('fetches and merges provider model lists without losing existing mappings', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({ data: [{ id: 'gpt-5.4-mini' }] }),
      ok: true,
      status: 200,
    });
    const result = await fetchProviderModelList(provider, fetcher as unknown as typeof fetch);

    expect(result).toEqual({
      ok: true,
      models: [
        {
          id: 'model_provider_openai_gpt-5_4-mini',
          providerModelId: 'gpt-5.4-mini',
          canonicalModelId: 'gpt-5.4-mini',
          displayName: 'gpt-5.4-mini',
          enabled: true,
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer sk-test' },
      method: 'GET',
    });
    expect(
      mergeFetchedProviderModels(
        {
          ...provider,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'custom-chat-model',
              enabled: false,
            },
          ],
        },
        result.ok ? result.models : [],
      ).models[0],
    ).toMatchObject({
      canonicalModelId: 'custom-chat-model',
      enabled: false,
      providerModelId: 'gpt-5.4-mini',
    });
  });
});
