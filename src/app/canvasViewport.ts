export type CanvasViewport = {
  x: number;
  y: number;
  scale: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Delta = {
  dx: number;
  dy: number;
};

export function clampScale(scale: number): number {
  return Math.min(2.5, Math.max(0.35, scale));
}

export function panViewport(viewport: CanvasViewport, delta: Delta): CanvasViewport {
  return {
    ...viewport,
    x: viewport.x + delta.dx,
    y: viewport.y + delta.dy,
  };
}

export function zoomViewportAtPoint(
  viewport: CanvasViewport,
  pointer: Point,
  nextScale: number,
): CanvasViewport {
  const scale = clampScale(nextScale);
  const canvasX = (pointer.x - viewport.x) / viewport.scale;
  const canvasY = (pointer.y - viewport.y) / viewport.scale;

  return {
    x: pointer.x - canvasX * scale,
    y: pointer.y - canvasY * scale,
    scale,
  };
}

export function moveCanvasNode(position: Point, delta: Delta, scale: number): Point {
  return {
    x: position.x + delta.dx / scale,
    y: position.y + delta.dy / scale,
  };
}
