import { describe, expect, it } from 'vitest';
import {
  addCanvasEdge,
  canConnectCanvasNodes,
  createCanvasEdge,
  createSequentialEdges,
  createWorkspaceState,
  canNodeReceiveInput,
  deleteCanvas,
  exportCanvas,
  findNodesInSelectionRect,
  getNodeCenter,
  getNodeInputPoint,
  getNodeOutputPoint,
  normalizeCanvasSelectionRect,
  importCanvas,
  parseWorkspaceState,
  renameCanvas,
  removeCanvasEdge,
  removeCanvasNode,
  serializeWorkspaceState,
  updateWorkspaceStorage,
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

  it('uses browser local storage as the default canvas storage setting', () => {
    expect(createWorkspaceState(canvases).storage).toEqual({
      mode: 'browser-local',
    });
  });

  it('serializes and parses workspace state', () => {
    const state = {
      activeCanvasId: 'canvas_second',
      canvases,
      storage: {
        mode: 'custom-folder' as const,
        folderName: 'Shot Agent',
        folderPath: '/Users/zz/Shot Agent',
      },
      generationHistory: [],
    };

    expect(parseWorkspaceState(serializeWorkspaceState(state), createWorkspaceState(canvases))).toEqual(
      state,
    );
  });

  it('falls back when storage payload is invalid', () => {
    const fallback = createWorkspaceState(canvases);

    expect(parseWorkspaceState('{bad json', fallback)).toEqual(fallback);
    expect(parseWorkspaceState('{"version":999,"activeCanvasId":"missing","canvases":[]}', fallback)).toEqual(fallback);
  });

  it('parses an empty canvas list', () => {
    expect(
      parseWorkspaceState('{"version":1,"activeCanvasId":"","canvases":[]}', createWorkspaceState(canvases)),
    ).toEqual({
      activeCanvasId: '',
      canvases: [],
      storage: {
        mode: 'browser-local',
      },
      generationHistory: [],
    });
  });

  it('parses custom canvas storage settings', () => {
    expect(
      parseWorkspaceState(
        '{"version":1,"activeCanvasId":"canvas_first","canvases":[{"id":"canvas_first","name":"默认画布","updatedAt":"刚刚","nodes":[],"edges":[]}],"storage":{"mode":"custom-folder","folderName":"镜头项目","folderPath":"/Volumes/Works/镜头项目"}}',
        createWorkspaceState(canvases),
      ).storage,
    ).toEqual({
      mode: 'custom-folder',
      folderName: '镜头项目',
      folderPath: '/Volumes/Works/镜头项目',
    });
  });

  it('marks interrupted running generations as failed when parsing persisted state', () => {
    const fallback = createWorkspaceState(canvases);

    expect(
      parseWorkspaceState(
        JSON.stringify({
          version: 1,
          activeCanvasId: 'canvas_first',
          canvases: [
            {
              id: 'canvas_first',
              name: '默认画布',
              updatedAt: '刚刚',
              edges: [],
              nodes: [
                {
                  id: 'node_1',
                  title: '提示词整理',
                  modelId: 'chat-openai',
                  kind: 'chat',
                  x: 0,
                  y: 0,
                  generationStatus: 'running',
                },
              ],
            },
          ],
          storage: { mode: 'browser-local' },
        }),
        fallback,
      ).canvases[0].nodes[0],
    ).toMatchObject({
      modelId: 'gpt-5.4-mini',
      generationStatus: 'failed',
      generationError: '页面刷新后生成请求已中断，请重新提交。',
    });
  });

  it('serializes and parses generation history records', () => {
    const state = {
      ...createWorkspaceState(canvases),
      generationHistory: [
        {
          id: 'gen_1',
          nodeId: 'node_1',
          nodeKind: 'chat' as const,
          canonicalModelId: 'chat-openai',
          providerId: 'provider_1',
          providerModelId: 'gpt-5',
          prompt: '整理提示词',
          promptReferences: [],
          inputAssetIds: [],
          outputAssetIds: [],
          status: 'succeeded' as const,
          attempts: 1,
          retry: { enabled: true, maxAttempts: 3 },
          createdAt: '2026-05-21T00:00:00.000Z',
          startedAt: '2026-05-21T00:00:00.000Z',
          endedAt: '2026-05-21T00:00:01.000Z',
        },
      ],
    };

    expect(parseWorkspaceState(serializeWorkspaceState(state), createWorkspaceState(canvases))).toEqual(
      state,
    );
  });

  it('updates custom canvas storage folder and trims empty values', () => {
    const state = createWorkspaceState(canvases);

    expect(
      updateWorkspaceStorage(state, {
        mode: 'custom-folder',
        folderName: '  Shot Agent  ',
        folderPath: '  /Users/zz/Shot Agent  ',
      }).storage,
    ).toEqual({
      mode: 'custom-folder',
      folderName: 'Shot Agent',
      folderPath: '/Users/zz/Shot Agent',
    });
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
      storage: {
        mode: 'browser-local' as const,
      },
      generationHistory: [],
    };

    expect(deleteCanvas(state, 'canvas_second')).toEqual({
      activeCanvasId: 'canvas_first',
      canvases: [canvases[0]],
      storage: {
        mode: 'browser-local',
      },
      generationHistory: [],
    });
  });

  it('allows deleting the last canvas', () => {
    const state = createWorkspaceState([canvases[0]]);

    expect(deleteCanvas(state, 'canvas_first')).toEqual({
      activeCanvasId: '',
      canvases: [],
      storage: {
        mode: 'browser-local',
      },
      generationHistory: [],
    });
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

  it('normalizes selection rectangles and finds intersecting nodes', () => {
    const nodes = [
      { id: 'node_1', title: 'One', modelId: 'gpt-image-2', kind: 'image' as const, x: 0, y: 0 },
      { id: 'node_2', title: 'Two', modelId: 'gpt-image-2', kind: 'image' as const, x: 360, y: 0 },
      { id: 'node_3', title: 'Three', modelId: 'gpt-image-2', kind: 'image' as const, x: 720, y: 0 },
    ];
    const rect = normalizeCanvasSelectionRect({ x: 620, y: 180 }, { x: 100, y: -20 });

    expect(rect).toEqual({ x: 100, y: -20, width: 520, height: 200 });
    expect(findNodesInSelectionRect(nodes, rect, { width: 320, height: 220 })).toEqual([
      'node_1',
      'node_2',
    ]);
  });

  it('marks asset nodes as output-only', () => {
    expect(
      canNodeReceiveInput({
        id: 'asset_text',
        title: '文本',
        modelId: 'asset-text',
        kind: 'textAsset',
        x: 0,
        y: 0,
      }),
    ).toBe(false);
    expect(canNodeReceiveInput({ id: 'node_1', title: 'A', modelId: 'a', kind: 'image', x: 0, y: 0 })).toBe(
      true,
    );
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

  it('blocks video nodes from connecting to text generation nodes', () => {
    expect(
      canConnectCanvasNodes(
        { id: 'video_1', title: 'Video', modelId: 'seedance2.0', kind: 'video', x: 0, y: 0 },
        { id: 'chat_1', title: 'Chat', modelId: 'gpt-5.4-mini', kind: 'chat', x: 0, y: 0 },
      ),
    ).toBe(false);
    expect(
      canConnectCanvasNodes(
        { id: 'image_1', title: 'Image', modelId: 'gpt-image-2', kind: 'image', x: 0, y: 0 },
        { id: 'chat_1', title: 'Chat', modelId: 'gpt-5.4-mini', kind: 'chat', x: 0, y: 0 },
      ),
    ).toBe(true);
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
