export type ID = string;
export type ISODateString = string;

export type AssetKind = 'image' | 'video' | 'audio' | 'file' | 'text';
export type CanvasNodeKind = 'image' | 'video' | 'chat' | 'asset';
export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type AssetReference =
  | {
      mode: 'relative';
      path: string;
    }
  | {
      mode: 'absolute';
      path: string;
    }
  | {
      mode: 'url';
      url: string;
    };

export type CanvasAsset = {
  id: ID;
  kind: AssetKind;
  name: string;
  reference: AssetReference;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  sourceGenerationId?: ID;
  missing?: boolean;
  missingPath?: string;
};

export type PromptReference = {
  token: string;
  assetId: ID;
  nodeId?: ID;
  path?: string;
  url?: string;
  kind: AssetKind;
};

export type CanvasNodeBase = {
  id: ID;
  kind: CanvasNodeKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outputAssetIds: ID[];
};

export type ModelNodeConfig = {
  canonicalModelId: string;
  providerId?: ID;
  prompt: string;
  promptReferences: PromptReference[];
  retry: {
    enabled: boolean;
    maxAttempts: number;
  };
};

export type CanvasNode = CanvasNodeBase & {
  model?: ModelNodeConfig;
};

export type CanvasEdge = {
  id: ID;
  fromNodeId: ID;
  toNodeId: ID;
};

export type CanvasWorkflow = {
  id: ID;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  currentGenerationIds: ID[];
};

export type CanvasProjectPaths = {
  canvas: string;
  workflow: string;
  generations: string;
  prompts: string;
  workflowSnapshots: string;
  assets: {
    images: string;
    videos: string;
    files: string;
    covers: string;
  };
  exports: string;
};

export type CanvasProject = {
  id: ID;
  name: string;
  rootDir: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  paths: CanvasProjectPaths;
};
