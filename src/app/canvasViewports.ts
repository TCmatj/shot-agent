import type { CanvasViewport } from './canvasViewport';

export type StoredCanvasViewports = Record<string, CanvasViewport>;

function isCanvasViewport(value: unknown): value is CanvasViewport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const viewport = value as CanvasViewport;

  return (
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Number.isFinite(viewport.scale) &&
    viewport.scale > 0
  );
}

export function parseStoredCanvasViewports(value: string | null): StoredCanvasViewports {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, CanvasViewport] =>
          typeof entry[0] === 'string' && isCanvasViewport(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function serializeStoredCanvasViewports(viewports: StoredCanvasViewports): string {
  return JSON.stringify(viewports);
}
