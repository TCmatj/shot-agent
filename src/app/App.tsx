import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CompositionEvent as ReactCompositionEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import AlibabaCloudIcon from '@lobehub/icons/es/AlibabaCloud/components/Mono';
import AnthropicIcon from '@lobehub/icons/es/Anthropic/components/Mono';
import AzureAIIcon from '@lobehub/icons/es/AzureAI/components/Mono';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Mono';
import GeminiIcon from '@lobehub/icons/es/Gemini/components/Mono';
import GroqIcon from '@lobehub/icons/es/Groq/components/Mono';
import MistralIcon from '@lobehub/icons/es/Mistral/components/Mono';
import OllamaIcon from '@lobehub/icons/es/Ollama/components/Mono';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono';
import OpenRouterIcon from '@lobehub/icons/es/OpenRouter/components/Mono';
import QwenIcon from '@lobehub/icons/es/Qwen/components/Mono';
import TogetherIcon from '@lobehub/icons/es/Together/components/Mono';
import VolcengineIcon from '@lobehub/icons/es/Volcengine/components/Mono';
import XAIIcon from '@lobehub/icons/es/XAI/components/Mono';
import {
  BoxSelect,
  Cloud,
  FilePlus2,
  FileText,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Image,
  Import,
  MessageSquare,
  Minus,
  Maximize2,
  Music,
  Move,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  SquareArrowUpRight,
  Trash2,
  Undo2,
  Redo2,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  defaultImageAspectRatio,
  defaultImageQuality,
  defaultImageResolutionTier,
  getImageAspectOptionLabel,
  getImageAspectOptions,
  getImageGenerationSize,
  imageQualityOptions,
  imageResolutionOptions,
  type ImageQuality,
  type ImageResolutionTier,
} from '../domain/imageGenerationOptions';
import {
  createProviderDraft,
  findChatProviders,
  findProviderModelsForNodeModel,
  findProvidersForCanonicalModel,
  mergeProviderDefaults,
  saveProviderDraft,
} from '../domain/provider';
import type { ProviderConfig } from '../domain/provider';
import type { ChatFormat } from '../domain/provider';
import { initialProviders } from '../models/providerCatalog';
import { fetchProviderModelList, mergeFetchedProviderModels } from '../models/providerModelList';
import {
  appendOutputVersion,
  getLatestOutputVersion,
  getOutputVersionsForDisplay,
  paginateOutputVersions,
} from '../domain/outputVersions';
import {
  parsePromptReferences,
  removePromptReferenceAtCaret,
  type PromptReferenceResolution,
} from '../domain/promptReferences';
import { createGenerationRecord, type GenerationRecord } from '../domain/generationHistory';
import {
  estimateSeedanceTokens,
  getDefaultSeedanceRatio,
  getSeedanceCapabilities,
  getSeedanceDurationInputBounds,
  getSeedanceInputPorts,
  getVisibleSeedanceFields,
  normalizeSeedanceDurationSeconds,
  type SeedanceInputPortId,
  type SeedanceModelId,
  type SeedanceRatio,
  type SeedanceScenario,
} from '../domain/seedance';
import {
  collectGenerationInputAssetIds,
  getEffectiveNodeOutputText,
  listVideoGenerationTasks,
  queryGenerationTask,
  resolveProviderToken,
  streamChatGenerationNode,
  submitGenerationNode,
  type VideoGenerationHistoryItem,
} from '../models/generationClient';
import {
  applyUploadedSeedanceAssetUrls,
  collectSeedanceUploadCandidates,
} from '../models/seedanceReferenceAssets';
import { renderMarkdownToHtml, shouldCollapseMarkdown } from '../lib/markdown';
import {
  clampPreviewImageZoom,
  getNextPreviewImageZoom,
  getPreviewZoomedScrollPosition,
  previewImageZoomStep,
} from './imagePreview';
import {
  addCanvasEdge,
  canConnectCanvasNodes,
  canNodeReceiveInput,
  copyCanvasSelection,
  createWorkspaceState,
  deleteCanvas,
  exportCanvas,
  findNodesInSelectionRect,
  getCanvasNodeWidth,
  getNextAvailableCanvasName,
  getUpstreamNodeIds,
  getNodeInputPoint,
  getNodeOutputPoint,
  importCanvas,
  moveCanvasNodes,
  normalizeCanvasSelectionRect,
  parseWorkspaceState,
  pasteCanvasClipboard,
  renameCanvas,
  removeCanvasEdge,
  removeCanvasNode,
  serializeWorkspaceState,
  updateWorkspaceStorage,
  type CanvasNodeKind,
  type CanvasNodeView,
  type CanvasView,
  type CanvasClipboardPayload,
  type CanvasWorkspaceState,
} from './canvasWorkspace';
import {
  getCanvasContentBounds,
  getViewportForCanvasCenter,
  panViewport,
  screenToCanvasPoint,
  zoomViewportAtPoint,
  type CanvasViewport,
  type Point,
  type Size,
} from './canvasViewport';
import {
  createWorkspaceHistory,
  pushWorkspaceHistory,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
  type WorkspaceHistory,
} from './workspaceHistory';
import {
  calculateCanvasCenterFromMinimapFrame,
  calculateMinimapViewportFrame,
  parseStoredCanvasViewports,
  serializeStoredCanvasViewports,
  type StoredCanvasViewports,
} from './canvasViewports';
import {
  getWorkspaceStore,
} from '../storage';
import {
  isObjectStorageConfigured,
  readAssetSourceAsBlob,
  uploadBlobToR2,
  type ObjectStorageConfig,
} from '../storage/objectStorage';
import type { CanvasAssetFile, CanvasAssetFileKind, WorkspaceRootHandle } from '../storage/workspaceStore';
import { createSeedanceTaskTracker } from '../models/seedanceTaskTracker';

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

type EdgeSnapTarget = {
  nodeId: string;
  portId?: SeedanceInputPortId | 'default';
};

type EdgeDraft = {
  fromNodeId: string;
  from: Point;
  to: Point;
  snapTarget?: EdgeSnapTarget;
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
      nodeIds: string[];
      lastX: number;
      lastY: number;
    }
  | {
      mode: 'select';
      pointerId: number;
      start: Point;
      current: Point;
    };

type DragPreviewState = {
  nodeIds: string[];
  dx: number;
  dy: number;
} | null;

type ModalDragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type MinimapDragState = {
  pointerId: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

type CanvasActionRailProps = {
  canUndo: boolean;
  canRedo: boolean;
  isAssetPanelOpen: boolean;
  scale: number;
  onAddNode: (clientX: number, clientY: number) => void;
  onCreateCanvas: () => void;
  onToggleAssetPanel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportCanvas: () => void;
  onImportCanvas: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetViewport: () => void;
};

function CanvasActionRail({
  canUndo,
  canRedo,
  isAssetPanelOpen,
  scale,
  onAddNode,
  onCreateCanvas,
  onToggleAssetPanel,
  onUndo,
  onRedo,
  onExportCanvas,
  onImportCanvas,
  onZoomOut,
  onZoomIn,
  onResetViewport,
}: CanvasActionRailProps) {
  return (
    <div className="canvas-action-rail">
      <div className="canvas-action-group">
        <button
          type="button"
          aria-label="添加节点"
          title="添加节点"
          onClick={(event) => onAddNode(event.clientX, event.clientY)}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          aria-label="撤销"
          title="撤销 Ctrl+Z"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          aria-label="回退"
          title="回退 Ctrl+Y / Ctrl+Shift+Z"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={18} />
        </button>
      </div>
      <div className="canvas-action-group">
        <button type="button" aria-label="新建画布" title="新建画布" onClick={onCreateCanvas}>
          <FolderPlus size={18} />
        </button>
        <button
          type="button"
          aria-label="导出当前画布"
          title="导出当前画布"
          onClick={onExportCanvas}
        >
          <SquareArrowUpRight size={18} />
        </button>
        <button type="button" aria-label="导入画布" title="导入画布" onClick={onImportCanvas}>
          <Import size={18} />
        </button>
        <button
          type="button"
          className={isAssetPanelOpen ? 'is-active' : ''}
          aria-label="资产"
          title="资产"
          onClick={onToggleAssetPanel}
        >
          <FileText size={18} />
        </button>
      </div>
      <div className="canvas-action-group">
        <button type="button" aria-label="缩小" title="缩小" onClick={onZoomOut}>
          <Minus size={18} />
        </button>
        <span className="canvas-scale-indicator">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="放大" title="放大" onClick={onZoomIn}>
          <Plus size={18} />
        </button>
        <button
          type="button"
          aria-label="重置视图"
          title="重置视图"
          onClick={onResetViewport}
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}

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
    id: 'chat',
    label: '对话节点',
    title: '提示词整理',
    modelId: 'gpt-5.4-mini',
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
  {
    id: 'asset-audio',
    label: '音频节点',
    title: '音频',
    modelId: 'asset-audio',
    kind: 'audioAsset',
    icon: Music,
    outputOnly: true,
  },
];

const initialCanvases: CanvasView[] = [];
const initialWorkspaceState = createWorkspaceState(initialCanvases);
const workspaceStorageKey = 'shot-agent:canvas-workspace';
const providerStorageKey = 'shot-agent:providers';
const cloudflareStorageKey = 'shot-agent:cloudflare-r2';
const deletedProviderStorageKey = 'shot-agent:deleted-providers';
const canvasViewportStorageKey = 'shot-agent:canvas-viewports';
const canvasNodeSize = { width: 320, height: 220 };
const edgeHandleHitSize = 18;
const minimapSize = { width: 220, height: 150 };
const defaultViewport: CanvasViewport = { x: 80, y: 72, scale: 1 };
const edgeSnapRadius = 52;

type ProviderSettingsView = 'providers' | 'cloudflare';

type UnsavedChangesPrompt = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

type AssetFilter = 'all' | CanvasAssetFileKind;

type TauriWindowCloseHandle = {
  close: () => Promise<void>;
  destroy?: () => Promise<void>;
};

type TauriInvoke = (command: string) => Promise<unknown>;

type CloudflareR2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  publicBaseUrl: string;
};

const emptyCloudflareR2Config: CloudflareR2Config = {
  accountId: '',
  bucketName: '',
  accessKeyId: '',
  secretAccessKey: '',
  endpoint: '',
  publicBaseUrl: '',
};

function summarizeOutputText(value: string, maxLength = 160): string {
  const summary = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return summary.length > maxLength ? `${summary.slice(0, maxLength)}...` : summary;
}

function StreamingOutputTail({ text }: { text: string }) {
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const output = outputRef.current;

    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  }, [text]);

  return (
    <pre ref={outputRef} className="node-output-stream-tail" aria-live="polite">
      {text || '等待模型输出...'}
    </pre>
  );
}

type PromptReferenceSuggestion = {
  token: string;
  title: string;
  subtitle: string;
  kindLabel: string;
  imageUrl?: string;
  videoUrl?: string;
  textPreview?: string;
};

type PromptReferencePreview = PromptReferenceSuggestion & {
  kind: 'text' | 'image' | 'video' | 'audio';
};

type ImagePreviewState = {
  title: string;
  imageUrl: string;
};

function getPromptReferenceTokenForSuggestion(suggestion: PromptReferenceSuggestion): string {
  if (suggestion.token === '@图片') {
    return `@image:${suggestion.subtitle}`;
  }

  if (suggestion.token === '@视频') {
    return `@video:${suggestion.subtitle}`;
  }

  if (suggestion.token === '@文本') {
    return `@text:${suggestion.subtitle}`;
  }

  if (suggestion.token === '@音频') {
    return `@audio:${suggestion.subtitle}`;
  }

  return suggestion.token;
}

function getNodeTextReferencePreview(node: CanvasNodeView): string | undefined {
  const text = node.kind === 'textAsset' ? node.textContent : getEffectiveNodeOutputText(node);
  const compact = text?.replace(/\s+/g, ' ').trim();

  return compact ? compact.slice(0, 5) : undefined;
}

function getNodeImageReferenceUrl(node: CanvasNodeView): string | undefined {
  if (node.kind === 'imageAsset') {
    return node.assetDataUrl;
  }

  if (node.kind === 'image') {
    return node.outputDataUrl ?? node.outputUrl;
  }

  return undefined;
}

function getNodeVideoReferenceUrl(node: CanvasNodeView): string | undefined {
  if (node.kind === 'videoAsset') {
    return node.assetDataUrl;
  }

  if (node.kind === 'video') {
    return node.outputUrl ?? node.outputDataUrl;
  }

  return undefined;
}

function getNodeAudioReferenceUrl(node: CanvasNodeView): string | undefined {
  if (node.kind === 'audioAsset') {
    return node.assetDataUrl;
  }

  return undefined;
}

function getPromptReferenceSuggestions(
  canvas: CanvasView | null,
  currentNodeId: string,
): PromptReferenceSuggestion[] {
  if (!canvas) {
    return [];
  }

  const upstreamNodeIds = new Set(getUpstreamNodeIds(canvas, currentNodeId));

  return canvas.nodes.flatMap<PromptReferenceSuggestion>((node) => {
    if (!upstreamNodeIds.has(node.id)) {
      return [];
    }

    const suggestions: PromptReferenceSuggestion[] = [];
    const textPreview = getNodeTextReferencePreview(node);
    if (textPreview) {
      suggestions.push({
        token: '@文本',
        title: node.title,
        subtitle: node.id,
        kindLabel: '文本',
        textPreview,
      });
    }

    const imageUrl = getNodeImageReferenceUrl(node);
    if (imageUrl) {
      suggestions.push({
        token: '@图片',
        title: node.title,
        subtitle: node.id,
        kindLabel: '图片',
        imageUrl,
      });
    }

    const videoUrl = getNodeVideoReferenceUrl(node);
    if (videoUrl) {
      suggestions.push({
        token: '@视频',
        title: node.title,
        subtitle: node.id,
        kindLabel: '视频',
        videoUrl,
      });
    }

    const audioUrl = getNodeAudioReferenceUrl(node);
    if (audioUrl) {
      suggestions.push({
        token: '@音频',
        title: node.title,
        subtitle: node.id,
        kindLabel: '音频',
      });
    }

    return suggestions;
  });
}

function getPromptReferenceResolution(
  canvas: CanvasView | null,
  currentNodeId: string,
): PromptReferenceResolution {
  if (!canvas) {
    return {};
  }

  const upstreamNodes = getUpstreamNodeIds(canvas, currentNodeId)
    .map((nodeId) => canvas.nodes.find((node) => node.id === nodeId))
    .filter((node): node is CanvasNodeView => Boolean(node));

  return {
    text: upstreamNodes
      .filter((node) => node.kind === 'textAsset' || Boolean(getNodeTextReferencePreview(node)))
      .map((node) => node.id),
    image: upstreamNodes
      .filter((node) => Boolean(getNodeImageReferenceUrl(node)))
      .map((node) => node.id),
    video: upstreamNodes
      .filter((node) => Boolean(getNodeVideoReferenceUrl(node)))
      .map((node) => node.id),
    audio: upstreamNodes
      .filter((node) => Boolean(getNodeAudioReferenceUrl(node)))
      .map((node) => node.id),
  };
}

function getPromptReferencePreviews(
  canvas: CanvasView | null,
  currentNodeId: string,
  prompt: string,
): PromptReferencePreview[] {
  if (!canvas) {
    return [];
  }

  const upstreamNodeIds = new Set(getUpstreamNodeIds(canvas, currentNodeId));

  return parsePromptReferences(
    prompt,
    getPromptReferenceResolution(canvas, currentNodeId),
  ).flatMap<PromptReferencePreview>((reference) => {
    if (
      reference.kind !== 'text' &&
      reference.kind !== 'image' &&
      reference.kind !== 'video' &&
      reference.kind !== 'audio'
    ) {
      return [];
    }

    const kind = reference.kind;
    const nodeId = reference.assetId;
    const token = reference.token;

    const referencedNode = upstreamNodeIds.has(nodeId)
      ? canvas.nodes.find((candidate) => candidate.id === nodeId)
      : undefined;
    if (!referencedNode) {
      return [];
    }

    if (kind === 'text') {
      const textPreview = getNodeTextReferencePreview(referencedNode);
      return textPreview
        ? [
            {
              token,
              title: referencedNode.title,
              subtitle: referencedNode.id,
              kindLabel: '文本',
              kind,
              textPreview,
            },
          ]
        : [];
    }

    const imageUrl = getNodeImageReferenceUrl(referencedNode);
    if (kind === 'image') {
      return imageUrl
        ? [
            {
              token,
              title: referencedNode.title,
              subtitle: referencedNode.id,
              kindLabel: '图片',
              kind,
              imageUrl,
            },
          ]
        : [];
    }

    const videoUrl = getNodeVideoReferenceUrl(referencedNode);
    if (kind === 'video') {
      return videoUrl
        ? [
            {
              token,
              title: referencedNode.title,
              subtitle: referencedNode.id,
              kindLabel: '视频',
              kind,
              videoUrl,
            },
          ]
        : [];
    }

    const audioUrl = getNodeAudioReferenceUrl(referencedNode);
    return audioUrl
      ? [
          {
            token,
            title: referencedNode.title,
            subtitle: referencedNode.id,
            kindLabel: '音频',
            kind,
          },
        ]
      : [];
  });
}

function getPromptReferenceTrigger(value: string, caret: number) {
  const prefix = value.slice(0, caret);
  const match = prefix.match(/(@(?:[a-zA-Z]*(?::[a-zA-Z0-9_-]*)?|[\u4e00-\u9fa5]*))$/);

  if (!match) {
    return null;
  }

  const token = match[1];
  return {
    start: caret - token.length,
    end: caret,
    token,
    query: token.slice(1).toLowerCase(),
  };
}

function filterPromptReferenceSuggestions(
  suggestions: PromptReferenceSuggestion[],
  query: string,
) {
  return suggestions.filter((suggestion) => {
    const searchable =
      `${suggestion.token} ${suggestion.kindLabel} ${suggestion.title} ${suggestion.subtitle}`.toLowerCase();

    return searchable.includes(query);
  });
}

function serializePromptEditor(root: HTMLElement): string {
  let value = '';

  root.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.dataset.token) {
      value += child.dataset.token;
      return;
    }

    value += child.textContent ?? '';
  });

  return value;
}

function createPromptReferenceTokenElement(
  reference: PromptReferencePreview,
  onPreviewImage: (reference: PromptReferencePreview) => void,
): HTMLElement {
  const token = document.createElement('span');
  token.className = `prompt-reference-token is-${reference.kind}`;
  token.contentEditable = 'false';
  token.dataset.token = reference.token;
  token.title = `${reference.title} ${reference.token}`;

  const prefix = document.createElement('span');
  prefix.textContent = '@';
  token.append(prefix);

  if (reference.kind === 'image' && reference.imageUrl) {
    const image = document.createElement('img');
    image.src = reference.imageUrl;
    image.alt = reference.title;
    token.append(image);
    token.addEventListener('click', () => onPreviewImage(reference));
  } else {
    const label = document.createElement('strong');
    label.textContent = reference.textPreview ?? reference.kindLabel;
    token.append(label);
  }

  return token;
}

