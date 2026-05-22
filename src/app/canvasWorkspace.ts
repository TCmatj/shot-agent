import type { OutputVersion } from '../domain/outputVersions';
import type { GenerationRecord } from '../domain/generationHistory';
import type {
  ImageQuality,
  ImageResolutionTier,
} from '../domain/imageGenerationOptions';
import { getSeedanceInputPorts, type SeedanceInputPortId } from '../domain/seedance';

export type CanvasNodeKind =
  | 'image'
  | 'video'
  | 'chat'
  | 'textAsset'
  | 'imageAsset'
  | 'videoAsset'
  | 'audioAsset';

export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  chatFormat?: 'openai' | 'anthropic';
  providerId?: string;
  providerModelId?: string;
  imageResolutionTier?: ImageResolutionTier;
  imageAspectRatio?: string;
  imageQuality?: ImageQuality;
  seedanceScenario?:
    | 'text_to_video'
    | 'image_to_video_first_frame'
    | 'image_to_video_first_last_frame'
    | 'multimodal_reference_video';
  videoResolution?: '480p' | '720p' | '1080p';
  videoRatio?: string;
  videoDurationSeconds?: number;
  videoFramesPerSecond?: number;
  videoSeed?: number;
  videoGenerateAudio?: boolean;
  videoReturnLastFrame?: boolean;
  videoPriority?: number;
  estimatedTokenCost?: number;
  settledCompletionTokens?: number;
  settledTotalTokens?: number;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  prompt?: string;
  generationStatus?: 'idle' | 'running' | 'succeeded' | 'failed';
  generationError?: string;
  outputVersions?: OutputVersion[];
  modelOutputText?: string;
  outputText?: string;
  outputUrl?: string;
  outputDataUrl?: string;
  outputPath?: string;
  outputCoverPath?: string;
  outputCoverDataUrl?: string;
  generationId?: string;
  textContent?: string;
  assetName?: string;
  assetPath?: string;
  assetDataUrl?: string;
  assetMimeType?: string;
};

export type CanvasEdgeView = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  toPortId?: SeedanceInputPortId | 'default';
};

export type CanvasSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasView = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: CanvasNodeView[];
  edges: CanvasEdgeView[];
};

export type CanvasClipboardPayload = {
  nodes: CanvasNodeView[];
  edges: CanvasEdgeView[];
};

export type CanvasStorageConfig =
  | {
      mode: 'browser-local';
    }
  | {
      mode: 'custom-folder';
      folderName?: string;
      folderPath?: string;
    };

export type CanvasWorkspaceState = {
  activeCanvasId: string;
  canvases: CanvasView[];
  storage: CanvasStorageConfig;
  generationHistory: GenerationRecord[];
};

const storageVersion = 1;
const canvasExportVersion = 1;

type PersistedCanvasWorkspaceState = CanvasWorkspaceState & {
  version: number;
};

type CanvasExportPayload = {
  version: number;
  canvas: CanvasView;
};

function isCanvasNodeView(value: unknown): value is CanvasNodeView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as CanvasNodeView;
  return (
    typeof node.id === 'string' &&
    typeof node.title === 'string' &&
    typeof node.modelId === 'string' &&
    isCanvasNodeKind(node.kind) &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
  );
}

function isCanvasNodeKind(kind: unknown): kind is CanvasNodeKind {
  return (
    kind === 'image' ||
    kind === 'video' ||
    kind === 'chat' ||
    kind === 'textAsset' ||
    kind === 'imageAsset' ||
    kind === 'videoAsset' ||
    kind === 'audioAsset'
  );
}

function isCanvasEdgeView(value: unknown): value is CanvasEdgeView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const edge = value as CanvasEdgeView;
  return (
    typeof edge.id === 'string' &&
    typeof edge.fromNodeId === 'string' &&
    typeof edge.toNodeId === 'string' &&
    (edge.toPortId === undefined || typeof edge.toPortId === 'string')
  );
}

