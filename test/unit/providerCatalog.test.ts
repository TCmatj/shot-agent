import { describe, expect, it } from 'vitest';
import { initialProviders } from '../../src/models/providerCatalog';

describe('provider catalog', () => {
  it('ships mainstream chat providers as built-in provider presets', () => {
    expect(initialProviders.map((provider) => provider.id)).toEqual(
      expect.arrayContaining([
        'provider_openai',
        'provider_anthropic',
        'provider_deepseek',
        'provider_google',
        'provider_mistral',
        'provider_groq',
        'provider_openrouter',
        'provider_together',
        'provider_qwen',
        'provider_xai',
        'provider_azure_openai',
        'provider_ollama',
      ]),
    );
    expect(initialProviders.find((provider) => provider.id === 'provider_openai')).toMatchObject({
      baseURL: 'https://api.openai.com',
      models: expect.arrayContaining([
        expect.objectContaining({
          canonicalModelId: 'gpt-image-2',
          providerModelId: 'gpt-image-2',
        }),
        expect.objectContaining({
          canonicalModelId: 'gpt-5.4-mini',
          providerModelId: 'gpt-5.4-mini',
        }),
      ]),
    });
    expect(initialProviders.find((provider) => provider.id === 'provider_anthropic')).toMatchObject({
      protocol: 'anthropic-compatible',
      models: expect.arrayContaining([
        expect.objectContaining({
          canonicalModelId: 'claude-sonnet-4-5',
          providerModelId: 'claude-sonnet-4-5',
        }),
      ]),
    });
  });
});