function ImagePreviewModal({
  preview,
  onClose,
}: {
  preview: ImagePreviewState | null;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    if (preview) {
      setZoomPercent(100);
      setDragState(null);
    }
  }, [preview]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === modalRef.current);
    }

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const className = 'preview-image-zoomed';
    const shouldHideMinimap = Boolean(preview) && zoomPercent > 100;

    document.body.classList.toggle(className, shouldHideMinimap);

    return () => {
      document.body.classList.remove(className);
    };
  }, [preview, zoomPercent]);

  if (!preview) {
    return null;
  }

  function updateZoom(nextZoom: number, anchor?: { x: number; y: number }) {
    setZoomPercent((current) => {
      const resolvedZoom = clampPreviewImageZoom(nextZoom);
      if (resolvedZoom === current) {
        return current;
      }

      const stage = stageRef.current;
      if (stage && anchor) {
        const nextScroll = getPreviewZoomedScrollPosition({
          currentZoom: current,
          nextZoom: resolvedZoom,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
          anchorX: anchor.x,
          anchorY: anchor.y,
        });

        requestAnimationFrame(() => {
          if (stageRef.current) {
            stageRef.current.scrollLeft = nextScroll.scrollLeft;
            stageRef.current.scrollTop = nextScroll.scrollTop;
          }
        });
      }

      return resolvedZoom;
    });
  }

  function adjustZoom(delta: number, anchor?: { x: number; y: number }) {
    const stage = stageRef.current;
    const fallbackAnchor = stage
      ? {
          x: stage.clientWidth / 2,
          y: stage.clientHeight / 2,
        }
      : undefined;

    setZoomPercent((current) => {
      const resolvedZoom = getNextPreviewImageZoom(current, delta);
      const resolvedAnchor = anchor ?? fallbackAnchor;
      if (resolvedZoom === current) {
        return current;
      }

      if (stage && resolvedAnchor) {
        const nextScroll = getPreviewZoomedScrollPosition({
          currentZoom: current,
          nextZoom: resolvedZoom,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
          anchorX: resolvedAnchor.x,
          anchorY: resolvedAnchor.y,
        });

        requestAnimationFrame(() => {
          if (stageRef.current) {
            stageRef.current.scrollLeft = nextScroll.scrollLeft;
            stageRef.current.scrollTop = nextScroll.scrollTop;
          }
        });
      }

      return resolvedZoom;
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    adjustZoom(event.deltaY < 0 ? previewImageZoomStep : -previewImageZoomStep, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  async function toggleFullscreen() {
    const modal = modalRef.current;
    if (!modal) {
      return;
    }

    if (document.fullscreenElement === modal) {
      await document.exitFullscreen?.();
      return;
    }

    await modal.requestFullscreen?.();
  }

  function handleStagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (zoomPercent <= 100 || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function handleStagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId || !stageRef.current) {
      return;
    }

    stageRef.current.scrollLeft -= event.clientX - dragState.lastX;
    stageRef.current.scrollTop -= event.clientY - dragState.lastY;
    setDragState({
      pointerId: dragState.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function finishStageDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  }

  return createPortal(
    <div className="prompt-reference-image-backdrop" onPointerDown={onClose}>
      <div
        ref={modalRef}
        className="prompt-reference-image-modal"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <strong>{preview.title}</strong>
          <div className="prompt-reference-image-toolbar">
            <div className="prompt-reference-image-zoom-controls">
              <button
                type="button"
                aria-label="缩小图片"
                title="缩小图片"
                onClick={() => adjustZoom(-previewImageZoomStep)}
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                className="zoom-value"
                aria-label={`当前缩放 ${zoomPercent}%`}
                onClick={() => updateZoom(100)}
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                aria-label="放大图片"
                title="放大图片"
                onClick={() => adjustZoom(previewImageZoomStep)}
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                aria-label="重置图片缩放"
                title="重置图片缩放"
                onClick={() => updateZoom(100)}
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                aria-label={isFullscreen ? '退出全屏查看图片' : '全屏查看图片'}
                title={isFullscreen ? '退出全屏查看图片' : '全屏查看图片'}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
            <button type="button" onClick={onClose}>
              <X size={16} />
              关闭
            </button>
          </div>
        </header>
        <div
          ref={stageRef}
          className={`prompt-reference-image-stage ${zoomPercent > 100 ? 'is-pannable' : ''} ${dragState ? 'is-dragging' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={finishStageDrag}
          onPointerCancel={finishStageDrag}
        >
          <div className="prompt-reference-image-surface">
            <img
              className="prompt-reference-image-preview"
              src={preview.imageUrl}
              alt={preview.title}
              style={{ width: `${zoomPercent}%` }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function renderPromptEditorContent(
  root: HTMLElement,
  value: string,
  references: PromptReferencePreview[],
  onPreviewImage: (reference: PromptReferencePreview) => void,
) {
  const referencesByToken = new Map<string, PromptReferencePreview[]>();
  references.forEach((reference) => {
    referencesByToken.set(reference.token, [
      ...(referencesByToken.get(reference.token) ?? []),
      reference,
    ]);
  });
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of value.matchAll(/@(text|image|video|audio):([a-zA-Z0-9_-]+)|@(图片|视频|文本|音频)/g)) {
    const token = match[0];
    const start = match.index ?? 0;
    const reference = referencesByToken.get(token)?.shift();

    if (start > cursor) {
      fragment.append(document.createTextNode(value.slice(cursor, start)));
    }

    fragment.append(
      reference
        ? createPromptReferenceTokenElement(reference, onPreviewImage)
        : document.createTextNode(token),
    );
    cursor = start + token.length;
  }

  if (cursor < value.length) {
    fragment.append(document.createTextNode(value.slice(cursor)));
  }

  root.replaceChildren(fragment);
}

function getPromptEditorCaretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return serializePromptEditor(root).length;
  }

  const range = selection.getRangeAt(0);
  const anchorNode = range.startContainer;
  const anchorOffset = range.startOffset;
  let offset = 0;
  let found = false;

  function visit(node: Node): void {
    if (found) {
      return;
    }

    if (node === anchorNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += anchorOffset;
      } else {
        const children = Array.from(node.childNodes).slice(0, anchorOffset);
        children.forEach((child) => {
          offset += child instanceof HTMLElement && child.dataset.token
            ? child.dataset.token.length
            : (child.textContent ?? '').length;
        });
      }
      found = true;
      return;
    }

    if (node instanceof HTMLElement && node.dataset.token) {
      offset += node.dataset.token.length;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      return;
    }

    node.childNodes.forEach(visit);
  }

  visit(root);
  return offset;
}

function setPromptEditorCaretOffset(root: HTMLElement, nextOffset: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  let offset = 0;
  let placed = false;

  function place(node: Node): void {
    if (placed) {
      return;
    }

    if (node instanceof HTMLElement && node.dataset.token) {
      const tokenLength = node.dataset.token.length;
      if (nextOffset <= offset + tokenLength) {
        range.setStartAfter(node);
        placed = true;
      }
      offset += tokenLength;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;
      if (nextOffset <= offset + textLength) {
        range.setStart(node, Math.max(0, nextOffset - offset));
        placed = true;
      }
      offset += textLength;
      return;
    }

    node.childNodes.forEach(place);
  }

  place(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function PromptTextarea({
  canvas,
  node,
  placeholder,
  stopPointerDown,
  onChange,
}: {
  canvas: CanvasView | null;
  node: CanvasNodeView;
  placeholder: string;
  stopPointerDown?: boolean;
  onChange(value: string): void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const suggestionInteractionModeRef = useRef<'pointer' | 'keyboard'>('pointer');
  const [trigger, setTrigger] = useState<ReturnType<typeof getPromptReferenceTrigger>>(null);
  const [previewImage, setPreviewImage] = useState<ImagePreviewState | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const suggestions = getPromptReferenceSuggestions(canvas, node.id);
  const referencePreviews = getPromptReferencePreviews(canvas, node.id, node.prompt ?? '');
  const visibleSuggestions = trigger
    ? filterPromptReferenceSuggestions(suggestions, trigger.query).slice(0, 8)
    : [];

  function handlePreviewImage(reference: PromptReferencePreview) {
    if (!reference.imageUrl) {
      return;
    }

    setPreviewImage({
      title: reference.title,
      imageUrl: reference.imageUrl,
    });
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) {
      return;
    }

    renderPromptEditorContent(editor, node.prompt ?? '', referencePreviews, handlePreviewImage);
  }, [node.prompt, referencePreviews]);

  function syncEditorValue(nextValue: string, nextCaret?: number) {
    const editor = editorRef.current;
    if (!editor) {
      onChange(nextValue);
      return;
    }

    renderPromptEditorContent(
      editor,
      nextValue,
      getPromptReferencePreviews(canvas, node.id, nextValue),
      handlePreviewImage,
    );
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      editor.focus();
      setPromptEditorCaretOffset(editor, nextCaret ?? nextValue.length);
    });
  }

  function refreshTrigger(target: HTMLElement) {
    if (isComposingRef.current) {
      return;
    }

    const value = serializePromptEditor(target);
    const nextTrigger = getPromptReferenceTrigger(value, getPromptEditorCaretOffset(target));
    setTrigger(nextTrigger);
    suggestionInteractionModeRef.current = 'pointer';
    setActiveSuggestionIndex(0);
  }

  function handleEditorInput(target: HTMLElement) {
    const value = serializePromptEditor(target);
    const caret = getPromptEditorCaretOffset(target);
    const previews = getPromptReferencePreviews(canvas, node.id, value);

    onChange(value);
    if (isComposingRef.current) {
      return;
    }

    if (previews.length > 0 && /@(图片|视频|文本|音频|image|video|text|audio):?/.test(value)) {
      renderPromptEditorContent(target, value, previews, handlePreviewImage);
      window.requestAnimationFrame(() => {
        setPromptEditorCaretOffset(target, caret);
      });
    }
    refreshTrigger(target);
  }

  function insertSuggestion(suggestion: PromptReferenceSuggestion) {
    if (!trigger) {
      return;
    }

    const value = editorRef.current ? serializePromptEditor(editorRef.current) : node.prompt ?? '';
    const insertedToken = getPromptReferenceTokenForSuggestion(suggestion);
    const nextValue = `${value.slice(0, trigger.start)}${insertedToken} ${value.slice(trigger.end)}`;
    const nextCaret = trigger.start + insertedToken.length + 1;

    setTrigger(null);
    syncEditorValue(nextValue, nextCaret);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || isComposingRef.current) {
      return;
    }

    if (trigger && visibleSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        suggestionInteractionModeRef.current = 'keyboard';
        setActiveSuggestionIndex((current) => (current + 1) % visibleSuggestions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        suggestionInteractionModeRef.current = 'keyboard';
        setActiveSuggestionIndex((current) =>
          current === 0 ? visibleSuggestions.length - 1 : current - 1,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        insertSuggestion(visibleSuggestions[activeSuggestionIndex] ?? visibleSuggestions[0]);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const editor = event.currentTarget;
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) {
      return;
    }

    const value = serializePromptEditor(editor);
    const caret = getPromptEditorCaretOffset(editor);
    const result = removePromptReferenceAtCaret(
      value,
      caret,
      event.key === 'Backspace' ? 'backward' : 'forward',
    );

    if (!result) {
      return;
    }

    event.preventDefault();
    setTrigger(null);
    syncEditorValue(result.prompt, result.caret);
  }

  function handleCompositionStart() {
    isComposingRef.current = true;
    setTrigger(null);
  }

  function handleCompositionEnd(event: ReactCompositionEvent<HTMLDivElement>) {
    isComposingRef.current = false;
    handleEditorInput(event.currentTarget);
  }

  function handleEditorKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || isComposingRef.current) {
      return;
    }

    if (
      trigger &&
      visibleSuggestions.length > 0 &&
      ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)
    ) {
      return;
    }

    refreshTrigger(event.currentTarget);
  }

  useEffect(() => {
    if (visibleSuggestions.length === 0) {
      setActiveSuggestionIndex(0);
      return;
    }

    if (activeSuggestionIndex >= visibleSuggestions.length) {
      setActiveSuggestionIndex(visibleSuggestions.length - 1);
    }
  }, [activeSuggestionIndex, visibleSuggestions.length]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || visibleSuggestions.length === 0) {
      return;
    }

    const activeButton = menu.querySelector<HTMLButtonElement>('button.is-active');
    activeButton?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeSuggestionIndex, visibleSuggestions.length]);

  return (
    <div className="prompt-reference-field">
      <div
        ref={editorRef}
        className="prompt-reference-editor"
        contentEditable
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onPointerDown={stopPointerDown ? (event) => event.stopPropagation() : undefined}
        onBlur={() => window.setTimeout(() => setTrigger(null), 120)}
        onClick={(event) => refreshTrigger(event.currentTarget)}
        onKeyUp={handleEditorKeyUp}
        onKeyDown={handleEditorKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={(event) => handleEditorInput(event.currentTarget)}
      />
      {visibleSuggestions.length > 0 ? (
        <div
          ref={menuRef}
          className="prompt-reference-menu"
          role="listbox"
          onPointerMove={() => {
            suggestionInteractionModeRef.current = 'pointer';
          }}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (visibleSuggestions.length <= 1) {
              return;
            }

            suggestionInteractionModeRef.current = 'pointer';
            setActiveSuggestionIndex((current) => {
              if (event.deltaY > 0) {
                return Math.min(visibleSuggestions.length - 1, current + 1);
              }

              if (event.deltaY < 0) {
                return Math.max(0, current - 1);
              }

              return current;
            });
          }}
        >
          {visibleSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.token}:${suggestion.subtitle}`}
              type="button"
              className={index === activeSuggestionIndex ? 'is-active' : undefined}
              aria-selected={index === activeSuggestionIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                if (suggestionInteractionModeRef.current !== 'pointer') {
                  return;
                }

                setActiveSuggestionIndex(index);
              }}
              onClick={() => insertSuggestion(suggestion)}
            >
              {suggestion.imageUrl ? (
                <img src={suggestion.imageUrl} alt={suggestion.title} />
              ) : (
                <span>{suggestion.kindLabel}</span>
              )}
              <strong>{suggestion.title}</strong>
              <small>{suggestion.textPreview ? suggestion.textPreview : suggestion.token}</small>
            </button>
          ))}
        </div>
      ) : null}
      <ImagePreviewModal preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}

function loadProviders(): ProviderConfig[] {
  const normalizeProviderDisplayText = (providers: ProviderConfig[]): ProviderConfig[] =>
    providers.map((provider) => {
      if (provider.id === 'provider_openai' && provider.name !== 'OpenAI 官方') {
        return { ...provider, name: 'OpenAI 官方' };
      }

      if (provider.id === 'provider_seedance' && provider.name === '火山方舟') {
        return { ...provider, name: '火山方舟' };
      }

      return provider;
    });

  if (typeof window === 'undefined') {
    return initialProviders;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(providerStorageKey) ?? '');
    const deletedProviderIds = parseDeletedProviderIds(
      window.localStorage.getItem(deletedProviderStorageKey),
    );

    if (!Array.isArray(parsed)) {
      return initialProviders;
    }

    const mergedProviders = mergeProviderDefaults(parsed as ProviderConfig[], initialProviders);
    const missingDefaultProviders = initialProviders.filter(
      (defaultProvider) =>
        !deletedProviderIds.has(defaultProvider.id) &&
        !mergedProviders.some((provider) => provider.id === defaultProvider.id),
    );

    return normalizeProviderDisplayText([
      ...mergedProviders,
      ...missingDefaultProviders.map(createProviderDraft),
    ]);
  } catch {
    return initialProviders;
  }
}

function buildSeedanceReferenceObjectKey(
  canvas: CanvasView,
  node: CanvasNodeView,
  candidate: {
    nodeId: string;
    kind: 'image' | 'video' | 'audio';
  },
  mimeType?: string,
): string {
  const extension = getMediaExtensionFromMimeType(mimeType, candidate.kind);

  return [
    'canvases',
    sanitizeObjectKeySegment(canvas.id),
    'seedance-references',
    `${sanitizeObjectKeySegment(node.id)}-${sanitizeObjectKeySegment(candidate.nodeId)}-${Date.now()}${extension}`,
  ].join('/');
}

function sanitizeObjectKeySegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function getMediaExtensionFromMimeType(
  mimeType: string | undefined,
  kind: 'image' | 'video' | 'audio',
): string {
  if (!mimeType) {
    return kind === 'image' ? '.png' : kind === 'video' ? '.mp4' : '.mp3';
  }

  if (mimeType.includes('png')) {
    return '.png';
  }

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return '.jpg';
  }

  if (mimeType.includes('webp')) {
    return '.webp';
  }

  if (mimeType.includes('mp4')) {
    return '.mp4';
  }

  if (mimeType.includes('quicktime')) {
    return '.mov';
  }

  if (mimeType.includes('mpeg')) {
    return '.mp3';
  }

  if (mimeType.includes('wav')) {
    return '.wav';
  }

  return kind === 'image' ? '.png' : kind === 'video' ? '.mp4' : '.mp3';
}

function loadCloudflareR2Config(): CloudflareR2Config {
  if (typeof window === 'undefined') {
    return emptyCloudflareR2Config;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(cloudflareStorageKey) ?? '');

    if (!parsed || typeof parsed !== 'object') {
      return emptyCloudflareR2Config;
    }

    const record = parsed as Partial<Record<keyof CloudflareR2Config, unknown>>;

    return {
      accountId: typeof record.accountId === 'string' ? record.accountId : '',
      bucketName: typeof record.bucketName === 'string' ? record.bucketName : '',
      accessKeyId: typeof record.accessKeyId === 'string' ? record.accessKeyId : '',
      secretAccessKey: typeof record.secretAccessKey === 'string' ? record.secretAccessKey : '',
      endpoint: typeof record.endpoint === 'string' ? record.endpoint : '',
      publicBaseUrl: typeof record.publicBaseUrl === 'string' ? record.publicBaseUrl : '',
    };
  } catch {
    return emptyCloudflareR2Config;
  }
}

function isCloudflareR2Configured(config: CloudflareR2Config): boolean {
  return Boolean(
    config.accountId.trim() &&
      config.bucketName.trim() &&
      config.accessKeyId.trim() &&
      config.secretAccessKey.trim() &&
      config.endpoint.trim() &&
      config.publicBaseUrl.trim(),
  );
}

function createObjectStorageConfigFromCloudflare(
  config: CloudflareR2Config,
): ObjectStorageConfig {
  return {
    endpoint: config.endpoint.trim(),
    bucket: config.bucketName.trim(),
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey.trim(),
    publicBaseURL: config.publicBaseUrl.trim(),
  };
}

function parseDeletedProviderIds(value: string | null): Set<string> {
  if (!value) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? new Set(parsed.filter((providerId): providerId is string => typeof providerId === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function loadCanvasViewports(): StoredCanvasViewports {
  if (typeof window === 'undefined') {
    return {};
  }

  return parseStoredCanvasViewports(window.localStorage.getItem(canvasViewportStorageKey));
}

function isSameViewport(first: CanvasViewport, second: CanvasViewport): boolean {
  return first.x === second.x && first.y === second.y && first.scale === second.scale;
}

function getNodeIcon(kind: CanvasNodeKind) {
  if (kind === 'video' || kind === 'videoAsset') {
    return Video;
  }

  if (kind === 'audioAsset') {
    return Music;
  }

  if (kind === 'chat') {
    return MessageSquare;
  }

  if (kind === 'textAsset') {
    return FileText;
  }

  return Image;
}

function getLocalStorageErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return '浏览器本地存储空间不足，当前更改可能刷新后丢失。请先删除较大的本地素材，或等待后续对象存储接入。';
  }

  return '画布保存到浏览器本地存储失败，当前更改可能刷新后丢失。';
}

function getProviderProtocolLabel(protocol: ProviderConfig['protocol']): string {
  switch (protocol) {
    case 'openai-compatible':
      return 'OpenAI 格式';
    case 'anthropic-compatible':
      return 'Anthropic 格式';
    case 'volcengine':
      return '火山方舟';
    case 'custom':
      return '自定义';
    default:
      return '未知格式';
  }
}

function getGenerationStatusLabel(status: GenerationRecord['status']): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'running':
      return '生成中';
    case 'succeeded':
      return '已完成';
    case 'failed':
      return '失败';
    case 'canceled':
      return '已取消';
    case 'idle':
    default:
      return '待开始';
  }
}

function getGenerationStatusTone(status: GenerationRecord['status']): string {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'queued':
    case 'running':
      return 'running';
    case 'canceled':
      return 'canceled';
    case 'idle':
    default:
      return 'idle';
  }
}

