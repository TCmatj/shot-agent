export type CanvasNodeKind = 'image' | 'video' | 'chat';

export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
};

export type CanvasView = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: CanvasNodeView[];
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
    canvas.nodes.every(isCanvasNodeView)
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
      canvases: parsed.canvases,
    };
  } catch {
    return fallback;
  }
}
