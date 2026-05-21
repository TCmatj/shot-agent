import { describe, expect, it } from 'vitest';
import {
  getCanvasContentBounds,
  getViewportForCanvasCenter,
  moveCanvasNode,
  panViewport,
  screenToCanvasPoint,
  zoomViewportAtPoint,
} from '../../src/app/canvasViewport';

describe('canvas viewport', () => {
  it('pans viewport by screen delta', () => {
    expect(panViewport({ x: 10, y: 20, scale: 1 }, { dx: 15, dy: -5 })).toEqual({
      x: 25,
      y: 15,
      scale: 1,
    });
  });

  it('zooms around the pointer position', () => {
    const viewport = zoomViewportAtPoint(
      { x: 0, y: 0, scale: 1 },
      { x: 100, y: 100 },
      2,
    );

    expect(viewport).toEqual({ x: -100, y: -100, scale: 2 });
  });

  it('moves node by canvas-space delta', () => {
    expect(moveCanvasNode({ x: 120, y: 80 }, { dx: 30, dy: -10 }, 2)).toEqual({
      x: 135,
      y: 75,
    });
  });

  it('converts screen point into canvas point', () => {
    expect(screenToCanvasPoint({ x: 220, y: 172 }, { x: 80, y: 72, scale: 2 })).toEqual({
      x: 70,
      y: 50,
    });
  });

  it('adds padding around node bounds for the minimap', () => {
    expect(
      getCanvasContentBounds(
        [
          { x: 100, y: 80 },
          { x: 500, y: 240 },
        ],
        { width: 320, height: 220 },
        40,
      ),
    ).toEqual({
      minX: 60,
      minY: 40,
      maxX: 860,
      maxY: 500,
      width: 800,
      height: 460,
    });
  });

  it('centers the viewport on a canvas point selected from the minimap', () => {
    expect(getViewportForCanvasCenter({ x: 200, y: 120 }, { width: 800, height: 600 }, 1.5)).toEqual({
      x: 100,
      y: 120,
      scale: 1.5,
    });
  });
});
