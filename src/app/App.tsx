import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  BoxSelect,
  FolderPlus,
  Image,
  MessageSquare,
  Minus,
  Move,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Video,
} from 'lucide-react';
import { findProvidersForCanonicalModel } from '../domain/provider';
import type { ProviderConfig } from '../domain/provider';
import {
  moveCanvasNode,
  panViewport,
  zoomViewportAtPoint,
  type CanvasViewport,
} from './canvasViewport';

type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  kind: 'image' | 'video' | 'chat';
  x: number;
  y: number;
};

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

const nodeTypes = [
  {
    id: 'gpt-image-2',
    label: 'gpt-image-2',
    icon: Image,
  },
  {
    id: 'seedance2.0',
    label: 'seedance2.0',
    icon: Video,
  },
  {
    id: 'chat-openai',
    label: '对话节点',
    icon: MessageSquare,
  },
];

const initialNodes: CanvasNodeView[] = [
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
];

function getNodeIcon(kind: CanvasNodeView['kind']) {
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
  const [nodes, setNodes] = useState<CanvasNodeView[]>(initialNodes);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const imageProviders = findProvidersForCanonicalModel(providers, 'gpt-image-2');
  const videoProviders = findProvidersForCanonicalModel(providers, 'seedance2.0');

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

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
      setNodes((current) =>
        current.map((node) =>
          node.id === dragState.nodeId
            ? { ...node, ...moveCanvasNode(node, delta, viewport.scale) }
            : node,
        ),
      );
    }

    setDragState({ ...dragState, lastX: event.clientX, lastY: event.clientY });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
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
          <button type="button">
            <FolderPlus size={18} />
            新建画布
          </button>
          <button type="button">
            <Settings size={18} />
            供应商管理
          </button>
        </nav>
        <section className="panel">
          <h2>节点</h2>
          <div className="node-list">
            {nodeTypes.map((node) => {
              const Icon = node.icon;
              return (
                <button key={node.id} type="button">
                  <Icon size={18} />
                  {node.label}
                </button>
              );
            })}
          </div>
        </section>
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <div className="toolbar-title">
            <BoxSelect size={18} />
            <span>视觉工作流画布</span>
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
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
        >
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
            <span>拖动画布平移，滚轮缩放，拖动节点移动</span>
          </div>
          <div
            className="canvas-plane"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            }}
          >
            {nodes.map((node) => {
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
                  className={`canvas-node canvas-node-${node.kind}`}
                  style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                  onPointerDown={(event) => handleNodePointerDown(event, node.id)}
                >
                  <header>
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
                    <textarea placeholder="输入提示词，使用 @image:asset_id 引用资产" />
                    <button type="button">生成</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
