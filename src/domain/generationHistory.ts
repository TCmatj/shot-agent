import type { CanvasNodeKind, GenerationStatus, ID, PromptReference } from './types';

export type GenerationRecord = {
  id: ID;
  nodeId: ID;
  nodeKind: CanvasNodeKind;
  canonicalModelId: string;
  providerId: ID;
  providerModelId: string;
  prompt: string;
  promptReferences: PromptReference[];
  inputAssetIds: ID[];
  outputAssetIds: ID[];
  workflowSnapshotPath?: string;
  status: GenerationStatus;
  errorMessage?: string;
  attempts: number;
  retry: {
    enabled: boolean;
    maxAttempts: number;
  };
  usage?: unknown;
  estimatedCost?: {
    amount: number;
    currency: string;
  };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
};

type CreateGenerationRecordInput = {
  id: ID;
  nodeId: ID;
  nodeKind: CanvasNodeKind;
  canonicalModelId: string;
  providerId: ID;
  providerModelId: string;
  prompt: string;
  promptReferences?: PromptReference[];
  inputAssetIds?: ID[];
  now?: string;
};

export function createGenerationRecord(input: CreateGenerationRecordInput): GenerationRecord {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.id,
    nodeId: input.nodeId,
    nodeKind: input.nodeKind,
    canonicalModelId: input.canonicalModelId,
    providerId: input.providerId,
    providerModelId: input.providerModelId,
    prompt: input.prompt,
    promptReferences: input.promptReferences ?? [],
    inputAssetIds: input.inputAssetIds ?? [],
    outputAssetIds: [],
    status: 'queued',
    attempts: 0,
    retry: {
      enabled: true,
      maxAttempts: 3,
    },
    createdAt: now,
  };
}

export function shouldRetryGeneration(record: GenerationRecord): boolean {
  return (
    record.status === 'failed' &&
    record.retry.enabled &&
    record.attempts < record.retry.maxAttempts
  );
}