function isCanvasView(value: unknown): value is CanvasView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const canvas = value as CanvasView;
  return (
    typeof canvas.id === 'string' &&
    typeof canvas.name === 'string' &&
    typeof canvas.updatedAt === 'string' &&
    Array.isArray(canvas.nodes) &&
    canvas.nodes.every(isCanvasNodeView) &&
    (canvas.edges === undefined ||
      (Array.isArray(canvas.edges) && canvas.edges.every(isCanvasEdgeView)))
  );
}

function normalizeCanvas(canvas: CanvasView): CanvasView {
  return {
    ...canvas,
    nodes: canvas.nodes.map(normalizeNode),
    edges: canvas.edges ?? [],
  };
}

function isCanvasStorageConfig(value: unknown): value is CanvasStorageConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const storage = value as CanvasStorageConfig;

  if (storage.mode === 'browser-local') {
    return true;
  }

  if (storage.mode !== 'custom-folder') {
    return false;
  }

  return (
    (storage.folderName === undefined || typeof storage.folderName === 'string') &&
    (storage.folderPath === undefined || typeof storage.folderPath === 'string')
  );
}

function normalizeStorageConfig(storage?: CanvasStorageConfig): CanvasStorageConfig {
  if (!storage) {
    return {
      mode: 'custom-folder',
    };
  }

  if (storage.mode === 'browser-local') {
    return {
      mode: 'custom-folder',
    };
  }

  const folderName = storage.folderName?.trim();
  const folderPath = storage.folderPath?.trim();

  return {
    mode: 'custom-folder',
    ...(folderName ? { folderName } : {}),
    ...(folderPath ? { folderPath } : {}),
  };
}

export function createWorkspaceState(canvases: CanvasView[]): CanvasWorkspaceState {
  const firstCanvas = canvases[0];

  return {
    activeCanvasId: firstCanvas?.id ?? '',
    canvases,
    storage: {
      mode: 'custom-folder',
    },
    generationHistory: [],
  };
}

export function serializeWorkspaceState(state: CanvasWorkspaceState): string {
  return JSON.stringify({
    version: storageVersion,
    activeCanvasId: state.activeCanvasId,
    canvases: stripTransientAssetData(state.canvases),
    storage: normalizeStorageConfig(state.storage),
    generationHistory: state.generationHistory,
  });
}

export function stripTransientAssetData(canvases: CanvasView[]): CanvasView[] {
  return canvases.map((canvas) => ({
    ...canvas,
    nodes: canvas.nodes.map((node) => ({
      ...node,
      assetDataUrl: node.assetPath ? undefined : node.assetDataUrl,
      outputDataUrl: node.outputPath ? undefined : node.outputDataUrl,
      outputCoverDataUrl: node.outputCoverPath ? undefined : node.outputCoverDataUrl,
    })),
  }));
}

export function parseWorkspaceState(
  value: string | null,
  fallback: CanvasWorkspaceState,
): CanvasWorkspaceState {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedCanvasWorkspaceState>;

    if (
      parsed.version !== storageVersion ||
      typeof parsed.activeCanvasId !== 'string' ||
      !Array.isArray(parsed.canvases) ||
      !parsed.canvases.every(isCanvasView) ||
      (parsed.storage !== undefined && !isCanvasStorageConfig(parsed.storage))
    ) {
      return fallback;
    }

    const activeCanvasExists = parsed.canvases.some(
      (canvas) => canvas.id === parsed.activeCanvasId,
    );

    return {
      activeCanvasId: activeCanvasExists ? parsed.activeCanvasId : (parsed.canvases[0]?.id ?? ''),
      canvases: parsed.canvases.map(normalizeCanvas),
      storage: normalizeStorageConfig(parsed.storage),
      generationHistory: Array.isArray(parsed.generationHistory)
        ? parsed.generationHistory.filter(isGenerationRecord).map(normalizeGenerationRecord)
        : [],
    };
  } catch {
    return fallback;
  }
}

