import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  BoxSelect,
  Download,
  FilePlus2,
  FileText,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Image,
  Import,
  MessageSquare,
  Minus,
  Move,
  Pencil,
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
  canNodeReceiveInput,
  createWorkspaceState,
  deleteCanvas,
  exportCanvas,
  getNodeInputPoint,
  getNodeOutputPoint,
  importCanvas,
  parseWorkspaceState,
  renameCanvas,
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
  outputOnly?: boolean;
};

type AddMenuState = {
  x: number;
  y: number;
  canvasPoint: Point;
  fromNodeId?: string;
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

const initialProviders: ProviderConfig[] = [
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
    label: 'gpt-image-2 生成节点',
    title: '图片生成',
    modelId: 'gpt-image-2',
    kind: 'image',
    icon: Image,
  },
  {
    id: 'seedance2.0',
    label: 'seedance2.0 生成节点',
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
  {
    id: 'asset-text',
    label: '文本节点',
    title: '文本',
    modelId: 'asset-text',
    kind: 'textAsset',
    icon: FileText,
    outputOnly: true,
  },
  {
    id: 'asset-image',
    label: '图片节点',
    title: '图片',
    modelId: 'asset-image',
    kind: 'imageAsset',
    icon: Image,
    outputOnly: true,
  },
  {
    id: 'asset-video',
    label: '视频节点',
    title: '视频',
    modelId: 'asset-video',
    kind: 'videoAsset',
    icon: Video,
    outputOnly: true,
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
const providerStorageKey = 'shot-agent:providers';

function loadProviders(): ProviderConfig[] {
  if (typeof window === 'undefined') {
    return initialProviders;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(providerStorageKey) ?? '');

    if (!Array.isArray(parsed)) {
      return initialProviders;
    }

    return parsed as ProviderConfig[];
  } catch {
    return initialProviders;
  }
}

function getNodeIcon(kind: CanvasNodeKind) {
  if (kind === 'video' || kind === 'videoAsset') {
    return Video;
  }

  if (kind === 'chat') {
    return MessageSquare;
  }

  if (kind === 'textAsset') {
    return FileText;
  }

  return Image;
}

export function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>(loadProviders);
  const [showProviderManager, setShowProviderManager] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  const [canvasMessage, setCanvasMessage] = useState<string | null>(null);
  const [isRenamingCanvas, setIsRenamingCanvas] = useState(false);
  const [draftCanvasName, setDraftCanvasName] = useState('');
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
    window.localStorage.setItem(providerStorageKey, JSON.stringify(providers));
  }, [providers]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/'),
      );

      if (!file) {
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      const point = screenToCanvasPoint(
        {
          x: rect ? rect.width / 2 : 420,
          y: rect ? rect.height / 2 : 280,
        },
        viewport,
      );

      addAssetNodeFromFile(file, point);
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [viewport]);

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

  function openAddMenu(clientX: number, clientY: number, fromNodeId?: string) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setAddMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      canvasPoint: getCanvasPointFromClient(clientX, clientY),
      fromNodeId,
    });
  }

  function addNode(template: NodeTemplate) {
    const point = addMenu?.canvasPoint ?? screenToCanvasPoint({ x: 260, y: 180 }, viewport);
    const nodeId = `node_${template.kind}_${Date.now()}`;

    updateActiveCanvasNodes((nodes) => [
      ...nodes,
      {
        id: nodeId,
        title: template.title,
        modelId: template.modelId,
        kind: template.kind,
        x: point.x,
        y: point.y,
        textContent: template.kind === 'textAsset' ? '在这里输入文本' : undefined,
      },
    ]);
    if (addMenu?.fromNodeId && !template.outputOnly) {
      updateActiveCanvasEdges((edges) => addCanvasEdge(edges, addMenu.fromNodeId!, nodeId));
    }
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setAddMenu(null);
  }

  function updateNode(nodeId: string, updater: (node: CanvasNodeView) => CanvasNodeView) {
    updateActiveCanvasNodes((nodes) => nodes.map((node) => (node.id === nodeId ? updater(node) : node)));
  }

  function addAssetNodeFromFile(file: File, point: Point) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const isImage = file.type.startsWith('image/');
      const nodeId = `node_${isImage ? 'imageAsset' : 'videoAsset'}_${Date.now()}`;

      updateActiveCanvasNodes((nodes) => [
        ...nodes,
        {
          id: nodeId,
          title: isImage ? '图片' : '视频',
          modelId: isImage ? 'asset-image' : 'asset-video',
          kind: isImage ? 'imageAsset' : 'videoAsset',
          x: point.x,
          y: point.y,
          assetName: file.name,
          assetDataUrl: typeof reader.result === 'string' ? reader.result : undefined,
          assetMimeType: file.type,
        },
      ]);
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    });
    reader.readAsDataURL(file);
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
    setCanvasMessage(null);
  }

  function renameActiveCanvas(name: string) {
    setWorkspaceState((current) => renameCanvas(current, current.activeCanvasId, name));
  }

  function startRenameActiveCanvas() {
    setDraftCanvasName(activeCanvas.name);
    setIsRenamingCanvas(true);
  }

  function commitRenameActiveCanvas() {
    renameActiveCanvas(draftCanvasName);
    setIsRenamingCanvas(false);
  }

  function deleteActiveCanvas() {
    setWorkspaceState((current) => deleteCanvas(current, current.activeCanvasId));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setAddMenu(null);
    setViewport({ x: 80, y: 72, scale: 1 });
    setCanvasMessage(null);
  }

  function downloadActiveCanvas() {
    const content = exportCanvas(activeCanvas);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${activeCanvas.name || 'canvas'}.shot-agent-canvas.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCanvasFile(file: File) {
    try {
      const content = await file.text();
      const nextId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `canvas_${crypto.randomUUID()}`
          : `canvas_${Date.now()}`;

      setWorkspaceState((current) => importCanvas(current, content, nextId));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setAddMenu(null);
      setViewport({ x: 80, y: 72, scale: 1 });
      setCanvasMessage('画布已导入');
    } catch (error) {
      setCanvasMessage(error instanceof Error ? error.message : '画布导入失败');
    }
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
      finishEdgeDraftOnBlank(event);
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

  function finishEdgeDraftOnBlank(event: PointerEvent<HTMLDivElement>) {
    if (!edgeDraft) {
      return;
    }

    openAddMenu(event.clientX, event.clientY, edgeDraft.fromNodeId);
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

  function updateProvider(providerId: string, updater: (provider: ProviderConfig) => ProviderConfig) {
    setProviders((current) =>
      current.map((provider) => (provider.id === providerId ? updater(provider) : provider)),
    );
  }

  function addProvider() {
    const id = `provider_${Date.now()}`;
    setProviders((current) => [
      ...current,
      {
        id,
        name: `供应商 ${current.length + 1}`,
        protocol: 'openai-compatible',
        baseURL: 'https://example.test/v1',
        apiTokenRef: 'secret_ref',
        enabled: true,
        models: [],
      },
    ]);
  }

  function addProviderModel(providerId: string) {
    updateProvider(providerId, (provider) => ({
      ...provider,
      models: [
        ...provider.models,
        {
          canonicalModelId: 'gpt-image-2',
          providerModelId: 'gpt-image-2',
          enabled: true,
        },
      ],
    }));
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <input
          ref={importInputRef}
          className="hidden-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';

            if (file) {
              void importCanvasFile(file);
            }
          }}
        />
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          onClick={() => setIsSidebarCollapsed((current) => !current)}
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        {!isSidebarCollapsed ? (
          <>
            <header>
              <h1>shot-agent</h1>
              <p>无限画布视觉工作台</p>
            </header>
            <nav>
          <button type="button" onClick={() => setShowProviderManager(true)}>
            <Settings size={18} />
            供应商管理
          </button>
        </nav>
        <section className="panel canvas-management">
          <h2>当前画布</h2>
          <button
            type="button"
            className="danger-button"
            disabled={canvases.length <= 1}
            onClick={deleteActiveCanvas}
          >
            <Trash2 size={16} />
            删除画布
          </button>
          {canvasMessage ? <p className="canvas-message">{canvasMessage}</p> : null}
        </section>
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
          </>
        ) : null}
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <div className="toolbar-title">
            {showProviderManager ? <Settings size={18} /> : <BoxSelect size={18} />}
            {showProviderManager ? (
              <span>供应商管理</span>
            ) : isRenamingCanvas ? (
              <input
                className="canvas-title-input"
                value={draftCanvasName}
                autoFocus
                onBlur={commitRenameActiveCanvas}
                onChange={(event) => setDraftCanvasName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitRenameActiveCanvas();
                  }

                  if (event.key === 'Escape') {
                    setIsRenamingCanvas(false);
                  }
                }}
              />
            ) : (
              <>
                <span>{activeCanvas.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="重命名画布"
                  title="重命名画布"
                  onClick={startRenameActiveCanvas}
                >
                  <Pencil size={15} />
                </button>
              </>
            )}
          </div>
          <div className="toolbar-actions">
            {showProviderManager ? (
              <>
                <button type="button" onClick={addProvider}>
                  <Plus size={18} />
                  新增供应商
                </button>
                <button type="button" onClick={() => setShowProviderManager(false)}>
                  返回画布
                </button>
              </>
            ) : (
              <button type="button">
                <Play size={18} />
                执行
              </button>
            )}
          </div>
        </div>
        {showProviderManager ? (
          <div className="provider-manager-view">
            <div className="provider-table provider-table-header">
              <span>供应商名称</span>
              <span>Base URL</span>
              <span>API Token 引用</span>
              <span>协议</span>
              <span>状态</span>
              <span>模型映射</span>
            </div>
            <div className="provider-list">
              {providers.map((provider) => (
                <section key={provider.id} className="provider-row">
                  <label>
                    供应商名称
                    <input
                      value={provider.name}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Base URL
                    <input
                      value={provider.baseURL}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          baseURL: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    API Token 引用
                    <input
                      value={provider.apiTokenRef}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          apiTokenRef: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    协议
                    <select
                      value={provider.protocol}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          protocol: event.target.value as ProviderConfig['protocol'],
                        }))
                      }
                    >
                      <option value="openai-compatible">OpenAI Compatible</option>
                      <option value="anthropic-compatible">Anthropic Compatible</option>
                      <option value="volcengine">火山方舟</option>
                      <option value="custom">自定义</option>
                    </select>
                  </label>
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    启用
                  </label>
                  <div className="provider-models">
                    {provider.models.map((model, modelIndex) => (
                      <div key={`${model.canonicalModelId}-${model.providerModelId}-${modelIndex}`}>
                        <label>
                          供应商模型 ID
                          <input
                            value={model.providerModelId}
                            onChange={(event) =>
                              updateProvider(provider.id, (current) => ({
                                ...current,
                                models: current.models.map((currentModel, currentIndex) =>
                                  currentIndex === modelIndex
                                    ? { ...currentModel, providerModelId: event.target.value }
                                    : currentModel,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label>
                          映射后标准模型 ID
                          <input
                            value={model.canonicalModelId}
                            onChange={(event) =>
                              updateProvider(provider.id, (current) => ({
                                ...current,
                                models: current.models.map((currentModel, currentIndex) =>
                                  currentIndex === modelIndex
                                    ? { ...currentModel, canonicalModelId: event.target.value }
                                    : currentModel,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="inline-toggle">
                          <input
                            type="checkbox"
                            checked={model.enabled}
                            onChange={(event) =>
                              updateProvider(provider.id, (current) => ({
                                ...current,
                                models: current.models.map((currentModel, currentIndex) =>
                                  currentIndex === modelIndex
                                    ? { ...currentModel, enabled: event.target.checked }
                                    : currentModel,
                                ),
                              }))
                            }
                          />
                          启用
                        </label>
                      </div>
                    ))}
                    <button type="button" onClick={() => addProviderModel(provider.id)}>
                      <Plus size={16} />
                      添加模型映射
                    </button>
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
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
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];

            if (file) {
              addAssetNodeFromFile(file, getCanvasPointFromClient(event.clientX, event.clientY));
            }
          }}
        >
          <div className="canvas-action-rail">
            <button type="button" aria-label="新建画布" title="新建画布" onClick={createCanvas}>
              <FolderPlus size={18} />
            </button>
            <button
              type="button"
              aria-label="导出当前画布"
              title="导出当前画布"
              onClick={downloadActiveCanvas}
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              aria-label="导入画布"
              title="导入画布"
              onClick={() => importInputRef.current?.click()}
            >
              <Import size={18} />
            </button>
          </div>
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
              {nodeTemplates
                .filter((template) => !addMenu.fromNodeId || !template.outputOnly)
                .map((template) => {
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
                  {canNodeReceiveInput(node) ? (
                    <button
                      type="button"
                      className="edge-handle edge-handle-input"
                      aria-label="连接到此节点"
                      onPointerUp={(event) => completeEdgeDraft(event, node.id)}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  ) : null}
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
                    {node.kind === 'textAsset' ? (
                      <textarea
                        value={node.textContent ?? ''}
                        placeholder="输入文本"
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateNode(node.id, (current) => ({
                            ...current,
                            textContent: event.target.value,
                          }))
                        }
                      />
                    ) : node.kind === 'imageAsset' ? (
                      <>
                        {node.assetDataUrl ? (
                          <img className="asset-preview" src={node.assetDataUrl} alt={node.assetName ?? '图片'} />
                        ) : null}
                        <label className="asset-upload">
                          导入图片
                          <input
                            type="file"
                            accept="image/*"
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                addAssetNodeFromFile(file, { x: node.x, y: node.y });
                                updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== node.id));
                              }
                            }}
                          />
                        </label>
                      </>
                    ) : node.kind === 'videoAsset' ? (
                      <>
                        {node.assetDataUrl ? (
                          <video className="asset-preview" src={node.assetDataUrl} controls />
                        ) : null}
                        <label className="asset-upload">
                          导入视频
                          <input
                            type="file"
                            accept="video/*"
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                addAssetNodeFromFile(file, { x: node.x, y: node.y });
                                updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== node.id));
                              }
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
        )}
      </section>
    </main>
  );
}
