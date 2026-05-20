export type CanvasNodeKind = 'image' | 'video' | 'chat' | 'textAsset' | 'imageAsset' | 'videoAsset';

export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  textContent?: string;
  assetName?: string;
  assetDataUrl?: string;
  assetMimeType?: string;
};

export type CanvasEdgeView = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
};

export type CanvasView = {
  id: string;
  name: string;
  updatedAt: string;
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
    kind === 'videoAsset'
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
    typeof edge.toNodeId === 'string'
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
  if (!storage || storage.mode === 'browser-local') {
    return {
      mode: 'browser-local',
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
      mode: 'browser-local',
    },
  };
}

export function serializeWorkspaceState(state: CanvasWorkspaceState): string {
  return JSON.stringify({
    version: storageVersion,
    activeCanvasId: state.activeCanvasId,
    canvases: state.canvases,
    storage: normalizeStorageConfig(state.storage),
  });
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
    };
  } catch {
    return fallback;
  }
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

export function getNodeCenter(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + 160,
    y: node.y + 88,
  };
}

export function getNodeInputPoint(node: CanvasNodeView): { x: number; y: number } {
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

export function canNodeReceiveInput(node: CanvasNodeView): boolean {
  return node.kind === 'image' || node.kind === 'video' || node.kind === 'chat';
}

export function createSequentialEdges(nodes: CanvasNodeView[]): CanvasEdgeView[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    fromNodeId: node.id,
    toNodeId: nodes[index + 1].id,
  }));
}

export function createCanvasEdge(fromNodeId: string, toNodeId: string): CanvasEdgeView {
  return {
    id: `edge_${fromNodeId}_${toNodeId}`,
    fromNodeId,
    toNodeId,
  };
}

export function addCanvasEdge(
  edges: CanvasEdgeView[],
  fromNodeId: string,
  toNodeId: string,
): CanvasEdgeView[] {
  if (fromNodeId === toNodeId) {
    return edges;
  }

  if (edges.some((edge) => edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId)) {
    return edges;
  }

  return [...edges, createCanvasEdge(fromNodeId, toNodeId)];
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
