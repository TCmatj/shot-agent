import type { ID } from './types';

export type ProviderProtocol =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'volcengine'
  | 'custom';

export type ChatFormat = 'openai' | 'anthropic';

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

export function findChatProviders(
  providers: ProviderConfig[],
  format: ChatFormat = 'openai',
): ProviderConfig[] {
  const canonicalModelId = getChatCanonicalModelId(format);
  const protocol = getChatProviderProtocol(format);

  return providers.filter(
    (provider) =>
      provider.enabled &&
      provider.protocol === protocol &&
      provider.models.some(
        (model) =>
          model.enabled &&
          (model.canonicalModelId === canonicalModelId ||
            (format === 'openai' && /^gpt-\d/.test(model.providerModelId)) ||
            (format === 'anthropic' && /^claude-/.test(model.providerModelId))),
      ),
  );
}

export function findProviderModelsForNodeModel(
  provider: ProviderConfig,
  nodeModelId: string,
  format: ChatFormat = 'openai',
  nodeKind?: 'chat',
): ProviderModelConfig[] {
  if (nodeKind === 'chat' || isLegacyChatNodeModelId(nodeModelId)) {
    return provider.models.filter(
      (model) => model.enabled && isChatProviderModel(model, format),
    );
  }

  return provider.models.filter(
    (model) => model.enabled && model.canonicalModelId === nodeModelId,
  );
}

export function mapCanonicalModelToProviderModel(
  provider: ProviderConfig,
  canonicalModelId: string,
  format: ChatFormat = 'openai',
  nodeKind?: 'chat',
): string | undefined {
  if (nodeKind === 'chat') {
    return provider.models.find(
      (model) =>
        model.enabled &&
        isChatProviderModel(model, format) &&
        (model.providerModelId === canonicalModelId ||
          model.canonicalModelId === canonicalModelId),
    )?.providerModelId;
  }

  const effectiveCanonicalModelId =
    isLegacyChatNodeModelId(canonicalModelId) ? getChatCanonicalModelId(format) : canonicalModelId;
  const canonicalMatch = provider.models.find(
    (model) => model.enabled && model.canonicalModelId === effectiveCanonicalModelId,
  )?.providerModelId;

  if (canonicalMatch || !isLegacyChatNodeModelId(canonicalModelId)) {
    return canonicalMatch;
  }

  return provider.models.find(
    (model) =>
      model.enabled &&
      (format === 'anthropic'
        ? /^claude-/.test(model.providerModelId)
        : /^gpt-\d/.test(model.providerModelId)),
  )?.providerModelId;
}

function getChatCanonicalModelId(format: ChatFormat): string {
  return format === 'anthropic' ? 'chat-anthropic' : 'chat-openai';
}

function getChatProviderProtocol(format: ChatFormat): ProviderProtocol {
  return format === 'anthropic' ? 'anthropic-compatible' : 'openai-compatible';
}

function isLegacyChatNodeModelId(modelId: string): boolean {
  return modelId === 'chat' || modelId === 'chat-openai' || modelId === 'chat-anthropic';
}

function isChatProviderModel(model: ProviderModelConfig, format: ChatFormat): boolean {
  if (model.canonicalModelId === getChatCanonicalModelId(format)) {
    return true;
  }

  if (format === 'openai' && /^gpt-\d/.test(model.providerModelId)) {
    return true;
  }

  if (format === 'anthropic' && /^claude-/.test(model.providerModelId)) {
    return true;
  }

  return !isKnownNonChatModel(model.canonicalModelId) && !isKnownNonChatModel(model.providerModelId);
}

function isKnownNonChatModel(modelId: string): boolean {
  return (
    modelId.startsWith('gpt-image') ||
    modelId.startsWith('seedance') ||
    modelId.startsWith('doubao-seedance') ||
    modelId.startsWith('asset-') ||
    modelId.includes('image') ||
    modelId.includes('video')
  );
}