function formatGenerationTime(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGenerationTokenUsage(record: GenerationRecord): string {
  const usage =
    record.usage && typeof record.usage === 'object'
      ? (record.usage as { completionTokens?: unknown; totalTokens?: unknown })
      : null;
  const totalTokens =
    typeof usage?.totalTokens === 'number'
      ? usage.totalTokens
      : typeof usage?.completionTokens === 'number'
        ? usage.completionTokens
        : undefined;

  return typeof totalTokens === 'number' ? `${totalTokens}` : '-';
}

function getAssetFilterLabel(filter: AssetFilter): string {
  switch (filter) {
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
    case 'file':
      return '文件';
    case 'cover':
      return '封面';
    case 'all':
    default:
      return '全部';
  }
}

function getAssetKindLabel(kind: CanvasAssetFileKind): string {
  return getAssetFilterLabel(kind);
}

export async function forceCloseTauriWindow(
  appWindow: TauriWindowCloseHandle,
  invokeCommand: TauriInvoke = invoke,
): Promise<void> {
  try {
    await invokeCommand('force_close_application');
    return;
  } catch {
    // Fall back to JS window APIs when the backend command is unavailable, such as in tests.
  }

  if (appWindow.destroy) {
    try {
      await appWindow.destroy();
      return;
    } catch {
      // Fall back to close below. Some runtimes may reject destroy depending on platform state.
    }
  }

  await appWindow.close();
}

function getImageNodeSettingBadges(node: CanvasNodeView): string[] {
  const resolutionTier = node.imageResolutionTier ?? defaultImageResolutionTier;
  const aspectRatio = node.imageAspectRatio ?? defaultImageAspectRatio;
  const quality = node.imageQuality ?? defaultImageQuality;
  const resolutionLabel =
    imageResolutionOptions.find((option) => option.value === resolutionTier)?.label ??
    resolutionTier.toUpperCase();
  const qualityLabel =
    imageQualityOptions.find((option) => option.value === quality)?.label ?? quality;
  const size = getImageGenerationSize(resolutionTier, aspectRatio);
  const aspectLabel = size === 'auto' ? 'Auto' : `${aspectRatio} ${size}`;

  return [resolutionLabel, aspectLabel, qualityLabel];
}

function getVideoNodeSettingBadges(node: CanvasNodeView): string[] {
  const model = (node.modelId as SeedanceModelId) ?? 'seedance2.0';
  const capabilities = getSeedanceCapabilities(model);
  const resolution = node.videoResolution ?? capabilities.supportedResolutions[0] ?? '720p';
  const ratio = node.videoRatio ?? getDefaultSeedanceRatio(model);
  const duration = node.videoDurationSeconds ?? 5;
  const durationLabel = duration === -1 ? 'Auto 时长' : `${duration}s`;
  const frameRate = node.videoFramesPerSecond ?? capabilities.fixedFrameRate;

  return [resolution, ratio === 'adaptive' ? 'Adaptive' : ratio, durationLabel, `${frameRate}fps`];
}

function getVideoOutputStorageStatus(node: CanvasNodeView): {
  summary: string;
  detail?: string;
  tone: 'local' | 'remote';
} | null {
  if (node.kind !== 'video') {
    return null;
  }

  if (node.outputPath) {
    return {
      summary: '已保存到本地',
      detail: node.outputPath,
      tone: 'local',
    };
  }

  if (node.outputUrl || node.outputDataUrl) {
    return {
      summary: '仅远程结果',
      detail: '当前结果尚未写入画布文件夹',
      tone: 'remote',
    };
  }

  return null;
}

function getEstimatedVideoDurationSeconds(node: CanvasNodeView): number {
  const model = (node.modelId as SeedanceModelId) ?? 'seedance2.0';
  const capabilities = getSeedanceCapabilities(model);
  const duration = node.videoDurationSeconds;

  if (duration === -1) {
    return capabilities.durationRangeSeconds.min;
  }

  return duration ?? 5;
}

function getVideoScenarioOptions(): Array<{ value: SeedanceScenario; label: string }> {
  return [
    { value: 'text_to_video', label: '文生视频' },
    { value: 'image_to_video_first_frame', label: '首帧图生视频' },
    { value: 'image_to_video_first_last_frame', label: '首尾帧图生视频' },
    { value: 'multimodal_reference_video', label: '多模态参考视频' },
  ];
}

function getVideoModelOptions(): Array<{ value: SeedanceModelId; label: string }> {
  return [
    { value: 'seedance2.0', label: 'seedance2.0' },
    { value: 'seedance2.0-fast', label: 'seedance2.0-fast' },
  ];
}

function getVideoScenarioLabel(scenario: SeedanceScenario): string {
  return getVideoScenarioOptions().find((option) => option.value === scenario)?.label ?? scenario;
}

function getVideoInputPorts(scenario: SeedanceScenario) {
  return getSeedanceInputPorts(scenario);
}

function getVideoPromptPlaceholder(scenario: SeedanceScenario): string {
  if (scenario === 'image_to_video_first_frame') {
    return '输入提示词，支持 @文本 引用文本；首帧图片通过连线传入，无需再 @ 引用图片';
  }

  if (scenario === 'image_to_video_first_last_frame') {
    return '输入提示词，支持 @文本 引用文本；首帧和尾帧通过连线传入，无需再 @ 引用图片';
  }

  if (scenario === 'multimodal_reference_video') {
    return '输入提示词，支持 @文本 / @图片 / @视频 / @音频；连线仅提供可引用范围，只有提示词中引用的图片、视频和音频才会上传';
  }

  return '输入提示词，支持 @文本 引用文本';
}

function getVideoScenarioHint(scenario: SeedanceScenario): string | null {
  if (scenario === 'text_to_video') {
    return '文生视频模式仅读取提示词内容；支持使用 @文本 引用已连线的文本或对话输出。';
  }

  if (scenario === 'image_to_video_first_frame') {
    return '首帧图生视频模式会自动读取直接连到当前视频节点的 1 张上游图片作为首帧；图片无需再在提示词里用 @ 引用。';
  }

  if (scenario === 'image_to_video_first_last_frame') {
    return '首尾帧图生视频模式会自动读取直接连到当前视频节点的上游图片，按画布从上到下依次作为首帧和尾帧；无需再在提示词里 @ 引用图片。';
  }

  if (scenario === 'multimodal_reference_video') {
    return '多模态参考视频模式下，连线用于提供可引用的参考素材范围；提示词中使用 @文本 / @图片 / @视频 / @音频 引用到的内容才会参与本次请求上传。';
  }

  return null;
}

function getProviderInitial(providerName: string): string {
  const compactName = providerName.trim();

  if (!compactName) {
    return 'AI';
  }

  const latinInitials = compactName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return latinInitials || compactName.slice(0, 2).toUpperCase();
}

function formatProviderHistoryDate(value?: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mergeWorkspaceStateForDirectory(
  currentState: CanvasWorkspaceState,
  discoveredState: CanvasWorkspaceState,
): CanvasWorkspaceState {
  const existingIds = new Set(currentState.canvases.map((canvas) => canvas.id));
  const mergedCanvases = [
    ...currentState.canvases,
    ...discoveredState.canvases.filter((canvas) => !existingIds.has(canvas.id)),
  ];

  return {
    ...currentState,
    activeCanvasId: mergedCanvases.some((canvas) => canvas.id === currentState.activeCanvasId)
      ? currentState.activeCanvasId
      : mergedCanvases[0]?.id ?? '',
    canvases: mergedCanvases,
  };
}

type ProviderBrandIconConfig = {
  Icon: typeof OpenAIIcon;
  background: string;
  color: string;
};

const providerBrandIcons: Record<string, ProviderBrandIconConfig> = {
  provider_anthropic: {
    Icon: AnthropicIcon,
    background: '#f1f0e8',
    color: '#141413',
  },
  provider_azure_openai: {
    Icon: AzureAIIcon,
    background: '#0078d4',
    color: '#ffffff',
  },
  provider_deepseek: {
    Icon: DeepSeekIcon,
    background: '#4d6bfe',
    color: '#ffffff',
  },
  provider_google: {
    Icon: GeminiIcon,
    background: 'linear-gradient(135deg, #4285f4 0%, #a855f7 54%, #ea4335 100%)',
    color: '#ffffff',
  },
  provider_groq: {
    Icon: GroqIcon,
    background: '#f55036',
    color: '#ffffff',
  },
  provider_mistral: {
    Icon: MistralIcon,
    background: '#ffaf00',
    color: '#171717',
  },
  provider_ollama: {
    Icon: OllamaIcon,
    background: '#ffffff',
    color: '#111111',
  },
  provider_openai: {
    Icon: OpenAIIcon,
    background: '#111111',
    color: '#ffffff',
  },
  provider_openrouter: {
    Icon: OpenRouterIcon,
    background: '#ffffff',
    color: '#111111',
  },
  provider_qwen: {
    Icon: QwenIcon,
    background: '#615ced',
    color: '#ffffff',
  },
  provider_seedance: {
    Icon: VolcengineIcon,
    background: '#1664ff',
    color: '#ffffff',
  },
  provider_together: {
    Icon: TogetherIcon,
    background: '#fff7eb',
    color: '#ff4d00',
  },
  provider_xai: {
    Icon: XAIIcon,
    background: '#101010',
    color: '#ffffff',
  },
};

function ProviderAvatar({
  provider,
  large = false,
}: {
  provider: ProviderConfig;
  large?: boolean;
}) {
  const brandIcon = providerBrandIcons[provider.id] ?? (
    provider.name.includes('阿里') || provider.name.includes('通义')
      ? {
          Icon: AlibabaCloudIcon,
          background: '#ff6a00',
          color: '#ffffff',
        }
      : undefined
  );

  if (brandIcon) {
    const Icon = brandIcon.Icon;

    return (
      <span
        className={`provider-avatar provider-avatar-brand ${large ? 'provider-avatar-large' : ''}`}
        style={{ background: brandIcon.background, color: brandIcon.color }}
        aria-hidden="true"
      >
        <Icon size={large ? 26 : 20} />
      </span>
    );
  }

  return (
    <span className={`provider-avatar ${large ? 'provider-avatar-large' : ''}`} aria-hidden="true">
      {getProviderInitial(provider.name)}
    </span>
  );
}

export function App() {
  const workspaceStore = useMemo(() => getWorkspaceStore(), []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>(loadProviders);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderConfig>>({});
  const [editingProviderIds, setEditingProviderIds] = useState<string[]>([]);
  const [fetchingProviderModelIds, setFetchingProviderModelIds] = useState<string[]>([]);
  const [providerVideoHistoryItems, setProviderVideoHistoryItems] = useState<
    VideoGenerationHistoryItem[]
  >([]);
  const [providerVideoHistoryLoading, setProviderVideoHistoryLoading] = useState(false);
  const [providerVideoHistoryError, setProviderVideoHistoryError] = useState<string | null>(null);
  const [providerVideoHistoryPage, setProviderVideoHistoryPage] = useState(1);
  const [providerVideoHistoryPageSize, setProviderVideoHistoryPageSize] = useState(20);
  const [providerVideoHistoryTotal, setProviderVideoHistoryTotal] = useState(0);
  const providerVideoHistoryRequestIdRef = useRef(0);
  const [showProviderManager, setShowProviderManager] = useState(false);
  const [providerSettingsView, setProviderSettingsView] = useState<ProviderSettingsView>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [canvasAssets, setCanvasAssets] = useState<CanvasAssetFile[]>([]);
  const [loadingCanvasAssets, setLoadingCanvasAssets] = useState(false);
  const [mutedAssetPaths, setMutedAssetPaths] = useState<string[]>([]);
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareR2Config>(loadCloudflareR2Config);
  const [cloudflareConfigDraft, setCloudflareConfigDraft] =
    useState<CloudflareR2Config>(cloudflareConfig);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspaceState, setWorkspaceStateRaw] = useState(() => {
    if (typeof window === 'undefined') {
      return initialWorkspaceState;
    }

    return parseWorkspaceState(
      window.localStorage.getItem(workspaceStorageKey),
      initialWorkspaceState,
    );
  });
  const [rootDirectoryHandle, setRootDirectoryHandle] = useState<WorkspaceRootHandle | null>(
    null,
  );
  const [folderStorageReady, setFolderStorageReady] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const isSavingWorkspaceRef = useRef(false);
  const [dirtyCanvasIds, setDirtyCanvasIds] = useState<Set<string>>(() => new Set());
  const dirtyCanvasIdsRef = useRef<Set<string>>(new Set());
  const allowTauriCloseRef = useRef(false);
  const [pendingUnsavedChangesPrompt, setPendingUnsavedChangesPrompt] =
    useState<UnsavedChangesPrompt | null>(null);
  const [canvasViewports, setCanvasViewports] = useState<StoredCanvasViewports>(
    loadCanvasViewports,
  );
  const [viewport, setViewport] = useState<CanvasViewport>(
    () => canvasViewports[workspaceState.activeCanvasId] ?? defaultViewport,
  );
  const [canvasSize, setCanvasSize] = useState<Size | null>(null);
  const pendingViewportRestoreRef = useRef<{
    canvasId: string;
    viewport: CanvasViewport;
  } | null>(null);
  const workspaceStateRef = useRef(workspaceState);
  const savedWorkspaceStateRef = useRef(workspaceState);
  const seedanceTrackersRef = useRef(
    new Map<string, ReturnType<typeof createSeedanceTaskTracker>>(),
  );
  const [workspaceHistory, setWorkspaceHistory] =
    useState<WorkspaceHistory<typeof workspaceState>>(createWorkspaceHistory);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState>(null);
  const dragPreviewRef = useRef<DragPreviewState>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [canvasClipboard, setCanvasClipboard] = useState<CanvasClipboardPayload | null>(null);
  const [canvasMessage, setCanvasMessage] = useState<string | null>(null);
  const [minimapDragState, setMinimapDragState] = useState<MinimapDragState | null>(null);
  const [isRenamingCanvas, setIsRenamingCanvas] = useState(false);
  const [draftCanvasName, setDraftCanvasName] = useState('');
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [draftListCanvasName, setDraftListCanvasName] = useState('');
  const [editingOutputNodeId, setEditingOutputNodeId] = useState<string | null>(null);
  const [editingNodeTitleId, setEditingNodeTitleId] = useState<string | null>(null);
  const [editingNodeTitleSurface, setEditingNodeTitleSurface] = useState<
    'canvas' | 'inspector' | null
  >(null);
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [selectedOutputVersionId, setSelectedOutputVersionId] = useState<string | null>(null);
  const [outputVersionPage, setOutputVersionPage] = useState(1);
  const [draftOutputText, setDraftOutputText] = useState('');
  const [outputEditorMode, setOutputEditorMode] = useState<'preview' | 'edit'>('preview');
  const [outputModalPosition, setOutputModalPosition] = useState({ x: 0, y: 0 });

  function setWorkspaceState(
    action:
      | typeof workspaceState
      | ((current: typeof workspaceState) => typeof workspaceState),
  ) {
    if (typeof action === 'function') {
      const current = workspaceStateRef.current;
      const next = (action as (current: typeof workspaceState) => typeof workspaceState)(current);
      workspaceStateRef.current = next;
      setWorkspaceStateRaw(next);
      return;
    }

    workspaceStateRef.current = action;
    setWorkspaceStateRaw(action);
  }

  function updateDirtyCanvasIds(updater: (current: Set<string>) => Set<string>) {
    const next = updater(dirtyCanvasIdsRef.current);
    dirtyCanvasIdsRef.current = next;
    setDirtyCanvasIds(next);
  }

  function markCanvasDirty(canvasId: string | null | undefined) {
    if (!canvasId) {
      return;
    }

    updateDirtyCanvasIds((current) => {
      if (current.has(canvasId)) {
        return current;
      }

      const next = new Set(current);
      next.add(canvasId);
      return next;
    });
  }

  function clearDirtyCanvasIds(canvasIds?: Iterable<string>) {
    updateDirtyCanvasIds((current) => {
      if (!canvasIds) {
        return current.size > 0 ? new Set() : current;
      }

      const next = new Set(current);
      let changed = false;
      for (const canvasId of canvasIds) {
        changed = next.delete(canvasId) || changed;
      }

      return changed ? next : current;
    });
  }

  function hasUnsavedCanvasChanges() {
    return dirtyCanvasIdsRef.current.size > 0;
  }

  function createCurrentCanvasSaveState(
    current: typeof workspaceState,
    saved: typeof workspaceState,
    canvasId: string,
  ): typeof workspaceState {
    const currentCanvas = current.canvases.find((canvas) => canvas.id === canvasId);
    if (!currentCanvas) {
      return saved;
    }

    const currentCanvasNodeIds = new Set(currentCanvas.nodes.map((node) => node.id));
    const savedHistoryForOtherCanvases = (saved.generationHistory ?? []).filter(
      (record) => !currentCanvasNodeIds.has(record.nodeId),
    );
    const currentCanvasHistory = (current.generationHistory ?? []).filter((record) =>
      currentCanvasNodeIds.has(record.nodeId),
    );

    const savedCanvasIds = new Set(saved.canvases.map((canvas) => canvas.id));
    const mergedCanvases = savedCanvasIds.has(canvasId)
      ? saved.canvases.map((canvas) => (canvas.id === canvasId ? currentCanvas : canvas))
      : [...saved.canvases, currentCanvas];

    return {
      ...saved,
      activeCanvasId: current.activeCanvasId,
      storage: current.storage,
      canvases: mergedCanvases,
      generationHistory: [...currentCanvasHistory, ...savedHistoryForOtherCanvases],
    };
  }

  function getCanvasSnapshotForDirtyCheck(state: typeof workspaceState, canvasId: string): string {
    const canvas = state.canvases.find((current) => current.id === canvasId) ?? null;
    const nodeIds = new Set(canvas?.nodes.map((node) => node.id) ?? []);
    const generationHistory = (state.generationHistory ?? []).filter((record) =>
      nodeIds.has(record.nodeId),
    );

    return JSON.stringify({
      canvas,
      generationHistory,
    });
  }

  function syncCanvasDirtyState(canvasId: string | null | undefined, state = workspaceStateRef.current) {
    if (!canvasId) {
      return;
    }

    const currentSnapshot = getCanvasSnapshotForDirtyCheck(state, canvasId);
    const savedSnapshot = getCanvasSnapshotForDirtyCheck(savedWorkspaceStateRef.current, canvasId);

    if (currentSnapshot === savedSnapshot) {
      clearDirtyCanvasIds([canvasId]);
    } else {
      markCanvasDirty(canvasId);
    }
  }

  async function confirmPendingUnsavedChanges() {
    const prompt = pendingUnsavedChangesPrompt;
    if (!prompt) {
      return;
    }

    setPendingUnsavedChangesPrompt(null);
    await prompt.onConfirm();
  }

  const [modalDragState, setModalDragState] = useState<ModalDragState | null>(null);
  const [previewImage, setPreviewImage] = useState<ImagePreviewState | null>(null);
  const { activeCanvasId, canvases, storage } = workspaceState;
  const canUndoWorkspace = workspaceHistory.past.length > 0;
  const canRedoWorkspace = workspaceHistory.future.length > 0;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId) ?? null;
  const activeCanvasIsDirty = activeCanvas ? dirtyCanvasIds.has(activeCanvas.id) : false;
  const filteredCanvasAssets =
    assetFilter === 'all'
      ? canvasAssets
      : canvasAssets.filter((asset) => asset.kind === assetFilter);
  const renderedCanvasNodes = useMemo(() => {
    if (!activeCanvas) {
      return [];
    }

    if (!dragPreview || dragPreview.nodeIds.length === 0) {
      return activeCanvas.nodes;
    }

    const previewNodeIds = new Set(dragPreview.nodeIds);
    return activeCanvas.nodes.map((node) =>
      previewNodeIds.has(node.id)
        ? {
            ...node,
            x: node.x + dragPreview.dx,
            y: node.y + dragPreview.dy,
          }
        : node,
    );
  }, [activeCanvas, dragPreview]);
  const renderedActiveCanvas = useMemo(
    () => (activeCanvas ? { ...activeCanvas, nodes: renderedCanvasNodes } : null),
    [activeCanvas, renderedCanvasNodes],
  );
  const selectedNode =
    activeCanvas?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const inspectedNode =
    activeCanvas?.nodes.find((node) => node.id === inspectedNodeId) ?? null;
  const selectedVideoScenario =
    selectedNode?.kind === 'video'
      ? selectedNode.seedanceScenario ?? 'text_to_video'
      : 'text_to_video';
  const selectedVideoModel =
    selectedNode?.kind === 'video'
      ? ((selectedNode.modelId as SeedanceModelId) ?? 'seedance2.0')
      : 'seedance2.0';
  const selectedVideoCapabilities =
    selectedNode?.kind === 'video'
      ? getSeedanceCapabilities(selectedVideoModel)
      : null;
  const visibleVideoFields =
    selectedNode?.kind === 'video'
      ? getVisibleSeedanceFields({
          model: selectedVideoModel,
          scenario: selectedVideoScenario,
        })
      : [];
  const selectedVideoReferenceCount =
    selectedNode?.kind === 'video' && activeCanvas
      ? countDirectVideoReferenceInputs(activeCanvas, selectedNode.id)
      : 0;
  const estimatedVideoTokens =
    selectedNode?.kind === 'video'
      ? estimateSeedanceTokens({
          model: selectedVideoModel,
          resolution:
            selectedNode.videoResolution ??
            selectedVideoCapabilities?.supportedResolutions[0] ??
            '720p',
          ratio: selectedNode.videoRatio ?? getDefaultSeedanceRatio(selectedVideoModel),
          duration: getEstimatedVideoDurationSeconds(selectedNode),
          framespersecond: selectedVideoCapabilities?.fixedFrameRate ?? 24,
          scenario: selectedVideoScenario,
          generateAudio: selectedNode.videoGenerateAudio ?? true,
          multimodalCount: selectedVideoReferenceCount,
        })
      : null;
  const selectedEdge =
    activeCanvas?.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const editingOutputNode =
    activeCanvas?.nodes.find((node) => node.id === editingOutputNodeId) ?? null;
  const outputVersionsForDisplay = editingOutputNode
    ? getOutputVersionsForDisplay(editingOutputNode)
    : [];
  const outputVersionPageData = paginateOutputVersions(
    outputVersionsForDisplay,
    outputVersionPage,
    10,
  );
  const runningNodeIds = new Set(
    activeCanvas?.nodes
      .filter((node) => node.generationStatus === 'running')
      .map((node) => node.id) ?? [],
  );
  const providerRows = [
    ...providers,
    ...Object.values(providerDrafts).filter(
      (draft) => !providers.some((provider) => provider.id === draft.id),
    ),
  ];
  const normalizedProviderSearchQuery = providerSearchQuery.trim().toLowerCase();
  const filteredProviderRows = providerRows.filter((provider) => {
    if (!normalizedProviderSearchQuery) {
      return true;
    }

    const searchableText = [
      provider.name,
      provider.protocol,
      provider.baseURL,
      ...provider.models.flatMap((model) => [
        model.providerModelId,
        model.canonicalModelId,
        model.displayName ?? '',
      ]),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedProviderSearchQuery);
  });
  const selectedProvider =
    providerRows.find((provider) => provider.id === selectedProviderId) ??
    filteredProviderRows[0] ??
    providerRows[0] ??
    null;
  const selectedProviderView =
    selectedProvider ? providerDrafts[selectedProvider.id] ?? selectedProvider : null;
  const selectedProviderIsFetching =
    selectedProvider ? fetchingProviderModelIds.includes(selectedProvider.id) : false;
  const selectedProviderHasDraft = selectedProvider
    ? Boolean(providerDrafts[selectedProvider.id])
    : false;
  const selectedProviderSupportsVideoHistory = selectedProviderView?.protocol === 'volcengine';
  const providerVideoHistoryPageCount = Math.max(
    1,
    Math.ceil(providerVideoHistoryTotal / providerVideoHistoryPageSize) || 1,
  );
  const cloudflareConfigIsDirty =
    JSON.stringify(cloudflareConfigDraft) !== JSON.stringify(cloudflareConfig);
  const cloudflareConfigIsConfigured = isCloudflareR2Configured(cloudflareConfigDraft);
  const minimapBounds = getCanvasContentBounds(renderedCanvasNodes, canvasNodeSize);
  const minimapScale = Math.min(
    minimapSize.width / minimapBounds.width,
    minimapSize.height / minimapBounds.height,
  );
  const minimapViewport = canvasSize
    ? {
        x: (0 - viewport.x) / viewport.scale,
        y: (0 - viewport.y) / viewport.scale,
        width: canvasSize.width / viewport.scale,
        height: canvasSize.height / viewport.scale,
      }
    : null;
  const minimapViewportFrame = minimapViewport
    ? calculateMinimapViewportFrame(minimapViewport, minimapBounds, minimapSize)
    : null;

  useEffect(
    () => () => {
      seedanceTrackersRef.current.forEach((tracker) => tracker.stop());
      seedanceTrackersRef.current.clear();
    },
    [],
  );

  useEffect(
    () => () => {
      if (dragPreviewFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(dragPreviewFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedCanvasChanges()) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let canceled = false;

    async function registerClosePrompt() {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (canceled) {
          return;
        }

        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (allowTauriCloseRef.current) {
            return;
          }

          event.preventDefault();

          if (!hasUnsavedCanvasChanges()) {
            allowTauriCloseRef.current = true;
            window.setTimeout(() => {
              void forceCloseTauriWindow(appWindow).catch(() => {
                allowTauriCloseRef.current = false;
                setCanvasMessage('关闭应用失败，请稍后重试。');
              });
            }, 0);
            return;
          }

          window.setTimeout(() => {
            setPendingUnsavedChangesPrompt({
              title: '画布未保存',
              message: '当前还有未保存的画布更改，关闭应用后这些更改可能丢失。',
              confirmLabel: '关闭应用',
              onConfirm: async () => {
                allowTauriCloseRef.current = true;
                try {
                  await forceCloseTauriWindow(appWindow);
                } catch {
                  allowTauriCloseRef.current = false;
                  setCanvasMessage('关闭应用失败，请先保存画布后再重试。');
                }
              },
            });
          }, 0);
        });
      } catch {
        // Browser runtime only needs beforeunload; Tauri close handling is optional here.
      }
    }

    void registerClosePrompt();

    return () => {
      canceled = true;
      unlisten?.();
    };
  }, []);

  function setWorkspaceStateWithHistory(
    updater: (current: typeof workspaceState) => typeof workspaceState,
  ) {
    const current = workspaceStateRef.current;
    const next = updater(current);

    if (next === current) {
      return;
    }

    workspaceStateRef.current = next;
    setWorkspaceHistory((history) => pushWorkspaceHistory(history, current));
    setWorkspaceState(next);
  }

  function undoWorkspace() {
    const current = workspaceStateRef.current;
    const result = undoWorkspaceHistory(workspaceHistory, current);

    if (result.state === current) {
      return;
    }

    workspaceStateRef.current = result.state;
    setWorkspaceHistory(result.history);
    setWorkspaceState(result.state);
    syncCanvasDirtyState(result.state.activeCanvasId, result.state);
    clearSelection();
    setAddMenu(null);
    setEdgeDraft(null);
  }

  function redoWorkspace() {
    const current = workspaceStateRef.current;
    const result = redoWorkspaceHistory(workspaceHistory, current);

    if (result.state === current) {
      return;
    }

    workspaceStateRef.current = result.state;
    setWorkspaceHistory(result.history);
    setWorkspaceState(result.state);
    syncCanvasDirtyState(result.state.activeCanvasId, result.state);
    clearSelection();
    setAddMenu(null);
    setEdgeDraft(null);
  }

  function openImagePreview(title: string, imageUrl: string) {
    setPreviewImage({ title, imageUrl });
  }

  function isVideoPortSingleValue(portId: SeedanceInputPortId) {
    return portId === 'first_frame_image' || portId === 'last_frame_image';
  }

  function canNodeConnectToVideoPort(node: CanvasNodeView, portId: SeedanceInputPortId) {
    if (portId === 'text') {
      return node.kind === 'textAsset' || node.kind === 'chat';
    }

    if (portId === 'first_frame_image' || portId === 'last_frame_image' || portId === 'reference_image') {
      return node.kind === 'image' || node.kind === 'imageAsset';
    }

    if (portId === 'reference_video') {
      return node.kind === 'video' || node.kind === 'videoAsset';
    }

    if (portId === 'reference_audio') {
      return node.kind === 'audioAsset';
    }

    return false;
  }

  function getVideoPortLimitMessage(portId: SeedanceInputPortId) {
    if (portId === 'first_frame_image') {
      return '首帧图端口只允许连接 1 个图片输入。';
    }

    if (portId === 'last_frame_image') {
      return '尾帧图端口只允许连接 1 个图片输入。';
    }

    return null;
  }

  function sanitizeVideoPortEdges(
    canvas: CanvasView,
    nodeId: string,
    scenario: SeedanceScenario,
  ): { removedEdgeIds: string[] } {
    const visiblePortIds = new Set(getVideoInputPorts(scenario).map((port) => port.id));
    const keptSinglePorts = new Set<SeedanceInputPortId>();
    const removedEdgeIds: string[] = [];

    canvas.edges
      .filter((edge) => edge.toNodeId === nodeId)
      .forEach((edge) => {
        if (!edge.toPortId || edge.toPortId === 'default' || !visiblePortIds.has(edge.toPortId)) {
          removedEdgeIds.push(edge.id);
          return;
        }

        if (!isVideoPortSingleValue(edge.toPortId)) {
          return;
        }

        if (keptSinglePorts.has(edge.toPortId)) {
          removedEdgeIds.push(edge.id);
          return;
        }

        keptSinglePorts.add(edge.toPortId);
      });

    return { removedEdgeIds };
  }

  function handleVideoScenarioChange(nodeId: string, nextScenario: SeedanceScenario) {
    if (!activeCanvas) {
      updateNode(nodeId, (current) => ({
        ...current,
        seedanceScenario: nextScenario,
      }));
      return;
    }

    const { removedEdgeIds } = sanitizeVideoPortEdges(activeCanvas, nodeId, nextScenario);

    updateNode(
      nodeId,
      (current) => ({
        ...current,
        seedanceScenario: nextScenario,
      }),
      { history: removedEdgeIds.length === 0 },
    );

    if (removedEdgeIds.length === 0) {
      return;
    }

    updateActiveCanvasEdges((edges) =>
      edges.filter((edge) => !removedEdgeIds.includes(edge.id)),
    );

    setCanvasMessage('已按新的视频模式清理不再适用的输入连线。');
  }

  useEffect(() => {
    workspaceStateRef.current = workspaceState;
  }, [workspaceState]);

  useEffect(() => {
    let canceled = false;

    async function restoreFolderWorkspace() {
      try {
        const handle = await workspaceStore.getStoredRootDirectoryHandle();
        if (!handle || !(await workspaceStore.ensureDirectoryPermission(handle, 'readwrite'))) {
          if (!canceled) {
            setFolderStorageReady(false);
            setCanvasMessage(
              workspaceStore.kind === 'unsupported'
                ? '当前环境不支持工作区文件夹存储。'
                : '请先选择画布存储文件夹，画布和素材将默认写入该文件夹。',
            );
          }
          return;
        }

        const restoredState = await workspaceStore.readWorkspaceFromFolder(
          handle,
          workspaceStateRef.current,
        );
        if (!canceled) {
          setRootDirectoryHandle(handle);
          workspaceStateRef.current = restoredState;
          savedWorkspaceStateRef.current = restoredState;
          setWorkspaceState(restoredState);
          setFolderStorageReady(true);
          setCanvasMessage(`已连接画布存储文件夹：${handle.name}`);
        }
      } catch {
        if (!canceled) {
          setFolderStorageReady(false);
          setCanvasMessage('读取画布存储文件夹失败，请重新选择文件夹。');
        }
      }
    }

    void restoreFolderWorkspace();

    return () => {
      canceled = true;
    };
  }, []);

  async function saveWorkspaceToFolder() {
    if (!rootDirectoryHandle || !folderStorageReady) {
      setCanvasMessage('请先选择画布存储文件夹，再保存画布。');
      return;
    }

    if (dragState) {
      setCanvasMessage('请结束拖拽后再保存画布。');
      return;
    }

    if (isSavingWorkspaceRef.current) {
      return;
    }

    isSavingWorkspaceRef.current = true;
    setIsSavingWorkspace(true);
    const snapshot = workspaceStateRef.current;
    const canvasIdToSave = snapshot.activeCanvasId;
    const dirtyCanvasIdsAtSaveStart = new Set(dirtyCanvasIdsRef.current);
    const saveState = createCurrentCanvasSaveState(
      snapshot,
      savedWorkspaceStateRef.current,
      canvasIdToSave,
    );

    try {
      const persistedState = await workspaceStore.persistCanvasToFolder(
        rootDirectoryHandle,
        saveState,
        canvasIdToSave,
      );
      const unchangedDuringSave = workspaceStateRef.current === snapshot;
      const persistedCanvas = persistedState.canvases.find((canvas) => canvas.id === canvasIdToSave);
      const nextSavedState = {
        ...savedWorkspaceStateRef.current,
        activeCanvasId: persistedState.activeCanvasId,
        storage: persistedState.storage,
        canvases: savedWorkspaceStateRef.current.canvases.some((canvas) => canvas.id === canvasIdToSave)
          ? savedWorkspaceStateRef.current.canvases.map((canvas) =>
              canvas.id === canvasIdToSave ? persistedCanvas ?? canvas : canvas,
            )
          : [
              ...savedWorkspaceStateRef.current.canvases,
              ...(persistedCanvas ? [persistedCanvas] : []),
            ],
        generationHistory: persistedState.generationHistory,
      };
      savedWorkspaceStateRef.current = nextSavedState;

      if (unchangedDuringSave && persistedCanvas) {
        const nextLiveState = {
          ...snapshot,
          storage: persistedState.storage,
          canvases: snapshot.canvases.map((canvas) =>
            canvas.id === canvasIdToSave ? persistedCanvas : canvas,
          ),
          generationHistory: [
            ...(persistedState.generationHistory ?? []).filter((record) =>
              persistedCanvas.nodes.some((node) => node.id === record.nodeId),
            ),
            ...(snapshot.generationHistory ?? []).filter(
              (record) => !persistedCanvas.nodes.some((node) => node.id === record.nodeId),
            ),
          ],
        };
        workspaceStateRef.current = nextLiveState;
        setWorkspaceState(nextLiveState);
      }

      if (dirtyCanvasIdsAtSaveStart.has(canvasIdToSave)) {
        clearDirtyCanvasIds([canvasIdToSave]);
      }
      setCanvasMessage(
        unchangedDuringSave
          ? '当前画布已保存。'
          : '画布已保存，保存期间产生的新更改需要再次保存。',
      );
    } catch {
      setCanvasMessage('写入画布存储文件夹失败，当前更改可能刷新后丢失。');
    } finally {
      isSavingWorkspaceRef.current = false;
      setIsSavingWorkspace(false);
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        canvasViewportStorageKey,
        serializeStoredCanvasViewports(canvasViewports),
      );
    } catch {
      // 视口信息是辅助状态，保存失败不应影响画布主流程。
    }
  }, [canvasViewports]);

  useEffect(() => {
    try {
      window.localStorage.setItem(providerStorageKey, JSON.stringify(providers));
    } catch (error) {
      setCanvasMessage(getLocalStorageErrorMessage(error));
    }
  }, [providers]);

  useEffect(() => {
    if (!showProviderManager) {
      return;
    }

    if (providerSettingsView !== 'providers') {
      return;
    }

    if (providerRows.length === 0) {
      setSelectedProviderId(null);
      return;
    }

    if (!selectedProviderId || !providerRows.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(providerRows[0].id);
    }
  }, [providerRows, providerSettingsView, selectedProviderId, showProviderManager]);

  useEffect(() => {
    setProviderVideoHistoryPage(1);
  }, [selectedProvider?.id]);

  useEffect(() => {
    if (!showProviderManager || !selectedProvider?.id) {
      return;
    }

    void refreshSelectedProviderVideoHistory();
  }, [
    providerVideoHistoryPage,
    providerVideoHistoryPageSize,
    selectedProvider?.id,
    showProviderManager,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || showProviderManager) {
      setCanvasSize(null);
      return undefined;
    }

    const updateCanvasSize = () => {
      setCanvasSize({
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      });
    };

    updateCanvasSize();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCanvasSize) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isSidebarCollapsed, showProviderManager]);

  useEffect(() => {
    if (!activeCanvasId) {
      return;
    }

    const restoredViewport = canvasViewports[activeCanvasId] ?? defaultViewport;
    pendingViewportRestoreRef.current = {
      canvasId: activeCanvasId,
      viewport: restoredViewport,
    };
    setViewport(restoredViewport);
  }, [activeCanvasId]);

  useEffect(() => {
    if (inspectedNodeId && !activeCanvas?.nodes.some((node) => node.id === inspectedNodeId)) {
      setInspectedNodeId(null);
    }
  }, [activeCanvas, inspectedNodeId]);

  useEffect(() => {
    if (!showAssetPanel) {
      return;
    }

    void refreshCanvasAssets();
  }, [showAssetPanel, activeCanvasId, folderStorageReady, rootDirectoryHandle]);

  useEffect(() => {
    if (!activeCanvasId) {
      return;
    }

    const pendingRestore = pendingViewportRestoreRef.current;
    if (pendingRestore?.canvasId === activeCanvasId) {
      if (!isSameViewport(pendingRestore.viewport, viewport)) {
        return;
      }

      pendingViewportRestoreRef.current = null;
    }

    setCanvasViewports((current) => {
      const previous = current[activeCanvasId];

      if (previous && isSameViewport(previous, viewport)) {
        return current;
      }

      return {
        ...current,
        [activeCanvasId]: viewport,
      };
    });
  }, [activeCanvasId, viewport]);

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

      void addAssetNodeFromFile(file, point);
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [viewport]);

  useEffect(() => {
    function handleWindowDragOver(event: DragEvent) {
      if (
        !hasSupportedMediaDataTransferItems(event.dataTransfer?.items) &&
        !getFirstSupportedMediaFile(event.dataTransfer?.files)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
    }

    function handleWindowDrop(event: DragEvent) {
      const file = getFirstSupportedMediaFile(event.dataTransfer?.files);

      if (!file) {
        return;
      }

      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const point =
        rect && event.clientX >= rect.left && event.clientY >= rect.top
          ? getCanvasPointFromClient(event.clientX, event.clientY)
          : screenToCanvasPoint(
              {
                x: rect ? rect.width / 2 : 420,
                y: rect ? rect.height / 2 : 280,
              },
              viewport,
            );

      void addAssetNodeFromFile(file, point);
    }

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [viewport]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const key = event.key.toLowerCase();
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z';
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        ((event.shiftKey && key === 'z') || key === 'y');
      const isCopy = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'c';
      const isCut = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'x';
      const isPaste = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'v';
      const isSelectAll = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'a';
      const isSave = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 's';

      if (isSave) {
        event.preventDefault();
        void saveWorkspaceToFolder();
        return;
      }

      if (isUndo || isRedo) {
        if ((isUndo && !canUndoWorkspace) || (isRedo && !canRedoWorkspace)) {
          return;
        }

        event.preventDefault();
        if (isUndo) {
          undoWorkspace();
        } else {
          redoWorkspace();
        }
        return;
      }

      if (!isEditingText && (isCopy || isCut || isPaste || isSelectAll)) {
        if (isCopy || isCut) {
          const nodeIdsToCopy = selectedNodeIds.length
            ? selectedNodeIds
            : selectedNodeId
              ? [selectedNodeId]
              : [];
          const copied = activeCanvas ? copyCanvasSelection(activeCanvas, nodeIdsToCopy) : null;

          if (!copied) {
            return;
          }

          event.preventDefault();
          setCanvasClipboard(copied);

          if (isCut) {
            markCanvasDirty(workspaceStateRef.current.activeCanvasId);
            setWorkspaceStateWithHistory((current) => ({
              ...current,
              canvases: current.canvases.map((canvas) =>
                canvas.id === current.activeCanvasId
                  ? {
                      ...nodeIdsToCopy.reduce(removeCanvasNode, canvas),
                      updatedAt: '刚刚',
                    }
                  : canvas,
              ),
            }));
            clearSelection();
          }
          return;
        }

        if (isPaste) {
          if (!canvasClipboard) {
            return;
          }

          event.preventDefault();
          let pastedNodeIds: string[] = [];
          let nextClipboard: CanvasClipboardPayload | null = null;
          markCanvasDirty(workspaceStateRef.current.activeCanvasId);

          setWorkspaceStateWithHistory((current) => ({
            ...current,
            canvases: current.canvases.map((canvas) => {
              if (canvas.id !== current.activeCanvasId) {
                return canvas;
              }

              const pasted = pasteCanvasClipboard(canvas, canvasClipboard, {
                createNodeId: (node) =>
                  `node_${node.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                offset: { dx: 36, dy: 36 },
              });
              pastedNodeIds = pasted.pastedNodeIds;
              nextClipboard = copyCanvasSelection(pasted.canvas, pastedNodeIds);
              return pasted.canvas;
            }),
          }));
          setCanvasClipboard(nextClipboard);
          setSelectedNodeIds(pastedNodeIds);
          setSelectedNodeId(pastedNodeIds.length === 1 ? pastedNodeIds[0] : null);
          setSelectedEdgeId(null);
          return;
        }

        if (isSelectAll && activeCanvas) {
          event.preventDefault();
          const allNodeIds = activeCanvas.nodes.map((node) => node.id);
          setSelectedNodeIds(allNodeIds);
          setSelectedNodeId(allNodeIds.length === 1 ? allNodeIds[0] : null);
          setSelectedEdgeId(null);
          return;
        }
      }

      if (isEditingText || (event.key !== 'Delete' && event.key !== 'Backspace')) {
        return;
      }

      const nodeIdsToDelete = selectedNodeIds.length
        ? selectedNodeIds
        : selectedNodeId
          ? [selectedNodeId]
          : [];

      if (!selectedEdgeId && nodeIdsToDelete.length === 0) {
        return;
      }

      event.preventDefault();

      if (selectedEdgeId) {
        updateActiveCanvasEdges((edges) => removeCanvasEdge(edges, selectedEdgeId));
        setSelectedEdgeId(null);
        return;
      }

      if (nodeIdsToDelete.length > 0) {
        markCanvasDirty(workspaceStateRef.current.activeCanvasId);
        setWorkspaceStateWithHistory((current) => ({
          ...current,
          canvases: current.canvases.map((canvas) =>
            canvas.id === current.activeCanvasId
              ? {
                  ...nodeIdsToDelete.reduce(removeCanvasNode, canvas),
                  updatedAt: '刚刚',
                }
              : canvas,
          ),
        }));
        clearSelection();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canRedoWorkspace,
    canUndoWorkspace,
    activeCanvas,
    canvasClipboard,
    dragState,
    folderStorageReady,
    rootDirectoryHandle,
    selectedEdgeId,
    selectedNodeId,
    selectedNodeIds,
    workspaceStore,
    workspaceHistory,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    function preventCanvasWheelScroll(event: globalThis.WheelEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('.output-modal')
      ) {
        return;
      }

      event.preventDefault();
    }

    canvas.addEventListener('wheel', preventCanvasWheelScroll, { passive: false });
    return () => canvas.removeEventListener('wheel', preventCanvasWheelScroll);
  }, [showProviderManager]);

  function setCanvases(updater: (canvases: CanvasView[]) => CanvasView[]) {
    markCanvasDirty(workspaceStateRef.current.activeCanvasId);
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      canvases: updater(current.canvases),
    }));
  }

  function setActiveCanvasId(canvasId: string) {
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      activeCanvasId: canvasId,
    }));
  }

  function returnToCanvas() {
    setShowProviderManager(false);
  }

  function openProviderSettingsView(view: ProviderSettingsView) {
    setProviderSettingsView(view);
    setShowProviderManager(true);
  }

  function selectCanvasFromSidebar(canvasId: string) {
    if (canvasId === activeCanvasId) {
      return;
    }

    function switchCanvas() {
      setActiveCanvasId(canvasId);
      setShowProviderManager(false);
      setAddMenu(null);
      clearSelection();
    }

    if (activeCanvasId && dirtyCanvasIdsRef.current.has(activeCanvasId)) {
      setPendingUnsavedChangesPrompt({
        title: '画布未保存',
        message: '当前画布有未保存的更改，切换到其他画布后请记得返回保存。',
        confirmLabel: '切换画布',
        onConfirm: switchCanvas,
      });
      return;
    }

    switchCanvas();
  }

  function updateActiveCanvasNodes(
    updater: (nodes: CanvasNodeView[]) => CanvasNodeView[],
    options: { history?: boolean } = {},
  ) {
    markCanvasDirty(workspaceStateRef.current.activeCanvasId);
    const setter = options.history === false ? setWorkspaceState : setWorkspaceStateWithHistory;

    setter((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        current.activeCanvasId && canvas.id === current.activeCanvasId
          ? { ...canvas, updatedAt: '刚刚', nodes: updater(canvas.nodes) }
          : canvas,
      ),
    }));
  }

  function updateActiveCanvasEdges(
    updater: (edges: CanvasView['edges']) => CanvasView['edges'],
    options: { history?: boolean } = {},
  ) {
    markCanvasDirty(workspaceStateRef.current.activeCanvasId);
    const setter = options.history === false ? setWorkspaceState : setWorkspaceStateWithHistory;

    setter((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        current.activeCanvasId && canvas.id === current.activeCanvasId
          ? { ...canvas, updatedAt: '刚刚', edges: updater(canvas.edges) }
          : canvas,
      ),
    }));
  }

  async function refreshCanvasAssets() {
    if (!rootDirectoryHandle || !folderStorageReady || !activeCanvas) {
      setCanvasAssets([]);
      return;
    }

    setLoadingCanvasAssets(true);
    try {
      const assets = await workspaceStore.listCanvasAssets(rootDirectoryHandle, activeCanvas);
      setCanvasAssets(assets);
    } catch {
      setCanvasMessage('读取画布资产失败，请检查存储目录权限。');
    } finally {
      setLoadingCanvasAssets(false);
    }
  }

  function clearCanvasAssetReferences(assetPath: string) {
    updateActiveCanvasNodes((nodes) =>
      nodes.map((node) => {
        if (
          node.assetPath !== assetPath &&
          node.outputPath !== assetPath &&
          node.outputCoverPath !== assetPath
        ) {
          return node;
        }

        return {
          ...node,
          assetPath: node.assetPath === assetPath ? undefined : node.assetPath,
          assetDataUrl: node.assetPath === assetPath ? undefined : node.assetDataUrl,
          assetName: node.assetPath === assetPath ? undefined : node.assetName,
          assetMimeType: node.assetPath === assetPath ? undefined : node.assetMimeType,
          outputPath: node.outputPath === assetPath ? undefined : node.outputPath,
          outputDataUrl: node.outputPath === assetPath ? undefined : node.outputDataUrl,
          outputCoverPath: node.outputCoverPath === assetPath ? undefined : node.outputCoverPath,
          outputCoverDataUrl:
            node.outputCoverPath === assetPath ? undefined : node.outputCoverDataUrl,
        };
      }),
    );
  }

  async function deleteCanvasAsset(asset: CanvasAssetFile) {
    if (!rootDirectoryHandle || !folderStorageReady || !activeCanvas) {
      return;
    }

    try {
      await workspaceStore.deleteCanvasAsset(rootDirectoryHandle, activeCanvas, asset.path);
      clearCanvasAssetReferences(asset.path);
      setCanvasAssets((current) => current.filter((item) => item.path !== asset.path));
      setCanvasMessage(`已删除资产：${asset.name}`);
    } catch {
      setCanvasMessage('删除资产失败，请检查存储目录权限。');
    }
  }

  function addGenerationHistoryRecord(record: GenerationRecord) {
    markCanvasDirty(workspaceStateRef.current.activeCanvasId);
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      generationHistory: [record, ...(current.generationHistory ?? [])],
    }));
  }

  function findCanvasIdByNodeId(nodeId: string): string | undefined {
    return workspaceStateRef.current.canvases.find((canvas) =>
      canvas.nodes.some((node) => node.id === nodeId),
    )?.id;
  }

  function updateGenerationHistoryRecord(
    recordId: string,
    updater: (record: GenerationRecord) => GenerationRecord,
  ) {
    const record = workspaceStateRef.current.generationHistory.find(
      (current) => current.id === recordId,
    );
    markCanvasDirty(findCanvasIdByNodeId(record?.nodeId ?? '') ?? workspaceStateRef.current.activeCanvasId);
    setWorkspaceState((current) => ({
      ...current,
      generationHistory: (current.generationHistory ?? []).map((record) =>
        record.id === recordId ? updater(record) : record,
      ),
    }));
  }

  function getCanvasPointFromClient(clientX: number, clientY: number): Point {
    return screenToCanvasPoint(getCanvasLocalPointFromClient(clientX, clientY), viewport);
  }

  function getCanvasLocalPointFromClient(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    const canvas = canvasRef.current;
    if (!rect || !canvas) {
      return { x: clientX, y: clientY };
    }

    const scaleX = rect.width / canvas.offsetWidth || 1;
    const scaleY = rect.height / canvas.offsetHeight || 1;

    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    };
  }

  function getCanvasDeltaFromClientDelta(delta: { dx: number; dy: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const canvas = canvasRef.current;
    if (!rect || !canvas) {
      return delta;
    }

    const scaleX = rect.width / canvas.offsetWidth || 1;
    const scaleY = rect.height / canvas.offsetHeight || 1;

    return {
      dx: delta.dx / scaleX,
      dy: delta.dy / scaleY,
    };
  }

  function openAddMenu(clientX: number, clientY: number, fromNodeId?: string) {
    const point = getCanvasLocalPointFromClient(clientX, clientY);

    setAddMenu({
      x: point.x,
      y: point.y,
      canvasPoint: getCanvasPointFromClient(clientX, clientY),
      fromNodeId,
    });
  }

  function getDefaultVideoInputPort(
    fromNode: CanvasNodeView,
    scenario: SeedanceScenario,
  ): SeedanceInputPortId | undefined {
    return getVideoInputPorts(scenario).find((port) => canNodeConnectToVideoPort(fromNode, port.id))
      ?.id;
  }

  function getDefaultVideoScenarioForSource(fromNode?: CanvasNodeView): SeedanceScenario {
    if (!fromNode) {
      return 'text_to_video';
    }

    if (
      fromNode.kind === 'image' ||
      fromNode.kind === 'imageAsset' ||
      fromNode.kind === 'video' ||
      fromNode.kind === 'videoAsset' ||
      fromNode.kind === 'audioAsset'
    ) {
      return 'multimodal_reference_video';
    }

    return 'text_to_video';
  }

  function addNode(template: NodeTemplate) {
    if (!activeCanvas) {
      return;
    }

    const point = addMenu?.canvasPoint ?? screenToCanvasPoint({ x: 260, y: 180 }, viewport);
    const nodeId = `node_${template.kind}_${Date.now()}`;
    const fromNode = addMenu?.fromNodeId
      ? activeCanvas.nodes.find((node) => node.id === addMenu.fromNodeId)
      : undefined;
    const defaultVideoScenario =
      template.kind === 'video' ? getDefaultVideoScenarioForSource(fromNode) : undefined;

    updateActiveCanvasNodes((nodes) => [
      ...nodes,
      {
        id: nodeId,
        title: template.title,
        modelId: template.modelId,
        kind: template.kind,
        x: point.x,
        y: point.y,
        imageResolutionTier:
          template.kind === 'image' ? defaultImageResolutionTier : undefined,
        imageAspectRatio: template.kind === 'image' ? defaultImageAspectRatio : undefined,
        imageQuality: template.kind === 'image' ? defaultImageQuality : undefined,
        videoRatio:
          template.kind === 'video'
            ? getDefaultSeedanceRatio(template.modelId as SeedanceModelId)
            : undefined,
        videoFramesPerSecond:
          template.kind === 'video'
            ? getSeedanceCapabilities(template.modelId as SeedanceModelId).fixedFrameRate
            : undefined,
        seedanceScenario: defaultVideoScenario,
        textContent: template.kind === 'textAsset' ? '在这里输入文本' : undefined,
      },
    ]);
    if (addMenu?.fromNodeId && !template.outputOnly) {
      const toNode = {
        id: nodeId,
        title: template.title,
        modelId: template.modelId,
        kind: template.kind,
        x: point.x,
        y: point.y,
        ...(defaultVideoScenario ? { seedanceScenario: defaultVideoScenario } : {}),
      };

      if (fromNode && canConnectCanvasNodes(fromNode, toNode)) {
        updateActiveCanvasEdges((edges) =>
          addCanvasEdge(
            edges,
            addMenu.fromNodeId!,
            nodeId,
            toNode.kind === 'video'
              ? getDefaultVideoInputPort(fromNode, defaultVideoScenario ?? 'text_to_video')
              : undefined,
          ),
        );
      }
    }
    selectSingleNode(nodeId);
    setAddMenu(null);
  }

  function updateNode(
    nodeId: string,
    updater: (node: CanvasNodeView) => CanvasNodeView,
    options: { history?: boolean } = {},
  ) {
    updateActiveCanvasNodes(
      (nodes) => nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
      options,
    );
  }

  function getChatFormat(node: CanvasNodeView): ChatFormat {
    return node.chatFormat ?? 'openai';
  }

  function updateDragState(next: DragState | null) {
    dragStateRef.current = next;
    setDragState(next);
  }

  function flushDragPreview() {
    if (dragPreviewFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }

    setDragPreview(dragPreviewRef.current);
  }

  function scheduleDragPreview(next: DragPreviewState) {
    dragPreviewRef.current = next;

    if (typeof window === 'undefined') {
      setDragPreview(next);
      return;
    }

    if (dragPreviewFrameRef.current !== null) {
      return;
    }

    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null;
      setDragPreview(dragPreviewRef.current);
    });
  }

  function clearDragPreview() {
    if (dragPreviewFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }

    dragPreviewRef.current = null;
    setDragPreview(null);
  }

  function startRenameNode(node: CanvasNodeView, surface: 'canvas' | 'inspector') {
    setAddMenu(null);
    setEdgeDraft(null);
    updateDragState(null);
    clearDragPreview();
    selectSingleNode(node.id);
    setEditingNodeTitleId(node.id);
    setEditingNodeTitleSurface(surface);
    setDraftNodeTitle(node.title);
  }

  function commitRenameNode(nodeId: string) {
    const nextTitle = draftNodeTitle.trim();

    if (nextTitle) {
      updateNode(nodeId, (current) => ({
        ...current,
        title: nextTitle,
      }));
    }

    setEditingNodeTitleId(null);
    setEditingNodeTitleSurface(null);
    setDraftNodeTitle('');
  }

  async function addAssetNodeFromFile(file: File, point: Point): Promise<string | null> {
    if (
      !file.type.startsWith('image/') &&
      !file.type.startsWith('video/') &&
      !file.type.startsWith('audio/')
    ) {
      return null;
    }

    if (!activeCanvas) {
      return null;
    }

    if (!rootDirectoryHandle || !folderStorageReady) {
      setCanvasMessage('请先选择画布存储文件夹，再导入图片、视频或音频素材。');
      return null;
    }

    try {
      const savedAsset = await workspaceStore.saveAssetFileToCanvasFolder(
        rootDirectoryHandle,
        activeCanvas,
        file,
      );
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const nodeKind = isImage ? 'imageAsset' : isVideo ? 'videoAsset' : 'audioAsset';
      const nodeId = `node_${nodeKind}_${Date.now()}`;

      updateActiveCanvasNodes((nodes) => [
        ...nodes,
        {
          id: nodeId,
          title: isImage ? '图片' : isVideo ? '视频' : '音频',
          modelId: isImage ? 'asset-image' : isVideo ? 'asset-video' : 'asset-audio',
          kind: nodeKind,
          x: point.x,
          y: point.y,
          ...savedAsset,
        },
      ]);
      selectSingleNode(nodeId);
      setCanvasMessage(null);
      return nodeId;
    } catch {
      setCanvasMessage(`保存素材 ${file.name} 到画布文件夹失败，请检查文件夹权限后重试。`);
      return null;
    }
  }

  function getFirstSupportedMediaFile(fileList?: FileList | null): File | null {
    return Array.from(fileList ?? []).find(isSupportedMediaFile) ?? null;
  }

  function hasSupportedMediaDataTransferItems(items?: DataTransferItemList | null): boolean {
    return Array.from(items ?? []).some(
      (item) => item.kind === 'file' && isSupportedMediaMimeType(item.type),
    );
  }

  function isSupportedMediaFile(file: File): boolean {
    return isSupportedMediaMimeType(file.type);
  }

  function isSupportedMediaMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/');
  }

  function createCanvas() {
    const id = `canvas_${Date.now()}`;
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      activeCanvasId: id,
      canvases: [
        ...current.canvases,
        {
          id,
          name: getNextAvailableCanvasName(current),
          updatedAt: '刚刚',
          nodes: [],
          edges: [],
        },
      ],
    }));
    markCanvasDirty(id);
    setViewport(defaultViewport);
    setCanvasMessage(null);
  }

  async function chooseCanvasStorageFolder() {
    if (!workspaceStore.isSupported()) {
      setCanvasMessage(
        '当前环境不支持文件夹写入，请使用桌面版或支持 File System Access API 的 Chromium 浏览器。',
      );
      return;
    }

    try {
      const directory = await workspaceStore.pickRootDirectory();
      if (!directory) {
        return;
      }

      if (!(await workspaceStore.ensureDirectoryPermission(directory, 'readwrite'))) {
        setCanvasMessage('未获得文件夹写入权限，无法保存画布。');
        return;
      }

      await workspaceStore.storeRootDirectoryHandle(directory);
      setRootDirectoryHandle(directory);
      setFolderStorageReady(true);
      const currentStateWithStorage = updateWorkspaceStorage(workspaceStateRef.current, {
        mode: 'custom-folder',
        folderName: directory.name,
        folderPath: directory.kind === 'desktop-directory' ? directory.path : directory.name,
      });
      const discoveredState = await workspaceStore.readWorkspaceFromFolder(
        directory,
        createWorkspaceState([]),
      );
      const nextState = mergeWorkspaceStateForDirectory(currentStateWithStorage, discoveredState);

      setWorkspaceStateWithHistory(() => nextState);
      const persistedState = await workspaceStore.persistWorkspaceToFolder(directory, nextState);
      workspaceStateRef.current = persistedState;
      savedWorkspaceStateRef.current = persistedState;
      setWorkspaceState(persistedState);
      clearDirtyCanvasIds();
      setCanvasMessage(`画布存储文件夹已设置为：${directory.name}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setCanvasMessage('选择画布存储文件夹失败');
    }
  }

  async function migrateCurrentWorkspaceToFolder() {
    if (!rootDirectoryHandle || !folderStorageReady) {
      setCanvasMessage('请先选择画布存储文件夹，再执行迁移。');
      return;
    }

    try {
      const persistedState = await workspaceStore.persistWorkspaceToFolder(
        rootDirectoryHandle,
        workspaceStateRef.current,
      );
      workspaceStateRef.current = persistedState;
      savedWorkspaceStateRef.current = persistedState;
      setWorkspaceState(persistedState);
      clearDirtyCanvasIds();
      setCanvasMessage(
        `已迁移 ${persistedState.canvases.length} 个画布和浏览器资产到文件夹：${rootDirectoryHandle.name}`,
      );
    } catch {
      setCanvasMessage('迁移到画布存储文件夹失败，请检查文件夹权限后重试。');
    }
  }

  function updateCanvasStorageFolder(value: string) {
    const folderValue = value.trim();

    setWorkspaceStateWithHistory((current) =>
      updateWorkspaceStorage(current, {
        mode: 'custom-folder',
        folderPath: folderValue,
      }),
    );
  }

  async function prepareSeedanceCanvasForSubmission(
    canvas: CanvasView,
    node: CanvasNodeView,
  ): Promise<
    | { ok: true; canvas: CanvasView; uploadedUrls: Map<string, string> }
    | { ok: false; error: string }
  > {
    const inputAssetIds = collectGenerationInputAssetIds({
      canvas,
      nodeId: node.id,
    });
    const uploadCandidates = collectSeedanceUploadCandidates(canvas, inputAssetIds);

    if (uploadCandidates.length === 0) {
      return { ok: true, canvas, uploadedUrls: new Map() };
    }

    const objectStorageConfig = createObjectStorageConfigFromCloudflare(cloudflareConfig);

    if (!isObjectStorageConfigured(objectStorageConfig)) {
      return { ok: true, canvas, uploadedUrls: new Map() };
    }

    const uploadedUrls = new Map<string, string>();

    try {
      await Promise.all(
        uploadCandidates.map(async (candidate) => {
          const sourceBlob = await readAssetSourceAsBlob(candidate.content);
          const uploadUrl = await uploadBlobToR2({
            config: objectStorageConfig,
            key: buildSeedanceReferenceObjectKey(canvas, node, candidate, sourceBlob.type),
            blob: sourceBlob,
          });
          uploadedUrls.set(candidate.nodeId, uploadUrl);
        }),
      );
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : '上传参考素材到 Cloudflare R2 失败',
      };
    }

    return {
      ok: true,
      canvas: applyUploadedSeedanceAssetUrls(canvas, uploadedUrls),
      uploadedUrls,
    };
  }

  async function renameCanvasWithFolderSync(canvasId: string, name: string) {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    const currentState = workspaceStateRef.current;
    const targetCanvas = currentState.canvases.find((canvas) => canvas.id === canvasId);
    if (!targetCanvas) {
      return;
    }

    const renamedState = renameCanvas(currentState, canvasId, nextName);
    if (renamedState === currentState) {
      return;
    }

    let nextState = renamedState;

    if (rootDirectoryHandle && folderStorageReady) {
      try {
        const renamedFolder = await workspaceStore.renameCanvasFolder(
          rootDirectoryHandle,
          targetCanvas,
          nextName,
        );
        nextState = {
          ...renamedState,
          canvases: renamedState.canvases.map((canvas) =>
            canvas.id === canvasId
              ? {
                  ...canvas,
                  ...renamedFolder,
                }
              : canvas,
          ),
        };
      } catch (error) {
        setCanvasMessage(
          `同步修改画布文件夹名称失败：${error instanceof Error ? error.message : '未知错误'}`,
        );
        return;
      }
    }

    setWorkspaceStateWithHistory(() => nextState);
    workspaceStateRef.current = nextState;

    if (!(rootDirectoryHandle && folderStorageReady)) {
      markCanvasDirty(canvasId);
    }

    if (rootDirectoryHandle && folderStorageReady) {
      try {
        const persistedState = await workspaceStore.persistWorkspaceToFolder(
          rootDirectoryHandle,
          nextState,
        );
        workspaceStateRef.current = persistedState;
        setWorkspaceState(persistedState);
      } catch {
        setCanvasMessage('画布改名后写入文件夹失败，请检查文件夹权限后重试。');
      }
    }
  }

  function startRenameActiveCanvas() {
    if (!activeCanvas) {
      return;
    }

    setDraftCanvasName(activeCanvas.name);
    setIsRenamingCanvas(true);
  }

  function commitRenameActiveCanvas() {
    void renameCanvasWithFolderSync(activeCanvasId, draftCanvasName);
    setIsRenamingCanvas(false);
  }

  function deleteActiveCanvas() {
    if (!activeCanvasId || !activeCanvas) {
      return;
    }

    void deletePersistedCanvasFolder(activeCanvas);
    setWorkspaceStateWithHistory((current) => deleteCanvas(current, current.activeCanvasId));
    clearDirtyCanvasIds([activeCanvasId]);
    clearSelection();
    setAddMenu(null);
    setViewport(defaultViewport);
    setCanvasMessage(null);
  }

  function deleteCanvasById(canvasId: string) {
    const canvasToDelete = workspaceStateRef.current.canvases.find((canvas) => canvas.id === canvasId);
    if (canvasToDelete) {
      void deletePersistedCanvasFolder(canvasToDelete);
    }

    setWorkspaceStateWithHistory((current) => deleteCanvas(current, canvasId));
    clearDirtyCanvasIds([canvasId]);
    clearSelection();
    setAddMenu(null);
    setEditingCanvasId(null);
    setViewport(defaultViewport);
  }

  async function deletePersistedCanvasFolder(canvas: CanvasView) {
    if (!rootDirectoryHandle || !folderStorageReady) {
      return;
    }

    try {
      await workspaceStore.deleteCanvasFolder(rootDirectoryHandle, canvas);
    } catch {
      setCanvasMessage('删除画布文件夹失败，请检查存储目录权限。');
    }
  }

  function startRenameCanvasFromList(canvas: CanvasView) {
    setEditingCanvasId(canvas.id);
    setDraftListCanvasName(canvas.name);
  }

  function commitRenameCanvasFromList(canvasId: string) {
    void renameCanvasWithFolderSync(canvasId, draftListCanvasName);
    setEditingCanvasId(null);
  }

  function downloadActiveCanvas() {
    if (!activeCanvas) {
      return;
    }

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

      setWorkspaceStateWithHistory((current) => importCanvas(current, content, nextId));
      markCanvasDirty(nextId);
      clearSelection();
      setAddMenu(null);
      setViewport(defaultViewport);
      setCanvasMessage('画布已导入');
    } catch (error) {
      setCanvasMessage(error instanceof Error ? error.message : '画布导入失败');
    }
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!activeCanvas) {
      return;
    }

    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    setAddMenu(null);
    setEdgeDraft(null);
    clearDragPreview();
    clearSelection();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.metaKey || event.ctrlKey) {
      const point = getCanvasPointFromClient(event.clientX, event.clientY);
      updateDragState({
        mode: 'select',
        pointerId: event.pointerId,
        start: point,
        current: point,
      });
      return;
    }

    updateDragState({
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
    clearDragPreview();
    const nodeIdsToDrag = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];

    if (!selectedNodeIds.includes(nodeId)) {
      selectSingleNode(nodeId);
    } else {
      setSelectedEdgeId(null);
    }

    setWorkspaceHistory((history) => pushWorkspaceHistory(history, workspaceState));
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDragState({
      mode: 'node',
      pointerId: event.pointerId,
      nodeId,
      nodeIds: nodeIdsToDrag,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      const to = getCanvasPointFromClient(event.clientX, event.clientY);
      const snapTarget = findNearestEdgeDraftTarget(to);

      setEdgeDraft({
        ...edgeDraft,
        to,
        snapTarget: snapTarget
          ? {
              nodeId: snapTarget.nodeId,
              portId: snapTarget.portId,
            }
          : undefined,
      });
      return;
    }

    const activeDragState = dragStateRef.current;

    if (!activeDragState || activeDragState.pointerId !== event.pointerId) {
      return;
    }

    if (activeDragState.mode === 'select') {
      updateDragState({
        ...activeDragState,
        current: getCanvasPointFromClient(event.clientX, event.clientY),
      });
      return;
    }

    const clientDelta = {
      dx: event.clientX - activeDragState.lastX,
      dy: event.clientY - activeDragState.lastY,
    };
    const delta = getCanvasDeltaFromClientDelta(clientDelta);

    if (activeDragState.mode === 'pan') {
      setViewport((current) => panViewport(current, delta));
    } else {
      const canvasDelta = {
        dx: delta.dx / viewport.scale,
        dy: delta.dy / viewport.scale,
      };
      scheduleDragPreview({
        nodeIds: activeDragState.nodeIds,
        dx: (dragPreviewRef.current?.dx ?? 0) + canvasDelta.dx,
        dy: (dragPreviewRef.current?.dy ?? 0) + canvasDelta.dy,
      });
    }

    dragStateRef.current = {
      ...activeDragState,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      finishEdgeDraftOnBlank(event);
      return;
    }

    const activeDragState = dragStateRef.current;

    if (activeDragState?.pointerId === event.pointerId) {
      if (activeDragState.mode === 'select') {
        const rect = normalizeCanvasSelectionRect(
          activeDragState.start,
          getCanvasPointFromClient(event.clientX, event.clientY),
        );
        const selectedIds =
          rect.width < 4 && rect.height < 4
            ? []
            : findNodesInSelectionRect(activeCanvas?.nodes ?? [], rect, canvasNodeSize);

        setSelectedNodeIds(selectedIds);
        setSelectedNodeId(selectedIds.length === 1 ? selectedIds[0] : null);
        setSelectedEdgeId(null);
      } else if (activeDragState.mode === 'node' && dragPreviewRef.current) {
        const preview = dragPreviewRef.current;
        flushDragPreview();

        if (preview.dx !== 0 || preview.dy !== 0) {
          updateActiveCanvasNodes(
            (nodes) => moveCanvasNodes(nodes, preview.nodeIds, preview),
            { history: false },
          );
        }
      }

      updateDragState(null);
      clearDragPreview();
    }
  }

  function startEdgeDraft(event: PointerEvent<HTMLButtonElement>, node: CanvasNodeView) {
    if (!activeCanvas) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const from = getNodeOutputPoint(node);

    setAddMenu(null);
    updateDragState(null);
    clearDragPreview();
    selectSingleNode(node.id, { preserveInspector: true });
    setEdgeDraft({
      fromNodeId: node.id,
      from,
      to: from,
    });
  }

  function countDirectVideoReferenceInputs(canvas: CanvasView, nodeId: string): number {
    return canvas.edges.filter((edge) => {
      if (edge.toNodeId !== nodeId) {
        return false;
      }

      return (
        edge.toPortId === 'reference_image' ||
        edge.toPortId === 'reference_video' ||
        edge.toPortId === 'reference_audio' ||
        edge.toPortId === 'first_frame_image' ||
        edge.toPortId === 'last_frame_image'
      );
    }).length;
  }

  function completeEdgeDraft(
    event: PointerEvent<HTMLButtonElement>,
    toNodeId: string,
    toPortId?: SeedanceInputPortId | 'default',
  ) {
    event.stopPropagation();

    completeEdgeDraftToTarget(toNodeId, toPortId);
  }

  function completeEdgeDraftToTarget(
    toNodeId: string,
    toPortId?: SeedanceInputPortId | 'default',
  ) {
    if (!edgeDraft) {
      return;
    }

    const fromNode = activeCanvas?.nodes.find((node) => node.id === edgeDraft.fromNodeId);
    const toNode = activeCanvas?.nodes.find((node) => node.id === toNodeId);

    if (!fromNode || !toNode || !canConnectCanvasNodes(fromNode, toNode)) {
      setCanvasMessage('视频节点暂不允许连接到文本生成节点');
      setEdgeDraft(null);
      return;
    }

    if (activeCanvas && toNode.kind === 'video') {
      if (!toPortId || toPortId === 'default') {
        setCanvasMessage('请连接到视频节点左侧的具体输入端口。');
        setEdgeDraft(null);
        return;
      }

      const visiblePorts = getVideoInputPorts(toNode.seedanceScenario ?? 'text_to_video');

      if (!visiblePorts.some((port) => port.id === toPortId)) {
        setCanvasMessage('当前模式下不支持这个输入端口。');
        setEdgeDraft(null);
        return;
      }

      if (!canNodeConnectToVideoPort(fromNode, toPortId)) {
        const portLabel = visiblePorts.find((port) => port.id === toPortId)?.label ?? '该';
        setCanvasMessage(`这个节点不能连接到“${portLabel}”输入端口。`);
        setEdgeDraft(null);
        return;
      }

      if (
        isVideoPortSingleValue(toPortId) &&
        activeCanvas.edges.some(
          (edge) => edge.toNodeId === toNode.id && edge.toPortId === toPortId,
        )
      ) {
        setCanvasMessage(getVideoPortLimitMessage(toPortId) ?? '该输入端口已达到上限。');
        setEdgeDraft(null);
        return;
      }
    }

    updateActiveCanvasEdges((edges) =>
      addCanvasEdge(edges, edgeDraft.fromNodeId, toNodeId, toPortId),
    );
    setSelectedEdgeId(
      `edge_${edgeDraft.fromNodeId}_${toNodeId}${toPortId ? `_${toPortId}` : ''}`,
    );
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setInspectedNodeId(null);
    setEdgeDraft(null);
  }

  function findNearestEdgeDraftTarget(point: { x: number; y: number }) {
    if (!activeCanvas || !edgeDraft) {
      return null;
    }

    const fromNode = activeCanvas.nodes.find((node) => node.id === edgeDraft.fromNodeId);

    if (!fromNode) {
      return null;
    }

    let nearest:
      | {
          distance: number;
          nodeId: string;
          portId?: SeedanceInputPortId | 'default';
        }
      | null = null;

    for (const node of activeCanvas.nodes) {
      if (node.id === edgeDraft.fromNodeId) {
        continue;
      }

      if (!canConnectCanvasNodes(fromNode, node)) {
        continue;
      }

      const portIds =
        node.kind === 'video'
          ? getVideoInputPorts(node.seedanceScenario ?? 'text_to_video').map((port) => port.id)
          : [undefined];

      for (const portId of portIds) {
        if (node.kind === 'video') {
          if (!portId) {
            continue;
          }

          if (!canNodeConnectToVideoPort(fromNode, portId)) {
            continue;
          }

          if (
            isVideoPortSingleValue(portId) &&
            activeCanvas.edges.some(
              (edge) => edge.toNodeId === node.id && edge.toPortId === portId,
            )
          ) {
            continue;
          }
        } else if (!canNodeReceiveInput(node)) {
          continue;
        }

        const target = getNodeInputPoint(node, portId);
        const distance = Math.hypot(point.x - target.x, point.y - target.y);

        if (distance <= edgeSnapRadius && (!nearest || distance < nearest.distance)) {
          nearest = {
            distance,
            nodeId: node.id,
            portId,
          };
        }
      }
    }

    return nearest;
  }

  function isEdgeSnapTarget(nodeId: string, portId?: SeedanceInputPortId | 'default') {
    return (
      edgeDraft?.snapTarget?.nodeId === nodeId &&
      (edgeDraft.snapTarget.portId ?? 'default') === (portId ?? 'default')
    );
  }

  function finishEdgeDraftOnBlank(event: PointerEvent<HTMLDivElement>) {
    if (!edgeDraft) {
      return;
    }

    const snapTarget =
      edgeDraft.snapTarget ?? findNearestEdgeDraftTarget(getCanvasPointFromClient(event.clientX, event.clientY));
    if (snapTarget) {
      completeEdgeDraftToTarget(snapTarget.nodeId, snapTarget.portId);
      return;
    }

    const dragDistance = Math.hypot(edgeDraft.to.x - edgeDraft.from.x, edgeDraft.to.y - edgeDraft.from.y);
    if (dragDistance < 8) {
      setEdgeDraft(null);
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
    clearSelection();
  }

  function deleteSelectedNode() {
    const nodeIdsToDelete = selectedNodeIds.length
      ? selectedNodeIds
      : selectedNodeId
        ? [selectedNodeId]
        : [];

    if (nodeIdsToDelete.length === 0) {
      return;
    }

    setWorkspaceState((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) =>
        canvas.id === current.activeCanvasId
          ? {
              ...nodeIdsToDelete.reduce(removeCanvasNode, canvas),
              updatedAt: '刚刚',
            }
          : canvas,
      ),
    }));
    clearSelection();
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest('.output-modal')
    ) {
      return;
    }

    event.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    setViewport((current) =>
      zoomViewportAtPoint(
        current,
        getCanvasLocalPointFromClient(event.clientX, event.clientY),
        current.scale * zoomFactor,
      ),
    );
  }

  function handleModalScrollableWheel(event: WheelEvent<HTMLElement>) {
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.scrollTop += event.deltaY;
    event.currentTarget.scrollLeft += event.deltaX;
  }

  function zoomBy(factor: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? { x: rect.width / 2, y: rect.height / 2 }
      : { x: 480, y: 320 };

    setViewport((current) => zoomViewportAtPoint(current, center, current.scale * factor));
  }

  function resetViewport() {
    setViewport(defaultViewport);
  }

  function getViewportSizeForMinimap() {
    const canvas = canvasRef.current;

    return (
      canvasSize ??
      (canvas
        ? { width: canvas.offsetWidth, height: canvas.offsetHeight }
        : { width: 960, height: 640 })
    );
  }

  function focusMinimapAtLocalPoint(localPoint: Point) {
    if (!renderedActiveCanvas) {
      return;
    }

    const bounds = getCanvasContentBounds(renderedActiveCanvas.nodes, canvasNodeSize);
    const center = {
      x: bounds.minX + bounds.width * Math.min(1, Math.max(0, localPoint.x / minimapSize.width)),
      y: bounds.minY + bounds.height * Math.min(1, Math.max(0, localPoint.y / minimapSize.height)),
    };

    setViewport(
      getViewportForCanvasCenter(center, getViewportSizeForMinimap(), viewport.scale),
    );
  }

  function moveViewportFromMinimapFrame(nextFrame: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    const center = calculateCanvasCenterFromMinimapFrame(
      nextFrame,
      minimapBounds,
      minimapSize,
      {
        width: getViewportSizeForMinimap().width / viewport.scale,
        height: getViewportSizeForMinimap().height / viewport.scale,
      },
    );

    setViewport(
      getViewportForCanvasCenter(center, getViewportSizeForMinimap(), viewport.scale),
    );
  }

  function handleMinimapPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localPoint = {
      x: Math.min(Math.max(0, event.clientX - rect.left), rect.width),
      y: Math.min(Math.max(0, event.clientY - rect.top), rect.height),
    };

    if (
      minimapViewportFrame &&
      event.target instanceof Element &&
      event.target.closest('.canvas-minimap-window')
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setMinimapDragState({
        pointerId: event.pointerId,
        grabOffsetX: localPoint.x - minimapViewportFrame.left,
        grabOffsetY: localPoint.y - minimapViewportFrame.top,
      });
      return;
    }

    focusMinimapAtLocalPoint(localPoint);
  }

  function handleMinimapPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!minimapDragState || minimapDragState.pointerId !== event.pointerId || !minimapViewportFrame) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localPoint = {
      x: Math.min(Math.max(0, event.clientX - rect.left), rect.width),
      y: Math.min(Math.max(0, event.clientY - rect.top), rect.height),
    };

    moveViewportFromMinimapFrame({
      ...minimapViewportFrame,
      left: localPoint.x - minimapDragState.grabOffsetX,
      top: localPoint.y - minimapDragState.grabOffsetY,
    });
  }

  function handleMinimapPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (minimapDragState?.pointerId === event.pointerId) {
      setMinimapDragState(null);
    }
  }

  function addProvider() {
    const id = `provider_${Date.now()}`;
    const draft: ProviderConfig = {
      id,
      name: `供应商 ${providers.length + 1}`,
      protocol: 'openai-compatible',
      baseURL: 'https://example.test/v1',
      apiTokenRef: 'secret_ref',
      enabled: true,
      models: [],
    };

    setProviderDrafts((current) => ({ ...current, [id]: draft }));
    setEditingProviderIds((current) => [...current, id]);
    setSelectedProviderId(id);
    openProviderSettingsView('providers');
  }

  function updateCloudflareConfigDraft(updates: Partial<CloudflareR2Config>) {
    setCloudflareConfigDraft((current) => ({
      ...current,
      ...updates,
    }));
  }

  function saveCloudflareConfig() {
    try {
      window.localStorage.setItem(cloudflareStorageKey, JSON.stringify(cloudflareConfigDraft));
      setCloudflareConfig(cloudflareConfigDraft);
      setCanvasMessage('Cloudflare R2 配置已保存。');
    } catch (error) {
      setCanvasMessage(getLocalStorageErrorMessage(error));
    }
  }

  function resetCloudflareConfigDraft() {
    setCloudflareConfigDraft(cloudflareConfig);
  }

  function addProviderModel(providerId: string) {
    updateProviderDraft(providerId, (provider) => ({
      ...provider,
      models: [
        ...provider.models,
        {
          id: `model_${Date.now()}`,
          canonicalModelId: 'gpt-image-2',
          providerModelId: 'gpt-image-2',
          enabled: true,
        },
      ],
    }));
  }

  function removeProviderModel(providerId: string, modelIndex: number) {
    updateProviderDraft(providerId, (provider) => ({
      ...provider,
      models: provider.models.filter((_model, currentIndex) => currentIndex !== modelIndex),
    }));
  }

  function deleteProvider(providerId: string) {
    if (!window.confirm('确认删除这个供应商？')) {
      return;
    }

    const deletedProviderIds = parseDeletedProviderIds(
      window.localStorage.getItem(deletedProviderStorageKey),
    );
    deletedProviderIds.add(providerId);
    window.localStorage.setItem(
      deletedProviderStorageKey,
      JSON.stringify([...deletedProviderIds]),
    );
    setProviders((current) => current.filter((provider) => provider.id !== providerId));
    setProviderDrafts((current) => {
      const { [providerId]: _deleted, ...rest } = current;
      return rest;
    });
    setEditingProviderIds((current) => current.filter((id) => id !== providerId));
    setSelectedProviderId((current) => (current === providerId ? null : current));
  }

  function startEditProvider(provider: ProviderConfig) {
    setProviderDrafts((current) => ({
      ...current,
      [provider.id]: createProviderDraft(provider),
    }));
    setEditingProviderIds((current) =>
      current.includes(provider.id) ? current : [...current, provider.id],
    );
  }

  function cancelEditProvider(providerId: string) {
    setProviderDrafts((current) => {
      const { [providerId]: _canceled, ...rest } = current;
      return rest;
    });
    setEditingProviderIds((current) => current.filter((id) => id !== providerId));
  }

  function saveEditedProvider(providerId: string) {
    const draft = providerDrafts[providerId];
    if (!draft) {
      return;
    }

    setProviders((current) => saveProviderDraft(current, draft));
    cancelEditProvider(providerId);
  }

  async function refreshProviderModels(providerId: string) {
    const provider =
      providerDrafts[providerId] ?? providers.find((current) => current.id === providerId);

    if (!provider) {
      return;
    }

    setFetchingProviderModelIds((current) =>
      current.includes(providerId) ? current : [...current, providerId],
    );

    try {
      const result = await fetchProviderModelList(provider);

      if (!result.ok) {
        setCanvasMessage(result.error);
        return;
      }

      const providerWithModels = mergeFetchedProviderModels(provider, result.models);

      if (providerDrafts[providerId] || editingProviderIds.includes(providerId)) {
        setProviderDrafts((current) => ({
          ...current,
          [providerId]: providerWithModels,
        }));
      } else {
        setProviders((current) => saveProviderDraft(current, providerWithModels));
      }

      setCanvasMessage(`已更新 ${provider.name} 的模型列表：${result.models.length} 个模型`);
    } finally {
      setFetchingProviderModelIds((current) => current.filter((id) => id !== providerId));
    }
  }

  async function refreshSelectedProviderVideoHistory() {
    if (!selectedProviderView) {
      setProviderVideoHistoryLoading(false);
      setProviderVideoHistoryItems([]);
      setProviderVideoHistoryTotal(0);
      setProviderVideoHistoryError(null);
      return;
    }

    if (selectedProviderView.protocol !== 'volcengine') {
      setProviderVideoHistoryLoading(false);
      setProviderVideoHistoryItems([]);
      setProviderVideoHistoryTotal(0);
      setProviderVideoHistoryError('当前供应商不支持视频生成历史查询，仅火山方舟可用。');
      return;
    }

    const token = resolveProviderToken(selectedProviderView);
    if (!token) {
      setProviderVideoHistoryLoading(false);
      setProviderVideoHistoryItems([]);
      setProviderVideoHistoryTotal(0);
      setProviderVideoHistoryError(`请先配置 ${selectedProviderView.name} 的 API Key。`);
      return;
    }

    const requestId = providerVideoHistoryRequestIdRef.current + 1;
    providerVideoHistoryRequestIdRef.current = requestId;
    setProviderVideoHistoryLoading(true);
    setProviderVideoHistoryError(null);

    const result = await listVideoGenerationTasks({
      provider: selectedProviderView,
      token,
      pageIndex: providerVideoHistoryPage,
      pageSize: providerVideoHistoryPageSize,
      status: 'succeeded',
    });

    if (providerVideoHistoryRequestIdRef.current !== requestId) {
      return;
    }

    if (!result.ok) {
      setProviderVideoHistoryItems([]);
      setProviderVideoHistoryTotal(0);
      setProviderVideoHistoryError(result.error);
      setProviderVideoHistoryLoading(false);
      return;
    }

    setProviderVideoHistoryItems(result.items);
    setProviderVideoHistoryTotal(result.total);
    setProviderVideoHistoryLoading(false);
  }

  function updateProviderDraft(
    providerId: string,
    updater: (provider: ProviderConfig) => ProviderConfig,
  ) {
    setProviderDrafts((current) => {
      const base =
        current[providerId] ??
        providers.find((provider) => provider.id === providerId);

      if (!base) {
        return current;
      }

      return {
        ...current,
        [providerId]: updater(createProviderDraft(base)),
      };
    });
  }

  function findProvidersForNode(node: CanvasNodeView): ProviderConfig[] {
    if (node.kind === 'chat' || node.modelId === 'chat') {
      return findChatProviders(providers, getChatFormat(node));
    }

    return findProvidersForCanonicalModel(providers, node.modelId);
  }

  function findSelectedProviderForNode(node: CanvasNodeView): ProviderConfig | undefined {
    const availableProviders = findProvidersForNode(node);

    return node.providerId
      ? availableProviders.find((provider) => provider.id === node.providerId)
      : availableProviders[0];
  }

  function findProviderModelsForNode(node: CanvasNodeView) {
    const provider = findSelectedProviderForNode(node);

    return provider
      ? findProviderModelsForNodeModel(
          provider,
          node.modelId,
          getChatFormat(node),
          node.kind === 'chat' ? 'chat' : undefined,
        )
      : [];
  }

  function findProviderModelsForNodeWithProvider(node: CanvasNodeView, provider: ProviderConfig) {
    return findProviderModelsForNodeModel(
      provider,
      node.modelId,
      getChatFormat(node),
      node.kind === 'chat' ? 'chat' : undefined,
    );
  }

  function markNodeGenerationFailed(nodeId: string, error: string) {
    updateNode(nodeId, (current) => ({
      ...current,
      generationStatus: 'failed',
      generationError: error,
    }), { history: false });
  }

  function getSeedanceTaskErrorMessage(task: { [key: string]: unknown; error?: unknown }) {
    if (!task.error || typeof task.error !== 'object') {
      return '视频生成失败';
    }

    const error = task.error as { code?: unknown; message?: unknown };
    const code = typeof error.code === 'string' ? error.code : undefined;
    const message = typeof error.message === 'string' ? error.message : undefined;

    if (code && message) {
      return `${code}: ${message}`;
    }

    return message ?? code ?? '视频生成失败';
  }

  function openOutputEditor(node: CanvasNodeView) {
    const outputVersions = getOutputVersionsForDisplay(node);
    const latestVersion = getLatestOutputVersion(outputVersions);
    setEditingOutputNodeId(node.id);
    setSelectedOutputVersionId(latestVersion?.id ?? null);
    setOutputVersionPage(1);
    setOutputEditorMode('preview');
    setOutputModalPosition({ x: 0, y: 0 });
    setDraftOutputText(latestVersion?.content ?? getEffectiveNodeOutputText(node) ?? '');
  }

  function saveOutputEditor() {
    if (!editingOutputNodeId || !editingOutputNode) {
      return;
    }

    const nextVersions = appendOutputVersion(outputVersionsForDisplay, draftOutputText, 'edit');
    const latestVersion = getLatestOutputVersion(nextVersions);

    updateNode(editingOutputNodeId, (current) => ({
      ...current,
      outputVersions: nextVersions,
      outputText: draftOutputText,
    }));
    setSelectedOutputVersionId(latestVersion?.id ?? null);
    setOutputVersionPage(1);
    setOutputEditorMode('preview');
  }

  function closeOutputEditor() {
    setEditingOutputNodeId(null);
    setSelectedOutputVersionId(null);
    setDraftOutputText('');
    setOutputEditorMode('preview');
    setModalDragState(null);
  }

  function selectOutputVersion(versionId: string) {
    const version = outputVersionsForDisplay.find((current) => current.id === versionId);

    if (!version) {
      return;
    }

    setSelectedOutputVersionId(version.id);
    setDraftOutputText(version.content);
    setOutputEditorMode('preview');
  }

  function deleteSelectedOutputVersion() {
    if (!editingOutputNodeId || !selectedOutputVersionId) {
      return;
    }

    if (!window.confirm('确定删除当前输出版本吗？')) {
      return;
    }

    const nextVersions = outputVersionsForDisplay.filter(
      (version) => version.id !== selectedOutputVersionId,
    );
    const latestVersion = getLatestOutputVersion(nextVersions);

    updateNode(editingOutputNodeId, (current) => ({
      ...current,
      outputVersions: nextVersions,
      modelOutputText: latestVersion?.content,
      outputText: undefined,
    }));

    if (!latestVersion) {
      closeOutputEditor();
      return;
    }

    setSelectedOutputVersionId(latestVersion.id);
    setDraftOutputText(latestVersion.content);
    setOutputVersionPage(1);
    setOutputEditorMode('preview');
  }

  function startOutputModalDrag(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest('button, textarea, input, select, a')
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setModalDragState({
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function handleOutputModalDrag(event: PointerEvent<HTMLElement>) {
    if (!modalDragState || modalDragState.pointerId !== event.pointerId) {
      return;
    }

    setOutputModalPosition((current) => ({
      x: current.x + event.clientX - modalDragState.lastX,
      y: current.y + event.clientY - modalDragState.lastY,
    }));
    setModalDragState({
      ...modalDragState,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  function stopOutputModalDrag(event: PointerEvent<HTMLElement>) {
    if (modalDragState?.pointerId === event.pointerId) {
      setModalDragState(null);
    }
  }

  function stopSeedanceTracking(nodeId: string) {
    const tracker = seedanceTrackersRef.current.get(nodeId);
    if (!tracker) {
      return;
    }

    tracker.stop();
    seedanceTrackersRef.current.delete(nodeId);
  }

  async function handleSeedanceTaskSuccess(
    node: CanvasNodeView,
    generationRecordId: string,
    task: {
      taskId?: string;
      status?: string;
      videoUrl?: string;
      lastFrameUrl?: string;
      completionTokens?: number;
      totalTokens?: number;
      error?: {
        code?: string;
        message?: string;
      };
    },
  ) {
    let savedVideoPath: string | undefined;
    let savedCoverPath: string | undefined;
    let localVideoUrl: string | undefined;
    let localCoverUrl: string | undefined;
    const saveWarnings: string[] = [];

    const targetCanvas =
      workspaceStateRef.current.canvases.find((canvas) =>
        canvas.nodes.some((currentNode) => currentNode.id === node.id),
      ) ?? activeCanvas;

    if (rootDirectoryHandle && folderStorageReady && targetCanvas) {
      if (task.videoUrl) {
        try {
          const savedVideo = await workspaceStore.saveGeneratedMediaUrlToCanvasFolder(
            rootDirectoryHandle,
            targetCanvas,
            {
              fileName: `${task.taskId ?? node.id}.mp4`,
              kind: 'video',
              url: task.videoUrl,
            },
          );
          savedVideoPath = savedVideo.assetPath;
          localVideoUrl = savedVideo.assetDataUrl;
        } catch (error) {
          saveWarnings.push(
            `视频结果未能保存到本地文件夹：${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

      if (task.lastFrameUrl) {
        try {
          const savedCover = await workspaceStore.saveGeneratedMediaUrlToCanvasFolder(
            rootDirectoryHandle,
            targetCanvas,
            {
              fileName: `${task.taskId ?? node.id}.png`,
              kind: 'cover',
              url: task.lastFrameUrl,
            },
          );
          savedCoverPath = savedCover.assetPath;
          localCoverUrl = savedCover.assetDataUrl;
        } catch (error) {
          saveWarnings.push(
            `视频封面未能保存到本地文件夹：${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }
    }

    updateNode(node.id, (current) => ({
      ...current,
      generationStatus: 'succeeded',
      generationError: saveWarnings.length > 0 ? saveWarnings.join(' | ') : undefined,
      outputUrl: task.videoUrl ?? current.outputUrl,
      outputDataUrl: localVideoUrl ?? current.outputDataUrl,
      outputPath: savedVideoPath ?? current.outputPath,
      outputCoverPath: savedCoverPath ?? current.outputCoverPath,
      outputCoverDataUrl: localCoverUrl ?? current.outputCoverDataUrl,
      settledCompletionTokens: task.completionTokens,
      settledTotalTokens: task.totalTokens,
      outputText: [
        task.status ? `任务状态：${task.status}` : current.outputText,
        ...saveWarnings,
      ]
        .filter(Boolean)
        .join(' | '),
    }), { history: false });
    updateGenerationHistoryRecord(generationRecordId, (record) => ({
      ...record,
      status: 'succeeded',
      outputAssetIds: [node.id],
      usage: {
        completionTokens: task.completionTokens,
        totalTokens: task.totalTokens,
      },
      endedAt: new Date().toISOString(),
    }));
    stopSeedanceTracking(node.id);
  }

  function startSeedanceTracking(
    node: CanvasNodeView,
    provider: ProviderConfig,
    token: string | undefined,
    generationRecordId: string,
    taskId: string,
  ) {
    stopSeedanceTracking(node.id);

    const tracker = createSeedanceTaskTracker({
      async getTask(currentTaskId) {
        const result = await queryGenerationTask({
          provider,
          taskId: currentTaskId,
          token,
        });

        if (!result.ok) {
          return {
            status: 'failed',
            error: {
              message: result.error,
            },
          };
        }

        return result.output;
      },
    });

    seedanceTrackersRef.current.set(node.id, tracker);
    tracker.start({
      taskId,
      onUpdate(task) {
        updateNode(node.id, (current) => ({
          ...current,
          generationStatus:
            task.status === 'queued' || task.status === 'running'
              ? 'running'
              : current.generationStatus,
          settledCompletionTokens:
            typeof task.completionTokens === 'number'
              ? task.completionTokens
              : current.settledCompletionTokens,
          settledTotalTokens:
            typeof task.totalTokens === 'number'
              ? task.totalTokens
              : current.settledTotalTokens,
          outputText:
            typeof task.status === 'string' ? `任务状态：${task.status}` : current.outputText,
        }), { history: false });
      },
      onFinished(task) {
        void handleSeedanceTaskSuccess(node, generationRecordId, task).catch((error) => {
          markNodeGenerationFailed(node.id, error instanceof Error ? error.message : '视频保存失败');
          stopSeedanceTracking(node.id);
        });
      },
      onFailed(task) {
        const errorMessage = getSeedanceTaskErrorMessage(task);
        markNodeGenerationFailed(node.id, errorMessage);
        updateGenerationHistoryRecord(generationRecordId, (record) => ({
          ...record,
          status: 'failed',
          errorMessage,
          usage: {
            completionTokens: task.completionTokens,
            totalTokens: task.totalTokens,
          },
          endedAt: new Date().toISOString(),
        }));
        stopSeedanceTracking(node.id);
      },
    });
  }

  async function submitNodeGeneration(node: CanvasNodeView) {
    if (!activeCanvas) {
      return;
    }

    const provider = findSelectedProviderForNode(node);
    if (!provider) {
      markNodeGenerationFailed(
        node.id,
        node.providerId
          ? '所选供应商不可用，请重新选择'
          : `未找到可用供应商：${node.modelId}`,
      );
      return;
    }

    const generationRecordId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const generationStartedAt = new Date().toISOString();
    const providerModelId =
      node.providerModelId ?? findProviderModelsForNode(node)[0]?.providerModelId ?? node.modelId;
    const inputAssetIds = collectGenerationInputAssetIds({
      canvas: activeCanvas,
      nodeId: node.id,
    });
    const estimatedVideoTokenCost =
      node.kind === 'video'
        ? estimateSeedanceTokens({
            model: (node.modelId as SeedanceModelId) ?? 'seedance2.0',
              resolution:
                node.videoResolution ??
                getSeedanceCapabilities((node.modelId as SeedanceModelId) ?? 'seedance2.0')
                  .supportedResolutions[0] ??
                '720p',
            ratio:
              node.videoRatio ??
              getDefaultSeedanceRatio((node.modelId as SeedanceModelId) ?? 'seedance2.0'),
            duration: getEstimatedVideoDurationSeconds(node),
            framespersecond:
              getSeedanceCapabilities((node.modelId as SeedanceModelId) ?? 'seedance2.0')
                .fixedFrameRate ?? 24,
            scenario: node.seedanceScenario ?? 'text_to_video',
            generateAudio: node.videoGenerateAudio ?? true,
            multimodalCount: countDirectVideoReferenceInputs(activeCanvas, node.id),
          })
        : undefined;
    addGenerationHistoryRecord({
      ...createGenerationRecord({
        id: generationRecordId,
        nodeId: node.id,
        nodeKind: node.kind === 'video' ? 'video' : node.kind === 'image' ? 'image' : 'chat',
        canonicalModelId: node.modelId,
        providerId: provider.id,
        providerModelId,
        prompt: node.prompt ?? '',
        inputAssetIds,
        now: generationStartedAt,
      }),
      status: 'running',
      attempts: 1,
      startedAt: generationStartedAt,
    });

    const token = resolveProviderToken(provider);
    updateNode(node.id, (current) => ({
      ...current,
      generationId: node.kind === 'video' ? undefined : generationRecordId,
      generationStatus: 'running',
      generationError: undefined,
      estimatedTokenCost:
        node.kind === 'video' ? estimatedVideoTokenCost ?? current.estimatedTokenCost : current.estimatedTokenCost,
      ...(node.kind === 'chat'
        ? {
            modelOutputText: '',
            outputText: undefined,
          }
        : {}),
    }), { history: false });

    if (node.kind === 'chat') {
      const result = await streamChatGenerationNode({
        canvas: activeCanvas,
        nodeId: node.id,
        provider,
        token,
        onDelta: (_delta, fullText) => {
          updateNode(node.id, (current) => ({
            ...current,
            modelOutputText: fullText,
            outputText: undefined,
          }), { history: false });
        },
      });

      if (!result.ok) {
        markNodeGenerationFailed(node.id, result.error);
        updateGenerationHistoryRecord(generationRecordId, (record) => ({
          ...record,
          status: 'failed',
          errorMessage: result.error,
          endedAt: new Date().toISOString(),
        }));
        return;
      }

      updateNode(node.id, (current) => ({
        ...current,
        generationStatus: 'succeeded',
        generationError: undefined,
        modelOutputText: result.output.kind === 'text' ? result.output.text : current.modelOutputText,
        outputVersions:
          result.output.kind === 'text'
            ? appendOutputVersion(getOutputVersionsForDisplay(current), result.output.text, 'model')
            : current.outputVersions,
        outputText: undefined,
      }), { history: false });
      updateGenerationHistoryRecord(generationRecordId, (record) => ({
        ...record,
        status: 'succeeded',
        outputAssetIds: [node.id],
        endedAt: new Date().toISOString(),
      }));
      return;
    }

    let generationCanvas = activeCanvas;

    if (node.kind === 'video' && provider.protocol === 'volcengine') {
      const prepared = await prepareSeedanceCanvasForSubmission(activeCanvas, node);

      if (!prepared.ok) {
        markNodeGenerationFailed(node.id, prepared.error);
        updateGenerationHistoryRecord(generationRecordId, (record) => ({
          ...record,
          status: 'failed',
          errorMessage: prepared.error,
          endedAt: new Date().toISOString(),
        }));
        return;
      }

      generationCanvas = prepared.canvas;

      if (prepared.uploadedUrls.size > 0) {
        updateActiveCanvasNodes(
          (nodes) =>
            applyUploadedSeedanceAssetUrls(
              {
                ...activeCanvas,
                nodes,
              },
              prepared.uploadedUrls,
            ).nodes,
          { history: false },
        );
      }
    }

    const result = await submitGenerationNode({
      canvas: generationCanvas,
      nodeId: node.id,
      provider,
      token,
    });

    if (!result.ok) {
      markNodeGenerationFailed(node.id, result.error);
      updateGenerationHistoryRecord(generationRecordId, (record) => ({
        ...record,
        status: 'failed',
        errorMessage: result.error,
        endedAt: new Date().toISOString(),
      }));
      return;
    }

    const savedImageOutput =
      result.output.kind === 'image' && result.output.dataUrl && rootDirectoryHandle && folderStorageReady
        ? await workspaceStore.saveDataUrlOutputToCanvasFolder(rootDirectoryHandle, activeCanvas, result.output.dataUrl, {
            kind: 'image',
            nodeId: node.id,
          }).catch(() => null)
        : null;

    if (result.output.kind === 'video-task') {
      const videoOutput = result.output;
      updateNode(node.id, (current) => ({
        ...current,
        generationStatus: videoOutput.videoUrl ? 'succeeded' : 'running',
        generationError: undefined,
        generationId: videoOutput.taskId ?? generationRecordId,
        estimatedTokenCost: current.estimatedTokenCost ?? estimatedVideoTokenCost,
        settledCompletionTokens: videoOutput.completionTokens,
        settledTotalTokens: videoOutput.totalTokens,
        outputUrl: videoOutput.videoUrl,
        outputText: videoOutput.status ? `任务状态：${videoOutput.status}` : undefined,
      }), { history: false });
      updateGenerationHistoryRecord(generationRecordId, (record) => ({
        ...record,
        status: videoOutput.videoUrl ? 'succeeded' : 'running',
        outputAssetIds: videoOutput.videoUrl ? [node.id] : record.outputAssetIds,
        usage: {
          completionTokens: videoOutput.completionTokens,
          totalTokens: videoOutput.totalTokens,
        },
        endedAt: videoOutput.videoUrl ? new Date().toISOString() : record.endedAt,
      }));

      if (videoOutput.videoUrl) {
        await handleSeedanceTaskSuccess(node, generationRecordId, videoOutput);
      } else if (videoOutput.taskId) {
        startSeedanceTracking(node, provider, token, generationRecordId, videoOutput.taskId);
      }
      return;
    }

    updateNode(node.id, (current) => {
      if (result.output.kind === 'image') {
        return {
          ...current,
          generationStatus: 'succeeded',
          generationError: undefined,
          outputDataUrl: savedImageOutput?.outputDataUrl ?? result.output.dataUrl,
          outputPath: savedImageOutput?.outputPath ?? current.outputPath,
          outputUrl: result.output.url,
          outputText: undefined,
        };
      }

      if (result.output.kind === 'text') {
        return {
          ...current,
          generationStatus: 'succeeded',
          generationError: undefined,
          modelOutputText: result.output.text,
          outputVersions: appendOutputVersion(getOutputVersionsForDisplay(current), result.output.text, 'model'),
          outputText: undefined,
          outputDataUrl: undefined,
          outputPath: undefined,
          outputUrl: undefined,
        };
      }

      return current;
    }, { history: false });
    updateGenerationHistoryRecord(generationRecordId, (record) => ({
      ...record,
      status: 'succeeded',
      outputAssetIds:
        result.output.kind === 'image' && (result.output.dataUrl || result.output.url)
          ? [node.id]
          : record.outputAssetIds,
      endedAt: new Date().toISOString(),
    }));
  }

  const canvasNavigationPanel =
    !showProviderManager && activeCanvas
      ? (
          <div
            className="canvas-navigation-panel"
            style={{
              left: isSidebarCollapsed ? '74px' : '278px',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="canvas-minimap"
              aria-label="缩略位置图"
              onPointerDown={handleMinimapPointerDown}
              onPointerMove={handleMinimapPointerMove}
              onPointerUp={handleMinimapPointerEnd}
              onPointerCancel={handleMinimapPointerEnd}
            >
              {renderedCanvasNodes.map((node) => (
                <span
                  key={node.id}
                  className={`canvas-minimap-node is-${node.kind}`}
                  style={{
                    left: (node.x - minimapBounds.minX) * minimapScale,
                    top: (node.y - minimapBounds.minY) * minimapScale,
                    width: Math.max(12, canvasNodeSize.width * minimapScale),
                    height: Math.max(8, canvasNodeSize.height * minimapScale),
                  }}
                />
              ))}
              {minimapViewportFrame ? (
                <span
                  className={`canvas-minimap-window ${
                    minimapDragState ? 'is-dragging' : ''
                  }`}
                  style={{
                    left: minimapViewportFrame.left,
                    top: minimapViewportFrame.top,
                    width: minimapViewportFrame.width,
                    height: minimapViewportFrame.height,
                  }}
                />
              ) : null}
            </button>
          </div>
        )
      : null;
  const selectionRect =
    dragState?.mode === 'select'
      ? normalizeCanvasSelectionRect(dragState.start, dragState.current)
      : null;

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setInspectedNodeId(null);
  }

  function selectSingleNode(
    nodeId: string,
    options: {
      openInspector?: boolean;
      preserveInspector?: boolean;
    } = {},
  ) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setInspectedNodeId((current) => {
      if (options.openInspector) {
        return nodeId;
      }

      if (options.preserveInspector || current === nodeId) {
        return current;
      }

      return null;
    });
  }

  const unsavedChangesPromptPortal = pendingUnsavedChangesPrompt
    ? createPortal(
        <div
          className="unsaved-dialog-backdrop"
          onPointerDown={() => setPendingUnsavedChangesPrompt(null)}
        >
          <section className="unsaved-dialog" onPointerDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{pendingUnsavedChangesPrompt.title}</h2>
            </header>
            <p>{pendingUnsavedChangesPrompt.message}</p>
            <footer>
              <button type="button" onClick={() => setPendingUnsavedChangesPrompt(null)}>
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void confirmPendingUnsavedChanges()}
              >
                {pendingUnsavedChangesPrompt.confirmLabel}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )
    : null;

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
          <button
            type="button"
            className={showProviderManager && providerSettingsView === 'providers' ? 'is-active' : ''}
            onClick={() => openProviderSettingsView('providers')}
          >
            <Settings size={18} />
            供应商管理
          </button>
          <button
            type="button"
            className={showProviderManager && providerSettingsView === 'cloudflare' ? 'is-active' : ''}
            onClick={() => openProviderSettingsView('cloudflare')}
          >
            <Cloud size={18} />
            Cloudflare 配置
          </button>
        </nav>
        <section className="panel storage-panel">
          <div className="panel-title-row">
            <h2>存储</h2>
            <div className="storage-title-actions">
              <button
                type="button"
                className="icon-button storage-select-icon-button"
                aria-label="选择画布存储文件夹"
                title="选择或重新授权画布存储文件夹"
                onClick={() => void chooseCanvasStorageFolder()}
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                className="icon-button storage-migrate-icon-button"
                disabled={!folderStorageReady || !rootDirectoryHandle}
                aria-label="迁移到文件夹"
                title={
                  folderStorageReady && rootDirectoryHandle
                    ? '将当前浏览器中的画布和资产写入已选择的文件夹'
                    : '请先选择画布存储文件夹'
                }
                onClick={() => void migrateCurrentWorkspaceToFolder()}
              >
                <Save size={15} />
              </button>
            </div>
          </div>
          <label>
            画布存储文件夹
            <input
              value={storage.mode === 'custom-folder' ? storage.folderPath ?? storage.folderName ?? '' : ''}
              placeholder="请选择或填写存储文件夹名称"
              onChange={(event) => updateCanvasStorageFolder(event.target.value)}
            />
          </label>
          <p>
            {folderStorageReady && rootDirectoryHandle
              ? `当前：${rootDirectoryHandle.name} / 每个画布独立文件夹`
              : '当前：未连接存储文件夹，无法保存素材'}
          </p>
        </section>
        <section className="panel">
          <div className="panel-title-row">
            <h2>画布</h2>
            <button type="button" className="icon-button" aria-label="新建画布" onClick={createCanvas}>
              <Plus size={15} />
            </button>
          </div>
          <div className="canvas-list">
            {canvases.map((canvas) => {
              const isEditing = editingCanvasId === canvas.id;
              return (
                <div
                  key={canvas.id}
                  className={`canvas-list-item ${canvas.id === activeCanvas?.id ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="canvas-list-select"
                    onClick={() => selectCanvasFromSidebar(canvas.id)}
                  >
                    <FilePlus2 size={17} />
                  </button>
                  <div className="canvas-list-content">
                    {isEditing ? (
                      <input
                        value={draftListCanvasName}
                        autoFocus
                        onBlur={() => commitRenameCanvasFromList(canvas.id)}
                        onChange={(event) => setDraftListCanvasName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitRenameCanvasFromList(canvas.id);
                          }

                          if (event.key === 'Escape') {
                            setEditingCanvasId(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="canvas-list-name"
                        onClick={() => selectCanvasFromSidebar(canvas.id)}
                      >
                        <strong className="canvas-list-name-text">
                          {canvas.name}
                          {dirtyCanvasIds.has(canvas.id) ? (
                            <span className="canvas-unsaved-dot" aria-label="未保存" title="未保存" />
                          ) : null}
                        </strong>
                        <small>{canvas.nodes.length} 个节点 · {canvas.updatedAt}</small>
                      </button>
                    )}
                  </div>
                  <div className="canvas-list-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="重命名画布"
                      onClick={() => startRenameCanvasFromList(canvas)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-icon-button"
                      aria-label="删除画布"
                      disabled={canvases.length <= 1}
                      onClick={() => deleteCanvasById(canvas.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {canvasMessage ? <p className="canvas-message">{canvasMessage}</p> : null}
        </section>
          </>
        ) : null}
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <div className="toolbar-title">
            {showProviderManager ? (
              providerSettingsView === 'cloudflare' ? <Cloud size={18} /> : <Settings size={18} />
            ) : (
              <BoxSelect size={18} />
            )}
            {showProviderManager ? (
              <span>{providerSettingsView === 'cloudflare' ? 'Cloudflare 配置' : '供应商管理'}</span>
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
                <span className="canvas-title-name">
                  {activeCanvas?.name ?? '暂无画布'}
                  {activeCanvasIsDirty ? (
                    <span className="canvas-unsaved-dot" aria-label="未保存" title="未保存" />
                  ) : null}
                </span>
                {activeCanvas ? (
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="重命名画布"
                      title="重命名画布"
                      onClick={startRenameActiveCanvas}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="保存画布"
                      title="保存画布 Ctrl+S"
                      disabled={!folderStorageReady || !rootDirectoryHandle || isSavingWorkspace}
                      onClick={() => void saveWorkspaceToFolder()}
                    >
                      <Save size={15} />
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
          <div className="toolbar-actions">
            {showProviderManager ? (
              <button
                type="button"
                className="icon-button"
                aria-label="关闭供应商管理"
                title="关闭供应商管理"
                onClick={returnToCanvas}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>
        {showProviderManager ? (
          providerSettingsView === 'cloudflare' ? (
            <div className="provider-manager-view">
              <section className="cloudflare-settings-detail">
                <header className="provider-detail-header">
                  <div className="provider-detail-title">
                    <span className="provider-avatar provider-avatar-brand provider-avatar-large cloudflare-avatar">
                      <Cloud size={26} />
                    </span>
                    <div>
                      <h2>Cloudflare R2 配置</h2>
                      <p>配置对象存储，用于后续将生成素材上传到 R2。</p>
                    </div>
                  </div>
                  <div className="cloudflare-header-actions">
                    <span
                      className={`provider-config-chip ${
                        cloudflareConfigIsConfigured ? 'is-configured' : ''
                      }`}
                    >
                      {cloudflareConfigIsConfigured ? '已配置' : '未配置'}
                    </span>
                    <button
                      type="button"
                      className="provider-secondary-button"
                      disabled={!cloudflareConfigIsDirty}
                      onClick={resetCloudflareConfigDraft}
                    >
                      取消更改
                    </button>
                    <button
                      type="button"
                      className="provider-save-button"
                      disabled={!cloudflareConfigIsDirty}
                      onClick={saveCloudflareConfig}
                    >
                      <Save size={17} />
                      保存 Cloudflare 配置
                    </button>
                  </div>
                </header>
                <div className="provider-detail-body cloudflare-detail-body">
                  <section className="provider-form-section">
                    <div className="provider-section-heading">
                      <h3>R2 存储</h3>
                      <p>这是可选配置。这些字段只保存在本机配置中，不会写入导出的画布文件。</p>
                    </div>
                    <div className="provider-form-grid">
                      <label>
                        Account ID
                        <input
                          value={cloudflareConfigDraft.accountId}
                          placeholder="Cloudflare Account ID"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ accountId: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Bucket 名称
                        <input
                          value={cloudflareConfigDraft.bucketName}
                          placeholder="shot-agent-assets"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ bucketName: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Access Key ID
                        <input
                          value={cloudflareConfigDraft.accessKeyId}
                          placeholder="R2 Access Key ID"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ accessKeyId: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Secret Access Key
                        <input
                          type="password"
                          value={cloudflareConfigDraft.secretAccessKey}
                          placeholder="R2 Secret Access Key"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ secretAccessKey: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        S3 Endpoint
                        <input
                          value={cloudflareConfigDraft.endpoint}
                          placeholder="https://<account-id>.r2.cloudflarestorage.com"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ endpoint: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        公开访问 URL
                        <input
                          value={cloudflareConfigDraft.publicBaseUrl}
                          placeholder="https://assets.example.com"
                          onChange={(event) =>
                            updateCloudflareConfigDraft({ publicBaseUrl: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </section>
                </div>
              </section>
            </div>
          ) : (
          <div className="provider-manager-view">
            <div className="provider-settings-shell">
              <aside className="provider-settings-sidebar" aria-label="供应商列表">
                <label className="provider-search">
                  <Search size={16} />
                  <input
                    value={providerSearchQuery}
                    placeholder="搜索供应商或模型"
                    onChange={(event) => setProviderSearchQuery(event.target.value)}
                  />
                </label>
                <div className="provider-nav-list">
                  {filteredProviderRows.map((provider) => {
                    const isActive = provider.id === selectedProvider?.id;
                    const draftProvider = providerDrafts[provider.id] ?? provider;
                    const enabledModels = draftProvider.models.filter((model) => model.enabled);

                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={`provider-nav-item ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedProviderId(provider.id);
                          if (!providerDrafts[provider.id]) {
                            startEditProvider(provider);
                          }
                        }}
                      >
                        <ProviderAvatar provider={draftProvider} />
                        <span className="provider-nav-copy">
                          <strong>{draftProvider.name}</strong>
                          <small>
                            {getProviderProtocolLabel(draftProvider.protocol)} ·{' '}
                            {enabledModels.length} 个模型
                          </small>
                        </span>
                        <span
                          className={`provider-status-dot ${draftProvider.enabled ? 'is-on' : ''}`}
                          aria-label={draftProvider.enabled ? '已启用' : '未启用'}
                        />
                      </button>
                    );
                  })}
                  {filteredProviderRows.length === 0 ? (
                    <div className="provider-empty-state">没有匹配的供应商</div>
                  ) : null}
                </div>
                <button type="button" className="provider-add-button" onClick={addProvider}>
                  <Plus size={17} />
                  添加服务商
                </button>
              </aside>
              <section className="provider-settings-detail">
                {selectedProvider && selectedProviderView ? (
                  <>
                    <header className="provider-detail-header">
                      <div className="provider-detail-title">
                        <ProviderAvatar provider={selectedProviderView} large />
                        <div>
                          <h2>{selectedProviderView.name}</h2>
                          <p>{getProviderProtocolLabel(selectedProviderView.protocol)}</p>
                        </div>
                      </div>
                      <div className="provider-detail-actions">
                        <span
                          className={`provider-config-chip ${
                            selectedProviderView.apiTokenRef ? 'is-configured' : ''
                          }`}
                        >
                          {selectedProviderView.apiTokenRef ? '已配置' : '未配置'}
                        </span>
                        <label className="provider-switch">
                          <input
                            type="checkbox"
                            checked={selectedProviderView.enabled}
                            onChange={(event) =>
                              updateProviderDraft(selectedProvider.id, (current) => ({
                                ...current,
                                enabled: event.target.checked,
                              }))
                            }
                          />
                          <span />
                        </label>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="删除供应商"
                          title="删除供应商"
                          onClick={() => deleteProvider(selectedProvider.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </header>
                    <div className="provider-detail-body">
                      <section className="provider-form-section">
                        <div className="provider-section-heading">
                          <h3>服务商</h3>
                          <p>配置请求协议、地址和密钥引用。</p>
                        </div>
                        <div className="provider-form-grid">
                          <label>
                            服务商名称
                            <input
                              value={selectedProviderView.name}
                              onChange={(event) =>
                                updateProviderDraft(selectedProvider.id, (current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            API 风格
                            <select
                              value={selectedProviderView.protocol}
                              onChange={(event) =>
                                updateProviderDraft(selectedProvider.id, (current) => ({
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
                          <label>
                            API Key / 密钥引用
                            <input
                              value={selectedProviderView.apiTokenRef}
                              placeholder="secret_openai 或 sk-..."
                              onChange={(event) =>
                                updateProviderDraft(selectedProvider.id, (current) => ({
                                  ...current,
                                  apiTokenRef: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="provider-url-field">
                            API URL
                            <span>
                              <input
                                value={selectedProviderView.baseURL}
                                onChange={(event) =>
                                  updateProviderDraft(selectedProvider.id, (current) => ({
                                    ...current,
                                    baseURL: event.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                disabled={selectedProviderIsFetching}
                                onClick={() => void refreshProviderModels(selectedProvider.id)}
                              >
                                <RefreshCw size={15} />
                                {selectedProviderIsFetching ? '测试中' : '测试 API'}
                              </button>
                            </span>
                          </label>
                        </div>
                        <button type="button" className="provider-secondary-button">
                          添加自定义请求头
                        </button>
                      </section>
                      <section className="provider-form-section">
                        <div className="provider-section-heading">
                          <h3>模型</h3>
                          <p>左侧为供应商真实模型 ID，右侧为节点使用的标准模型 ID。</p>
                        </div>
                        <div className="provider-model-toolbar">
                          <button
                            type="button"
                            onClick={() => addProviderModel(selectedProvider.id)}
                          >
                            <Plus size={16} />
                            添加模型
                          </button>
                          <button
                            type="button"
                            disabled={selectedProviderIsFetching}
                            onClick={() => void refreshProviderModels(selectedProvider.id)}
                          >
                            <RefreshCw size={16} />
                            {selectedProviderIsFetching ? '获取中' : '获取模型列表'}
                          </button>
                        </div>
                        <div className="provider-model-list">
                          {selectedProviderView.models.map((model, modelIndex) => (
                            <div className="provider-model-item" key={model.id ?? modelIndex}>
                              <label className="provider-model-toggle">
                                <input
                                  type="checkbox"
                                  checked={model.enabled}
                                  onChange={(event) =>
                                    updateProviderDraft(selectedProvider.id, (current) => ({
                                      ...current,
                                      models: current.models.map((currentModel, currentIndex) =>
                                        currentIndex === modelIndex
                                          ? { ...currentModel, enabled: event.target.checked }
                                          : currentModel,
                                      ),
                                    }))
                                  }
                                />
                                <span />
                              </label>
                              <label>
                                供应商模型 ID
                                <input
                                  value={model.providerModelId}
                                  onChange={(event) =>
                                    updateProviderDraft(selectedProvider.id, (current) => ({
                                      ...current,
                                      models: current.models.map((currentModel, currentIndex) =>
                                        currentIndex === modelIndex
                                          ? {
                                              ...currentModel,
                                              providerModelId: event.target.value,
                                              canonicalModelId:
                                                currentModel.canonicalModelId ===
                                                currentModel.providerModelId
                                                  ? event.target.value
                                                  : currentModel.canonicalModelId,
                                            }
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
                                    updateProviderDraft(selectedProvider.id, (current) => ({
                                      ...current,
                                      models: current.models.map((currentModel, currentIndex) =>
                                        currentIndex === modelIndex
                                          ? {
                                              ...currentModel,
                                              canonicalModelId: event.target.value,
                                            }
                                          : currentModel,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="删除模型映射"
                                title="删除模型映射"
                                onClick={() => removeProviderModel(selectedProvider.id, modelIndex)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                          {selectedProviderView.models.length === 0 ? (
                            <div className="provider-empty-state">
                              还没有模型映射，添加模型后节点才能选择这个供应商。
                            </div>
                          ) : null}
                        </div>
                      </section>
                      <section className="provider-form-section">
                        <div className="provider-section-heading">
                          <h3>视频生成历史</h3>
                          <p>读取当前供应商历史调用成功的视频生成任务，支持分页浏览。</p>
                        </div>
                        <div className="provider-history-toolbar">
                          <label>
                            每页展示
                            <select
                              value={providerVideoHistoryPageSize}
                              onChange={(event) => {
                                setProviderVideoHistoryPageSize(Number(event.target.value));
                                setProviderVideoHistoryPage(1);
                              }}
                            >
                              {[10, 20, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="provider-history-toolbar-actions">
                            <span className="provider-history-summary">
                              {selectedProviderSupportsVideoHistory
                                ? `共 ${providerVideoHistoryTotal} 条成功任务`
                                : '仅火山方舟供应商支持此能力'}
                            </span>
                            <button
                              type="button"
                              disabled={!selectedProviderSupportsVideoHistory || providerVideoHistoryLoading}
                              onClick={() => void refreshSelectedProviderVideoHistory()}
                            >
                              <RefreshCw size={16} />
                              {providerVideoHistoryLoading ? '刷新中' : '刷新'}
                            </button>
                          </div>
                        </div>
                        {providerVideoHistoryError ? (
                          <div className="provider-empty-state">{providerVideoHistoryError}</div>
                        ) : providerVideoHistoryItems.length === 0 ? (
                          <div className="provider-empty-state">
                            {providerVideoHistoryLoading ? '正在读取视频生成历史...' : '暂无成功的视频生成记录。'}
                          </div>
                        ) : (
                          <>
                            <div className="provider-history-list">
                              {providerVideoHistoryItems.map((item) => (
                                <article className="provider-history-item" key={item.taskId}>
                                  <div className="provider-history-item-main">
                                    <div className="provider-history-item-head">
                                      <strong>{item.model ?? '未返回模型 ID'}</strong>
                                      <span>{item.status ?? 'succeeded'}</span>
                                    </div>
                                    <div className="provider-history-item-meta">
                                      <span>任务 ID：{item.taskId}</span>
                                      <span>创建：{formatProviderHistoryDate(item.createdAt)}</span>
                                      <span>更新：{formatProviderHistoryDate(item.updatedAt)}</span>
                                      <span>完成：{formatProviderHistoryDate(item.succeededAt)}</span>
                                      <span>比例：{item.ratio ?? '—'}</span>
                                      <span>时长：{item.durationSeconds ? `${item.durationSeconds}s` : '—'}</span>
                                      <span>
                                        Tokens：
                                        {typeof item.completionTokens === 'number'
                                          ? item.completionTokens
                                          : typeof item.totalTokens === 'number'
                                            ? item.totalTokens
                                            : '—'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="provider-history-item-links">
                                    {item.videoUrl ? (
                                      <a href={item.videoUrl} target="_blank" rel="noreferrer">
                                        打开视频
                                      </a>
                                    ) : null}
                                    {item.lastFrameUrl ? (
                                      <a href={item.lastFrameUrl} target="_blank" rel="noreferrer">
                                        查看尾帧
                                      </a>
                                    ) : null}
                                  </div>
                                </article>
                              ))}
                            </div>
                            <div className="provider-history-pagination">
                              <button
                                type="button"
                                disabled={providerVideoHistoryPage <= 1 || providerVideoHistoryLoading}
                                onClick={() =>
                                  setProviderVideoHistoryPage((current) => Math.max(1, current - 1))
                                }
                              >
                                上一页
                              </button>
                              <span>
                                第 {providerVideoHistoryPage} / {providerVideoHistoryPageCount} 页
                              </span>
                              <button
                                type="button"
                                disabled={
                                  providerVideoHistoryPage >= providerVideoHistoryPageCount ||
                                  providerVideoHistoryLoading
                                }
                                onClick={() =>
                                  setProviderVideoHistoryPage((current) =>
                                    Math.min(providerVideoHistoryPageCount, current + 1),
                                  )
                                }
                              >
                                下一页
                              </button>
                            </div>
                          </>
                        )}
                      </section>
                    </div>
                    <footer className="provider-detail-footer">
                      <button
                        type="button"
                        className="provider-secondary-button"
                        disabled={!selectedProviderHasDraft}
                        onClick={() => cancelEditProvider(selectedProvider.id)}
                      >
                        取消更改
                      </button>
                      <button
                        type="button"
                        className="provider-save-button"
                        disabled={!selectedProviderHasDraft}
                        onClick={() => saveEditedProvider(selectedProvider.id)}
                      >
                        <Save size={17} />
                        保存 AI 服务商
                      </button>
                    </footer>
                  </>
                ) : (
                  <div className="provider-detail-empty">请选择或添加一个服务商。</div>
                )}
              </section>
            </div>
          </div>
          )
        ) : (
        <div
          ref={canvasRef}
          className={`infinite-canvas ${dragState?.mode === 'pan' ? 'is-panning' : ''} ${
            edgeDraft?.snapTarget ? 'is-edge-snapping' : ''
          }`}
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
            event.stopPropagation();
            const file = getFirstSupportedMediaFile(event.dataTransfer.files);

            if (file) {
              void addAssetNodeFromFile(file, getCanvasPointFromClient(event.clientX, event.clientY));
            }
          }}
        >
          <CanvasActionRail
            canUndo={canUndoWorkspace}
            canRedo={canRedoWorkspace}
            isAssetPanelOpen={showAssetPanel}
            scale={viewport.scale}
            onAddNode={(clientX, clientY) => openAddMenu(clientX, clientY)}
            onCreateCanvas={createCanvas}
            onToggleAssetPanel={() => setShowAssetPanel((current) => !current)}
            onUndo={undoWorkspace}
            onRedo={redoWorkspace}
            onExportCanvas={downloadActiveCanvas}
            onImportCanvas={() => importInputRef.current?.click()}
            onZoomOut={() => zoomBy(0.88)}
            onZoomIn={() => zoomBy(1.12)}
            onResetViewport={resetViewport}
          />
          {showAssetPanel ? (
            <section
              className="canvas-asset-sidebar asset-panel"
              onPointerDown={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
              onDragOver={(event) => event.preventDefault()}
            >
              <div className="panel-title-row">
                <h2>资产</h2>
                <div className="asset-panel-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="刷新资产"
                    title="刷新资产"
                    onClick={() => void refreshCanvasAssets()}
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="关闭资产面板"
                    title="关闭资产面板"
                    onClick={() => setShowAssetPanel(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="asset-filter-row" role="tablist" aria-label="资产类型">
                {(['all', 'image', 'video', 'audio', 'file', 'cover'] as AssetFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={assetFilter === filter ? 'is-active' : ''}
                    onClick={() => setAssetFilter(filter)}
                  >
                    {getAssetFilterLabel(filter)}
                  </button>
                ))}
              </div>
              <div className="asset-list">
                {loadingCanvasAssets ? (
                  <div className="asset-empty-state">正在读取资产</div>
                ) : filteredCanvasAssets.length > 0 ? (
                  filteredCanvasAssets.map((asset) => {
                    const isMuted = mutedAssetPaths.includes(asset.path);
                    return (
                      <article className="asset-list-item" key={asset.path}>
                        <div className="asset-list-preview">
                          {asset.kind === 'image' || asset.kind === 'cover' ? (
                            asset.dataUrl ? <img src={asset.dataUrl} alt={asset.name} /> : <Image size={22} />
                          ) : asset.kind === 'video' ? (
                            asset.dataUrl ? (
                              <video src={asset.dataUrl} controls muted={isMuted} />
                            ) : (
                              <Video size={22} />
                            )
                          ) : asset.kind === 'audio' ? (
                            asset.dataUrl ? (
                              <audio src={asset.dataUrl} controls muted={isMuted} />
                            ) : (
                              <Music size={22} />
                            )
                          ) : (
                            <FileText size={22} />
                          )}
                        </div>
                        <div className="asset-list-meta">
                          <strong title={asset.name}>{asset.name}</strong>
                          <small>{getAssetKindLabel(asset.kind)} · {asset.mimeType}</small>
                        </div>
                        <div className="asset-list-actions">
                          {(asset.kind === 'video' || asset.kind === 'audio') ? (
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={isMuted ? '取消静音' : '静音'}
                              title={isMuted ? '取消静音' : '静音'}
                              onClick={() =>
                                setMutedAssetPaths((current) =>
                                  current.includes(asset.path)
                                    ? current.filter((path) => path !== asset.path)
                                    : [...current, asset.path],
                                )
                              }
                            >
                              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="icon-button danger-icon-button"
                            aria-label="删除资产"
                            title="删除资产"
                            onClick={() => void deleteCanvasAsset(asset)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="asset-empty-state">没有匹配的资产文件</div>
                )}
              </div>
            </section>
          ) : null}
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
              {renderedActiveCanvas?.edges.map((edge) => {
                const fromNode = renderedActiveCanvas.nodes.find((node) => node.id === edge.fromNodeId);
                const toNode = renderedActiveCanvas.nodes.find((node) => node.id === edge.toNodeId);

                if (!fromNode || !toNode) {
                  return null;
                }

                const from = getNodeOutputPoint(fromNode);
                const to = getNodeInputPoint(toNode, edge.toPortId);
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
                        setSelectedNodeIds([]);
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
            {selectionRect ? (
              <div
                className="canvas-selection-box"
                style={{
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: selectionRect.width,
                  height: selectionRect.height,
                }}
              />
            ) : null}
            {renderedCanvasNodes.map((node) => {
              const Icon = getNodeIcon(node.kind);
              const providersForNode = findProvidersForNode(node);
              const isGenerating = runningNodeIds.has(node.id);
              const effectiveOutputText = getEffectiveNodeOutputText(node);
              const isLongOutput =
                effectiveOutputText !== undefined && shouldCollapseMarkdown(effectiveOutputText);
              const videoOutputStorageStatus =
                node.kind === 'video' ? getVideoOutputStorageStatus(node) : null;
              const videoInputPorts =
                node.kind === 'video'
                  ? getVideoInputPorts(node.seedanceScenario ?? 'text_to_video')
                  : [];

              return (
                <article
                  key={node.id}
                  className={`canvas-node canvas-node-${node.kind} ${
                    node.id === selectedNodeId || selectedNodeIds.includes(node.id)
                      ? 'is-selected'
                      : ''
                  }`}
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    width: `${getCanvasNodeWidth(node)}px`,
                    maxWidth: `${canvasNodeSize.width * 3}px`,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    selectSingleNode(node.id, { preserveInspector: true });
                    setAddMenu(null);
                  }}
                >
                  {node.kind === 'video' ? (
                    <div className="video-input-port-list">
                      {videoInputPorts.map((port) => (
                        <label key={port.id} className="video-input-port">
                          <span>{port.label}</span>
                          <button
                            type="button"
                            className={`edge-handle edge-handle-input ${
                              isEdgeSnapTarget(node.id, port.id) ? 'is-snap-target' : ''
                            }`}
                            aria-label={`连接到${port.label}`}
                            style={{
                              width: `${edgeHandleHitSize}px`,
                              height: `${edgeHandleHitSize}px`,
                              minHeight: `${edgeHandleHitSize}px`,
                              right: `${-edgeHandleHitSize / 2}px`,
                            }}
                            onPointerUp={(event) => completeEdgeDraft(event, node.id, port.id)}
                            onPointerDown={(event) => event.stopPropagation()}
                          />
                        </label>
                      ))}
                    </div>
                  ) : canNodeReceiveInput(node) ? (
                    <button
                      type="button"
                      className={`edge-handle edge-handle-input ${
                        isEdgeSnapTarget(node.id) ? 'is-snap-target' : ''
                      }`}
                      aria-label="连接到此节点"
                      style={{
                        width: `${edgeHandleHitSize}px`,
                        height: `${edgeHandleHitSize}px`,
                        minHeight: `${edgeHandleHitSize}px`,
                        left: `${-edgeHandleHitSize / 2}px`,
                      }}
                      onPointerUp={(event) => completeEdgeDraft(event, node.id)}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  ) : null}
                  <header onPointerDown={(event) => handleNodePointerDown(event, node.id)}>
                    <span className="node-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      {editingNodeTitleId === node.id &&
                      editingNodeTitleSurface === 'canvas' ? (
                        <input
                          className="node-title-input"
                          value={draftNodeTitle}
                          autoFocus
                          onPointerDown={(event) => event.stopPropagation()}
                          onBlur={() => commitRenameNode(node.id)}
                          onChange={(event) => setDraftNodeTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitRenameNode(node.id);
                            }

                            if (event.key === 'Escape') {
                              setEditingNodeTitleId(null);
                              setEditingNodeTitleSurface(null);
                              setDraftNodeTitle('');
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="node-title-row"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation();

                            if (event.detail >= 2) {
                              event.preventDefault();
                              startRenameNode(node, 'canvas');
                              return;
                            }

                            setAddMenu(null);
                            setEdgeDraft(null);
                            selectSingleNode(node.id, { preserveInspector: true });
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            startRenameNode(node, 'canvas');
                          }}
                        >
                          <h2
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              startRenameNode(node, 'canvas');
                            }}
                          >
                            {node.title}
                          </h2>
                          <button
                            type="button"
                            className="node-title-edit-button"
                            aria-label="编辑节点名称"
                            title="编辑节点名称"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startRenameNode(node, 'canvas');
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="node-title-edit-button"
                            aria-label="打开节点配置"
                            title="打开节点配置"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              selectSingleNode(node.id, { openInspector: true, preserveInspector: true });
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Settings size={13} />
                          </button>
                        </div>
                      )}
                      <p>{node.modelId}</p>
                      {node.kind === 'image' ? (
                        <div className="node-image-settings-meta" aria-label="图片生成参数">
                          {getImageNodeSettingBadges(node).map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </div>
                      ) : node.kind === 'video' ? (
                        <div className="node-image-settings-meta node-video-settings-meta" aria-label="视频生成参数">
                          {getVideoNodeSettingBadges(node).map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </header>
                  <div
                    className="node-body"
                    onDoubleClick={(event) => {
                      if (!(event.target instanceof HTMLImageElement)) {
                        return;
                      }

                      if (!event.target.classList.contains('asset-preview')) {
                        return;
                      }

                      const imageUrl =
                        node.kind === 'imageAsset'
                          ? node.assetDataUrl
                          : node.kind === 'image'
                            ? node.outputDataUrl ?? node.outputUrl
                            : undefined;

                      if (!imageUrl) {
                        return;
                      }

                      event.stopPropagation();
                      openImagePreview(node.title, imageUrl);
                    }}
                  >
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
                                void addAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                                  if (nodeId) {
                                    updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== node.id));
                                  }
                                });
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
                                void addAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                                  if (nodeId) {
                                    updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== node.id));
                                  }
                                });
                              }
                            }}
                          />
                        </label>
                      </>
                    ) : node.kind === 'audioAsset' ? (
                      <>
                        {node.assetDataUrl ? (
                          <audio className="asset-preview" src={node.assetDataUrl} controls />
                        ) : null}
                        <label className="asset-upload">
                          导入音频
                          <input
                            type="file"
                            accept="audio/*"
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void addAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                                  if (nodeId) {
                                    updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== node.id));
                                  }
                                });
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
                        <PromptTextarea
                          canvas={activeCanvas}
                          node={node}
                          placeholder={
                            node.kind === 'video'
                              ? getVideoPromptPlaceholder(node.seedanceScenario ?? 'text_to_video')
                              : '输入节点提示词，支持 @文本 / @图片 / @视频 引用已连线的上游资产'
                          }
                          stopPointerDown
                          onChange={(value) =>
                            updateNode(node.id, (current) => ({
                              ...current,
                              prompt: value,
                            }))
                          }
                        />
                        {node.kind === 'video' ? (
                          <>
                            <div className="node-inline-video-actions">
                              <span className="node-inline-video-mode-label">模式</span>
                              <label className="node-inline-video-mode">
                                <select
                                  className="video-mode-select"
                                  value={node.seedanceScenario ?? 'text_to_video'}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    handleVideoScenarioChange(
                                      node.id,
                                      event.target.value as SeedanceScenario,
                                    )
                                  }
                                >
                                  {getVideoScenarioOptions().map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="node-inline-generate-button"
                                disabled={isGenerating}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => void submitNodeGeneration(node)}
                              >
                                {isGenerating ? '提交中' : '生成'}
                              </button>
                            </div>
                            {node.generationId ? (
                              <p className="node-generation-id">生成ID：{node.generationId}</p>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isGenerating}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => void submitNodeGeneration(node)}
                          >
                            {isGenerating ? '提交中' : '生成'}
                          </button>
                        )}
                        {node.generationError ? (
                          <p className="node-error">{node.generationError}</p>
                        ) : null}
                        {node.outputDataUrl || node.outputUrl ? (
                          node.kind === 'video' ? (
                            <>
                              <video
                                className="asset-preview"
                                src={node.outputDataUrl ?? node.outputUrl}
                                controls
                              />
                              {videoOutputStorageStatus ? (
                                <p
                                  className={`node-storage-status is-${videoOutputStorageStatus.tone}`}
                                  title={videoOutputStorageStatus.detail}
                                >
                                  {videoOutputStorageStatus.summary}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <img
                              className="asset-preview"
                              src={node.outputDataUrl ?? node.outputUrl}
                              alt={`${node.title} 输出`}
                            />
                          )
                        ) : null}
                        {isGenerating ? (
                          <StreamingOutputTail text={effectiveOutputText ?? ''} />
                        ) : effectiveOutputText ? (
                          isLongOutput ? (
                            <>
                            <div className="node-output-summary">
                              {summarizeOutputText(effectiveOutputText)}
                            </div>
                            <button
                              type="button"
                              className="node-output-open"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => openOutputEditor(node)}
                            >
                              查看 / 编辑完整输出
                            </button>
                            </>
                          ) : (
                            <div
                              className="node-output-markdown"
                              dangerouslySetInnerHTML={{
                                __html: renderMarkdownToHtml(effectiveOutputText),
                              }}
                            />
                          )
                        ) : null}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="edge-handle edge-handle-output"
                    aria-label="从此节点连线"
                    style={{
                      width: `${edgeHandleHitSize}px`,
                      height: `${edgeHandleHitSize}px`,
                      minHeight: `${edgeHandleHitSize}px`,
                      right: `${-edgeHandleHitSize / 2}px`,
                    }}
                    onPointerDown={(event) => startEdgeDraft(event, node)}
                  />
                </article>
              );
            })}
            {!activeCanvas ? (
              <div className="empty-canvas-state">
                <h2>暂无画布</h2>
                <p>新建或导入一个画布后即可开始组织节点。</p>
                <div>
                  <button type="button" onClick={createCanvas}>
                    <FolderPlus size={18} />
                    新建画布
                  </button>
                  <button type="button" onClick={() => importInputRef.current?.click()}>
                    <Import size={18} />
                    导入画布
                  </button>
                </div>
              </div>
            ) : null}
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
          {inspectedNode ? (() => {
            const selectedNode = inspectedNode;

            return (
            <aside className="node-inspector">
              <header>
                {editingNodeTitleId === selectedNode.id &&
                editingNodeTitleSurface === 'inspector' ? (
                        <input
                          className="node-title-input"
                          value={draftNodeTitle}
                          autoFocus
                          onPointerDown={(event) => event.stopPropagation()}
                          onBlur={() => commitRenameNode(selectedNode.id)}
                    onChange={(event) => setDraftNodeTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitRenameNode(selectedNode.id);
                      }

                      if (event.key === 'Escape') {
                        setEditingNodeTitleId(null);
                        setEditingNodeTitleSurface(null);
                        setDraftNodeTitle('');
                      }
                    }}
                  />
                ) : (
                  <div
                    className="node-title-row"
                    onMouseDown={(event) => {
                      if (event.detail >= 2) {
                        event.preventDefault();
                        startRenameNode(selectedNode, 'inspector');
                      }
                    }}
                    onDoubleClick={() => startRenameNode(selectedNode, 'inspector')}
                  >
                    <h2>
                      {selectedNode.title}
                    </h2>
                    <button
                      type="button"
                      className="node-title-edit-button"
                      aria-label="编辑节点名称"
                      title="编辑节点名称"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startRenameNode(selectedNode, 'inspector');
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
                <p>{selectedNode.modelId}</p>
              </header>
              <button type="button" className="danger-button" onClick={deleteSelectedNode}>
                <Trash2 size={16} />
                删除节点
              </button>
              {selectedNode.kind === 'chat' ? (
                <label>
                  调用格式
                  <select
                    value={getChatFormat(selectedNode)}
                    onChange={(event) => {
                      const nextFormat = event.target.value as ChatFormat;
                      const nextProviders = findChatProviders(providers, nextFormat);
                      const nextProvider = nextProviders[0];
                      const nodeForFormat = { ...selectedNode, chatFormat: nextFormat };
                      const nextModel = nextProvider
                        ? findProviderModelsForNodeWithProvider(nodeForFormat, nextProvider)[0]
                        : undefined;

                      updateNode(selectedNode.id, (current) => ({
                        ...current,
                        chatFormat: nextFormat,
                        providerId: undefined,
                        providerModelId: undefined,
                        modelId: nextModel?.providerModelId ?? current.modelId,
                      }));
                    }}
                  >
                    <option value="openai">OpenAI Chat Completions</option>
                    <option value="anthropic">Anthropic Messages</option>
                  </select>
                </label>
              ) : null}
              {selectedNode.kind === 'video' ? (
                <div className="video-generation-settings">
                  <label>
                    类型
                    <select
                      className="video-mode-select"
                      aria-label="类型"
                      value={selectedVideoScenario}
                      onChange={(event) =>
                        handleVideoScenarioChange(
                          selectedNode.id,
                          event.target.value as SeedanceScenario,
                        )
                      }
                    >
                      {getVideoScenarioOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    模型
                    <select
                      aria-label="模型"
                      value={selectedVideoModel}
                      onChange={(event) => {
                        const nextModel = event.target.value as SeedanceModelId;
                        const nextCapabilities = getSeedanceCapabilities(nextModel);
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          modelId: nextModel,
                          providerModelId: undefined,
                          videoResolution: nextCapabilities.supportedResolutions.includes(
                            current.videoResolution ?? '720p',
                          )
                            ? current.videoResolution
                            : nextCapabilities.supportedResolutions[0],
                          videoRatio: nextCapabilities.supportedRatios.includes(
                            current.videoRatio ?? getDefaultSeedanceRatio(nextModel),
                          )
                            ? current.videoRatio ?? getDefaultSeedanceRatio(nextModel)
                            : getDefaultSeedanceRatio(nextModel),
                          videoDurationSeconds: normalizeSeedanceDurationSeconds(
                            nextModel,
                            current.videoDurationSeconds ?? 5,
                          ),
                          videoFramesPerSecond: nextCapabilities.fixedFrameRate,
                        }));
                      }}
                    >
                      {getVideoModelOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {visibleVideoFields.includes('resolution') ||
                  visibleVideoFields.includes('ratio') ||
                  visibleVideoFields.includes('duration') ? (
                    <div className="video-top-inline-fields">
                      {visibleVideoFields.includes('resolution') ? (
                        <label className="video-inline-setting">
                          <span>分辨率</span>
                          <select
                            aria-label="分辨率"
                            value={
                              selectedNode.videoResolution ??
                              selectedVideoCapabilities?.supportedResolutions[0] ??
                              '720p'
                            }
                            onChange={(event) =>
                              updateNode(selectedNode.id, (current) => ({
                                ...current,
                                videoResolution: event.target.value as '480p' | '720p' | '1080p',
                              }))
                            }
                          >
                            {(selectedVideoCapabilities?.supportedResolutions ?? ['720p']).map(
                              (resolution) => (
                                <option key={resolution} value={resolution}>
                                  {resolution}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      ) : null}
                      {visibleVideoFields.includes('ratio') ? (
                        <label className="video-inline-setting">
                          <span>比例</span>
                          <select
                            aria-label="比例"
                            value={
                              selectedNode.videoRatio ??
                              (selectedVideoCapabilities
                                ? getDefaultSeedanceRatio(selectedVideoModel)
                                : '16:9')
                            }
                            onChange={(event) =>
                              updateNode(selectedNode.id, (current) => ({
                                ...current,
                                videoRatio: event.target.value as SeedanceRatio,
                              }))
                            }
                          >
                            {(selectedVideoCapabilities?.supportedRatios ?? ['16:9']).map((ratio) => (
                              <option key={ratio} value={ratio}>
                                {ratio === 'adaptive' ? 'adaptive' : ratio}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {visibleVideoFields.includes('duration') ? (
                        <div className="video-readonly-field video-inline-readonly" aria-label="帧率 24fps（官方固定）">
                          <span>帧率</span>
                          <strong>{selectedVideoCapabilities?.fixedFrameRate ?? 24}fps</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {visibleVideoFields.includes('duration') ? (
                    <div className="video-inline-fields">
                      <div className="video-duration-control">
                        <div className="video-duration-row">
                          <label className="video-duration-label" htmlFor="video-duration-range">
                            <span>时长</span>
                            <strong>
                              {selectedNode.videoDurationSeconds === -1
                                ? 'Auto'
                                : `${selectedNode.videoDurationSeconds ?? 5}s`}
                            </strong>
                          </label>
                          <div className="video-duration-slider-wrap">
                            <input
                              className="video-duration-range"
                              id="video-duration-range"
                              aria-label="时长"
                              type="range"
                              min={Math.max(4, getSeedanceDurationInputBounds(selectedVideoModel).min)}
                              max={getSeedanceDurationInputBounds(selectedVideoModel).max}
                              step={1}
                              value={
                                selectedNode.videoDurationSeconds === -1
                                  ? getSeedanceCapabilities(selectedVideoModel).durationRangeSeconds.min
                                  : selectedNode.videoDurationSeconds ?? 5
                              }
                              disabled={selectedNode.videoDurationSeconds === -1}
                              onChange={(event) =>
                                updateNode(selectedNode.id, (current) => ({
                                  ...current,
                                  videoDurationSeconds: normalizeSeedanceDurationSeconds(
                                    selectedVideoModel,
                                    Number(event.target.value),
                                  ),
                                }))
                              }
                            />
                          </div>
                          <label className="video-duration-auto-toggle" title="自动时长">
                            <input
                              aria-label="自动时长"
                              title="自动时长"
                              type="checkbox"
                              checked={selectedNode.videoDurationSeconds === -1}
                              onChange={(event) =>
                                updateNode(selectedNode.id, (current) => ({
                                  ...current,
                                  videoDurationSeconds: event.target.checked
                                    ? -1
                                    : normalizeSeedanceDurationSeconds(
                                        selectedVideoModel,
                                        current.videoDurationSeconds === -1
                                          ? getSeedanceCapabilities(selectedVideoModel)
                                              .durationRangeSeconds.min
                                          : current.videoDurationSeconds ?? 5,
                                      ),
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {getVideoScenarioHint(selectedVideoScenario) ? (
                    <p className="video-scene-hint">{getVideoScenarioHint(selectedVideoScenario)}</p>
                  ) : null}
                  <p className="video-usage-line">预计消耗：{estimatedVideoTokens ?? 0} tokens（本地预估）</p>
                  <p className="video-usage-line">
                    实际消耗：
                    {typeof selectedNode.settledTotalTokens === 'number'
                      ? `${selectedNode.settledCompletionTokens} completion tokens / ${selectedNode.settledTotalTokens} total tokens`
                      : '等待官方结算'}
                  </p>
                  {getVideoOutputStorageStatus(selectedNode) ? (
                    <p
                      className={`video-usage-line node-storage-status is-${
                        getVideoOutputStorageStatus(selectedNode)?.tone
                      }`}
                      title={getVideoOutputStorageStatus(selectedNode)?.detail}
                    >
                      保存状态：{getVideoOutputStorageStatus(selectedNode)?.summary}
                      {getVideoOutputStorageStatus(selectedNode)?.detail
                        ? ` · ${getVideoOutputStorageStatus(selectedNode)?.detail}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <label>
                供应商
                <select
                  value={selectedNode.providerId ?? ''}
                  onChange={(event) => {
                    const nextProviderId = event.target.value || undefined;
                    const nextProvider = nextProviderId
                      ? findProvidersForNode(selectedNode).find(
                          (provider) => provider.id === nextProviderId,
                        )
                      : findProvidersForNode(selectedNode)[0];
                    const nextModel = nextProvider
                      ? findProviderModelsForNodeWithProvider(selectedNode, nextProvider)[0]
                      : undefined;

                    updateNode(selectedNode.id, (current) => ({
                      ...current,
                      providerId: nextProviderId,
                      providerModelId: nextProviderId ? nextModel?.providerModelId : undefined,
                      modelId:
                        selectedNode.kind === 'chat' && nextModel
                          ? nextModel.providerModelId
                          : current.modelId,
                    }));
                  }}
                >
                  <option value="">
                    自动选择供应商
                  </option>
                  {findProvidersForNode(selectedNode).map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                供应商模型
                <select
                  value={selectedNode.providerModelId ?? ''}
                  onChange={(event) =>
                    updateNode(selectedNode.id, (current) => ({
                      ...current,
                      providerModelId: event.target.value || undefined,
                      modelId:
                        selectedNode.kind === 'chat' && event.target.value
                          ? event.target.value
                          : current.modelId,
                    }))
                  }
                >
                  <option value="">自动选择模型</option>
                  {findProviderModelsForNode(selectedNode).map((model) => (
                    <option
                      key={`${model.canonicalModelId}:${model.providerModelId}`}
                      value={model.providerModelId}
                    >
                      {model.displayName ?? model.providerModelId}
                    </option>
                  ))}
                </select>
              </label>
              {selectedNode.kind === 'image' ? (
                <div className="image-generation-settings">
                  <label>
                    分辨率
                    <select
                      value={selectedNode.imageResolutionTier ?? defaultImageResolutionTier}
                      onChange={(event) => {
                        const nextTier = event.target.value as ImageResolutionTier;
                        const currentRatio =
                          selectedNode.imageAspectRatio ?? defaultImageAspectRatio;
                        const nextRatio = getImageAspectOptions(nextTier).some(
                          (option) => option.ratio === currentRatio,
                        )
                          ? currentRatio
                          : defaultImageAspectRatio;

                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          imageResolutionTier: nextTier,
                          imageAspectRatio: nextRatio,
                        }));
                      }}
                    >
                      {imageResolutionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    比例
                    <select
                      value={selectedNode.imageAspectRatio ?? defaultImageAspectRatio}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          imageAspectRatio: event.target.value,
                        }))
                      }
                    >
                      {getImageAspectOptions(
                        selectedNode.imageResolutionTier ?? defaultImageResolutionTier,
                      ).map((option) => (
                        <option key={option.ratio} value={option.ratio}>
                          {getImageAspectOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    质量
                    <select
                      value={selectedNode.imageQuality ?? defaultImageQuality}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          imageQuality: event.target.value as ImageQuality,
                        }))
                      }
                    >
                      {imageQualityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} - {option.description}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <label>
                提示词
                <PromptTextarea
                  canvas={activeCanvas}
                  node={selectedNode}
                  placeholder="输入节点提示词，支持 @文本 / @图片 / @视频 引用已连线的上游资产"
                  onChange={(value) =>
                    updateNode(selectedNode.id, (current) => ({
                      ...current,
                      prompt: value,
                    }))
                  }
                />
              </label>
            </aside>
            );
          })() : null}
          {editingOutputNode ? createPortal(
            <div className="output-modal-backdrop" onPointerDown={closeOutputEditor}>
              <section
                className="output-modal"
                style={{
                  transform: `translate(${outputModalPosition.x}px, ${outputModalPosition.y}px)`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={handleOutputModalDrag}
                onPointerUp={stopOutputModalDrag}
                onPointerCancel={stopOutputModalDrag}
              >
                <header className="output-modal-header" onPointerDown={startOutputModalDrag}>
                  <div>
                    <h2>{editingOutputNode.title} 输出版本</h2>
                    <p>拖拽标题栏移动窗口</p>
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={closeOutputEditor}
                  >
                    <X size={16} />
                    关闭
                  </button>
                </header>
                <div className="output-modal-layout">
                  <aside className="output-version-sidebar">
                    <div className="output-version-list">
                      {outputVersionPageData.items.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          className={version.id === selectedOutputVersionId ? 'is-active' : ''}
                          onClick={() => selectOutputVersion(version.id)}
                        >
                          <span>{version.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="output-version-pagination">
                      <button
                        type="button"
                        disabled={outputVersionPageData.page <= 1}
                        onClick={() => setOutputVersionPage((current) => Math.max(1, current - 1))}
                      >
                        上一页                      </button>
                      <span>
                        {outputVersionPageData.page} / {outputVersionPageData.pageCount}
                      </span>
                      <button
                        type="button"
                        disabled={outputVersionPageData.page >= outputVersionPageData.pageCount}
                        onClick={() =>
                          setOutputVersionPage((current) =>
                            Math.min(outputVersionPageData.pageCount, current + 1),
                          )
                        }
                      >
                        下一页                      </button>
                    </div>
                  </aside>
                  <div className="output-version-detail">
                    <div className="output-version-detail-actions">
                      <button
                        type="button"
                        className={outputEditorMode === 'preview' ? 'is-active' : ''}
                        onClick={() => setOutputEditorMode('preview')}
                      >
                        预览
                      </button>
                      <button
                        type="button"
                        className={outputEditorMode === 'edit' ? 'is-active' : ''}
                        onClick={() => setOutputEditorMode('edit')}
                      >
                        <Pencil size={16} />
                        编辑
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={!selectedOutputVersionId}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={deleteSelectedOutputVersion}
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>
                    {outputEditorMode === 'preview' ? (
                      <div
                        className="output-modal-preview"
                        onWheel={handleModalScrollableWheel}
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownToHtml(draftOutputText),
                        }}
                      />
                    ) : (
                      <textarea
                        value={draftOutputText}
                        onWheel={handleModalScrollableWheel}
                        onChange={(event) => setDraftOutputText(event.target.value)}
                      />
                    )}
                  </div>
                </div>
                <footer>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={closeOutputEditor}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={saveOutputEditor}
                  >
                    <Save size={16} />
                    保存为新版本
                  </button>
                </footer>
              </section>
            </div>,
            document.body,
          ) : null}
          <ImagePreviewModal preview={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
        )}
      </section>
      {unsavedChangesPromptPortal}
      {canvasNavigationPanel ? createPortal(canvasNavigationPanel, document.body) : null}
    </main>
  );
}
