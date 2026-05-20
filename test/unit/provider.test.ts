import { describe, expect, it } from 'vitest';
import {
  findProvidersForCanonicalModel,
  mapCanonicalModelToProviderModel,
} from '../../src/domain/provider';

const providers = [
  {
    id: 'provider_openai',
    name: 'OpenAI',
    protocol: 'openai-compatible' as const,
    baseURL: 'https://api.openai.com',
    apiTokenRef: 'secret_openai',
    enabled: true,
    models: [
      {
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ],
  },
  {
    id: 'provider_other',
    name: '第三方',
    protocol: 'openai-compatible' as const,
    baseURL: 'https://example.test/v1',
    apiTokenRef: 'secret_other',
    enabled: true,
    models: [
      {
        providerModelId: 'image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ],
  },
];

describe('provider model mapping', () => {
  it('filters providers by canonical model id', () => {
    expect(findProvidersForCanonicalModel(providers, 'gpt-image-2')).toHaveLength(2);
    expect(findProvidersForCanonicalModel(providers, 'seedance2.0')).toHaveLength(0);
  });

  it('maps canonical model id to provider model id', () => {
    expect(mapCanonicalModelToProviderModel(providers[1], 'gpt-image-2')).toBe('image-2');
  });
});
