import type { ProviderConfig } from '../domain/provider';

export type ProviderConnectionResult = {
  ok: boolean;
  status?: number;
  message: string;
  rawResponse?: unknown;
};

export type ProviderAdapter = {
  protocol: ProviderConfig['protocol'];
  testConnection(provider: ProviderConfig): Promise<ProviderConnectionResult>;
};

export class ProviderRegistry {
  private readonly adapters = new Map<ProviderConfig['protocol'], ProviderAdapter>();

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.protocol, adapter);
  }

  async testConnection(provider: ProviderConfig): Promise<ProviderConnectionResult> {
    const adapter = this.adapters.get(provider.protocol);

    if (!adapter) {
      return {
        ok: false,
        message: `未找到协议适配器：${provider.protocol}`,
      };
    }

    return adapter.testConnection(provider);
  }
}