function normalizeGenerationRecord(record: GenerationRecord): GenerationRecord {
  if (record.status !== 'running') {
    return record;
  }

  return {
    ...record,
    status: 'failed',
    errorMessage: '页面刷新后生成请求已中断，请重新提交。',
    endedAt: record.endedAt ?? new Date().toISOString(),
  };
}

function normalizeNode(node: CanvasNodeView): CanvasNodeView {
  const normalizedNode = normalizeChatNodeModelId(node);

  if (normalizedNode.generationStatus !== 'running') {
    return normalizedNode;
  }

  return {
    ...normalizedNode,
    generationStatus: 'failed',
    generationError: '页面刷新后生成请求已中断，请重新提交。',
  };
}

function normalizeChatNodeModelId(node: CanvasNodeView): CanvasNodeView {
  if (node.kind !== 'chat') {
    return node;
  }

  if (node.modelId === 'chat-openai') {
    return {
      ...node,
      modelId: 'gpt-5.4-mini',
      chatFormat: node.chatFormat ?? 'openai',
    };
  }

  if (node.modelId === 'chat-anthropic') {
    return {
      ...node,
      modelId: 'claude-sonnet-4-5',
      chatFormat: node.chatFormat ?? 'anthropic',
    };
  }

  return node;
}

function isGenerationRecord(value: unknown): value is GenerationRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as GenerationRecord;
  return (
    typeof record.id === 'string' &&
    typeof record.nodeId === 'string' &&
    typeof record.nodeKind === 'string' &&
    typeof record.canonicalModelId === 'string' &&
    typeof record.providerId === 'string' &&
    typeof record.providerModelId === 'string' &&
    typeof record.prompt === 'string' &&
    Array.isArray(record.promptReferences) &&
    Array.isArray(record.inputAssetIds) &&
    Array.isArray(record.outputAssetIds) &&
    typeof record.status === 'string' &&
    typeof record.attempts === 'number' &&
    typeof record.createdAt === 'string'
  );
}

export function updateWorkspaceStorage(
  state: CanvasWorkspaceState,
  storage: CanvasStorageConfig,
): CanvasWorkspaceState {
  return {
    ...state,
    storage: normalizeStorageConfig(storage),
  };
}

export function renameCanvas(
  state: CanvasWorkspaceState,
  canvasId: string,
  name: string,
): CanvasWorkspaceState {
  const nextName = name.trim();

  if (!nextName) {
    return state;
  }

  if (isCanvasNameTaken(state, nextName, canvasId)) {
    return state;
  }

  return {
    ...state,
    canvases: state.canvases.map((canvas) =>
      canvas.id === canvasId ? { ...canvas, name: nextName, updatedAt: '刚刚' } : canvas,
    ),
  };
}

export function deleteCanvas(
  state: CanvasWorkspaceState,
  canvasId: string,
): CanvasWorkspaceState {
  const deletedIndex = state.canvases.findIndex((canvas) => canvas.id === canvasId);
  const canvases = state.canvases.filter((canvas) => canvas.id !== canvasId);

  if (state.activeCanvasId !== canvasId) {
    return {
      ...state,
      canvases,
    };
  }

  const fallbackCanvas = canvases[Math.max(0, deletedIndex - 1)] ?? canvases[0];

  return {
    ...state,
    activeCanvasId: fallbackCanvas?.id ?? '',
    canvases,
  };
}

export function exportCanvas(canvas: CanvasView): string {
  return JSON.stringify(
    {
      version: canvasExportVersion,
      canvas,
    },
    null,
    2,
  );
}

export function importCanvas(
  state: CanvasWorkspaceState,
  value: string,
  nextId: string,
): CanvasWorkspaceState {
  const parsed = JSON.parse(value) as Partial<CanvasExportPayload>;

  if (parsed.version !== canvasExportVersion || !isCanvasView(parsed.canvas)) {
    throw new Error('画布文件格式无效');
  }

  const canvas = normalizeCanvas(parsed.canvas);
  if (isCanvasNameTaken(state, canvas.name)) {
    throw new Error('已存在同名画布');
  }
  const importedCanvas: CanvasView = {
    ...canvas,
    id: nextId,
    updatedAt: '刚刚',
    nodes: canvas.nodes.map((node) => ({ ...node })),
    edges: canvas.edges.map((edge) => ({ ...edge })),
  };

  return {
    ...state,
    activeCanvasId: importedCanvas.id,
    canvases: [...state.canvases, importedCanvas],
  };
}

