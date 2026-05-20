import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  BoxSelect,
  FilePlus2,
  FolderPlus,
  Image,
  MessageSquare,
  Minus,
  Move,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Video,
} from 'lucide-react';
import { findProvidersForCanonicalModel } from '../domain/provider';
import type { ProviderConfig } from '../domain/provider';
import {
  addCanvasEdge,
  createWorkspaceState,
  getNodeInputPoint,
  getNodeOutputPoint,
  parseWorkspaceState,
  removeCanvasEdge,
  removeCanvasNode,
  serializeWorkspaceState,
  type CanvasNodeKind,
  type CanvasNodeView,
  type CanvasView,
} from './canvasWorkspace';
import {
  moveCanvasNode,
  panViewport,
  screenToCanvasPoint,
  zoomViewportAtPoint,
  type CanvasViewport,
  type Point,
} from './canvasViewport';

type NodeTemplate = {
  id: string;
  label: string;
  title: string;
  modelId: string;
  kind: CanvasNodeKind;
  icon: typeof Image;
};

type AddMenuState = {
  x: number;
  y: number;
  canvasPoint: Point;
} | null;

type EdgeDraft = {
  fromNodeId: string;
  from: Point;
  to: Point;
} | null;

type DragState =
  | {
      mode: 'pan';
      pointerId: number;
      lastX: number;
      lastY: number;
    }
  | {
      mode: 'node';
      pointerId: number;
      nodeId: string;
      lastX: number;
      lastY: number;
    };

