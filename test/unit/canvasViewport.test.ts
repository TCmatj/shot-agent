import { describe, expect, it } from 'vitest';
import {
  clampScale,
  filterVisibleCanvasNodes,
  getCanvasContentBounds,
  getCanvasViewportBounds,
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

  it('clamps zoom scale between 10% and 500%', () => {
    expect(clampScale(0.05)).toBe(0.1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(6)).toBe(5);
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
          { id: 'node_1', title: 'One', modelId: 'gpt-image-2', kind: 'image', x: 100, y: 80 },
          { id: 'node_2', title: 'Two', modelId: 'gpt-image-2', kind: 'image', x: 500, y: 240 },
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

  it('computes visible canvas bounds for the current viewport', () => {
    expect(
      getCanvasViewportBounds(
        { x: 80, y: 72, scale: 2 },
        { width: 800, height: 600 },
        120,
      ),
    ).toEqual({
      minX: -160,
      minY: -156,
      maxX: 480,
      maxY: 384,
      width: 640,
      height: 540,
    });
  });

  it('keeps selected nodes visible even when fully outside the viewport', () => {
    const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
    const node = {
      id: 'node_selected',
      title: '选中节点',
      modelId: 'gpt-image-2',
      kind: 'image' as const,
      x: 5000,
      y: 5000,
    };

    expect(
      filterVisibleCanvasNodes([node], bounds, {
        selectedNodeId: 'node_selected',
        selectedNodeIds: new Set(),
      }),
    ).toHaveLength(1);
  });

  it('uses measured height so a tall node partly inside the viewport is not culled', () => {
    // 视口位于 canvas 坐标 y∈[-240, 1040]（含 overscan）。
    const bounds = { minX: -240, minY: -240, maxX: 1040, maxY: 1040, width: 1280, height: 1280 };
    // 高节点：顶部在视口上方（y=-500），但真实高度 700，底部到 200 仍在视口内。
    const node = {
      id: 'node_tall',
      title: '高节点',
      modelId: 'gpt-image-2',
      kind: 'image' as const,
      x: 100,
      y: -500,
    };

    // 无实测高度：估算高度 220 → 底部 -280 < minY(-240) → 被误剔除（复现 bug）。
    expect(
      filterVisibleCanvasNodes([node], bounds, {
        selectedNodeId: null,
        selectedNodeIds: new Set(),
      }),
    ).toHaveLength(0);

    // 有实测高度 700：底部 200 > minY → 保留（修复后行为）。
    expect(
      filterVisibleCanvasNodes([node], bounds, {
        selectedNodeId: null,
        selectedNodeIds: new Set(),
        measuredHeights: new Map([['node_tall', 700]]),
      }),
    ).toHaveLength(1);
  });
});