export function getNextAvailableCanvasName(
  state: CanvasWorkspaceState,
  baseName = '新画布',
): string {
  let index = 1;
  let candidate = `${baseName} ${index}`;

  while (isCanvasNameTaken(state, candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }

  return candidate;
}

function isCanvasNameTaken(
  state: CanvasWorkspaceState,
  name: string,
  excludeCanvasId?: string,
): boolean {
  const target = name.trim();

  return state.canvases.some(
    (canvas) => canvas.id !== excludeCanvasId && canvas.name.trim() === target,
  );
}

export function getNodeCenter(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + 160,
    y: node.y + 88,
  };
}

export function getNodeInputPoint(
  node: CanvasNodeView,
  portId?: SeedanceInputPortId | 'default',
): { x: number; y: number } {
  if (node.kind === 'video' && portId && portId !== 'default') {
    const ports = getSeedanceInputPorts(node.seedanceScenario ?? 'text_to_video');
    const portIndex = ports.findIndex((port) => port.id === portId);

    if (portIndex >= 0) {
      return {
        x: node.x,
        y: node.y + 60 + portIndex * 36,
      };
    }
  }

  return {
    x: node.x,
    y: node.y + 88,
  };
}

export function getNodeOutputPoint(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + 320,
    y: node.y + 88,
  };
}

export function normalizeCanvasSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): CanvasSelectionRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function findNodesInSelectionRect(
  nodes: CanvasNodeView[],
  rect: CanvasSelectionRect,
  nodeSize: { width: number; height: number },
): string[] {
  return nodes
    .filter((node) =>
      rectanglesIntersect(rect, {
        x: node.x,
        y: node.y,
        width: nodeSize.width,
        height: nodeSize.height,
      }),
    )
    .map((node) => node.id);
}

export function moveCanvasNodes(
  nodes: CanvasNodeView[],
  nodeIds: string[],
  delta: { dx: number; dy: number },
): CanvasNodeView[] {
  const selectedIds = new Set(nodeIds);

  return nodes.map((node) =>
    selectedIds.has(node.id)
      ? {
          ...node,
          x: node.x + delta.dx,
          y: node.y + delta.dy,
        }
      : node,
  );
}

export function copyCanvasSelection(
  canvas: CanvasView,
  nodeIds: string[],
): CanvasClipboardPayload | null {
  const selectedNodeIds = new Set(nodeIds);
  const nodes = canvas.nodes.filter((node) => selectedNodeIds.has(node.id));

  if (nodes.length === 0) {
    return null;
  }

  return {
    nodes: nodes.map((node) => ({ ...node })),
    edges: canvas.edges
      .filter(
        (edge) => selectedNodeIds.has(edge.fromNodeId) && selectedNodeIds.has(edge.toNodeId),
      )
      .map((edge) => ({ ...edge })),
  };
}

export function pasteCanvasClipboard(
  canvas: CanvasView,
  payload: CanvasClipboardPayload,
  options: {
    createNodeId(node: CanvasNodeView): string;
    offset?: { dx: number; dy: number };
  },
): { canvas: CanvasView; pastedNodeIds: string[] } {
  const offset = options.offset ?? { dx: 36, dy: 36 };
  const idMap = new Map<string, string>();

  payload.nodes.forEach((node) => {
    idMap.set(node.id, options.createNodeId(node));
  });

  const pastedNodes = payload.nodes.map((node) => {
    const nextId = idMap.get(node.id)!;

    return {
      ...node,
      id: nextId,
      x: node.x + offset.dx,
      y: node.y + offset.dy,
      prompt: node.prompt ? remapPromptNodeReferences(node.prompt, idMap) : node.prompt,
      generationStatus: undefined,
      generationError: undefined,
      generationId: undefined,
    };
  });
  const pastedEdges = payload.edges.flatMap((edge) => {
    const fromNodeId = idMap.get(edge.fromNodeId);
    const toNodeId = idMap.get(edge.toNodeId);

    return fromNodeId && toNodeId
      ? [createCanvasEdge(fromNodeId, toNodeId, edge.toPortId)]
      : [];
  });

  return {
    canvas: {
      ...canvas,
      updatedAt: '刚刚',
      nodes: [...canvas.nodes, ...pastedNodes],
      edges: [...canvas.edges, ...pastedEdges],
    },
    pastedNodeIds: pastedNodes.map((node) => node.id),
  };
}

