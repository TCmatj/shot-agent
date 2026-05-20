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

export function mapCanonicalModelToProviderModel(
  provider: ProviderConfig,
  canonicalModelId: string,
): string | undefined {
  return provider.models.find(
    (model) => model.enabled && model.canonicalModelId === canonicalModelId,
  )?.providerModelId;
}
