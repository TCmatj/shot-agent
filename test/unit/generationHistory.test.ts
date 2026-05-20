import { describe, expect, it } from 'vitest';
import { createGenerationRecord, shouldRetryGeneration } from '../../src/domain/generationHistory';

describe('generation history', () => {
  it('creates a generation record with retry defaults', () => {
    const record = createGenerationRecord({
      id: 'gen_1',
      nodeId: 'node_1',
      nodeKind: 'image',
      canonicalModelId: 'gpt-image-2',
      providerId: 'provider_1',
      providerModelId: 'image-2',
      prompt: '生成一张图',
      now: '2026-05-20T00:00:00.000Z',
    });

    expect(record.retry.enabled).toBe(true);
    expect(record.retry.maxAttempts).toBe(3);
    expect(record.status).toBe('queued');
  });

  it('allows retry while attempts are below max', () => {
    const record = createGenerationRecord({
      id: 'gen_1',
      nodeId: 'node_1',
      nodeKind: 'image',
      canonicalModelId: 'gpt-image-2',
      providerId: 'provider_1',
      providerModelId: 'image-2',
      prompt: '生成一张图',
      now: '2026-05-20T00:00:00.000Z',
    });

    expect(shouldRetryGeneration({ ...record, attempts: 2, status: 'failed' })).toBe(true);
    expect(shouldRetryGeneration({ ...record, attempts: 3, status: 'failed' })).toBe(false);
  });
});