function remapPromptNodeReferences(prompt: string, idMap: Map<string, string>): string {
  return prompt.replace(/@(text|image|video|audio|file):([a-zA-Z0-9_-]+)/g, (token, kind, nodeId) => {
    const nextNodeId = idMap.get(nodeId);

    return nextNodeId ? `@${kind}:${nextNodeId}` : token;
  });
}

export function getUpstreamNodeIds(canvas: CanvasView, nodeId: string): string[] {
  const upstreamNodeIds: string[] = [];
  const visited = new Set<string>([nodeId]);
  const queue = canvas.edges
    .filter((edge) => edge.toNodeId === nodeId)
    .map((edge) => edge.fromNodeId);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);
    upstreamNodeIds.push(currentNodeId);

    canvas.edges
      .filter((edge) => edge.toNodeId === currentNodeId)
      .forEach((edge) => queue.push(edge.fromNodeId));
  }

  return upstreamNodeIds;
}

function rectanglesIntersect(first: CanvasSelectionRect, second: CanvasSelectionRect): boolean {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

export function canNodeReceiveInput(node: CanvasNodeView): boolean {
  return node.kind === 'image' || node.kind === 'video' || node.kind === 'chat';
}

export function canConnectCanvasNodes(fromNode: CanvasNodeView, toNode: CanvasNodeView): boolean {
  if (fromNode.id === toNode.id) {
    return false;
  }

  if (!canNodeReceiveInput(toNode)) {
    return false;
  }

  if (
    toNode.kind === 'chat' &&
    (fromNode.kind === 'video' || fromNode.kind === 'videoAsset' || fromNode.kind === 'audioAsset')
  ) {
    return false;
  }

  return true;
}

export function createSequentialEdges(nodes: CanvasNodeView[]): CanvasEdgeView[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    fromNodeId: node.id,
    toNodeId: nodes[index + 1].id,
  }));
}

export function createCanvasEdge(
  fromNodeId: string,
  toNodeId: string,
  toPortId?: SeedanceInputPortId | 'default',
): CanvasEdgeView {
  return {
    id: `edge_${fromNodeId}_${toNodeId}${toPortId ? `_${toPortId}` : ''}`,
    fromNodeId,
    toNodeId,
    ...(toPortId ? { toPortId } : {}),
  };
}

export function addCanvasEdge(
  edges: CanvasEdgeView[],
  fromNodeId: string,
  toNodeId: string,
  toPortId?: SeedanceInputPortId | 'default',
): CanvasEdgeView[] {
  if (fromNodeId === toNodeId) {
    return edges;
  }

  if (
    edges.some(
      (edge) =>
        edge.fromNodeId === fromNodeId &&
        edge.toNodeId === toNodeId &&
        (edge.toPortId ?? 'default') === (toPortId ?? 'default'),
    )
  ) {
    return edges;
  }

  return [...edges, createCanvasEdge(fromNodeId, toNodeId, toPortId)];
}

export function removeCanvasEdge(edges: CanvasEdgeView[], edgeId: string): CanvasEdgeView[] {
  return edges.filter((edge) => edge.id !== edgeId);
}

export function removeCanvasNode(canvas: CanvasView, nodeId: string): CanvasView {
  return {
    ...canvas,
    nodes: canvas.nodes.filter((node) => node.id !== nodeId),
    edges: canvas.edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
    ),
  };
}