const providers: ProviderConfig[] = [
  {
    id: 'provider_openai',
    name: 'OpenAI 官方',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com',
    apiTokenRef: 'secret_openai',
    enabled: true,
    models: [
      {
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ],
  },
  {
    id: 'provider_seedance',
    name: '火山方舟',
    protocol: 'volcengine',
    baseURL: 'https://ark.cn-beijing.volces.com',
    apiTokenRef: 'secret_seedance',
    enabled: true,
    models: [
      {
        providerModelId: 'doubao-seedance-2-0-260128',
        canonicalModelId: 'seedance2.0',
        enabled: true,
      },
      {
        providerModelId: 'doubao-seedance-2-0-fast-260128',
        canonicalModelId: 'seedance2.0-fast',
        enabled: true,
      },
    ],
  },
];

const nodeTemplates: NodeTemplate[] = [
  {
    id: 'gpt-image-2',
    label: 'gpt-image-2 图片节点',
    title: '图片生成',
    modelId: 'gpt-image-2',
    kind: 'image',
    icon: Image,
  },
  {
    id: 'seedance2.0',
    label: 'seedance2.0 视频节点',
    title: '视频生成',
    modelId: 'seedance2.0',
    kind: 'video',
    icon: Video,
  },
  {
    id: 'chat-openai',
    label: '对话节点',
    title: '提示词整理',
    modelId: 'chat-openai',
    kind: 'chat',
    icon: MessageSquare,
  },
];

const initialCanvases: CanvasView[] = [
  {
    id: 'canvas_first',
    name: '默认画布',
    updatedAt: '刚刚',
    nodes: [
      {
        id: 'node_image_1',
        title: '图片生成',
        modelId: 'gpt-image-2',
        kind: 'image',
        x: 120,
        y: 120,
      },
      {
        id: 'node_video_1',
        title: '视频生成',
        modelId: 'seedance2.0',
        kind: 'video',
        x: 520,
        y: 240,
      },
      {
        id: 'node_chat_1',
        title: '提示词整理',
        modelId: 'chat-openai',
        kind: 'chat',
        x: 320,
        y: -40,
      },
    ],
    edges: [
      {
        id: 'edge_image_video',
        fromNodeId: 'node_image_1',
        toNodeId: 'node_video_1',
      },
    ],
  },
  {
    id: 'canvas_second',
    name: '产品短片',
    updatedAt: '示例',
    nodes: [],
    edges: [],
  },
];
const initialWorkspaceState = createWorkspaceState(initialCanvases);
const workspaceStorageKey = 'shot-agent:canvas-workspace';

function getNodeIcon(kind: CanvasNodeKind) {
  if (kind === 'video') {
    return Video;
  }

  if (kind === 'chat') {
    return MessageSquare;
  }

  return Image;
}

export function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 80, y: 72, scale: 1 });
  const [workspaceState, setWorkspaceState] = useState(() => {
    if (typeof window === 'undefined') {
      return initialWorkspaceState;
    }

    return parseWorkspaceState(
      window.localStorage.getItem(workspaceStorageKey),
      initialWorkspaceState,
    );
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const { activeCanvasId, canvases } = workspaceState;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId) ?? canvases[0];
  const selectedNode =
    activeCanvas.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge =
    activeCanvas.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const imageProviders = findProvidersForCanonicalModel(providers, 'gpt-image-2');
  const videoProviders = findProvidersForCanonicalModel(providers, 'seedance2.0');

  useEffect(() => {
    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(workspaceState));
  }, [workspaceState]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditingText || (event.key !== 'Delete' && event.key !== 'Backspace')) {
        return;
      }

      if (!selectedEdgeId && !selectedNodeId) {
        return;
      }

      event.preventDefault();

      if (selectedEdgeId) {
        updateActiveCanvasEdges((edges) => removeCanvasEdge(edges, selectedEdgeId));
        setSelectedEdgeId(null);
        return;
      }

      if (selectedNodeId) {
        setWorkspaceState((current) => ({
          ...current,
          canvases: current.canvases.map((canvas) =>
            canvas.id === current.activeCanvasId
              ? { ...removeCanvasNode(canvas, selectedNodeId), updatedAt: '刚刚' }
              : canvas,
          ),
        }));
        setSelectedNodeId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, selectedNodeId]);

  function setCanvases(updater: (canvases: CanvasView[]) => CanvasView[]) {
    setWorkspaceState((current) => ({
      ...current,
      canvases: updater(current.canvases),
    }));
  }

  function setActiveCanvasId(canvasId: string) {
    setWorkspaceState((current) => ({
      ...current,
      activeCanvasId: canvasId,
    }));
  }

  function updateActiveCanvasNodes(updater: (nodes: CanvasNodeView[]) => CanvasNodeView[]) {
    setWorkspaceState((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        canvas.id === current.activeCanvasId
          ? { ...canvas, updatedAt: '刚刚', nodes: updater(canvas.nodes) }
          : canvas,
      ),
    }));
  }

  function updateActiveCanvasEdges(
    updater: (edges: CanvasView['edges']) => CanvasView['edges'],
  ) {
    setWorkspaceState((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        canvas.id === current.activeCanvasId
          ? { ...canvas, updatedAt: '刚刚', edges: updater(canvas.edges) }
          : canvas,
      ),
    }));
  }

  function getCanvasPointFromClient(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return screenToCanvasPoint({ x: clientX, y: clientY }, viewport);
    }

    return screenToCanvasPoint(
      {
        x: clientX - rect.left,
        y: clientY - rect.top,
      },
      viewport,
    );
  }

  function openAddMenu(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setAddMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      canvasPoint: getCanvasPointFromClient(clientX, clientY),
    });
  }

  function addNode(template: NodeTemplate) {
    const point = addMenu?.canvasPoint ?? screenToCanvasPoint({ x: 260, y: 180 }, viewport);

    updateActiveCanvasNodes((nodes) => [
      ...nodes,
      {
        id: `node_${template.kind}_${Date.now()}`,
        title: template.title,
        modelId: template.modelId,
        kind: template.kind,
        x: point.x,
        y: point.y,
      },
    ]);
    setAddMenu(null);
  }

  function createCanvas() {
    const id = `canvas_${Date.now()}`;
    setWorkspaceState((current) => ({
      activeCanvasId: id,
      canvases: [
        ...current.canvases,
      {
        id,
        name: `新画布 ${current.canvases.length + 1}`,
        updatedAt: '刚刚',
        nodes: [],
        edges: [],
      },
      ],
    }));
    setViewport({ x: 80, y: 72, scale: 1 });
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    setAddMenu(null);
    setEdgeDraft(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      mode: 'pan',
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function handleNodePointerDown(event: PointerEvent<HTMLElement>, nodeId: string) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    setAddMenu(null);
    setEdgeDraft(null);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      mode: 'node',
      pointerId: event.pointerId,
      nodeId,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      setEdgeDraft({
        ...edgeDraft,
        to: getCanvasPointFromClient(event.clientX, event.clientY),
      });
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const delta = {
      dx: event.clientX - dragState.lastX,
      dy: event.clientY - dragState.lastY,
    };

    if (dragState.mode === 'pan') {
      setViewport((current) => panViewport(current, delta));
    } else {
      updateActiveCanvasNodes((nodes) =>
        nodes.map((node) =>
          node.id === dragState.nodeId
            ? { ...node, ...moveCanvasNode(node, delta, viewport.scale) }
            : node,
        ),
      );
    }

    setDragState({ ...dragState, lastX: event.clientX, lastY: event.clientY });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      setEdgeDraft(null);
      return;
    }

    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function startEdgeDraft(event: PointerEvent<HTMLButtonElement>, node: CanvasNodeView) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const from = getNodeOutputPoint(node);

    setAddMenu(null);
    setDragState(null);
    setEdgeDraft({
      fromNodeId: node.id,
      from,
      to: from,
    });
  }

  function completeEdgeDraft(event: PointerEvent<HTMLButtonElement>, toNodeId: string) {
    event.stopPropagation();

    if (!edgeDraft) {
      return;
    }

    updateActiveCanvasEdges((edges) => addCanvasEdge(edges, edgeDraft.fromNodeId, toNodeId));
    setSelectedEdgeId(`edge_${edgeDraft.fromNodeId}_${toNodeId}`);
    setSelectedNodeId(null);
    setEdgeDraft(null);
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) {
      return;
    }

    updateActiveCanvasEdges((edges) => removeCanvasEdge(edges, selectedEdgeId));
    setSelectedEdgeId(null);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) {
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        canvas.id === current.activeCanvasId
          ? { ...removeCanvasNode(canvas, selectedNodeId), updatedAt: '刚刚' }
          : canvas,
      ),
    }));
    setSelectedNodeId(null);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    setViewport((current) =>
      zoomViewportAtPoint(
        current,
        {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
        current.scale * zoomFactor,
      ),
    );
  }

  function zoomBy(factor: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? { x: rect.width / 2, y: rect.height / 2 }
      : { x: 480, y: 320 };

    setViewport((current) => zoomViewportAtPoint(current, center, current.scale * factor));
  }

  function resetViewport() {
    setViewport({ x: 80, y: 72, scale: 1 });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header>
          <h1>shot-agent</h1>
          <p>无限画布视觉工作台</p>
        </header>
        <nav>
          <button type="button" onClick={createCanvas}>
            <FolderPlus size={18} />
            新建画布
          </button>
          <button type="button">
            <Settings size={18} />
            供应商管理
          </button>
        </nav>
        <section className="panel">
          <h2>画布</h2>
          <div className="canvas-list">
            {canvases.map((canvas) => (
              <button
                key={canvas.id}
                type="button"
                className={canvas.id === activeCanvas.id ? 'is-active' : ''}
                onClick={() => {
                  setActiveCanvasId(canvas.id);
                  setAddMenu(null);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
              >
                <FilePlus2 size={17} />
                <span>
                  <strong>{canvas.name}</strong>
                  <small>{canvas.nodes.length} 个节点 · {canvas.updatedAt}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <div className="toolbar-title">
            <BoxSelect size={18} />
            <span>{activeCanvas.name}</span>
          </div>
          <div className="toolbar-actions">
            <button type="button">
              <Play size={18} />
              执行
            </button>
          </div>
        </div>
        <div
          ref={canvasRef}
          className={`infinite-canvas ${dragState?.mode === 'pan' ? 'is-panning' : ''}`}
          onContextMenu={(event) => {
            event.preventDefault();
            openAddMenu(event.clientX, event.clientY);
          }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
        >
          <button
            type="button"
            className="canvas-add-button"
            aria-label="添加节点"
            onClick={(event) => openAddMenu(event.clientX, event.clientY)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Plus size={20} />
          </button>
          {addMenu ? (
            <div
              className="add-node-menu"
              style={{ left: addMenu.x, top: addMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {nodeTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <button key={template.id} type="button" onClick={() => addNode(template)}>
                    <Icon size={17} />
                    {template.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="canvas-hud">
            <button type="button" aria-label="缩小" onClick={() => zoomBy(0.88)}>
              <Minus size={16} />
            </button>
            <span>{Math.round(viewport.scale * 100)}%</span>
            <button type="button" aria-label="放大" onClick={() => zoomBy(1.12)}>
              <Plus size={16} />
            </button>
            <button type="button" aria-label="重置视图" onClick={resetViewport}>
              <RotateCcw size={16} />
            </button>
          </div>
          <div className="canvas-tip">
            <Move size={15} />
            <span>拖节点右侧圆点到另一个节点左侧圆点连线</span>
          </div>
          <div
            className="canvas-plane"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            }}
          >
            <svg className="edge-layer" aria-label="节点连线">
              {activeCanvas.edges.map((edge) => {
                const fromNode = activeCanvas.nodes.find((node) => node.id === edge.fromNodeId);
                const toNode = activeCanvas.nodes.find((node) => node.id === edge.toNodeId);

                if (!fromNode || !toNode) {
                  return null;
                }

                const from = getNodeOutputPoint(fromNode);
                const to = getNodeInputPoint(toNode);
                const controlOffset = Math.max(120, Math.abs(to.x - from.x) * 0.45);

                return (
                  <g key={edge.id}>
                    <path
                      className={edge.id === selectedEdgeId ? 'edge-path is-selected' : 'edge-path'}
                      d={`M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${
                        to.x - controlOffset
                      } ${to.y}, ${to.x} ${to.y}`}
                    />
                    <path
                      className="edge-hit-area"
                      d={`M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${
                        to.x - controlOffset
                      } ${to.y}, ${to.x} ${to.y}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                        setAddMenu(null);
                      }}
                    />
                  </g>
                );
              })}
              {edgeDraft ? (
                <path
                  className="edge-draft"
                  d={`M ${edgeDraft.from.x} ${edgeDraft.from.y} C ${
                    edgeDraft.from.x + 120
                  } ${edgeDraft.from.y}, ${edgeDraft.to.x - 120} ${edgeDraft.to.y}, ${
                    edgeDraft.to.x
                  } ${edgeDraft.to.y}`}
                />
              ) : null}
            </svg>
            {activeCanvas.nodes.map((node) => {
              const Icon = getNodeIcon(node.kind);
              const providersForNode =
                node.modelId === 'gpt-image-2'
                  ? imageProviders
                  : node.modelId === 'seedance2.0'
                    ? videoProviders
                    : [];

              return (
                <article
                  key={node.id}
                  className={`canvas-node canvas-node-${node.kind} ${
                    node.id === selectedNodeId ? 'is-selected' : ''
                  }`}
                  style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    setAddMenu(null);
                  }}
                >
                  <button
                    type="button"
                    className="edge-handle edge-handle-input"
                    aria-label="连接到此节点"
                    onPointerUp={(event) => completeEdgeDraft(event, node.id)}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                  <header onPointerDown={(event) => handleNodePointerDown(event, node.id)}>
                    <span className="node-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h2>{node.title}</h2>
                      <p>{node.modelId}</p>
                    </div>
                  </header>
                  <div className="node-body">
                    <p>
                      {providersForNode.length > 0
                        ? `可用供应商：${providersForNode
                            .map((provider) => provider.name)
                            .join('、')}`
                        : '对话模型供应商待配置'}
                    </p>
                    <textarea
                      placeholder="输入提示词，使用 @image:asset_id 引用资产"
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                    <button type="button" onPointerDown={(event) => event.stopPropagation()}>
                      生成
                    </button>
                  </div>
                  <button
                    type="button"
                    className="edge-handle edge-handle-output"
                    aria-label="从此节点连线"
                    onPointerDown={(event) => startEdgeDraft(event, node)}
                  />
                </article>
              );
            })}
          </div>
          {selectedEdge ? (
            <div className="edge-actions">
              <span>已选中连线</span>
              <button type="button" onClick={deleteSelectedEdge}>
                <Trash2 size={16} />
                删除
              </button>
            </div>
          ) : null}
          {selectedNode ? (
            <aside className="node-inspector">
              <header>
                <h2>{selectedNode.title}</h2>
                <p>{selectedNode.modelId}</p>
              </header>
              <button type="button" className="danger-button" onClick={deleteSelectedNode}>
                <Trash2 size={16} />
                删除节点
              </button>
              <label>
                供应商
                <select defaultValue="">
                  <option value="" disabled>
                    选择供应商
                  </option>
                  {(selectedNode.modelId === 'gpt-image-2'
                    ? imageProviders
                    : selectedNode.modelId === 'seedance2.0'
                      ? videoProviders
                      : []
                  ).map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                提示词
                <textarea placeholder="输入节点提示词，支持 @ 引用画布资产" />
              </label>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
