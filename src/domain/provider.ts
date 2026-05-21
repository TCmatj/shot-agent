import type { ID } from './types';

export type ProviderProtocol =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'volcengine'
  | 'custom';

export type BillingConfig =
  | {
      mode: 'official-token';
      inputTokenPrice?: number;
      outputTokenPrice?: number;
      currency?: string;
    }
  | {
      mode: 'per-call';
      pricePerCall?: number;
      currency?: string;
    }
  | {
      mode: 'none';
    };

export type ProviderModelConfig = {
  id?: ID;
  providerModelId: string;
  canonicalModelId: string;
  displayName?: string;
  billing?: BillingConfig;
  enabled: boolean;
};

export type ProviderConfig = {
  id: ID;
  name: string;
  protocol: ProviderProtocol;
  baseURL: string;
  apiTokenRef: string;
  models: ProviderModelConfig[];
  enabled: boolean;
};

export function createProviderDraft(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model })),
  };
}

export function updateProviderDraft(
  draft: ProviderConfig,
  updates: Partial<ProviderConfig>,
): ProviderConfig {
  return {
    ...draft,
    ...updates,
    models: updates.models
      ? updates.models.map((model) => ({ ...model }))
      : draft.models.map((model) => ({ ...model })),
  };
}

export function saveProviderDraft(
  providers: ProviderConfig[],
  draft: ProviderConfig,
): ProviderConfig[] {
  const normalizedDraft = createProviderDraft(draft);
  const existingIndex = providers.findIndex((provider) => provider.id === draft.id);

  if (existingIndex === -1) {
    return [...providers, normalizedDraft];
  }

  return providers.map((provider) =>
    provider.id === draft.id ? normalizedDraft : provider,
  );
}

export function mergeProviderDefaults(
  providers: ProviderConfig[],
  defaultProviders: ProviderConfig[],
): ProviderConfig[] {
  return providers.map((provider) => {
    const defaultProvider = defaultProviders.find(
      (current) => current.id === provider.id,
    );

    if (!defaultProvider) {
      return createProviderDraft(provider);
    }

    const missingModels = defaultProvider.models.filter(
      (defaultModel) =>
        !provider.models.some(
          (model) =>
            model.providerModelId === defaultModel.providerModelId &&
            model.canonicalModelId === defaultModel.canonicalModelId,
        ),
    );

    return {
      ...provider,
      models: [
        ...provider.models.map((model) => ({ ...model })),
        ...missingModels.map((model) => ({ ...model })),
      ],
    };
  });
}

export function findProvidersForCanonicalModel(
  providers: ProviderConfig[],
  canonicalModelId: string,
): ProviderConfig[] {
  return providers.filter(
    (provider) =>
      provider.enabled &&
      provider.models.some(
        (model) => model.enabled && model.canonicalModelId === canonicalModelId,
      ),
  );
}

export function findChatProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers.filter(
    (provider) =>
      provider.enabled &&
      provider.protocol === 'openai-compatible' &&
      provider.models.some(
        (model) => model.enabled && /^gpt-\d/.test(model.providerModelId),
      ),
  );
}

export function findProviderModelsForNodeModel(
  provider: ProviderConfig,
  nodeModelId: string,
): ProviderModelConfig[] {
  if (nodeModelId === 'chat-openai') {
    return provider.models.filter(
      (model) => model.enabled && /^gpt-\d/.test(model.providerModelId),
    );
  }

  return provider.models.filter(
    (model) => model.enabled && model.canonicalModelId === nodeModelId,
  );
}

export function mapCanonicalModelToProviderModel(
  provider: ProviderConfig,
  canonicalModelId: string,
): string | undefined {
  const canonicalMatch = provider.models.find(
    (model) => model.enabled && model.canonicalModelId === canonicalModelId,
  )?.providerModelId;

  if (canonicalMatch || canonicalModelId !== 'chat-openai') {
    return canonicalMatch;
  }

  return provider.models.find(
    (model) => model.enabled && /^gpt-\d/.test(model.providerModelId),
  )?.providerModelId;
}
