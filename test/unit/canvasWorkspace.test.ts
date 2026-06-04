import { describe, expect, it } from 'vitest';
import {
  addCanvasEdge,
  canConnectCanvasNodes,
  copyCanvasSelection,
  createCanvasEdge,
  getNextAvailableCanvasName,
  createSequentialEdges,
  createWorkspaceState,
  canNodeReceiveInput,
  deleteCanvas,
  exportCanvas,
  getUpstreamNodeIds,
  findNodesInSelectionRect,
  getNodeCenter,
  getNodeInputPoint,
  getNodeOutputPoint,
  normalizeCanvasSelectionRect,
  importCanvas,
  moveCanvasNodes,
  parseWorkspaceState,
  pasteCanvasClipboard,
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

  it('uses custom folder storage as the default canvas storage setting', () => {
    expect(createWorkspaceState(canvases).storage).toEqual({
      mode: 'custom-folder',
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
      assetUploadCache: {
        'sha256:test': 'https://assets.example.com/input.png',
      },
    };

    expect(parseWorkspaceState(serializeWorkspaceState(state), createWorkspaceState(canvases))).toEqual(
      state,
    );
  });

  it('does not persist transient in-memory asset data when file paths exist', () => {
    const state = createWorkspaceState([
      {
        id: 'canvas_assets',
        name: '素材画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'asset_1',
            title: '图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetPath: 'assets/images/input.png',
            assetDataUrl: 'data:image/png;base64,input',
            outputPath: 'assets/images/output.png',
            outputDataUrl: 'data:image/png;base64,output',
          },
        ],
        edges: [],
      },
    ]);
    const serialized = serializeWorkspaceState(state);

    expect(serialized).not.toContain('data:image/png;base64,input');
    expect(serialized).not.toContain('data:image/png;base64,output');
    expect(serialized).toContain('assets/images/input.png');
    expect(serialized).toContain('assets/images/output.png');
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
        mode: 'custom-folder',
      },
      generationHistory: [],
      assetUploadCache: {},
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

  it('preserves story node structured output fields during workspace persistence', () => {
    const state = createWorkspaceState([
      {
        id: 'canvas_story',
        name: '故事画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_story_1',
            title: '故事拆解',
            modelId: 'gpt-5.4-mini',
            kind: 'story',
            x: 120,
            y: 80,
            prompt: '请拆解这个故事',
            storyExecutionMode: 'structure_only',
            storyExpansionMode: 'structure_only',
            storyRawOutput: '{"storySummary":"一个人走进雨夜街头"}',
            storyStructuredOutput: {
              version: 1,
              storySummary: '一个人走进雨夜街头',
              styleNotes: ['电影感', '潮湿夜景'],
              globalAssets: {
                scenePrompts: [],
                characterSheetPrompts: [],
                propSheetPrompts: [],
              },
              narrativeSegments: [],
              rawModelOutput: '{"storySummary":"一个人走进雨夜街头"}',
            },
          },
        ],
        edges: [],
      },
    ]);

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

  it('does not allow duplicate canvas names when renaming', () => {
    const state = createWorkspaceState(canvases);

    expect(renameCanvas(state, 'canvas_first', '第二画布')).toEqual(state);
  });

  it('allows story nodes to receive text and image inputs but rejects video and audio inputs', () => {
    const storyNode: CanvasView['nodes'][number] = {
      id: 'node_story_1',
      title: '故事拆解',
      modelId: 'gpt-5.4-mini',
      kind: 'story',
      x: 240,
      y: 120,
    };
    const textNode: CanvasView['nodes'][number] = {
      id: 'node_text_1',
      title: '文本',
      modelId: 'asset-text',
      kind: 'textAsset',
      x: 0,
      y: 0,
      textContent: '故事正文',
    };
    const imageNode: CanvasView['nodes'][number] = {
      id: 'node_image_1',
      title: '图片',
      modelId: 'asset-image',
      kind: 'imageAsset',
      x: 0,
      y: 120,
      assetDataUrl: 'data:image/png;base64,aW1hZw==',
    };
    const videoNode: CanvasView['nodes'][number] = {
      id: 'node_video_1',
      title: '视频',
      modelId: 'asset-video',
      kind: 'videoAsset',
      x: 0,
      y: 240,
      assetDataUrl: 'data:video/mp4;base64,dmlkZW8=',
    };
    const audioNode: CanvasView['nodes'][number] = {
      id: 'node_audio_1',
      title: '音频',
      modelId: 'asset-audio',
      kind: 'audioAsset',
      x: 0,
      y: 360,
      assetDataUrl: 'data:audio/mp3;base64,YXVkaW8=',
    };

    expect(canNodeReceiveInput(storyNode)).toBe(true);
    expect(canConnectCanvasNodes(textNode, storyNode)).toBe(true);
    expect(canConnectCanvasNodes(imageNode, storyNode)).toBe(true);
    expect(canConnectCanvasNodes(videoNode, storyNode)).toBe(false);
    expect(canConnectCanvasNodes(audioNode, storyNode)).toBe(false);
  });

  it('returns the next available canvas name for auto-created canvases', () => {
    const state = createWorkspaceState([
      ...canvases,
      {
        id: 'canvas_third',
        name: '新画布 1',
        updatedAt: '刚刚',
        nodes: [],
        edges: [],
      },
      {
        id: 'canvas_fourth',
        name: '新画布 2',
        updatedAt: '刚刚',
        nodes: [],
        edges: [],
      },
    ]);

    expect(getNextAvailableCanvasName(state)).toBe('新画布 3');
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
        mode: 'custom-folder',
      },
      generationHistory: [],
      assetUploadCache: {},
    });
  });

  it('exports and imports a canvas with a new id', () => {
    const state = createWorkspaceState(canvases);
    const imported = importCanvas(
      state,
      exportCanvas({
        ...canvases[0],
        name: '导入画布',
      }),
      'canvas_imported',
    );

    expect(imported.activeCanvasId).toBe('canvas_imported');
    expect(imported.canvases).toHaveLength(3);
    expect(imported.canvases[2]).toEqual({
      ...canvases[0],
      id: 'canvas_imported',
      name: '导入画布',
      updatedAt: '刚刚',
    });
  });

  it('does not allow importing a canvas with a duplicate name', () => {
    const state = createWorkspaceState(canvases);

    expect(() => importCanvas(state, exportCanvas(canvases[0]), 'canvas_imported')).toThrow(
      '已存在同名画布',
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

  it('returns node input and output points for edge handles', () => {
    const node = { id: 'node_1', title: 'A', modelId: 'a', kind: 'image' as const, x: 40, y: 20 };

    expect(getNodeInputPoint(node)).toEqual({ x: 40, y: 108 });
    expect(getNodeOutputPoint(node)).toEqual({ x: 360, y: 108 });
  });

  it('returns separate input points for video role ports', () => {
    const node = {
      id: 'node_video_1',
      title: 'Video',
      modelId: 'seedance2.0',
      kind: 'video' as const,
      x: 40,
      y: 20,
      seedanceScenario: 'image_to_video_first_last_frame' as const,
    };

    expect(getNodeInputPoint(node, 'first_frame_image')).toEqual({ x: 40, y: 80 });
    expect(getNodeInputPoint(node, 'last_frame_image')).toEqual({ x: 40, y: 116 });
    expect(getNodeInputPoint(node, 'text')).toEqual({ x: 40, y: 152 });
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

  it('moves selected nodes together', () => {
    const nodes = [
      { id: 'node_1', title: 'One', modelId: 'gpt-image-2', kind: 'image' as const, x: 0, y: 0 },
      { id: 'node_2', title: 'Two', modelId: 'gpt-image-2', kind: 'image' as const, x: 360, y: 0 },
      { id: 'node_3', title: 'Three', modelId: 'gpt-image-2', kind: 'image' as const, x: 720, y: 0 },
    ];

    expect(moveCanvasNodes(nodes, ['node_1', 'node_2'], { dx: 12, dy: -8 })).toEqual([
      { ...nodes[0], x: 12, y: -8 },
      { ...nodes[1], x: 372, y: -8 },
      nodes[2],
    ]);
  });

  it('copies selected nodes with their internal edges', () => {
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

    expect(copyCanvasSelection(canvas, ['node_1', 'node_2'])).toEqual({
      nodes: [canvas.nodes[0], canvas.nodes[1]],
      edges: [canvas.edges[0]],
    });
    expect(copyCanvasSelection(canvas, [])).toBeNull();
  });

  it('pastes copied nodes with new ids, shifted positions and remapped references', () => {
    const canvas: CanvasView = {
      id: 'canvas_1',
      name: '画布',
      updatedAt: '刚刚',
      nodes: [
        { id: 'node_1', title: 'A', modelId: 'asset-image', kind: 'imageAsset', x: 0, y: 0 },
        {
          id: 'node_2',
          title: 'B',
          modelId: 'gpt-image-2',
          kind: 'image',
          x: 320,
          y: 0,
          prompt: '参考 @image:node_1',
          generationStatus: 'running',
          generationId: 'gen_1',
          generationError: '旧错误',
        },
      ],
      edges: [{ id: 'edge_node_1_node_2', fromNodeId: 'node_1', toNodeId: 'node_2' }],
    };
    const copied = copyCanvasSelection(canvas, ['node_1', 'node_2']);
    let nextId = 0;

    expect(copied).not.toBeNull();
    const pasted = pasteCanvasClipboard(canvas, copied!, {
      createNodeId: (node) => `${node.id}_copy_${++nextId}`,
      offset: { dx: 40, dy: 48 },
    });

    expect(pasted.pastedNodeIds).toEqual(['node_1_copy_1', 'node_2_copy_2']);
    expect(pasted.canvas.nodes.slice(2)).toEqual([
      { ...canvas.nodes[0], id: 'node_1_copy_1', x: 40, y: 48 },
      {
        ...canvas.nodes[1],
        id: 'node_2_copy_2',
        x: 360,
        y: 48,
        prompt: '参考 @image:node_1_copy_1',
        generationStatus: undefined,
        generationId: undefined,
        generationError: undefined,
      },
    ]);
    expect(pasted.canvas.edges[1]).toEqual({
      id: 'edge_node_1_copy_1_node_2_copy_2',
      fromNodeId: 'node_1_copy_1',
      toNodeId: 'node_2_copy_2',
    });
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
    expect(createCanvasEdge('node_1', 'node_2', 'text')).toEqual({
      id: 'edge_node_1_node_2_text',
      fromNodeId: 'node_1',
      toNodeId: 'node_2',
      toPortId: 'text',
    });
  });

  it('adds edges without self links or duplicates', () => {
    const first = addCanvasEdge([], 'node_1', 'node_2', 'text');

    expect(first).toEqual([
      { id: 'edge_node_1_node_2_text', fromNodeId: 'node_1', toNodeId: 'node_2', toPortId: 'text' },
    ]);
    expect(addCanvasEdge(first, 'node_1', 'node_1')).toEqual(first);
    expect(addCanvasEdge(first, 'node_1', 'node_2', 'text')).toEqual(first);
  });

  it('finds only upstream nodes as referenceable assets', () => {
    const canvas: CanvasView = {
      id: 'canvas_1',
      name: '画布',
      updatedAt: '刚刚',
      nodes: [
        { id: 'text_1', title: 'Text', modelId: 'asset-text', kind: 'textAsset', x: 0, y: 0 },
        { id: 'image_1', title: 'Image', modelId: 'gpt-image-2', kind: 'image', x: 360, y: 0 },
        { id: 'video_1', title: 'Video', modelId: 'seedance2.0', kind: 'video', x: 720, y: 0 },
        { id: 'side_1', title: 'Side', modelId: 'asset-image', kind: 'imageAsset', x: 0, y: 320 },
      ],
      edges: [
        { id: 'edge_text_image', fromNodeId: 'text_1', toNodeId: 'image_1' },
        { id: 'edge_image_video', fromNodeId: 'image_1', toNodeId: 'video_1' },
      ],
    };

    expect(getUpstreamNodeIds(canvas, 'video_1')).toEqual(['image_1', 'text_1']);
    expect(getUpstreamNodeIds(canvas, 'image_1')).toEqual(['text_1']);
    expect(getUpstreamNodeIds(canvas, 'side_1')).toEqual([]);
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
