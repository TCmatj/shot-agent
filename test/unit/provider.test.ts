import { describe, expect, it } from 'vitest';
import {
  createProviderDraft,
  findChatProviders,
  findProviderModelsForNodeModel,
  findProvidersForCanonicalModel,
  mapCanonicalModelToProviderModel,
  mergeProviderDefaults,
  saveProviderDraft,
  updateProviderDraft,
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

  it('lists selectable provider models for image and chat nodes', () => {
    const provider = {
      ...providers[0],
      models: [
        ...providers[0].models,
        {
          providerModelId: 'gpt-5.4-mini',
          canonicalModelId: 'gpt-5.4-mini',
          enabled: true,
        },
      ],
    };

    expect(findProviderModelsForNodeModel(provider, 'gpt-image-2')).toEqual([
      {
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ]);
    expect(findProviderModelsForNodeModel(provider, 'gpt-5.4-mini', 'openai', 'chat')).toEqual([
      {
        providerModelId: 'gpt-5.4-mini',
        canonicalModelId: 'gpt-5.4-mini',
        enabled: true,
      },
    ]);
  });

  it('matches chat providers by selected chat format', () => {
    expect(
      findChatProviders([
        ...providers,
        {
          id: 'provider_chat',
          name: 'Chat',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com',
          apiTokenRef: 'secret_openai',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'chat-openai',
              enabled: true,
            },
          ],
        },
        {
          id: 'provider_anthropic',
          name: 'Anthropic',
          protocol: 'anthropic-compatible',
          baseURL: 'https://api.anthropic.com/v1',
          apiTokenRef: 'secret_anthropic',
          enabled: true,
          models: [
            {
              providerModelId: 'claude-sonnet-4-5',
              canonicalModelId: 'chat-anthropic',
              enabled: true,
            },
          ],
        },
        {
          id: 'provider_non_gpt',
          name: 'Non GPT',
          protocol: 'openai-compatible',
          baseURL: 'https://example.test',
          apiTokenRef: 'secret_other',
          enabled: true,
          models: [
            {
              providerModelId: 'image-2',
              canonicalModelId: 'chat-openai',
              enabled: true,
            },
          ],
        },
      ], 'openai').map((provider) => provider.id),
    ).toEqual(['provider_chat', 'provider_non_gpt']);

    expect(
      findChatProviders([
        ...providers,
        {
          id: 'provider_anthropic',
          name: 'Anthropic',
          protocol: 'anthropic-compatible',
          baseURL: 'https://api.anthropic.com/v1',
          apiTokenRef: 'secret_anthropic',
          enabled: true,
          models: [
            {
              providerModelId: 'claude-sonnet-4-5',
              canonicalModelId: 'chat-anthropic',
              enabled: true,
            },
          ],
        },
      ], 'anthropic').map((provider) => provider.id),
    ).toEqual(['provider_anthropic']);
  });

  it('lists selectable Anthropic chat models for chat nodes', () => {
    const provider = {
      id: 'provider_anthropic',
      name: 'Anthropic',
      protocol: 'anthropic-compatible' as const,
      baseURL: 'https://api.anthropic.com/v1',
      apiTokenRef: 'secret_anthropic',
      enabled: true,
      models: [
        {
          providerModelId: 'claude-sonnet-4-5',
          canonicalModelId: 'claude-sonnet-4-5',
          enabled: true,
        },
      ],
    };

    expect(findProviderModelsForNodeModel(provider, 'claude-sonnet-4-5', 'anthropic', 'chat')).toEqual([
      {
        providerModelId: 'claude-sonnet-4-5',
        canonicalModelId: 'claude-sonnet-4-5',
        enabled: true,
      },
    ]);
    expect(mapCanonicalModelToProviderModel(provider, 'claude-sonnet-4-5', 'anthropic', 'chat')).toBe(
      'claude-sonnet-4-5',
    );
  });

  it('maps chat model ids directly from provider model ids', () => {
    const provider = {
      ...providers[0],
      models: [
        {
          providerModelId: 'gpt-5.4-mini',
          canonicalModelId: 'gpt-5.4-mini',
          enabled: true,
        },
      ],
    };

    expect(mapCanonicalModelToProviderModel(provider, 'gpt-5.4-mini', 'openai', 'chat')).toBe(
      'gpt-5.4-mini',
    );
  });

  it('merges missing default provider model mappings into saved providers', () => {
    const savedProviders = [
      {
        ...providers[0],
        models: [
          {
            providerModelId: 'gpt-image-2',
            canonicalModelId: 'gpt-image-2',
            enabled: true,
          },
        ],
      },
    ];
    const defaults = [
      {
        ...providers[0],
        models: [
          ...providers[0].models,
          {
            id: 'model_openai_chat',
            providerModelId: 'gpt-5.4-mini',
            canonicalModelId: 'gpt-5.4-mini',
            enabled: true,
          },
        ],
      },
    ];

    expect(mergeProviderDefaults(savedProviders, defaults)[0].models).toHaveLength(2);
  });

  it('migrates old default chat mappings without duplicating provider models', () => {
    const savedProviders = [
      {
        ...providers[0],
        models: [
          {
            providerModelId: 'gpt-5.4-mini',
            canonicalModelId: 'chat-openai',
            enabled: true,
          },
        ],
      },
    ];
    const defaults = [
      {
        ...providers[0],
        models: [
          {
            id: 'model_openai_chat',
            providerModelId: 'gpt-5.4-mini',
            canonicalModelId: 'gpt-5.4-mini',
            enabled: true,
          },
        ],
      },
    ];

    expect(mergeProviderDefaults(savedProviders, defaults)[0].models).toEqual([
      {
        providerModelId: 'gpt-5.4-mini',
        canonicalModelId: 'gpt-5.4-mini',
        enabled: true,
      },
    ]);
  });

  it('edits provider drafts without mutating the saved provider list', () => {
    const draft = createProviderDraft(providers[0]);
    const updatedDraft = updateProviderDraft(draft, {
      name: 'OpenAI Local',
      models: [
        {
          providerModelId: 'gpt-image-2',
          canonicalModelId: 'gpt-image-2',
          enabled: false,
        },
      ],
    });

    expect(providers[0].name).toBe('OpenAI');
    expect(updatedDraft.name).toBe('OpenAI Local');
    expect(saveProviderDraft(providers, updatedDraft)[0]).toEqual(updatedDraft);
  });
});
