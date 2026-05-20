export type CanvasNodeKind = 'image' | 'video' | 'chat';

export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
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

export type CanvasWorkspaceState = {
  activeCanvasId: string;
  canvases: CanvasView[];
};

const storageVersion = 1;

type PersistedCanvasWorkspaceState = CanvasWorkspaceState & {
  version: number;
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
    (node.kind === 'image' || node.kind === 'video' || node.kind === 'chat') &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
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
    (canvas.edges === undefined || Array.isArray(canvas.edges))
  );
}

export function createWorkspaceState(canvases: CanvasView[]): CanvasWorkspaceState {
  const firstCanvas = canvases[0];

  return {
    activeCanvasId: firstCanvas?.id ?? '',
    canvases,
  };
}

export function serializeWorkspaceState(state: CanvasWorkspaceState): string {
  return JSON.stringify({
    version: storageVersion,
    activeCanvasId: state.activeCanvasId,
    canvases: state.canvases,
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
      parsed.canvases.length === 0 ||
      !parsed.canvases.every(isCanvasView)
    ) {
      return fallback;
    }

    const activeCanvasExists = parsed.canvases.some(
      (canvas) => canvas.id === parsed.activeCanvasId,
    );

    return {
      activeCanvasId: activeCanvasExists ? parsed.activeCanvasId : parsed.canvases[0].id,
      canvases: parsed.canvases.map((canvas) => ({
        ...canvas,
        edges: canvas.edges ?? [],
      })),
    };
  } catch {
    return fallback;
  }
}

export function getNodeCenter(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + 160,
    y: node.y + 88,
  };
}

export function createSequentialEdges(nodes: CanvasNodeView[]): CanvasEdgeView[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    fromNodeId: node.id,
    toNodeId: nodes[index + 1].id,
  }));
}
