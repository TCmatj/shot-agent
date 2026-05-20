import { describe, expect, it } from 'vitest';
import {
  addCanvasEdge,
  createCanvasEdge,
  createSequentialEdges,
  createWorkspaceState,
  deleteCanvas,
  exportCanvas,
  getNodeCenter,
  getNodeInputPoint,
  getNodeOutputPoint,
  importCanvas,
  parseWorkspaceState,
  renameCanvas,
  removeCanvasEdge,
  removeCanvasNode,
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

  it('renames a canvas when name is not empty', () => {
    const state = createWorkspaceState(canvases);

    expect(renameCanvas(state, 'canvas_first', '  新名字  ').canvases[0].name).toBe('新名字');
    expect(renameCanvas(state, 'canvas_first', '   ')).toEqual(state);
  });

  it('deletes canvas and moves active selection', () => {
    const state = {
      activeCanvasId: 'canvas_second',
      canvases,
    };

    expect(deleteCanvas(state, 'canvas_second')).toEqual({
      activeCanvasId: 'canvas_first',
      canvases: [canvases[0]],
    });
  });

  it('keeps the last canvas when deleting', () => {
    const state = createWorkspaceState([canvases[0]]);

    expect(deleteCanvas(state, 'canvas_first')).toEqual(state);
  });

  it('exports and imports a canvas with a new id', () => {
    const state = createWorkspaceState(canvases);
    const imported = importCanvas(state, exportCanvas(canvases[0]), 'canvas_imported');

    expect(imported.activeCanvasId).toBe('canvas_imported');
    expect(imported.canvases).toHaveLength(3);
    expect(imported.canvases[2]).toEqual({
      ...canvases[0],
      id: 'canvas_imported',
      updatedAt: '刚刚',
    });
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

  it('returns node input and output points for edge handles', () => {
    const node = { id: 'node_1', title: 'A', modelId: 'a', kind: 'image' as const, x: 40, y: 20 };

    expect(getNodeInputPoint(node)).toEqual({ x: 40, y: 108 });
    expect(getNodeOutputPoint(node)).toEqual({ x: 360, y: 108 });
  });

  it('creates stable canvas edge ids', () => {
    expect(createCanvasEdge('node_1', 'node_2')).toEqual({
      id: 'edge_node_1_node_2',
      fromNodeId: 'node_1',
      toNodeId: 'node_2',
    });
  });

  it('adds edges without self links or duplicates', () => {
    const first = addCanvasEdge([], 'node_1', 'node_2');

    expect(first).toEqual([
      { id: 'edge_node_1_node_2', fromNodeId: 'node_1', toNodeId: 'node_2' },
    ]);
    expect(addCanvasEdge(first, 'node_1', 'node_1')).toEqual(first);
    expect(addCanvasEdge(first, 'node_1', 'node_2')).toEqual(first);
  });

  it('removes a canvas edge by id', () => {
    const edges = [
      { id: 'edge_node_1_node_2', fromNodeId: 'node_1', toNodeId: 'node_2' },
      { id: 'edge_node_2_node_3', fromNodeId: 'node_2', toNodeId: 'node_3' },
    ];

    expect(removeCanvasEdge(edges, 'edge_node_1_node_2')).toEqual([
      { id: 'edge_node_2_node_3', fromNodeId: 'node_2', toNodeId: 'node_3' },
    ]);
  });

  it('removes a canvas node and its connected edges', () => {
    const canvas: CanvasView = {
      id: 'canvas_1',
      name: '画布',
      updatedAt: '刚刚',
      nodes: [
        { id: 'node_1', title: 'A', modelId: 'a', kind: 'image', x: 0, y: 0 },
        { id: 'node_2', title: 'B', modelId: 'b', kind: 'video', x: 320, y: 0 },
        { id: 'node_3', title: 'C', modelId: 'c', kind: 'chat', x: 640, y: 0 },
      ],
      edges: [
        { id: 'edge_node_1_node_2', fromNodeId: 'node_1', toNodeId: 'node_2' },
        { id: 'edge_node_2_node_3', fromNodeId: 'node_2', toNodeId: 'node_3' },
      ],
    };

    expect(removeCanvasNode(canvas, 'node_2')).toEqual({
      ...canvas,
      nodes: [{ id: 'node_1', title: 'A', modelId: 'a', kind: 'image', x: 0, y: 0 }, { id: 'node_3', title: 'C', modelId: 'c', kind: 'chat', x: 640, y: 0 }],
      edges: [],
    });
  });
});
