import type { ProviderConfig, ProviderModelConfig, ProviderProtocol } from '../domain/provider';
import { resolveProviderToken } from './generationClient';
import { runtimeFetch } from './httpFetch';

export type ProviderModelListRequest = {
  url: string;
  headers: Record<string, string>;
};

export type ProviderModelListResult =
  | {
      ok: true;
      models: ProviderModelConfig[];
    }
  | {
      ok: false;
      error: string;
    };

type ProviderModelListProtocol = ProviderProtocol | 'google' | 'ollama';

export function buildProviderModelListRequest(provider: ProviderConfig): ProviderModelListRequest {
  const protocol = getProviderModelListProtocol(provider);
  const token = resolveProviderToken(provider) ?? '';
  const baseURL = normalizeModelListBaseURL(provider.baseURL, protocol);
  const headers = buildProviderModelListHeaders(protocol, token);

  return {
    headers,
    url: `${baseURL}/models`,
  };
}

export async function fetchProviderModelList(
  provider: ProviderConfig,
  fetcher: typeof fetch = runtimeFetch,
): Promise<ProviderModelListResult> {
  try {
    const request = buildProviderModelListRequest(provider);
    const response = await fetcher(request.url, {
      headers: request.headers,
      method: 'GET',
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        error: readProviderModelListError(body) ?? `获取模型列表失败：HTTP ${response.status}`,
      };
    }

    const models = parseProviderModelList(provider, body);
    if (models.length === 0) {
      return { ok: false, error: '供应商未返回可用模型' };
    }

    return { ok: true, models };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取模型列表失败',
    };
  }
}

export function parseProviderModelList(
  provider: ProviderConfig,
  body: unknown,
): ProviderModelConfig[] {
  const protocol = getProviderModelListProtocol(provider);
  const records = readModelRecords(body);
  const seenModelIds = new Set<string>();

  return records.flatMap<ProviderModelConfig>((record) => {
    const providerModelId = readModelId(protocol, record);

    if (!providerModelId || seenModelIds.has(providerModelId) || isUnsupportedModelId(providerModelId)) {
      return [];
    }

    seenModelIds.add(providerModelId);
    return [
      {
        id: `model_${provider.id}_${sanitizeModelId(providerModelId)}`,
        providerModelId,
        canonicalModelId: providerModelId,
        displayName: readModelDisplayName(protocol, record, providerModelId),
        enabled: true,
      },
    ];
  });
}

export function mergeFetchedProviderModels(
  provider: ProviderConfig,
  fetchedModels: ProviderModelConfig[],
): ProviderConfig {
  const existingModels = new Map(
    provider.models.map((model) => [model.providerModelId, model]),
  );

  return {
    ...provider,
    models: fetchedModels.map((model) => ({
      ...model,
      canonicalModelId:
        existingModels.get(model.providerModelId)?.canonicalModelId ?? model.canonicalModelId,
      enabled: existingModels.get(model.providerModelId)?.enabled ?? model.enabled,
    })),
  };
}

function getProviderModelListProtocol(provider: ProviderConfig): ProviderModelListProtocol {
  if (provider.id === 'provider_google') {
    return 'google';
  }

  if (provider.id === 'provider_ollama') {
    return 'ollama';
  }

  return provider.protocol;
}

function buildProviderModelListHeaders(
  protocol: ProviderModelListProtocol,
  token: string,
): Record<string, string> {
  if (!token || protocol === 'custom' || protocol === 'ollama') {
    return {};
  }

  if (protocol === 'anthropic-compatible') {
    return {
      'anthropic-version': '2023-06-01',
      'x-api-key': token,
    };
  }

  if (protocol === 'google') {
    return {
      'x-goog-api-key': token,
    };
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeModelListBaseURL(
  baseURL: string,
  protocol: ProviderModelListProtocol,
): string {
  const trimmed = baseURL.replace(/\/+$/, '');

  if (protocol === 'volcengine') {
    return trimmed.endsWith('/api/v3') ? trimmed : `${trimmed}/api/v3`;
  }

  if (protocol === 'google') {
    return trimmed.replace(/\/openai\/?$/, '');
  }

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function readModelRecords(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body.filter(isRecord);
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.data)) {
    return body.data.filter(isRecord);
  }

  if (Array.isArray(body.models)) {
    return body.models.filter(isRecord);
  }

  return [];
}

function readModelId(
  protocol: ProviderModelListProtocol,
  record: Record<string, unknown>,
): string | undefined {
  const id = typeof record.id === 'string' ? record.id : undefined;
  const name = typeof record.name === 'string' ? record.name : undefined;

  if (protocol === 'google' && name?.startsWith('models/')) {
    return name.slice('models/'.length);
  }

  return id ?? name;
}

function readModelDisplayName(
  protocol: ProviderModelListProtocol,
  record: Record<string, unknown>,
  providerModelId: string,
): string {
  if (typeof record.displayName === 'string') {
    return record.displayName;
  }

  if (typeof record.display_name === 'string') {
    return record.display_name;
  }

  if (
    typeof record.name === 'string' &&
    !(protocol === 'google' && record.name.startsWith('models/'))
  ) {
    return record.name;
  }

  return providerModelId;
}

function isUnsupportedModelId(providerModelId: string): boolean {
  const normalizedModelId = providerModelId.toLowerCase();

  return (
    normalizedModelId.includes('audio') ||
    normalizedModelId.includes('embed') ||
    normalizedModelId.includes('moderation') ||
    normalizedModelId.includes('rerank') ||
    normalizedModelId.includes('tts') ||
    normalizedModelId.includes('whisper')
  );
}

function sanitizeModelId(providerModelId: string): string {
  return providerModelId.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function readProviderModelListError(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  if (typeof body.error === 'string') {
    return body.error;
  }

  if (isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
