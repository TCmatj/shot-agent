import { getCanvasNodeHeight, getCanvasNodeWidth, type CanvasNodeView } from './canvasWorkspace';

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

export type Size = {
  width: number;
  height: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function clampScale(scale: number): number {
  return Math.min(5, Math.max(0.1, scale));
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

export function screenToCanvasPoint(point: Point, viewport: CanvasViewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function getCanvasContentBounds(
  nodes: CanvasNodeView[],
  nodeSize: Size,
  padding = 80,
): Bounds {
  if (nodes.length === 0) {
    const width = nodeSize.width + padding * 2;
    const height = nodeSize.height + padding * 2;

    return {
      minX: -padding,
      minY: -padding,
      maxX: nodeSize.width + padding,
      maxY: nodeSize.height + padding,
      width,
      height,
    };
  }

  const minX = Math.min(...nodes.map((node) => node.x)) - padding;
  const minY = Math.min(...nodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...nodes.map((node) => node.x + getCanvasNodeWidth(node))) + padding;
  const maxY = Math.max(...nodes.map((node) => node.y + getCanvasNodeHeight(node))) + padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getViewportForCanvasCenter(
  center: Point,
  viewportSize: Size,
  scale: number,
): CanvasViewport {
  return {
    x: viewportSize.width / 2 - center.x * scale,
    y: viewportSize.height / 2 - center.y * scale,
    scale: clampScale(scale),
  };
}

export function getCanvasViewportBounds(
  viewport: CanvasViewport,
  viewportSize: Size,
  overscan = 0,
): Bounds {
  const minX = (-viewport.x) / viewport.scale - overscan;
  const minY = (-viewport.y) / viewport.scale - overscan;
  const maxX = (viewportSize.width - viewport.x) / viewport.scale + overscan;
  const maxY = (viewportSize.height - viewport.y) / viewport.scale + overscan;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
