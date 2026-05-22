import type { Bounds, CanvasViewport, Size } from './canvasViewport';

export type StoredCanvasViewports = Record<string, CanvasViewport>;

export type MinimapViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapViewportFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitFrameToSize(start: number, length: number, maxLength: number): { start: number; length: number } {
  const nextLength = Math.min(length, maxLength);
  const nextStart = clamp(start, 0, Math.max(0, maxLength - nextLength));

  return {
    start: nextStart,
    length: nextLength,
  };
}

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

export function calculateMinimapViewportFrame(
  viewport: MinimapViewportRect,
  bounds: Bounds,
  minimapSize: Size,
  minimumSize: Size = { width: 14, height: 10 },
): MinimapViewportFrame {
  const scale = Math.min(minimapSize.width / bounds.width, minimapSize.height / bounds.height);
  const rawLeft = (viewport.x - bounds.minX) * scale;
  const rawTop = (viewport.y - bounds.minY) * scale;
  const rawRight = rawLeft + viewport.width * scale;
  const rawBottom = rawTop + viewport.height * scale;

  const visibleLeft = clamp(rawLeft, 0, minimapSize.width);
  const visibleTop = clamp(rawTop, 0, minimapSize.height);
  const visibleRight = clamp(rawRight, 0, minimapSize.width);
  const visibleBottom = clamp(rawBottom, 0, minimapSize.height);

  const horizontal = fitFrameToSize(
    visibleLeft,
    Math.max(minimumSize.width, visibleRight - visibleLeft),
    minimapSize.width,
  );
  const vertical = fitFrameToSize(
    visibleTop,
    Math.max(minimumSize.height, visibleBottom - visibleTop),
    minimapSize.height,
  );

  return {
    left: horizontal.start,
    top: vertical.start,
    width: horizontal.length,
    height: vertical.length,
  };
}
