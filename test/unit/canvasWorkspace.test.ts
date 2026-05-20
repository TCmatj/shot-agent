import { describe, expect, it } from 'vitest';
import {
  createSequentialEdges,
  createWorkspaceState,
  getNodeCenter,
  parseWorkspaceState,
  serializeWorkspaceState,
  type CanvasView,
} from '../../src/app/canvasWorkspace';

const canvases: CanvasView[] = [
  {
    id: 'canvas_first',
    name: '默认画布',
    updatedAt: '刚刚',
    nodes: [],
    edges: [],
  },
  {
    id: 'canvas_second',
    name: '第二画布',
    updatedAt: '刚刚',
    nodes: [],
    edges: [],
  },
];

describe('canvas workspace persistence', () => {
  it('uses first canvas as default active canvas', () => {
    expect(createWorkspaceState(canvases).activeCanvasId).toBe('canvas_first');
  });

  it('serializes and parses workspace state', () => {
    const state = {
      activeCanvasId: 'canvas_second',
      canvases,
    };

    expect(parseWorkspaceState(serializeWorkspaceState(state), createWorkspaceState(canvases))).toEqual(
      state,
    );
  });

  it('falls back when storage payload is invalid', () => {
    const fallback = createWorkspaceState(canvases);

    expect(parseWorkspaceState('{bad json', fallback)).toEqual(fallback);
    expect(parseWorkspaceState('{"version":1,"activeCanvasId":"missing","canvases":[]}', fallback)).toEqual(
      fallback,
    );
  });

  it('creates sequential edges from canvas nodes', () => {
    const edges = createSequentialEdges([
      { id: 'node_1', title: 'A', modelId: 'a', kind: 'image', x: 0, y: 0 },
      { id: 'node_2', title: 'B', modelId: 'b', kind: 'video', x: 320, y: 0 },
    ]);

    expect(edges).toEqual([
      { id: 'edge_node_1_node_2', fromNodeId: 'node_1', toNodeId: 'node_2' },
    ]);
  });

  it('returns node center for edge rendering', () => {
    expect(getNodeCenter({ id: 'node_1', title: 'A', modelId: 'a', kind: 'image', x: 40, y: 20 })).toEqual({
      x: 200,
      y: 108,
    });
  });
});
