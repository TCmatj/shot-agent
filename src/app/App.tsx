import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CompositionEvent as ReactCompositionEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
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
  Check,
  ChevronDown,
  Copy,
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
  findProvidersForVideoFormat,
  isSoraCompatibleVideoFormat,
  mergeProviderDefaults,
  saveProviderDraft,
} from '../domain/provider';
import type { ChatFormat, ProviderConfig, VideoModelFormat } from '../domain/provider';
import { initialProviders } from '../models/providerCatalog';
import { fetchProviderModelList, mergeFetchedProviderModels } from '../models/providerModelList';
import {
  appendOutputVersion,
  getLatestOutputVersion,
  getOutputVersionsForDisplay,
  getStoredOutputVersions,
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
  buildStorySystemInstruction,
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
  groupSeedanceUploadCandidatesByContent,
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
  createCanvasEdge,
  createWorkspaceState,
  deleteCanvas,
  exportCanvas,
  findNodesInSelectionRect,
  getCanvasNodeHeight,
  getCanvasNodeMinimumHeight,
  getCanvasNodeMinimumWidth,
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
  filterVisibleCanvasNodes,
  getCanvasViewportBounds,
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
  buildDiamondMaskLineSegments,
  createDefaultDiamondMaskRect,
  createDiamondMaskImageDataUrl,
  diamondMaskColorValues,
  normalizeDiamondMaskDensity,
  normalizeDiamondMaskLineWidth,
  normalizeDiamondMaskRect,
  type DiamondMaskColor,
  type DiamondMaskRect,
} from '../models/diamondMask';
import {
  calculateCanvasCenterFromMinimapFrame,
  calculateMinimapViewportFrame,
  parseStoredCanvasViewports,
  serializeStoredCanvasViewports,
  type StoredCanvasViewports,
} from './canvasViewports';
import { buildStoryNodeExpansion } from './storyNodeExpansion';
import {
  defaultStoryAutoRunConcurrencyLimits,
  normalizeStoryAutoRunConcurrencyLimit,
  runStoryAutoRunQueue,
} from './storyAutoRunQueue';
import {
  createEmptyStoryStructuredOutput,
  parseStoryStructuredOutput,
  type StoryNodeExecutionMode,
  type StoryNodeExpansionMode,
  type StoryNarrativeSegment,
  type StoryShot,
} from '../domain/story';
import {
  getWorkspaceStore,
} from '../storage';
import {
  createObjectStorageConfigFromEnv,
  createAssetContentHash,
  getAssetUploadEndpointFromEnv,
  isObjectStorageConfigured,
  readAssetSourceAsBlob,
  uploadBlobToAssetEndpoint,
  uploadBlobToR2,
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

type DiamondMaskResizeHandle = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

type DiamondMaskNodeBodyProps = {
  node: CanvasNodeView;
  canChooseSource: boolean;
  onReplaceImage: (file: File) => void;
  onSelectAsset: () => void;
  onRequireStorage: () => void;
  onUpdateNode: (updater: (node: CanvasNodeView) => CanvasNodeView) => void;
  onGenerate: () => void;
};

type AssetPickerTarget = {
  nodeId: string;
  kind: 'image' | 'video';
  purpose: 'assetNode' | 'diamondMask';
};

type VideoCapabilities = {
  supportedResolutions: Array<'480p' | '720p' | '1080p'>;
  supportedRatios: SeedanceRatio[];
  durationRangeSeconds: {
    min: number;
    max: number;
    supportsAuto: boolean;
  };
  fixedFrameRate: number;
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
  pointerId: number;
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

type InlineSelectOption = {
  value: string;
  label: string;
};

type InlineOptionSelectProps = {
  value: string | number;
  options: InlineSelectOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
  menuKey: string;
  openMenuKey: string | null;
  setOpenMenuKey: (value: string | null) => void;
  variant?: 'default' | 'compact';
  disabled?: boolean;
};

type OutputSelectionToolbarState = {
  text: string;
  top: number;
  left: number;
  copied: boolean;
};

type PromptTextareaProps = {
  canvas: CanvasView | null;
  node: CanvasNodeView;
  placeholder: string;
  ariaLabel?: string;
  stopPointerDown?: boolean;
  onChange(value: string): void;
};

type CanvasNodeBodyProps = {
  activeCanvas: CanvasView | null;
  node: CanvasNodeView;
  providers: ProviderConfig[];
  isGenerating: boolean;
  effectiveOutputText?: string;
  openInlineSelectKey: string | null;
  setOpenInlineSelectKey: (value: string | null) => void;
  rootDirectoryReady: boolean;
  folderStorageReady: boolean;
  onOpenImagePreview: (title: string, imageUrl: string) => void;
  onReplaceDiamondMaskImage: (nodeId: string, file: File) => void;
  onOpenAssetPicker: (target: AssetPickerTarget) => void;
  onRequireDiamondMaskStorage: () => void;
  onUpdateNode: (
    nodeId: string,
    updater: (node: CanvasNodeView) => CanvasNodeView,
  ) => void;
  onGenerateDiamondMaskAsset: (node: CanvasNodeView) => void;
  onAddAssetNodeFromFile: (
    file: File,
    position: { x: number; y: number },
  ) => Promise<string | null | undefined>;
  onRemovePlaceholderNode: (nodeId: string) => void;
  onHandleVideoScenarioChange: (nodeId: string, nextScenario: SeedanceScenario) => void;
  onSubmitNodeGeneration: (node: CanvasNodeView) => Promise<void>;
  onRegenerateStoryNodes: (
    node: CanvasNodeView,
    options: {
      structuredOutput?: ReturnType<typeof parseStoryStructuredOutput>;
      expansionMode: StoryNodeExpansionMode;
    },
  ) => void;
  onClearStoryOutputs: (nodeId: string) => void;
  hasStoryDownstreamOutputs: (nodeId: string) => boolean;
  onOpenOutputEditor: (node: CanvasNodeView) => void;
};

function getStoryImageConcurrencyLimit(node: CanvasNodeView): number {
  return normalizeStoryAutoRunConcurrencyLimit(
    node.storyImageConcurrencyLimit ?? defaultStoryAutoRunConcurrencyLimits.image,
  );
}

function getStoryVideoConcurrencyLimit(node: CanvasNodeView): number {
  return normalizeStoryAutoRunConcurrencyLimit(
    node.storyVideoConcurrencyLimit ?? defaultStoryAutoRunConcurrencyLimits.video,
  );
}

function isNodeInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        'button',
        'input',
        'textarea',
        'select',
        'a',
        'label',
        'video',
        'audio',
        'img',
        '[contenteditable="true"]',
        '.prompt-reference-field',
        '.inline-option-select',
        '.asset-upload',
        '.diamond-mask-stage',
        '.node-output-open',
        '.node-output-markdown',
        '.node-output-summary',
        '.node-output-stream-tail',
        '.node-preview-stage',
      ].join(', '),
    ),
  );
}

const OutputPreviewContent = memo(function OutputPreviewContent({
  html,
  previewRef,
  onWheel,
  onPointerDown,
  onPointerUp,
  onKeyUp,
}: {
  html: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onPointerDown: () => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onKeyUp: () => void;
}) {
  return (
    <div
      ref={previewRef}
      className="output-modal-preview"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyUp={onKeyUp}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
});

const InlineOptionSelect = memo(function InlineOptionSelect({
  value,
  options,
  ariaLabel,
  onChange,
  menuKey,
  openMenuKey,
  setOpenMenuKey,
  variant = 'default',
  disabled = false,
}: InlineOptionSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isOpen = openMenuKey === menuKey;
  const selectedOption =
    options.find((option) => option.value === String(value)) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenuKey(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuKey(null);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setOpenMenuKey]);

  return (
    <div
      ref={rootRef}
      className={`inline-option-select inline-option-select-${variant} ${
        isOpen ? 'is-open' : ''
      }`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (!isOpen) {
          return;
        }

        const nextFocused = event.relatedTarget;
        if (nextFocused instanceof Node && rootRef.current?.contains(nextFocused)) {
          return;
        }

        setOpenMenuKey(null);
      }}
    >
      <button
        type="button"
        className="inline-option-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setOpenMenuKey(isOpen ? null : menuKey)}
      >
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div
          className="inline-option-menu"
          role="listbox"
          aria-label={ariaLabel}
          onWheelCapture={(event) => event.stopPropagation()}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? 'is-active' : ''}
                role="option"
                aria-selected={isActive}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onChange(option.value);
                  setOpenMenuKey(null);
                }}
                onClick={() => {
                  onChange(option.value);
                  setOpenMenuKey(null);
                }}
              >
                <span>{option.label}</span>
                {isActive ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}, areInlineOptionSelectPropsEqual);

function areInlineOptionSelectPropsEqual(
  previous: Readonly<InlineOptionSelectProps>,
  next: Readonly<InlineOptionSelectProps>,
): boolean {
  return (
    previous.value === next.value &&
    previous.ariaLabel === next.ariaLabel &&
    previous.menuKey === next.menuKey &&
    previous.openMenuKey === next.openMenuKey &&
    previous.variant === next.variant &&
    previous.disabled === next.disabled &&
    areInlineSelectOptionsEqual(previous.options, next.options)
  );
}

function areInlineSelectOptionsEqual(
  previous: InlineSelectOption[],
  next: InlineSelectOption[],
): boolean {
  if (previous === next) {
    return true;
  }

  if (previous.length !== next.length) {
    return false;
  }

  return previous.every(
    (option, index) =>
      option.value === next[index]?.value && option.label === next[index]?.label,
  );
}

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
    id: 'story',
    label: '故事拆解节点',
    title: '故事拆解',
    modelId: 'gpt-5.4-mini',
    kind: 'story',
    icon: FileText,
  },
  {
    id: 'diamond-mask',
    label: '菱形遮罩节点',
    title: '菱形遮罩',
    modelId: 'diamond-mask',
    kind: 'diamondMask',
    icon: BoxSelect,
    outputOnly: true,
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
const desktopRootDirectoryStorageKey = 'shot-agent:desktop-root-directory-path';
const providerStorageKey = 'shot-agent:providers';
const deletedProviderStorageKey = 'shot-agent:deleted-providers';
const canvasViewportStorageKey = 'shot-agent:canvas-viewports';
const canvasNodeSize = { width: 320, height: 220 };
const edgeHandleHitSize = 18;
const minimapSize = { width: 220, height: 150 };
const defaultViewport: CanvasViewport = { x: 80, y: 72, scale: 1 };
const edgeSnapRadius = 52;

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

function isChatLikeNode(node: CanvasNodeView): boolean {
  return node.kind === 'chat' || node.kind === 'story';
}

function getNodeChatFormat(node: Pick<CanvasNodeView, 'chatFormat'>): ChatFormat {
  return node.chatFormat ?? 'openai';
}

function findProvidersForNodeWithProviders(
  providers: ProviderConfig[],
  node: CanvasNodeView,
): ProviderConfig[] {
  if (isChatLikeNode(node) || node.modelId === 'chat') {
    return findChatProviders(providers, getNodeChatFormat(node));
  }

  if (node.kind === 'video') {
    return findProvidersForVideoFormat(providers, getVideoModelFormat(node));
  }

  return findProvidersForCanonicalModel(providers, node.modelId);
}

function findProviderModelsForNodeWithProviders(
  providers: ProviderConfig[],
  node: CanvasNodeView,
) {
  const availableProviders = findProvidersForNodeWithProviders(providers, node);
  const provider = node.providerId
    ? availableProviders.find((current) => current.id === node.providerId)
    : availableProviders[0];

  return provider
    ? findProviderModelsForNodeModel(
        provider,
        node.modelId,
        getNodeChatFormat(node),
        isChatLikeNode(node) ? 'chat' : undefined,
        node.kind === 'video' ? getVideoModelFormat(node) : undefined,
      )
    : [];
}

function findProviderModelsForNodeWithSpecificProvider(
  node: CanvasNodeView,
  provider: ProviderConfig,
) {
  return findProviderModelsForNodeModel(
    provider,
    node.modelId,
    getNodeChatFormat(node),
    isChatLikeNode(node) ? 'chat' : undefined,
    node.kind === 'video' ? getVideoModelFormat(node) : undefined,
  );
}

function resolveNodeProviderSelectionWithProviders(
  providers: ProviderConfig[],
  node: CanvasNodeView,
): {
  availableProviders: ProviderConfig[];
  selectedProvider?: ProviderConfig;
  availableModels: ReturnType<typeof findProviderModelsForNodeWithProviders>;
  effectiveProviderId: string;
  effectiveProviderModelId: string;
} {
  const availableProviders = findProvidersForNodeWithProviders(providers, node);
  const selectedProvider = node.providerId
    ? availableProviders.find((provider) => provider.id === node.providerId) ?? availableProviders[0]
    : availableProviders[0];
  const availableModels = selectedProvider
    ? findProviderModelsForNodeWithSpecificProvider(node, selectedProvider)
    : [];
  const effectiveProviderModelId =
    (node.providerModelId &&
    availableModels.some((model) => model.providerModelId === node.providerModelId)
      ? node.providerModelId
      : availableModels[0]?.providerModelId) ?? '';

  return {
    availableProviders,
    selectedProvider,
    availableModels,
    effectiveProviderId: selectedProvider?.id ?? '',
    effectiveProviderModelId,
  };
}

function getNextModelIdForNode(
  node: CanvasNodeView,
  nextModel?: {
    canonicalModelId: string;
    providerModelId: string;
  },
): string {
  if (!nextModel) {
    return node.modelId;
  }

  if (isChatLikeNode(node)) {
    return nextModel.providerModelId;
  }

  if (
    node.kind === 'video' &&
    !isSoraCompatibleVideoFormat(getVideoModelFormat(node)) &&
    isSeedanceVideoModel(nextModel.canonicalModelId)
  ) {
    return nextModel.canonicalModelId;
  }

  return nextModel.canonicalModelId;
}

function getNodePromptPlaceholder(node: CanvasNodeView): string {
  if (node.kind === 'video') {
    return getVideoPromptPlaceholder(node.seedanceScenario ?? 'text_to_video');
  }

  if (node.kind === 'story') {
    return '输入故事内容，支持 @文本 / @图片 引用已连线的上游资产';
  }

  return '输入节点提示词，支持 @文本 / @图片 / @视频 引用已连线的上游资产';
}

function getNodeTextReferencePreview(node: CanvasNodeView): string | undefined {
  const text =
    node.kind === 'textAsset'
      ? node.textContent
      : getEffectiveNodeOutputText(node) ?? (node.kind === 'image' ? node.prompt : undefined);
  const compact = text?.replace(/\s+/g, ' ').trim();

  return compact ? compact.slice(0, 5) : undefined;
}

function getStoryGlobalAssetCount(structuredOutput?: CanvasNodeView['storyStructuredOutput']): number {
  if (!structuredOutput) {
    return 0;
  }

  return (
    structuredOutput.globalAssets.scenePrompts.length +
    structuredOutput.globalAssets.characterSheetPrompts.length +
    structuredOutput.globalAssets.propSheetPrompts.length
  );
}

function getStoryShotCount(structuredOutput?: CanvasNodeView['storyStructuredOutput']): number {
  if (!structuredOutput) {
    return 0;
  }

  return structuredOutput.narrativeSegments.reduce((total, segment) => total + segment.shots.length, 0);
}

function getStoryDurationSeconds(structuredOutput?: CanvasNodeView['storyStructuredOutput']): number {
  if (!structuredOutput) {
    return 0;
  }

  return structuredOutput.narrativeSegments.reduce(
    (total, segment) => total + Math.max(0, segment.durationSeconds),
    0,
  );
}

function hasStoryExpansionContent(structuredOutput?: CanvasNodeView['storyStructuredOutput']): boolean {
  if (!structuredOutput) {
    return false;
  }

  return (
    getStoryGlobalAssetCount(structuredOutput) > 0 ||
    structuredOutput.narrativeSegments.length > 0
  );
}

function getStoryStructuredOutputCompletenessScore(
  structuredOutput?: CanvasNodeView['storyStructuredOutput'],
): number {
  if (!structuredOutput) {
    return -1;
  }

  return (
    structuredOutput.narrativeSegments.length * 1000 +
    getStoryShotCount(structuredOutput) * 100 +
    getStoryGlobalAssetCount(structuredOutput) * 10 +
    (structuredOutput.storySummary.trim() ? 1 : 0)
  );
}

function resolveBestStoryStructuredOutput(
  structuredOutput: CanvasNodeView['storyStructuredOutput'],
  rawOutput?: string,
): CanvasNodeView['storyStructuredOutput'] {
  const parsedFromRaw = rawOutput ? parseStoryStructuredOutput(rawOutput) ?? undefined : undefined;

  if (!structuredOutput) {
    return parsedFromRaw;
  }

  if (!parsedFromRaw) {
    return structuredOutput;
  }

  return getStoryStructuredOutputCompletenessScore(parsedFromRaw)
    >= getStoryStructuredOutputCompletenessScore(structuredOutput)
    ? parsedFromRaw
    : structuredOutput;
}

function formatStoryPromptPreview(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  return normalized;
}

function formatStoryShotMeta(shot: StoryShot): string[] {
  const lines = [
    `${shot.durationSeconds} 秒`,
    shot.characters.length > 0 ? `角色：${shot.characters.join('、')}` : '角色：未指定',
    `运镜：${shot.cameraMotion}`,
  ];

  if (shot.composition?.trim()) {
    lines.push(`构图：${shot.composition.trim()}`);
  }

  lines.push(`动作：${shot.action}`);

  if (shot.dialogue?.trim()) {
    lines.push(`对白：${shot.dialogue.trim()}`);
  }

  if (shot.dialoguePacing?.trim()) {
    lines.push(`对白节奏：${shot.dialoguePacing.trim()}`);
  }

  if (shot.atmosphere?.trim()) {
    lines.push(`气氛：${shot.atmosphere.trim()}`);
  }

  if (shot.bgm?.trim()) {
    lines.push(`BGM：${shot.bgm.trim()}`);
  }

  if (shot.transitionToNext) {
    lines.push(
      `转场：${shot.transitionToNext.description}（${shot.transitionToNext.type}，${shot.transitionToNext.durationSeconds} 秒）`,
    );
  }

  return lines;
}

function getStorySegmentAssetSummary(segment: StoryNarrativeSegment): Array<{ label: string; prompt: string }> {
  return [
    { label: '叙事段落提示词', prompt: segment.prompt },
    { label: '首帧图', prompt: segment.firstFramePrompt.prompt },
    { label: '尾帧图', prompt: segment.lastFramePrompt.prompt },
    { label: '运镜简笔画', prompt: segment.motionSketchPrompt.prompt },
  ];
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

  const currentNode = canvas.nodes.find((node) => node.id === currentNodeId);
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

    return currentNode?.kind === 'story'
      ? suggestions.filter(
          (suggestion) => suggestion.token === '@文本' || suggestion.token === '@图片',
        )
      : suggestions;
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

function isTextEditingTarget(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function insertPlainTextIntoContentEditable(root: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    root.append(document.createTextNode(text));
    return serializePromptEditor(root).length;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStart(textNode, text.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  return getPromptEditorCaretOffset(root);
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

const PromptTextarea = memo(function PromptTextarea({
  canvas,
  node,
  placeholder,
  ariaLabel = '提示词',
  stopPointerDown,
  onChange,
}: PromptTextareaProps) {
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

  function handleEditorPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const plainText = event.clipboardData.getData('text/plain');
    const hasFiles = event.clipboardData.files.length > 0;
    const hasHtml = event.clipboardData.types.includes('text/html');

    if (!plainText && !hasFiles && !hasHtml) {
      return;
    }

    event.preventDefault();
    const nextCaret = insertPlainTextIntoContentEditable(event.currentTarget, plainText);
    handleEditorInput(event.currentTarget);
    window.requestAnimationFrame(() => {
      setPromptEditorCaretOffset(event.currentTarget, nextCaret);
    });
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
        aria-label={ariaLabel}
        aria-multiline="true"
        style={{ cursor: 'text' }}
        suppressContentEditableWarning
        onPointerDown={stopPointerDown ? (event) => event.stopPropagation() : undefined}
        onBlur={() => window.setTimeout(() => setTrigger(null), 120)}
        onClick={(event) => refreshTrigger(event.currentTarget)}
        onKeyUp={handleEditorKeyUp}
        onKeyDown={handleEditorKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handleEditorPaste}
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
}, arePromptTextareaPropsEqual);

function arePromptTextareaPropsEqual(
  previous: Readonly<PromptTextareaProps>,
  next: Readonly<PromptTextareaProps>,
): boolean {
  return (
    previous.canvas === next.canvas &&
    previous.node === next.node &&
    previous.placeholder === next.placeholder &&
    previous.ariaLabel === next.ariaLabel &&
    previous.stopPointerDown === next.stopPointerDown
  );
}

const CanvasNodeBody = memo(function CanvasNodeBody({
  activeCanvas,
  node,
  providers,
  isGenerating,
  effectiveOutputText,
  openInlineSelectKey,
  setOpenInlineSelectKey,
  rootDirectoryReady,
  folderStorageReady,
  onOpenImagePreview,
  onReplaceDiamondMaskImage,
  onOpenAssetPicker,
  onRequireDiamondMaskStorage,
  onUpdateNode,
  onGenerateDiamondMaskAsset,
  onAddAssetNodeFromFile,
  onRemovePlaceholderNode,
  onHandleVideoScenarioChange,
  onSubmitNodeGeneration,
  onRegenerateStoryNodes,
  onClearStoryOutputs,
  hasStoryDownstreamOutputs,
  onOpenOutputEditor,
}: CanvasNodeBodyProps) {
  const providersForNode = useMemo(
    () => findProvidersForNodeWithProviders(providers, node),
    [node, providers],
  );
  const providerSelection = useMemo(
    () => resolveNodeProviderSelectionWithProviders(providers, node),
    [node, providers],
  );
  const isLongOutput =
    effectiveOutputText !== undefined && shouldCollapseMarkdown(effectiveOutputText);
  const videoOutputStorageStatus =
    node.kind === 'video' ? getVideoOutputStorageStatus(node) : null;
  const nodeSettingSummary = getNodeSettingSummaryText(node);
  const nodeSoraFormatAvailable = findProvidersForVideoFormat(providers, 'seedance-sora').length > 0;

  return (
    <div
      className={`node-body node-body-${node.kind}`}
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
        onOpenImagePreview(node.title, imageUrl);
      }}
    >
      {node.kind === 'diamondMask' ? (
        <DiamondMaskNodeBody
          node={node}
          canChooseSource={Boolean(rootDirectoryReady && folderStorageReady)}
          onReplaceImage={(file) => onReplaceDiamondMaskImage(node.id, file)}
          onSelectAsset={() =>
            onOpenAssetPicker({
              nodeId: node.id,
              kind: 'image',
              purpose: 'diamondMask',
            })
          }
          onRequireStorage={onRequireDiamondMaskStorage}
          onUpdateNode={(updater) => onUpdateNode(node.id, updater)}
          onGenerate={() => onGenerateDiamondMaskAsset(node)}
        />
      ) : node.kind === 'textAsset' ? (
        <textarea
          className="text-asset-textarea"
          value={node.textContent ?? ''}
          placeholder="输入文本"
          style={{
            cursor: 'text',
            minHeight: `${Math.max(88, getCanvasNodeHeight(node) - 108)}px`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onWheelCapture={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onChange={(event) =>
            onUpdateNode(node.id, (current) => ({
              ...current,
              textContent: event.target.value,
            }))
          }
        />
      ) : node.kind === 'imageAsset' ? (
        <>
          <div className="node-preview-stage">
            {node.assetDataUrl ? (
              <img className="asset-preview" src={node.assetDataUrl} alt={node.assetName ?? '图片'} />
            ) : (
              <div className="node-preview-empty">暂无图片</div>
            )}
          </div>
          <div className="node-asset-actions">
            <label className="asset-upload">
              导入图片
              <input
                type="file"
                accept="image/*"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onAddAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                      if (nodeId) {
                        onRemovePlaceholderNode(node.id);
                      }
                    });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="asset-upload asset-select-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                onOpenAssetPicker({
                  nodeId: node.id,
                  kind: 'image',
                  purpose: 'assetNode',
                })
              }
            >
              选择资产
            </button>
          </div>
        </>
      ) : node.kind === 'videoAsset' ? (
        <>
          <div className="node-preview-stage">
            {node.assetDataUrl ? (
              <video className="asset-preview" src={node.assetDataUrl} controls />
            ) : (
              <div className="node-preview-empty">暂无视频</div>
            )}
          </div>
          <div className="node-asset-actions">
            <label className="asset-upload">
              导入视频
              <input
                type="file"
                accept="video/*"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onAddAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                      if (nodeId) {
                        onRemovePlaceholderNode(node.id);
                      }
                    });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="asset-upload asset-select-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                onOpenAssetPicker({
                  nodeId: node.id,
                  kind: 'video',
                  purpose: 'assetNode',
                })
              }
            >
              选择资产
            </button>
          </div>
        </>
      ) : node.kind === 'audioAsset' ? (
        <>
          <div className="node-preview-stage node-preview-stage-audio">
            {node.assetDataUrl ? (
              <audio className="asset-preview" src={node.assetDataUrl} controls />
            ) : (
              <div className="node-preview-empty">暂无音频</div>
            )}
          </div>
          <div className="node-asset-actions">
            <label className="asset-upload">
              导入音频
              <input
                type="file"
                accept="audio/*"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onAddAssetNodeFromFile(file, { x: node.x, y: node.y }).then((nodeId) => {
                      if (nodeId) {
                        onRemovePlaceholderNode(node.id);
                      }
                    });
                  }
                }}
              />
            </label>
          </div>
        </>
      ) : (
        <>
          {node.kind === 'story'
            ? (() => {
                const storyProviders = providersForNode;
                const storyProviderModels = findProviderModelsForNodeWithProviders(providers, node);
                const resolvedStructuredOutput = resolveBestStoryStructuredOutput(
                  node.storyStructuredOutput,
                  node.storyRawOutput ?? node.modelOutputText ?? '',
                );
                const hasDownstreamOutputs = hasStoryDownstreamOutputs(node.id);

                return (
                  <div className="node-inline-story-config">
                    <div className="node-inline-story-row">
                      <label className="node-inline-story-inline-field">
                        <span className="node-inline-story-inline-label">执行方式</span>
                        <InlineOptionSelect
                          ariaLabel="执行方式"
                          value={node.storyExecutionMode ?? 'structure_only'}
                          menuKey={`node-inline-story-execution-mode:${node.id}`}
                          openMenuKey={openInlineSelectKey}
                          setOpenMenuKey={setOpenInlineSelectKey}
                          variant="compact"
                          onChange={(value) =>
                            onUpdateNode(node.id, (current) => ({
                              ...current,
                              storyExecutionMode: value as StoryNodeExecutionMode,
                            }))
                          }
                          options={[
                            { value: 'structure_only', label: '仅拆解' },
                            { value: 'structure_and_nodes', label: '拆解并铺节点' },
                            { value: 'structure_and_generate_images', label: '拆解并执行生图' },
                            { value: 'fully_automatic', label: '拆解并全自动执行' },
                          ]}
                        />
                      </label>
                      <button
                        type="button"
                        className="node-inline-generate-button node-inline-story-action-button"
                        disabled={isGenerating}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => void onSubmitNodeGeneration(node)}
                      >
                        {isGenerating ? '提交中' : '生成'}
                      </button>
                    </div>
                    <div className="node-inline-story-row">
                      <label className="node-inline-story-inline-field">
                        <span className="node-inline-story-inline-label">供应商</span>
                        <InlineOptionSelect
                          ariaLabel="供应商"
                          value={providerSelection.effectiveProviderId}
                          menuKey={`node-inline-story-provider:${node.id}`}
                          openMenuKey={openInlineSelectKey}
                          setOpenMenuKey={setOpenInlineSelectKey}
                          variant="compact"
                          onChange={(value) => {
                            const nextProviderId = value || undefined;
                            const nextProvider = nextProviderId
                              ? storyProviders.find((provider) => provider.id === nextProviderId)
                              : storyProviders[0];
                            const nextModel = nextProvider
                              ? findProviderModelsForNodeWithSpecificProvider(node, nextProvider)[0]
                              : undefined;

                            onUpdateNode(node.id, (current) => ({
                              ...current,
                              providerId: nextProviderId,
                              providerModelId: nextModel?.providerModelId,
                              modelId: nextModel?.providerModelId ?? current.modelId,
                            }));
                          }}
                          options={storyProviders.map((provider) => ({
                            value: provider.id,
                            label: provider.name,
                          }))}
                        />
                      </label>
                      <label className="node-inline-story-inline-field">
                        <span className="node-inline-story-inline-label">模型</span>
                        <InlineOptionSelect
                          ariaLabel="供应商模型"
                          value={providerSelection.effectiveProviderModelId}
                          menuKey={`node-inline-story-provider-model:${node.id}`}
                          openMenuKey={openInlineSelectKey}
                          setOpenMenuKey={setOpenInlineSelectKey}
                          variant="compact"
                          onChange={(value) => {
                            const nextProviderModelId = value || undefined;
                            onUpdateNode(node.id, (current) => ({
                              ...current,
                              providerModelId: nextProviderModelId,
                              modelId: nextProviderModelId ?? current.modelId,
                            }));
                          }}
                          options={storyProviderModels.map((model) => ({
                            value: model.providerModelId,
                            label: model.displayName ?? model.providerModelId,
                          }))}
                        />
                      </label>
                    </div>
                    {resolvedStructuredOutput ? (
                      <div className="node-inline-story-actions">
                        <label className="node-inline-story-inline-field">
                          <span className="node-inline-story-inline-label">重建类型</span>
                          <InlineOptionSelect
                            ariaLabel="重建类型"
                            value={node.storyExpansionMode ?? 'full'}
                            menuKey={`node-inline-story-expansion-mode:${node.id}`}
                            openMenuKey={openInlineSelectKey}
                            setOpenMenuKey={setOpenInlineSelectKey}
                            variant="compact"
                            onChange={(value) =>
                              onUpdateNode(node.id, (current) => ({
                                ...current,
                                storyExpansionMode: value as StoryNodeExpansionMode,
                              }))
                            }
                            options={[
                              { value: 'structure_only', label: '仅生成结构' },
                              { value: 'global_assets', label: '结构 + 全局资产' },
                              { value: 'full', label: '展开全部节点' },
                            ]}
                          />
                        </label>
                        <button
                          type="button"
                          className="node-inline-generate-button node-inline-story-action-button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            if (hasDownstreamOutputs) {
                              onClearStoryOutputs(node.id);
                              return;
                            }

                            onRegenerateStoryNodes(node, {
                              structuredOutput: resolvedStructuredOutput,
                              expansionMode: node.storyExpansionMode ?? 'full',
                            });
                          }}
                        >
                          {hasDownstreamOutputs ? '清除节点' : '重建节点'}
                        </button>
                      </div>
                    ) : null}
                    <label>
                      提示词
                      <PromptTextarea
                        canvas={activeCanvas}
                        node={node}
                        ariaLabel="节点提示词"
                        placeholder={getNodePromptPlaceholder(node)}
                        stopPointerDown
                        onChange={(value) =>
                          onUpdateNode(node.id, (current) => ({
                            ...current,
                            prompt: value,
                          }))
                        }
                      />
                    </label>
                  </div>
                );
              })()
            : null}
          {(node.kind === 'image' || node.kind === 'video' || node.kind === 'chat') ? (
            <div className="node-inline-provider-row">
              <label className="node-inline-story-inline-field">
                <span className="node-inline-story-inline-label">供应商</span>
                <InlineOptionSelect
                  ariaLabel="供应商"
                  value={providerSelection.effectiveProviderId}
                  menuKey={`node-inline-provider:${node.id}`}
                  openMenuKey={openInlineSelectKey}
                  setOpenMenuKey={setOpenInlineSelectKey}
                  variant="compact"
                  onChange={(value) => {
                    const nextProvider = providerSelection.availableProviders.find(
                      (provider) => provider.id === value,
                    );
                    const nextModel = nextProvider
                      ? findProviderModelsForNodeWithSpecificProvider(node, nextProvider)[0]
                      : undefined;

                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      providerId: nextProvider?.id,
                      providerModelId: nextModel?.providerModelId,
                      modelId: getNextModelIdForNode(current, nextModel),
                    }));
                  }}
                  options={providerSelection.availableProviders.map((provider) => ({
                    value: provider.id,
                    label: provider.name,
                  }))}
                />
              </label>
              <label className="node-inline-story-inline-field">
                <span className="node-inline-story-inline-label">模型</span>
                <InlineOptionSelect
                  ariaLabel="供应商模型"
                  value={providerSelection.effectiveProviderModelId}
                  menuKey={`node-inline-provider-model:${node.id}`}
                  openMenuKey={openInlineSelectKey}
                  setOpenMenuKey={setOpenInlineSelectKey}
                  variant="compact"
                  onChange={(value) => {
                    const nextModel = providerSelection.availableModels.find(
                      (model) => model.providerModelId === value,
                    );

                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      providerId: providerSelection.selectedProvider?.id,
                      providerModelId: value,
                      modelId: getNextModelIdForNode(current, nextModel),
                    }));
                  }}
                  options={providerSelection.availableModels.map((model) => ({
                    value: model.providerModelId,
                    label: model.displayName ?? model.providerModelId,
                  }))}
                />
              </label>
            </div>
          ) : null}
          {node.kind === 'image' ? (
            <div className="node-inline-media-grid node-inline-image-grid">
              <label className="node-inline-story-inline-field node-inline-image-field-compact">
                <span className="node-inline-story-inline-label">分辨率</span>
                <InlineOptionSelect
                  value={node.imageResolutionTier ?? defaultImageResolutionTier}
                  ariaLabel="图片分辨率"
                  menuKey={`node-inline-image-resolution-tier:${node.id}`}
                  openMenuKey={openInlineSelectKey}
                  setOpenMenuKey={setOpenInlineSelectKey}
                  variant="compact"
                  onChange={(value) => {
                    const nextTier = value as ImageResolutionTier;
                    const currentRatio = node.imageAspectRatio ?? defaultImageAspectRatio;
                    const nextRatio = getImageAspectOptions(nextTier).some(
                      (option) => option.ratio === currentRatio,
                    )
                      ? currentRatio
                      : defaultImageAspectRatio;

                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      imageResolutionTier: nextTier,
                      imageAspectRatio: nextRatio,
                    }));
                  }}
                  options={imageResolutionOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </label>
              <label className="node-inline-story-inline-field node-inline-image-field-wide">
                <span className="node-inline-story-inline-label">比例</span>
                <InlineOptionSelect
                  value={node.imageAspectRatio ?? defaultImageAspectRatio}
                  ariaLabel="图片比例"
                  menuKey={`node-inline-image-aspect-ratio:${node.id}`}
                  openMenuKey={openInlineSelectKey}
                  setOpenMenuKey={setOpenInlineSelectKey}
                  variant="compact"
                  onChange={(value) =>
                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      imageAspectRatio: value,
                    }))
                  }
                  options={getImageAspectOptions(
                    node.imageResolutionTier ?? defaultImageResolutionTier,
                  ).map((option) => ({
                    value: option.ratio,
                    label: getImageAspectOptionLabel(option),
                  }))}
                />
              </label>
              <label className="node-inline-story-inline-field node-inline-image-field-compact">
                <span className="node-inline-story-inline-label">质量</span>
                <InlineOptionSelect
                  value={node.imageQuality ?? defaultImageQuality}
                  ariaLabel="图片质量"
                  menuKey={`node-inline-image-quality:${node.id}`}
                  openMenuKey={openInlineSelectKey}
                  setOpenMenuKey={setOpenInlineSelectKey}
                  variant="compact"
                  onChange={(value) =>
                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      imageQuality: value as ImageQuality,
                    }))
                  }
                  options={imageQualityOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </label>
            </div>
          ) : null}
          {node.kind === 'video' ? (
            <>
              <div className="node-inline-media-grid node-inline-video-grid">
                <label className="node-inline-story-inline-field">
                  <span className="node-inline-story-inline-label">类型</span>
                  <InlineOptionSelect
                    ariaLabel="节点类型"
                    value={node.seedanceScenario ?? 'text_to_video'}
                    menuKey={`node-inline-video-scenario:${node.id}`}
                    openMenuKey={openInlineSelectKey}
                    setOpenMenuKey={setOpenInlineSelectKey}
                    variant="compact"
                    onChange={(value) => onHandleVideoScenarioChange(node.id, value as SeedanceScenario)}
                    options={getVideoScenarioOptions().map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </label>
                <label className="node-inline-story-inline-field">
                  <span className="node-inline-story-inline-label">调用格式</span>
                  <InlineOptionSelect
                    ariaLabel="节点模型调用格式"
                    value={getVideoModelFormat(node)}
                    menuKey={`node-inline-video-format:${node.id}`}
                    openMenuKey={openInlineSelectKey}
                    setOpenMenuKey={setOpenInlineSelectKey}
                    variant="compact"
                    onChange={(value) => {
                      const nextFormat = value as VideoModelFormat;
                      const nodeForFormat = {
                        ...node,
                        videoModelFormat: nextFormat,
                        modelId: isSoraCompatibleVideoFormat(nextFormat) ? nextFormat : node.modelId,
                      };
                      const nextProviders = findProvidersForNodeWithProviders(providers, nodeForFormat);
                      const nextProvider = nextProviders.find(
                        (provider) => provider.id === node.providerId,
                      ) ?? nextProviders[0];
                      const nextModel = nextProvider
                        ? findProviderModelsForNodeWithSpecificProvider(nodeForFormat, nextProvider)[0]
                        : undefined;
                      const nextProviderModelId = nextModel?.providerModelId;
                      const nextCanonicalModel =
                        isSoraCompatibleVideoFormat(nextFormat)
                          ? nextFormat
                          : nextModel && isSeedanceVideoModel(nextModel.canonicalModelId)
                            ? nextModel.canonicalModelId
                            : 'seedance2.0';
                      const nextCapabilities = getVideoCapabilities(nextCanonicalModel);

                      onUpdateNode(node.id, (current) => ({
                        ...current,
                        videoModelFormat: nextFormat,
                        providerId: nextProvider?.id,
                        providerModelId: nextProviderModelId,
                        modelId: nextCanonicalModel,
                        videoResolution: nextCapabilities.supportedResolutions.includes(
                          current.videoResolution ?? '720p',
                        )
                          ? current.videoResolution
                          : nextCapabilities.supportedResolutions[0],
                        videoRatio: nextCapabilities.supportedRatios.includes(
                          current.videoRatio ?? getDefaultVideoRatio(nextCanonicalModel),
                        )
                          ? current.videoRatio ?? getDefaultVideoRatio(nextCanonicalModel)
                          : getDefaultVideoRatio(nextCanonicalModel),
                        videoDurationSeconds: normalizeVideoDurationSeconds(
                          nextCanonicalModel,
                          current.videoDurationSeconds ?? 5,
                        ),
                        videoFramesPerSecond: nextCapabilities.fixedFrameRate,
                      }));
                    }}
                    options={getVideoModelOptions({
                      allowSoraFormat: nodeSoraFormatAvailable,
                    }).map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </label>
              </div>
              <div className="node-inline-media-grid node-inline-video-grid node-inline-video-grid-secondary">
                <label className="node-inline-story-inline-field">
                  <span className="node-inline-story-inline-label">分辨率</span>
                  <InlineOptionSelect
                    ariaLabel="节点分辨率"
                    value={node.videoResolution ?? getVideoCapabilities(node.modelId).supportedResolutions[0] ?? '720p'}
                    menuKey={`node-inline-video-resolution:${node.id}`}
                    openMenuKey={openInlineSelectKey}
                    setOpenMenuKey={setOpenInlineSelectKey}
                    variant="compact"
                    options={getVideoCapabilities(node.modelId).supportedResolutions.map((resolution) => ({
                      value: resolution,
                      label: resolution,
                    }))}
                    onChange={(resolution) =>
                      onUpdateNode(node.id, (current) => ({
                        ...current,
                        videoResolution: resolution as '480p' | '720p' | '1080p',
                      }))
                    }
                  />
                </label>
                <label className="node-inline-story-inline-field">
                  <span className="node-inline-story-inline-label">比例</span>
                  <InlineOptionSelect
                    ariaLabel="节点比例"
                    value={node.videoRatio ?? getDefaultVideoRatio(node.modelId)}
                    menuKey={`node-inline-video-ratio:${node.id}`}
                    openMenuKey={openInlineSelectKey}
                    setOpenMenuKey={setOpenInlineSelectKey}
                    variant="compact"
                    options={getVideoCapabilities(node.modelId).supportedRatios.map((ratio) => ({
                      value: ratio,
                      label: ratio === 'adaptive' ? 'adaptive' : ratio,
                    }))}
                    onChange={(ratio) =>
                      onUpdateNode(node.id, (current) => ({
                        ...current,
                        videoRatio: ratio as SeedanceRatio,
                      }))
                    }
                  />
                </label>
                <div className="node-inline-story-inline-field node-inline-readonly-field">
                  <span className="node-inline-story-inline-label">帧率</span>
                  <strong>{node.videoFramesPerSecond ?? getVideoCapabilities(node.modelId).fixedFrameRate}fps</strong>
                </div>
              </div>
              <div className="node-inline-duration-row">
                <label className="node-inline-duration-label" htmlFor={`node-inline-duration-${node.id}`}>
                  <span>时长</span>
                  <strong>{node.videoDurationSeconds === -1 ? 'Auto' : `${node.videoDurationSeconds ?? 5}s`}</strong>
                </label>
                <input
                  id={`node-inline-duration-${node.id}`}
                  className="node-inline-duration-range"
                  aria-label="节点时长"
                  type="range"
                  min={getVideoDurationInputBounds(node.modelId).min}
                  max={getVideoDurationInputBounds(node.modelId).max}
                  step={1}
                  value={
                    node.videoDurationSeconds === -1
                      ? getVideoCapabilities(node.modelId).durationRangeSeconds.min
                      : node.videoDurationSeconds ?? 5
                  }
                  disabled={node.videoDurationSeconds === -1}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onUpdateNode(node.id, (current) => ({
                      ...current,
                      videoDurationSeconds: normalizeVideoDurationSeconds(
                        current.modelId,
                        Number(event.target.value),
                      ),
                    }))
                  }
                />
                <label className="node-inline-duration-toggle" title="自动时长">
                  <input
                    aria-label="节点自动时长"
                    title="自动时长"
                    type="checkbox"
                    checked={node.videoDurationSeconds === -1}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onUpdateNode(node.id, (current) => ({
                        ...current,
                        videoDurationSeconds: event.target.checked
                          ? -1
                          : normalizeVideoDurationSeconds(
                              current.modelId,
                              current.videoDurationSeconds === -1
                                ? getVideoCapabilities(current.modelId).durationRangeSeconds.min
                                : current.videoDurationSeconds ?? 5,
                            ),
                      }))
                    }
                  />
                </label>
              </div>
            </>
          ) : null}
          {node.kind !== 'story' ? (
            <p>
              {providersForNode.length > 0
                ? `可用供应商：${providersForNode.map((provider) => provider.name).join('、')}`
                : isChatLikeNode(node)
                  ? '对话模型供应商待配置'
                  : '模型供应商待配置'}
            </p>
          ) : null}
          {node.kind !== 'story' ? (
            <PromptTextarea
              canvas={activeCanvas}
              node={node}
              ariaLabel="节点提示词"
              placeholder={getNodePromptPlaceholder(node)}
              stopPointerDown
              onChange={(value) =>
                onUpdateNode(node.id, (current) => ({
                  ...current,
                  prompt: value,
                }))
              }
            />
          ) : null}
          {node.kind === 'video' ? (
            <>
              <div className="node-inline-video-actions">
                <button
                  type="button"
                  className="node-inline-generate-button node-inline-video-generate-button"
                  disabled={isGenerating}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => void onSubmitNodeGeneration(node)}
                >
                  {isGenerating ? '提交中' : '生成'}
                </button>
              </div>
              {node.generationId ? (
                <p className="node-generation-id">生成ID：{node.generationId}</p>
              ) : null}
            </>
          ) : node.kind === 'story' ? (
            node.generationId ? <p className="node-generation-id">生成ID：{node.generationId}</p> : null
          ) : (
            <button
              type="button"
              className="node-inline-generate-action"
              disabled={isGenerating}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void onSubmitNodeGeneration(node)}
            >
              {isGenerating ? '提交中' : '生成'}
            </button>
          )}
          {node.generationError ? <p className="node-error">{node.generationError}</p> : null}
          {node.outputDataUrl || node.outputUrl ? (
            node.kind === 'video' ? (
              <>
                <div className="node-preview-stage node-output-preview-stage">
                  <video className="asset-preview" src={node.outputDataUrl ?? node.outputUrl} controls />
                </div>
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
              <div className="node-preview-stage node-output-preview-stage">
                <img
                  className="asset-preview"
                  src={node.outputDataUrl ?? node.outputUrl}
                  alt={`${node.title} 输出`}
                />
              </div>
            )
          ) : null}
          {isGenerating ? (
            <StreamingOutputTail text={effectiveOutputText ?? ''} />
          ) : effectiveOutputText ? (
            isLongOutput ? (
              <>
                <div className="node-output-summary">{summarizeOutputText(effectiveOutputText)}</div>
                <button
                  type="button"
                  className="node-output-open"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onOpenOutputEditor(node)}
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
  );
}, areCanvasNodeBodyPropsEqual);

function areCanvasNodeBodyPropsEqual(
  previous: Readonly<CanvasNodeBodyProps>,
  next: Readonly<CanvasNodeBodyProps>,
): boolean {
  return (
    previous.activeCanvas === next.activeCanvas &&
    previous.node === next.node &&
    previous.providers === next.providers &&
    previous.isGenerating === next.isGenerating &&
    previous.effectiveOutputText === next.effectiveOutputText &&
    previous.openInlineSelectKey === next.openInlineSelectKey &&
    previous.rootDirectoryReady === next.rootDirectoryReady &&
    previous.folderStorageReady === next.folderStorageReady
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

function buildSeedanceReferenceFilename(
  node: CanvasNodeView,
  candidate: {
    nodeId: string;
    kind: 'image' | 'video' | 'audio';
  },
  mimeType?: string,
): string {
  const extension = getMediaExtensionFromMimeType(mimeType, candidate.kind);
  return `${sanitizeObjectKeySegment(node.id)}-${sanitizeObjectKeySegment(candidate.nodeId)}-${Date.now()}${extension}`;
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

  if (kind === 'story') {
    return FileText;
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
      return 'OpenAI / Sora 格式';
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

function getAssetFilterLabel(filter: AssetFilter | CanvasAssetFileKind): string {
  switch (filter) {
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
    case 'file':
      return '文件';
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

function isSeedanceVideoModel(modelId: string): modelId is SeedanceModelId {
  return modelId === 'seedance2.0' || modelId === 'seedance2.0-fast';
}

function isSeedanceSoraVideoModel(modelId: string): modelId is 'seedance-sora' {
  return modelId === 'seedance-sora' || modelId === 'sora-2';
}

function getVideoModelFormat(node: Pick<CanvasNodeView, 'modelId' | 'videoModelFormat'>): VideoModelFormat {
  if (node.videoModelFormat) {
    return node.videoModelFormat;
  }

  if (node.modelId === 'sora-ch1') {
    return 'sora-ch1';
  }

  return isSeedanceSoraVideoModel(node.modelId) ? 'seedance-sora' : 'seedance';
}

function getResolvedVideoModelId(
  node: Pick<CanvasNodeView, 'kind' | 'modelId' | 'videoModelFormat' | 'providerModelId'>,
  providerModels: Array<{ canonicalModelId: string; providerModelId: string }>,
): VideoModelFormat | SeedanceModelId {
  const videoFormat = getVideoModelFormat(node);
  if (isSoraCompatibleVideoFormat(videoFormat)) {
    return videoFormat;
  }

  if (isSeedanceVideoModel(node.modelId)) {
    return node.modelId;
  }

  const selectedModel = providerModels.find(
    (model) => model.providerModelId === node.providerModelId,
  );
  if (selectedModel && isSeedanceVideoModel(selectedModel.canonicalModelId)) {
    return selectedModel.canonicalModelId;
  }

  const firstSeedanceModel = providerModels.find((model) =>
    isSeedanceVideoModel(model.canonicalModelId),
  );
  if (firstSeedanceModel && isSeedanceVideoModel(firstSeedanceModel.canonicalModelId)) {
    return firstSeedanceModel.canonicalModelId;
  }

  return 'seedance2.0';
}

function getSeedanceConfigModel(modelId: string): SeedanceModelId | null {
  if (isSeedanceVideoModel(modelId)) {
    return modelId;
  }

  if (isSeedanceSoraVideoModel(modelId)) {
    return 'seedance2.0';
  }

  if (modelId === 'sora-ch1') {
    return 'seedance2.0';
  }

  return null;
}

function getVideoCapabilities(modelId: string): VideoCapabilities {
  const seedanceConfigModel = getSeedanceConfigModel(modelId);
  if (seedanceConfigModel) {
    return getSeedanceCapabilities(seedanceConfigModel);
  }

  return {
    supportedResolutions: ['720p', '1080p'],
    supportedRatios: ['16:9', '9:16', '1:1'],
    durationRangeSeconds: {
      min: 1,
      max: 20,
      supportsAuto: false,
    },
    fixedFrameRate: 24,
  };
}

function getDefaultVideoRatio(modelId: string): SeedanceRatio {
  const seedanceConfigModel = getSeedanceConfigModel(modelId);
  return seedanceConfigModel ? getDefaultSeedanceRatio(seedanceConfigModel) : '16:9';
}

function normalizeVideoDurationSeconds(modelId: string, value: number): number {
  const seedanceConfigModel = getSeedanceConfigModel(modelId);
  if (seedanceConfigModel) {
    return normalizeSeedanceDurationSeconds(seedanceConfigModel, value);
  }

  const capabilities = getVideoCapabilities(modelId);
  if (!Number.isFinite(value)) {
    return capabilities.durationRangeSeconds.min;
  }

  return Math.min(
    capabilities.durationRangeSeconds.max,
    Math.max(capabilities.durationRangeSeconds.min, Math.round(value)),
  );
}

function getVideoDurationInputBounds(modelId: string): { min: number; max: number } {
  const seedanceConfigModel = getSeedanceConfigModel(modelId);
  if (seedanceConfigModel) {
    return getSeedanceDurationInputBounds(seedanceConfigModel);
  }

  return getVideoCapabilities(modelId).durationRangeSeconds;
}

function getVisibleVideoFields(modelId: string, scenario: SeedanceScenario) {
  const seedanceConfigModel = getSeedanceConfigModel(modelId);
  if (seedanceConfigModel) {
    return getVisibleSeedanceFields({ model: seedanceConfigModel, scenario });
  }

  return ['prompt', 'resolution', 'ratio', 'duration', 'framespersecond'] as const;
}

function getVideoNodeSettingBadges(node: CanvasNodeView): string[] {
  const model = node.modelId || 'seedance2.0';
  const capabilities = getVideoCapabilities(model);
  const resolution = node.videoResolution ?? capabilities.supportedResolutions[0] ?? '720p';
  const ratio = node.videoRatio ?? getDefaultVideoRatio(model);
  const duration = node.videoDurationSeconds ?? 5;
  const durationLabel = duration === -1 ? 'Auto 时长' : `${duration}s`;
  const frameRate = node.videoFramesPerSecond ?? capabilities.fixedFrameRate;

  return [resolution, ratio === 'adaptive' ? 'Adaptive' : ratio, durationLabel, `${frameRate}fps`];
}

function getNodeSettingSummaryText(node: CanvasNodeView): string | null {
  if (node.kind === 'image') {
    return getImageNodeSettingBadges(node).join(' · ');
  }

  if (node.kind === 'video') {
    const format = getVideoModelFormat(node) === 'seedance-sora' ? 'sora' : getVideoModelFormat(node);
    return [
      getVideoScenarioOptions().find((option) => option.value === (node.seedanceScenario ?? 'text_to_video'))
        ?.label,
      format,
      ...getVideoNodeSettingBadges(node),
      `预计输出 ${getEstimatedVideoTokens(node) ?? 0} tokens`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return null;
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
  const model = node.modelId || 'seedance2.0';
  const capabilities = getVideoCapabilities(model);
  const duration = node.videoDurationSeconds;

  if (duration === -1) {
    return capabilities.durationRangeSeconds.min;
  }

  return duration ?? 5;
}

function getEstimatedVideoTokens(node: CanvasNodeView): number | null {
  if (node.kind !== 'video') {
    return null;
  }

  const model = node.modelId || 'seedance2.0';
  const billingModel = getSeedanceConfigModel(model);
  if (!billingModel) {
    return null;
  }
  const resolution =
    node.videoResolution ?? getVideoCapabilities(model).supportedResolutions[0] ?? '720p';
  const ratio = node.videoRatio ?? getDefaultVideoRatio(model);
  const framesPerSecond = node.videoFramesPerSecond ?? getVideoCapabilities(model).fixedFrameRate ?? 24;

  return estimateSeedanceTokens({
    resolution,
    ratio,
    duration: getEstimatedVideoDurationSeconds(node),
    framespersecond: framesPerSecond,
    scenario: node.seedanceScenario ?? 'text_to_video',
    model: billingModel,
    generateAudio: node.videoGenerateAudio ?? true,
    multimodalCount: 0,
  });
}

function getVideoScenarioOptions(): Array<{ value: SeedanceScenario; label: string }> {
  return [
    { value: 'text_to_video', label: '文生视频' },
    { value: 'image_to_video_first_frame', label: '首帧图生视频' },
    { value: 'image_to_video_first_last_frame', label: '首尾帧图生视频' },
    { value: 'multimodal_reference_video', label: '多模态参考视频' },
  ];
}

function getVideoModelOptions(input?: {
  allowSoraFormat?: boolean;
}): Array<{ value: VideoModelFormat; label: string }> {
  const options: Array<{ value: VideoModelFormat; label: string }> = [
    { value: 'seedance', label: 'seedance' },
  ];

  if (input?.allowSoraFormat) {
    options.push({ value: 'seedance-sora', label: 'sora' });
    options.push({ value: 'sora-ch1', label: 'sora-ch1' });
  }

  return options;
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

function getVideoModelFormatHint(format: VideoModelFormat): string | null {
  if (format === 'seedance-sora') {
    return '当前节点会按 sora 调用格式提交，请在下方选择实际供应商模型。';
  }

  if (format === 'sora-ch1') {
    return '当前节点会按 sora-ch1 调用格式提交，参考图写入 metadata.refrenceImage，参考视频写入 metadata.refrenceVideo。';
  }

  return '当前节点会按 seedance 调用格式提交，下方供应商模型决定使用标准版还是 Fast。';
}

function getDiamondMaskColorLabel(color: DiamondMaskColor): string {
  const labels: Record<DiamondMaskColor, string> = {
    white: '白色',
    red: '红色',
    yellow: '黄色',
    blue: '蓝色',
    green: '绿色',
  };

  return labels[color];
}

function getDiamondMaskSource(node: CanvasNodeView): string | undefined {
  return node.maskImageDataUrl;
}

function DiamondMaskNodeBody({
  node,
  canChooseSource,
  onReplaceImage,
  onSelectAsset,
  onRequireStorage,
  onUpdateNode,
  onGenerate,
}: DiamondMaskNodeBodyProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageSource = getDiamondMaskSource(node);
  const imageWidth = Math.max(1, node.maskImageWidth ?? 1);
  const imageHeight = Math.max(1, node.maskImageHeight ?? 1);
  const rect = node.maskRect
    ? normalizeDiamondMaskRect(node.maskRect, imageWidth, imageHeight)
    : createDefaultDiamondMaskRect(imageWidth, imageHeight);
  const lineWidth = normalizeDiamondMaskLineWidth(node.maskLineWidth ?? 1);
  const density = normalizeDiamondMaskDensity(node.maskGridDensity ?? 38);
  const color = node.maskColor ?? 'white';
  const lines = useMemo(
    () => buildDiamondMaskLineSegments(rect, density),
    [rect.x, rect.y, rect.width, rect.height, density],
  );
  const storageHint = '请先选择画布存储文件夹，再导入或选择遮罩图片。';
  const uploadButtonTitle = canChooseSource
    ? '导入并保存遮罩图片到当前画布文件夹'
    : storageHint;
  const assetButtonTitle = canChooseSource
    ? '从当前画布资产中选择遮罩图片'
    : storageHint;

  function handleChooseImage() {
    if (!canChooseSource) {
      onRequireStorage();
      return;
    }

    fileInputRef.current?.click();
  }

  function handleChooseAsset() {
    if (!canChooseSource) {
      onRequireStorage();
      return;
    }

    onSelectAsset();
  }

  function updateMaskRect(nextRect: DiamondMaskRect) {
    onUpdateNode((current) => ({
      ...current,
      maskRect: normalizeDiamondMaskRect(nextRect, imageWidth, imageHeight),
    }));
  }

  function startMove(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget.closest('.diamond-mask-stage');
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = rect;
    const scaleX = imageWidth / bounds.width;
    const scaleY = imageHeight / bounds.height;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      updateMaskRect({
        ...startRect,
        x: startRect.x + (moveEvent.clientX - startX) * scaleX,
        y: startRect.y + (moveEvent.clientY - startY) * scaleY,
      });
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, handle: DiamondMaskResizeHandle) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget.closest('.diamond-mask-stage');
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = rect;
    const scaleX = imageWidth / bounds.width;
    const scaleY = imageHeight / bounds.height;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;
      let nextRect = { ...startRect };

      if (handle.includes('w')) {
        nextRect = {
          ...nextRect,
          x: startRect.x + dx,
          width: startRect.width - dx,
        };
      }

      if (handle.includes('e')) {
        nextRect = {
          ...nextRect,
          width: startRect.width + dx,
        };
      }

      if (handle.includes('n')) {
        nextRect = {
          ...nextRect,
          y: startRect.y + dy,
          height: startRect.height - dy,
        };
      }

      if (handle.includes('s')) {
        nextRect = {
          ...nextRect,
          height: startRect.height + dy,
        };
      }

      updateMaskRect(nextRect);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  return (
    <div className="diamond-mask-node">
      {imageSource ? (
        <div
          className="diamond-mask-stage"
          style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <img
            src={imageSource}
            alt={node.maskImageName ?? '遮罩图片'}
            onLoad={(event) => {
              const image = event.currentTarget;
              const nextWidth = image.naturalWidth;
              const nextHeight = image.naturalHeight;
              const needsUpdate =
                node.maskImageWidth !== nextWidth ||
                node.maskImageHeight !== nextHeight ||
                !node.maskRect;

              if (!needsUpdate) {
                return;
              }

              onUpdateNode((current) => ({
                ...current,
                maskImageWidth: nextWidth,
                maskImageHeight: nextHeight,
                maskRect: current.maskRect
                  ? normalizeDiamondMaskRect(current.maskRect, nextWidth, nextHeight)
                  : createDefaultDiamondMaskRect(nextWidth, nextHeight),
              }));
            }}
          />
          <svg
            className="diamond-mask-overlay"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <clipPath id={`diamond-mask-clip-${node.id}`}>
                <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
              </clipPath>
            </defs>
            <g clipPath={`url(#diamond-mask-clip-${node.id})`}>
              {lines.map((line, index) => (
                <line
                  key={`${index}-${line.x1}-${line.y1}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={diamondMaskColorValues[color]}
                  strokeWidth={lineWidth}
                  opacity={0.82}
                />
              ))}
            </g>
          </svg>
          <div
            className="diamond-mask-box"
            style={{
              left: `${(rect.x / imageWidth) * 100}%`,
              top: `${(rect.y / imageHeight) * 100}%`,
              width: `${(rect.width / imageWidth) * 100}%`,
              height: `${(rect.height / imageHeight) * 100}%`,
            }}
            onPointerDown={startMove}
          >
            {(['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'] as DiamondMaskResizeHandle[]).map(
              (handle) => (
                <button
                  key={handle}
                  type="button"
                  className={`diamond-mask-handle diamond-mask-handle-${handle}`}
                  aria-label={`缩放遮罩范围 ${handle}`}
                  onPointerDown={(event) => startResize(event, handle)}
                />
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="diamond-mask-actions">
          <button
            type="button"
            className={`asset-upload diamond-mask-upload diamond-mask-upload-button${
              canChooseSource ? '' : ' is-disabled'
            }`}
            aria-disabled={canChooseSource ? undefined : 'true'}
            title={uploadButtonTitle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleChooseImage}
          >
            选择图片
          </button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/*"
            disabled={!canChooseSource}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onReplaceImage(file);
                event.target.value = '';
              }
            }}
          />
          <button
            type="button"
            aria-disabled={canChooseSource ? undefined : 'true'}
            className={canChooseSource ? '' : 'is-disabled'}
            title={assetButtonTitle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleChooseAsset}
          >
            选择资产
          </button>
        </div>
      )}
      {!imageSource && !canChooseSource ? (
        <p className="diamond-mask-storage-hint">{storageHint}</p>
      ) : null}
      <div className="diamond-mask-controls">
        <label>
          <span>
            线宽
            <strong>{lineWidth}px</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={lineWidth}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              onUpdateNode((current) => ({
                ...current,
                maskLineWidth: normalizeDiamondMaskLineWidth(Number(event.target.value)),
              }))
            }
          />
        </label>
        <label>
          <span>
            网格密度
            <strong>{density}</strong>
          </span>
          <input
            type="range"
            min={20}
            max={70}
            step={1}
            value={density}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              onUpdateNode((current) => ({
                ...current,
                maskGridDensity: normalizeDiamondMaskDensity(Number(event.target.value)),
              }))
            }
          />
        </label>
      </div>
      <div className="diamond-mask-color-row" aria-label="遮罩颜色">
        <span className="diamond-mask-color-label">颜色</span>
        {(['white', 'red', 'yellow', 'blue', 'green'] as DiamondMaskColor[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`选择${getDiamondMaskColorLabel(option)}`}
            title={getDiamondMaskColorLabel(option)}
            className={option === color ? 'is-active' : ''}
            style={{ '--mask-color': diamondMaskColorValues[option] } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              onUpdateNode((current) => ({
                ...current,
                maskColor: option,
              }))
            }
          />
        ))}
      </div>
      <div className="diamond-mask-actions diamond-mask-bottom-actions">
        {imageSource ? (
          <label className="asset-upload diamond-mask-replace">
            替换图片
            <input
              type="file"
              accept="image/*"
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onReplaceImage(file);
                  event.target.value = '';
                }
              }}
            />
          </label>
        ) : null}
        {imageSource ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onSelectAsset}
          >
            选择资产
          </button>
        ) : null}
        <button
          type="button"
          disabled={!imageSource || !node.maskImageWidth || !node.maskImageHeight}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onGenerate}
        >
          生成遮罩图
        </button>
      </div>
    </div>
  );
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

function isLegacyStarterCanvas(canvas: CanvasView): boolean {
  const name = canvas.name.trim();

  if (name === '产品短片') {
    return canvas.updatedAt === '示例' || (canvas.nodes.length === 0 && canvas.edges.length === 0);
  }

  if (name === '新画布 1') {
    return canvas.nodes.length === 0 && canvas.edges.length === 0;
  }

  if (name !== '默认画布' || canvas.updatedAt !== '刚刚' || canvas.nodes.length < 3) {
    return false;
  }

  const modelIds = new Set(canvas.nodes.map((node) => node.modelId));
  return modelIds.has('gpt-image-2') && modelIds.has('seedance2.0');
}

function removeLegacyStarterCanvases(state: CanvasWorkspaceState): CanvasWorkspaceState {
  const canvases = state.canvases.filter((canvas) => !isLegacyStarterCanvas(canvas));

  if (canvases.length === state.canvases.length) {
    return state;
  }

  const canvasIds = new Set(canvases.map((canvas) => canvas.id));
  const nodeIds = new Set(canvases.flatMap((canvas) => canvas.nodes.map((node) => node.id)));

  return {
    ...state,
    activeCanvasId: canvasIds.has(state.activeCanvasId) ? state.activeCanvasId : canvases[0]?.id ?? '',
    canvases,
    generationHistory: state.generationHistory?.filter((record) => nodeIds.has(record.nodeId)) ?? [],
  };
}

function persistWorkspaceStateToLocalStorage(state: CanvasWorkspaceState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));
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
  const canvasPlaneRef = useRef<HTMLDivElement>(null);
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
  const [isCanvasNavigationActive, setIsCanvasNavigationActive] = useState(false);
  const providerVideoHistoryRequestIdRef = useRef(0);
  const pendingStoryAutoRunNodeIdsRef = useRef<{
    nodeIds: string[];
    imageConcurrencyLimit: number;
    videoConcurrencyLimit: number;
  } | null>(null);
  const generatedNodeIdRef = useRef(0);
  const [showProviderManager, setShowProviderManager] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [canvasAssets, setCanvasAssets] = useState<CanvasAssetFile[]>([]);
  const [loadingCanvasAssets, setLoadingCanvasAssets] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspaceState, setWorkspaceStateRaw] = useState(() => {
    if (typeof window === 'undefined') {
      return initialWorkspaceState;
    }

    return removeLegacyStarterCanvases(
      parseWorkspaceState(window.localStorage.getItem(workspaceStorageKey), initialWorkspaceState),
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
  const [openInlineSelectKey, setOpenInlineSelectKey] = useState<string | null>(null);
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [selectedOutputVersionId, setSelectedOutputVersionId] = useState<string | null>(null);
  const [outputVersionPage, setOutputVersionPage] = useState(1);
  const [draftOutputText, setDraftOutputText] = useState('');
  const [outputEditorMode, setOutputEditorMode] = useState<'preview' | 'edit'>('preview');
  const [outputModalPosition, setOutputModalPosition] = useState({ x: 0, y: 0 });
  const [outputSelectionToolbar, setOutputSelectionToolbar] =
    useState<OutputSelectionToolbarState | null>(null);
  const outputPreviewRef = useRef<HTMLDivElement | null>(null);
  const outputSelectionToolbarPointerDownRef = useRef(false);
  const outputSelectionRangesRef = useRef<Range[]>([]);
  const outputSelectionSyncingRef = useRef(false);
  const canvasNavigationTimeoutRef = useRef<number | null>(null);
  const viewportPersistenceTimeoutRef = useRef<number | null>(null);
  const previousActiveCanvasIdRef = useRef(workspaceState.activeCanvasId);
  const viewportRef = useRef(viewport);
  const scheduledViewportRef = useRef<CanvasViewport | null>(null);
  const scheduledViewportFrameRef = useRef<number | null>(null);
  const stableVisibleCanvasNodesRef = useRef<CanvasNodeView[]>([]);
  const stableVisibleCanvasEdgesRef = useRef<CanvasView['edges']>([]);

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

  function scheduleViewportUpdate(
    action: CanvasViewport | ((current: CanvasViewport) => CanvasViewport),
  ) {
    const baseViewport = scheduledViewportRef.current ?? viewportRef.current;
    const nextViewport =
      typeof action === 'function'
        ? (action as (current: CanvasViewport) => CanvasViewport)(baseViewport)
        : action;

    scheduledViewportRef.current = nextViewport;
    viewportRef.current = nextViewport;

    if (scheduledViewportFrameRef.current !== null || typeof window === 'undefined') {
      return;
    }

    scheduledViewportFrameRef.current = window.requestAnimationFrame(() => {
      scheduledViewportFrameRef.current = null;
      const pendingViewport = scheduledViewportRef.current;

      if (!pendingViewport) {
        return;
      }

      scheduledViewportRef.current = null;
      applyViewportToCanvasPlane(pendingViewport);
    });
  }

  function applyViewportToCanvasPlane(nextViewport: CanvasViewport) {
    const canvasPlane = canvasPlaneRef.current;

    if (!canvasPlane) {
      return;
    }

    canvasPlane.style.transform = `translate3d(${nextViewport.x}px, ${nextViewport.y}px, 0) scale(${nextViewport.scale})`;
  }

  function commitViewportState(nextViewport = viewportRef.current) {
    if (!isSameViewport(viewportRef.current, nextViewport)) {
      viewportRef.current = nextViewport;
    }

    setViewport((current) => (isSameViewport(current, nextViewport) ? current : nextViewport));
  }

  function persistViewportForCanvas(canvasId: string, nextViewport: CanvasViewport) {
    if (!canvasId) {
      return;
    }

    setCanvasViewports((current) => {
      const previous = current[canvasId];

      if (previous && isSameViewport(previous, nextViewport)) {
        return current;
      }

      return {
        ...current,
        [canvasId]: nextViewport,
      };
    });
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
  const isCanvasNavigating =
    Boolean(dragState) || Boolean(minimapDragState) || isCanvasNavigationActive;
  const shouldFreezeVisibleCanvas =
    dragState?.mode === 'pan' || Boolean(minimapDragState) || isCanvasNavigationActive;
  const filteredCanvasAssets =
    assetFilter === 'all'
      ? canvasAssets
      : canvasAssets.filter((asset) => asset.kind === assetFilter);
  const assetPickerAssets = assetPickerTarget
    ? canvasAssets.filter((asset) => asset.kind === assetPickerTarget.kind)
    : [];
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
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const renderedCanvasNodeMap = useMemo(
    () => new Map(renderedCanvasNodes.map((node) => [node.id, node])),
    [renderedCanvasNodes],
  );
  const [measuredNodeHeights, setMeasuredNodeHeights] = useState<Map<string, number>>(
    () => new Map(),
  );
  const nodeHeightObserverRef = useRef<ResizeObserver | null>(null);
  // 在 render 阶段 lazy 创建 observer（而非 useEffect/passive effect），确保 article 的
  // ref callback（commit 阶段，早于 passive effect）执行时 observer 已就绪，节点能被真正
  // observe；否则 ref callback 先于 useEffect 运行、observer 仍为 null，测量永不生效。
  if (
    nodeHeightObserverRef.current === null &&
    typeof window !== 'undefined' &&
    typeof ResizeObserver !== 'undefined'
  ) {
    nodeHeightObserverRef.current = new ResizeObserver((entries) => {
      setMeasuredNodeHeights((previous) => {
        let next = previous;

        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const nodeId = element.dataset.nodeId;

          if (!nodeId) {
            continue;
          }

          const measured = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          const height = Math.round(measured);

          if (height > 0 && previous.get(nodeId) !== height) {
            if (next === previous) {
              next = new Map(previous);
            }
            next.set(nodeId, height);
          }
        }

        return next;
      });
    });
  }
  useEffect(() => {
    const observer = nodeHeightObserverRef.current;

    if (!observer) {
      return;
    }

    return () => {
      observer.disconnect();
    };
  }, []);
  const observeNodeElement = useCallback((element: HTMLElement | null) => {
    const observer = nodeHeightObserverRef.current;

    if (!observer || !element) {
      return;
    }

    observer.observe(element);
    return () => observer.unobserve(element);
  }, []);
  const visibleCanvasBounds = useMemo(
    () =>
      canvasSize && canvasSize.width > 0 && canvasSize.height > 0
        ? getCanvasViewportBounds(viewport, canvasSize, Math.max(240, 160 / Math.max(viewport.scale, 0.1)))
        : null,
    [canvasSize, viewport],
  );
  const nextVisibleCanvasNodes = useMemo(() => {
    if (!visibleCanvasBounds) {
      return renderedCanvasNodes;
    }

    return filterVisibleCanvasNodes(renderedCanvasNodes, visibleCanvasBounds, {
      selectedNodeId,
      selectedNodeIds: selectedNodeIdSet,
      measuredHeights: measuredNodeHeights,
    });
  }, [
    renderedCanvasNodes,
    selectedNodeId,
    selectedNodeIdSet,
    visibleCanvasBounds,
    measuredNodeHeights,
  ]);
  const visibleCanvasNodes = useMemo(() => {
    const previous = stableVisibleCanvasNodesRef.current;

    if (shouldFreezeVisibleCanvas && previous.length > 0) {
      return previous;
    }

    if (
      previous.length === nextVisibleCanvasNodes.length &&
      previous.every((node, index) => node === nextVisibleCanvasNodes[index])
    ) {
      return previous;
    }

    stableVisibleCanvasNodesRef.current = nextVisibleCanvasNodes;
    return nextVisibleCanvasNodes;
  }, [nextVisibleCanvasNodes, shouldFreezeVisibleCanvas]);
  const visibleCanvasNodeIdSet = useMemo(
    () => new Set(visibleCanvasNodes.map((node) => node.id)),
    [visibleCanvasNodes],
  );
  const nextVisibleCanvasEdges = useMemo(() => {
    if (!renderedActiveCanvas) {
      return [];
    }

    return renderedActiveCanvas.edges.filter(
      (edge) =>
        visibleCanvasNodeIdSet.has(edge.fromNodeId) || visibleCanvasNodeIdSet.has(edge.toNodeId),
    );
  }, [renderedActiveCanvas, visibleCanvasNodeIdSet]);
  const visibleCanvasEdges = useMemo(() => {
    const previous = stableVisibleCanvasEdgesRef.current;

    if (shouldFreezeVisibleCanvas && previous.length > 0) {
      return previous;
    }

    if (
      previous.length === nextVisibleCanvasEdges.length &&
      previous.every((edge, index) => edge === nextVisibleCanvasEdges[index])
    ) {
      return previous;
    }

    stableVisibleCanvasEdgesRef.current = nextVisibleCanvasEdges;
    return nextVisibleCanvasEdges;
  }, [nextVisibleCanvasEdges, shouldFreezeVisibleCanvas]);

  useEffect(() => {
    if (!editingOutputNodeId || outputEditorMode !== 'preview') {
      setOutputSelectionToolbar(null);
      outputSelectionRangesRef.current = [];
      return;
    }

    function handleSelectionChange() {
      if (outputSelectionToolbarPointerDownRef.current || outputSelectionSyncingRef.current) {
        return;
      }

      const preview = outputPreviewRef.current;
      const selection = window.getSelection();

      if (!preview || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setOutputSelectionToolbar(null);
        outputSelectionRangesRef.current = [];
        return;
      }

      const range = selection.getRangeAt(0);
      const commonAncestor =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;

      if (!commonAncestor || !preview.contains(commonAncestor)) {
        setOutputSelectionToolbar(null);
        outputSelectionRangesRef.current = [];
      }
    }

    function handleWindowResize() {
      setOutputSelectionToolbar(null);
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleWindowResize);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [editingOutputNodeId, outputEditorMode]);

  useLayoutEffect(() => {
    if (!editingOutputNodeId || outputEditorMode !== 'preview' || !outputSelectionToolbar) {
      return;
    }

    const selection = window.getSelection();
    const preview = outputPreviewRef.current;
    const preservedRanges = outputSelectionRangesRef.current;

    if (!selection || !preview || preservedRanges.length === 0) {
      outputSelectionSyncingRef.current = false;
      return;
    }

    const allRangesInsidePreview = preservedRanges.every((range) => {
      const commonAncestor =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;

      return commonAncestor ? preview.contains(commonAncestor) : false;
    });

    if (!allRangesInsidePreview) {
      outputSelectionSyncingRef.current = false;
      return;
    }

    selection.removeAllRanges();
    preservedRanges.forEach((range) => selection.addRange(range.cloneRange()));
    window.requestAnimationFrame(() => {
      outputSelectionSyncingRef.current = false;
    });
  }, [editingOutputNodeId, outputEditorMode, outputSelectionToolbar]);

  const selectedNode =
    activeCanvas?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const inspectedNode =
    activeCanvas?.nodes.find((node) => node.id === inspectedNodeId) ?? null;
  const selectedVideoScenario =
    selectedNode?.kind === 'video'
      ? selectedNode.seedanceScenario ?? 'text_to_video'
      : 'text_to_video';
  const selectedVideoFormat =
    selectedNode?.kind === 'video'
      ? getVideoModelFormat(selectedNode)
      : 'seedance';
  const selectedNodeProviderSelection =
    selectedNode ? resolveNodeProviderSelectionWithProviders(providers, selectedNode) : null;
  const selectedVideoProviderModels =
    selectedNode?.kind === 'video' ? findProviderModelsForNode(selectedNode) : [];
  const selectedVideoModel =
    selectedNode?.kind === 'video'
      ? getResolvedVideoModelId(selectedNode, selectedVideoProviderModels)
      : 'seedance2.0';
  const selectedVideoCapabilities =
    selectedNode?.kind === 'video'
      ? getVideoCapabilities(selectedVideoModel)
      : null;
  const selectedSeedanceConfigModel =
    selectedNode?.kind === 'video' ? getSeedanceConfigModel(selectedVideoModel) : null;
  const visibleVideoFields =
    selectedNode?.kind === 'video'
      ? getVisibleVideoFields(selectedVideoModel, selectedVideoScenario)
      : [];
  const selectedVideoReferenceCount =
    selectedNode?.kind === 'video' && activeCanvas
      ? countDirectVideoReferenceInputs(activeCanvas, selectedNode.id)
      : 0;
  const estimatedVideoTokens =
    selectedNode?.kind === 'video' && selectedSeedanceConfigModel
      ? estimateSeedanceTokens({
          model: selectedSeedanceConfigModel,
          resolution:
            selectedNode.videoResolution ??
            selectedVideoCapabilities?.supportedResolutions[0] ??
            '720p',
          ratio: selectedNode.videoRatio ?? getDefaultVideoRatio(selectedVideoModel),
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
  const selectedStoryStructuredOutput =
    selectedNode?.kind === 'story'
      ? resolveBestStoryStructuredOutput(
          selectedNode.storyStructuredOutput,
          selectedNode.storyRawOutput ?? selectedNode.modelOutputText ?? '',
        )
      : null;
  const editingOutputStoryStructuredOutput =
    editingOutputNode?.kind === 'story'
      ? resolveBestStoryStructuredOutput(
          editingOutputNode.storyStructuredOutput,
          editingOutputNode.storyRawOutput ?? editingOutputNode.modelOutputText ?? '',
        )
      : null;
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
  const soraFormatAvailable =
    providers.some((provider) =>
      provider.enabled &&
      provider.models.some(
        (model) => model.enabled && model.canonicalModelId === 'seedance-sora',
      ),
    );
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
  const minimapNodeElements = useMemo(
    () =>
      renderedCanvasNodes.map((node) => (
        <span
          key={node.id}
          className={`canvas-minimap-node is-${node.kind}`}
          style={{
            left: (node.x - minimapBounds.minX) * minimapScale,
            top: (node.y - minimapBounds.minY) * minimapScale,
            width: Math.max(12, getCanvasNodeWidth(node) * minimapScale),
            height: Math.max(8, getCanvasNodeHeight(node) * minimapScale),
          }}
        />
      )),
    [renderedCanvasNodes, minimapBounds.minX, minimapBounds.minY, minimapScale],
  );

  useEffect(
    () => () => {
      if (canvasNavigationTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(canvasNavigationTimeoutRef.current);
      }

      if (viewportPersistenceTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(viewportPersistenceTimeoutRef.current);
      }

      if (scheduledViewportFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(scheduledViewportFrameRef.current);
      }

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
      return node.kind === 'textAsset' || isChatLikeNode(node);
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
        const hasExplicitDesktopWorkspace =
          workspaceStore.kind !== 'desktop'
          || window.localStorage.getItem(desktopRootDirectoryStorageKey) !== null;
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
          {
            includeDiscoveredCanvases: hasExplicitDesktopWorkspace,
          },
        );
        const nextState = hasExplicitDesktopWorkspace
          ? restoredState
          : removeLegacyStarterCanvases(restoredState);
        if (!canceled) {
          setRootDirectoryHandle(handle);
          workspaceStateRef.current = nextState;
          savedWorkspaceStateRef.current = nextState;
          setWorkspaceState(nextState);
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

    if (providerRows.length === 0) {
      setSelectedProviderId(null);
      return;
    }

    if (!selectedProviderId || !providerRows.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(providerRows[0].id);
    }
  }, [providerRows, selectedProviderId, showProviderManager]);

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
    if (!pendingStoryAutoRunNodeIdsRef.current) {
      return;
    }

    const pendingAutoRun = pendingStoryAutoRunNodeIdsRef.current;
    pendingStoryAutoRunNodeIdsRef.current = null;
    void autoRunStoryGeneratedNodes(pendingAutoRun.nodeIds, {
      imageConcurrencyLimit: pendingAutoRun.imageConcurrencyLimit,
      videoConcurrencyLimit: pendingAutoRun.videoConcurrencyLimit,
    });
  }, [workspaceState]);

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

    const previousCanvasId = previousActiveCanvasIdRef.current;
    if (previousCanvasId && previousCanvasId !== activeCanvasId) {
      persistViewportForCanvas(previousCanvasId, viewportRef.current);
    }

    if (viewportPersistenceTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(viewportPersistenceTimeoutRef.current);
      viewportPersistenceTimeoutRef.current = null;
    }

    if (scheduledViewportFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(scheduledViewportFrameRef.current);
      scheduledViewportFrameRef.current = null;
    }

    scheduledViewportRef.current = null;

    const restoredViewport = canvasViewports[activeCanvasId] ?? defaultViewport;
    pendingViewportRestoreRef.current = {
      canvasId: activeCanvasId,
      viewport: restoredViewport,
    };
    previousActiveCanvasIdRef.current = activeCanvasId;
    viewportRef.current = restoredViewport;
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

    if (viewportPersistenceTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(viewportPersistenceTimeoutRef.current);
    }

    if (typeof window === 'undefined') {
      persistViewportForCanvas(activeCanvasId, viewport);
      return;
    }

    viewportPersistenceTimeoutRef.current = window.setTimeout(() => {
      viewportPersistenceTimeoutRef.current = null;
      persistViewportForCanvas(activeCanvasId, viewportRef.current);
    }, 140);
  }, [activeCanvasId, viewport]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (isTextEditingTarget(event.target)) {
        return;
      }

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
      const isEditingText = isTextEditingTarget(target);
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
        if (isEditingText) {
          return;
        }

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
        event.target.closest(
          '.output-modal, .canvas-asset-sidebar, .asset-picker-layer, .node-inspector, .inline-option-select, .inline-option-menu',
        )
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

  function openProviderSettingsView() {
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

  function openAssetPicker(target: AssetPickerTarget) {
    if (!rootDirectoryHandle || !folderStorageReady || !activeCanvas) {
      setCanvasMessage('请先选择画布存储文件夹，再选择当前画布资产。');
      return;
    }

    setAssetPickerTarget(target);
    void refreshCanvasAssets();
  }

  function selectCanvasAssetForTarget(asset: CanvasAssetFile) {
    const target = assetPickerTarget;
    if (!target || asset.kind !== target.kind || !asset.dataUrl) {
      setCanvasMessage('当前资产暂时无法读取，请刷新资产后重试。');
      return;
    }

    updateNode(target.nodeId, (current) => {
      if (target.purpose === 'diamondMask') {
        return {
          ...current,
          maskImageName: asset.name,
          maskImagePath: asset.path,
          maskImageDataUrl: asset.dataUrl,
          maskImageMimeType: asset.mimeType,
          maskImageWidth: undefined,
          maskImageHeight: undefined,
          maskRect: undefined,
        };
      }

      return {
        ...current,
        title:
          current.title === '图片' || current.title === '视频'
            ? getAssetKindLabel(asset.kind)
            : current.title,
        assetName: asset.name,
        assetPath: asset.path,
        assetDataUrl: asset.dataUrl,
        assetMimeType: asset.mimeType,
      };
    });
    setAssetPickerTarget(null);
    setCanvasMessage(`已选择资产：${asset.name}`);
  }

  function clearCanvasAssetReferences(assetPath: string) {
    updateActiveCanvasNodes((nodes) =>
      nodes.map((node) => {
        if (
          node.assetPath !== assetPath &&
          node.outputPath !== assetPath
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
    return screenToCanvasPoint(getCanvasLocalPointFromClient(clientX, clientY), viewportRef.current);
  }

  function startNodeResize(event: PointerEvent<HTMLButtonElement>, node: CanvasNodeView) {
    event.preventDefault();
    event.stopPropagation();

    const targetNode = event.currentTarget.closest('article.canvas-node');
    if (!(targetNode instanceof HTMLElement)) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = getCanvasNodeWidth(node);
    const startHeight = getCanvasNodeHeight(node);
    const minWidth = getCanvasNodeMinimumWidth(node);
    const minHeight = getCanvasNodeMinimumHeight(node);
    const bounds = targetNode.getBoundingClientRect();
    const scaleX = bounds.width / Math.max(targetNode.offsetWidth, 1);
    const scaleY = bounds.height / Math.max(targetNode.offsetHeight, 1);
    const nextScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : viewportRef.current.scale || 1;
    const nextScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : viewportRef.current.scale || 1;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const width = Math.max(minWidth, Math.round(startWidth + (moveEvent.clientX - startX) / nextScaleX));
      const height = Math.max(minHeight, Math.round(startHeight + (moveEvent.clientY - startY) / nextScaleY));

      updateNode(node.id, (current) => {
        if (
          current.width === width &&
          current.height === height &&
          current.minWidth === minWidth &&
          current.minHeight === minHeight
        ) {
          return current;
        }

        return {
          ...current,
          width,
          height,
          minWidth,
          minHeight,
        };
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
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

  function pulseCanvasNavigation(durationMs = 140) {
    setIsCanvasNavigationActive(true);

    if (canvasNavigationTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(canvasNavigationTimeoutRef.current);
    }

    if (typeof window === 'undefined') {
      return;
    }

    canvasNavigationTimeoutRef.current = window.setTimeout(() => {
      canvasNavigationTimeoutRef.current = null;
      commitViewportState();
      setIsCanvasNavigationActive(false);
    }, durationMs);
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
      return 'image_to_video_first_last_frame';
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
    const draftNode: CanvasNodeView = {
      id: nodeId,
      title: template.title,
      modelId: template.modelId,
      videoModelFormat:
        template.kind === 'video' ? getVideoModelFormat({ modelId: template.modelId }) : undefined,
      kind: template.kind,
      x: point.x,
      y: point.y,
      imageResolutionTier:
        template.kind === 'image' ? defaultImageResolutionTier : undefined,
      imageAspectRatio: template.kind === 'image' ? defaultImageAspectRatio : undefined,
      imageQuality: template.kind === 'image' ? defaultImageQuality : undefined,
      videoResolution: template.kind === 'video' ? '480p' : undefined,
      videoRatio:
        template.kind === 'video'
          ? '16:9'
          : undefined,
      videoFramesPerSecond:
        template.kind === 'video'
          ? getVideoCapabilities(template.modelId).fixedFrameRate
          : undefined,
      seedanceScenario: defaultVideoScenario,
      storyExecutionMode:
        template.kind === 'story' ? ('structure_only' as StoryNodeExecutionMode) : undefined,
      storyExpansionMode:
        template.kind === 'story' ? ('full' as StoryNodeExpansionMode) : undefined,
      storyImageConcurrencyLimit:
        template.kind === 'story' ? defaultStoryAutoRunConcurrencyLimits.image : undefined,
      storyVideoConcurrencyLimit:
        template.kind === 'story' ? defaultStoryAutoRunConcurrencyLimits.video : undefined,
      storyStructuredOutput:
        template.kind === 'story' ? createEmptyStoryStructuredOutput() : undefined,
      maskLineWidth: template.kind === 'diamondMask' ? 1 : undefined,
      maskGridDensity: template.kind === 'diamondMask' ? 38 : undefined,
      maskColor: template.kind === 'diamondMask' ? 'white' : undefined,
      textContent: template.kind === 'textAsset' ? '在这里输入文本' : undefined,
    };
    const draftProviderSelection = resolveNodeProviderSelectionWithProviders(providers, draftNode);
    const draftProviderModel = draftProviderSelection.availableModels.find(
      (model) => model.providerModelId === draftProviderSelection.effectiveProviderModelId,
    );
    const nextNode: CanvasNodeView = {
      ...draftNode,
      providerId: draftProviderSelection.selectedProvider?.id,
      providerModelId: draftProviderSelection.effectiveProviderModelId || undefined,
      modelId: getNextModelIdForNode(draftNode, draftProviderModel),
    };

    updateActiveCanvasNodes((nodes) => [
      ...nodes,
      nextNode,
    ]);
    if (addMenu?.fromNodeId && !template.outputOnly) {
      const toNode = {
        id: nodeId,
        title: template.title,
        modelId: template.modelId,
        videoModelFormat:
          template.kind === 'video' ? getVideoModelFormat({ modelId: template.modelId }) : undefined,
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

  async function replaceDiamondMaskImage(nodeId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      setCanvasMessage('请选择图片文件。');
      return;
    }

    if (!activeCanvas) {
      return;
    }

    if (!rootDirectoryHandle || !folderStorageReady) {
      setCanvasMessage('请先选择画布存储文件夹，再导入遮罩图片。');
      return;
    }

    try {
      const savedAsset = await workspaceStore.saveAssetFileToCanvasFolder(
        rootDirectoryHandle,
        activeCanvas,
        file,
      );

      if (!savedAsset.assetDataUrl) {
        setCanvasMessage('读取遮罩图片失败，请重新选择图片。');
        return;
      }

      updateNode(nodeId, (current) => ({
        ...current,
        maskImageName: savedAsset.assetName,
        maskImagePath: savedAsset.assetPath,
        maskImageDataUrl: savedAsset.assetDataUrl,
        maskImageMimeType: savedAsset.assetMimeType,
        maskImageWidth: undefined,
        maskImageHeight: undefined,
        maskRect: undefined,
      }));
      setCanvasMessage(null);
    } catch {
      setCanvasMessage(`保存遮罩图片 ${file.name} 到画布文件夹失败，请检查文件夹权限后重试。`);
    }
  }

  function requestDiamondMaskStorageSetup() {
    setCanvasMessage('请先选择画布存储文件夹，再导入或选择遮罩图片。');
  }

  async function generateDiamondMaskAsset(node: CanvasNodeView) {
    if (!activeCanvas || node.kind !== 'diamondMask') {
      return;
    }

    const imageSource = getDiamondMaskSource(node);
    if (!imageSource) {
      setCanvasMessage('请先为菱形遮罩节点选择图片。');
      return;
    }

    if (!node.maskImageWidth || !node.maskImageHeight) {
      setCanvasMessage('图片还在读取中，请稍后再生成。');
      return;
    }

    const imageWidth = node.maskImageWidth;
    const imageHeight = node.maskImageHeight;
    const maskRect = node.maskRect ?? createDefaultDiamondMaskRect(imageWidth, imageHeight);

    try {
      const dataUrl = await createDiamondMaskImageDataUrl({
        imageUrl: imageSource,
        imageWidth,
        imageHeight,
        settings: {
          lineWidth: normalizeDiamondMaskLineWidth(node.maskLineWidth ?? 1),
          density: normalizeDiamondMaskDensity(node.maskGridDensity ?? 38),
          color: node.maskColor ?? 'white',
          rect: maskRect,
        },
      });
      const blob = await (await fetch(dataUrl)).blob();
      const timestamp = Date.now();
      const generatedNodeId = `node_diamond_mask_output_${timestamp}`;
      const generatedName = `diamond-mask-${timestamp}.png`;
      const savedAsset =
        rootDirectoryHandle && folderStorageReady
          ? await workspaceStore.saveGeneratedMediaBlobToCanvasFolder(
              rootDirectoryHandle,
              activeCanvas,
              {
                blob,
                fileName: generatedName,
                kind: 'image',
              },
            )
          : {
              assetName: generatedName,
              assetPath: undefined,
              mimeType: blob.type || 'image/png',
            };
      const assetNodeCreated = addGeneratedAssetNode({
        sourceNode: node,
        nodeId: generatedNodeId,
        title: '遮罩图片',
        kind: 'imageAsset',
        assetName: savedAsset.assetName,
        assetPath: savedAsset.assetPath,
        assetDataUrl: dataUrl,
        assetMimeType: savedAsset.mimeType || 'image/png',
      });
      if (assetNodeCreated) {
        selectSingleNode(generatedNodeId);
      }
      setCanvasMessage('已生成遮罩图片并保存到图片资产。');
    } catch (error) {
      setCanvasMessage(
        `生成遮罩图片失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  function addGeneratedAssetNode(input: {
    sourceNode: CanvasNodeView;
    nodeId: string;
    title: string;
    kind: 'imageAsset' | 'videoAsset';
    assetName: string;
    assetPath?: string;
    assetDataUrl?: string;
    assetMimeType: string;
  }): boolean {
    const targetCanvas = workspaceStateRef.current.canvases.find((canvas) =>
      canvas.nodes.some((candidate) => candidate.id === input.sourceNode.id),
    );

    if (!targetCanvas) {
      return false;
    }

    markCanvasDirty(targetCanvas.id);
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) => {
        if (canvas.id !== targetCanvas.id) {
          return canvas;
        }

        const outputIndex = canvas.edges.filter((edge) => {
          const targetNode = canvas.nodes.find((candidate) => candidate.id === edge.toNodeId);
          return edge.fromNodeId === input.sourceNode.id && targetNode?.kind === input.kind;
        }).length;
        const outputNode: CanvasNodeView = {
          id: input.nodeId,
          title: input.title,
          modelId: input.kind === 'imageAsset' ? 'asset-image' : 'asset-video',
          kind: input.kind,
          x: input.sourceNode.x + getCanvasNodeWidth(input.sourceNode) + 120,
          y: input.sourceNode.y + outputIndex * (canvasNodeSize.height + 32),
          assetName: input.assetName,
          assetPath: input.assetPath,
          assetDataUrl: input.assetDataUrl,
          assetMimeType: input.assetMimeType,
        };

        return {
          ...canvas,
          updatedAt: '刚刚',
          nodes: [...canvas.nodes, outputNode],
          edges: [...canvas.edges, createCanvasEdge(input.sourceNode.id, input.nodeId)],
        };
      }),
    }));
    void refreshCanvasAssets();
    return true;
  }

  function findCanvasAndNodeById(nodeId: string): {
    canvas: CanvasView;
    node: CanvasNodeView;
  } | null {
    for (const canvas of workspaceStateRef.current.canvases) {
      const node = canvas.nodes.find((candidate) => candidate.id === nodeId);
      if (node) {
        return { canvas, node };
      }
    }

    return null;
  }

  async function autoRunStoryGeneratedNodes(
    nodeIds: string[],
    limits: {
      imageConcurrencyLimit: number;
      videoConcurrencyLimit: number;
    },
  ) {
    const tasks = nodeIds.flatMap((nodeId) => {
      const target = findCanvasAndNodeById(nodeId);
      if (!target) {
        return [];
      }

      if (target.node.kind !== 'image' && target.node.kind !== 'video') {
        return [];
      }

      return [{ id: nodeId, kind: target.node.kind }];
    });

    await runStoryAutoRunQueue(tasks, async (task) => {
      const target = findCanvasAndNodeById(task.id);
      if (!target) {
        return;
      }

      await submitNodeGeneration(target.node);
    }, {
      image: limits.imageConcurrencyLimit,
      video: limits.videoConcurrencyLimit,
    });
  }

  function getStoryAutoRunNodeIds(
    executionMode: StoryNodeExecutionMode,
    expansion: ReturnType<typeof buildStoryNodeExpansion>,
  ): string[] {
    if (executionMode === 'fully_automatic') {
      return expansion.autoRunNodeIds.slice();
    }

    if (executionMode === 'structure_and_generate_images') {
      const autoRunNodeSet = new Set(expansion.autoRunNodeIds);
      return expansion.nodes
        .filter((node) => node.kind === 'image' && autoRunNodeSet.has(node.id))
        .map((node) => node.id);
    }

    return [];
  }

  function createGeneratedNodeId(prefix: 'node_image_output' | 'node_video_output'): string {
    generatedNodeIdRef.current += 1;
    return `${prefix}_${Date.now()}_${generatedNodeIdRef.current}`;
  }

  function removeDownstreamNodesForStoryNode(sourceNodeId: string) {
    const targetCanvas = workspaceStateRef.current.canvases.find((canvas) =>
      canvas.nodes.some((candidate) => candidate.id === sourceNodeId),
    );

    if (!targetCanvas) {
      return false;
    }

    const downstreamNodeIds = getStoryDownstreamNodeIds(targetCanvas, sourceNodeId);

    if (downstreamNodeIds.size === 0) {
      return false;
    }

    markCanvasDirty(targetCanvas.id);
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) => {
        if (canvas.id !== targetCanvas.id) {
          return canvas;
        }

        return {
          ...canvas,
          updatedAt: '刚刚',
          nodes: canvas.nodes.filter(
            (node) => node.id === sourceNodeId || !downstreamNodeIds.has(node.id),
          ),
          edges: canvas.edges.filter(
            (edge) =>
              edge.fromNodeId !== sourceNodeId &&
              !downstreamNodeIds.has(edge.fromNodeId) &&
              !downstreamNodeIds.has(edge.toNodeId),
          ),
        };
      }),
    }));
    return true;
  }

  function getStoryDownstreamNodeIds(canvas: CanvasView, sourceNodeId: string) {
    const downstreamNodeIds = new Set<string>();
    const visitQueue = [sourceNodeId];

    while (visitQueue.length > 0) {
      const currentNodeId = visitQueue.shift();
      if (!currentNodeId) {
        continue;
      }

      canvas.edges.forEach((edge) => {
        if (edge.fromNodeId !== currentNodeId || downstreamNodeIds.has(edge.toNodeId)) {
          return;
        }

        downstreamNodeIds.add(edge.toNodeId);
        visitQueue.push(edge.toNodeId);
      });
    }

    return downstreamNodeIds;
  }

  function storyNodeHasDownstreamNodes(sourceNodeId: string) {
    const targetCanvas = workspaceStateRef.current.canvases.find((canvas) =>
      canvas.nodes.some((candidate) => candidate.id === sourceNodeId),
    );

    if (!targetCanvas) {
      return false;
    }

    return getStoryDownstreamNodeIds(targetCanvas, sourceNodeId).size > 0;
  }

  function clearStoryNodeOutputs(sourceNodeId: string, successMessage = '已清除故事节点的下游输出。') {
    if (!removeDownstreamNodesForStoryNode(sourceNodeId)) {
      setCanvasMessage('当前没有可清除的下游输出。');
      return false;
    }

    setCanvasMessage(successMessage);
    return true;
  }

  function expandStoryNodeOutputs(
    sourceNode: CanvasNodeView,
    structuredOutput: NonNullable<CanvasNodeView['storyStructuredOutput']>,
    options: {
      expansionMode?: StoryNodeExpansionMode;
      executionMode?: StoryNodeExecutionMode;
      successMessage?: string;
    } = {},
  ) {
    const targetCanvas = workspaceStateRef.current.canvases.find((canvas) =>
      canvas.nodes.some((candidate) => candidate.id === sourceNode.id),
    );

    if (!targetCanvas) {
      return;
    }

    const expansionMode = options.expansionMode ?? sourceNode.storyExpansionMode ?? 'full';
    const executionMode = options.executionMode ?? sourceNode.storyExecutionMode ?? 'structure_only';
    if (expansionMode === 'structure_only' || executionMode === 'structure_only') {
      return;
    }

    const batchId = `story_batch_${Date.now()}`;
    let index = 0;
    const expansion = buildStoryNodeExpansion({
      canvas: targetCanvas,
      storyNode: sourceNode,
      structuredOutput,
      expansionMode,
      generationBatchId: batchId,
      createNodeId: (role, segmentId) => {
        index += 1;
        return `node_story_${role}_${segmentId ?? 'global'}_${Date.now()}_${index}`;
      },
    });

    if (expansion.nodes.length === 0) {
      return;
    }

    markCanvasDirty(targetCanvas.id);
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) => {
        if (canvas.id !== targetCanvas.id) {
          return canvas;
        }

        return {
          ...canvas,
          updatedAt: '刚刚',
          nodes: canvas.nodes.map((node) =>
            node.id === sourceNode.id
              ? {
                  ...node,
                  storyGenerationBatchId: batchId,
                }
              : node,
          ).concat(expansion.nodes),
          edges: canvas.edges.concat(expansion.edges),
        };
      }),
    }));

    setCanvasMessage(options.successMessage ?? `已从故事节点生成 ${expansion.nodes.length} 个下游节点。`);

    const autoRunNodeIds = getStoryAutoRunNodeIds(executionMode, expansion);
    if (autoRunNodeIds.length > 0) {
      pendingStoryAutoRunNodeIdsRef.current = {
        nodeIds: autoRunNodeIds,
        imageConcurrencyLimit: getStoryImageConcurrencyLimit(sourceNode),
        videoConcurrencyLimit: getStoryVideoConcurrencyLimit(sourceNode),
      };
    }
  }

  function regenerateStoryNodesFromStructuredOutput(
    sourceNode: CanvasNodeView,
    options: {
      structuredOutput?: NonNullable<CanvasNodeView['storyStructuredOutput']>;
      expansionMode?: StoryNodeExpansionMode;
      successMessage?: string;
    } = {},
  ) {
    const structuredOutput =
      options.structuredOutput ??
      resolveBestStoryStructuredOutput(
        sourceNode.storyStructuredOutput,
        sourceNode.storyRawOutput ?? sourceNode.modelOutputText ?? '',
      );
    if (!structuredOutput) {
      setCanvasMessage('当前结构化结果无法解析，请先检查 JSON 格式。');
      return;
    }

    expandStoryNodeOutputs(sourceNode, structuredOutput, {
      expansionMode: options.expansionMode,
      executionMode: 'structure_and_nodes',
      successMessage: options.successMessage,
    });
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
    | {
        ok: true;
        canvas: CanvasView;
        uploadedUrls: Map<string, string>;
        cacheUpdates: Map<string, string>;
      }
    | { ok: false; error: string }
  > {
    const inputAssetIds = collectGenerationInputAssetIds({
      canvas,
      nodeId: node.id,
    });
    const uploadCandidates = collectSeedanceUploadCandidates(canvas, inputAssetIds);

    if (uploadCandidates.length === 0) {
      return { ok: true, canvas, uploadedUrls: new Map(), cacheUpdates: new Map() };
    }

    const assetUploadEndpoint = getAssetUploadEndpointFromEnv();
    const objectStorageConfig = createObjectStorageConfigFromEnv();
    const canUploadReferenceAssets =
      Boolean(assetUploadEndpoint) || isObjectStorageConfigured(objectStorageConfig);

    if (!canUploadReferenceAssets) {
      return { ok: true, canvas, uploadedUrls: new Map(), cacheUpdates: new Map() };
    }

    const uploadedUrls = new Map<string, string>();
    const cacheUpdates = new Map<string, string>();
    const cachedUrls = workspaceStateRef.current.assetUploadCache ?? {};
    const uploadGroups = groupSeedanceUploadCandidatesByContent(uploadCandidates);

    try {
      await Promise.all(
        uploadGroups.map(async ({ candidate, nodeIds }) => {
          const sourceBlob = await readAssetSourceAsBlob(candidate.content);
          const contentHash = await createAssetContentHash(sourceBlob);
          const uploadUrl = cachedUrls[contentHash] ?? (
            assetUploadEndpoint
              ? await uploadBlobToAssetEndpoint({
                  endpoint: assetUploadEndpoint,
                  canvasId: canvas.id,
                  nodeId: candidate.nodeId,
                  filename: buildSeedanceReferenceFilename(node, candidate, sourceBlob.type),
                  blob: sourceBlob,
                })
              : await uploadBlobToR2({
                  config: objectStorageConfig,
                  key: buildSeedanceReferenceObjectKey(canvas, node, candidate, sourceBlob.type),
                  blob: sourceBlob,
                })
          );
          if (!cachedUrls[contentHash]) {
            cacheUpdates.set(contentHash, uploadUrl);
          }
          nodeIds.forEach((nodeId) => uploadedUrls.set(nodeId, uploadUrl));
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
      cacheUpdates,
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

    void deleteCanvasAndPersist(activeCanvasId);
  }

  function deleteCanvasById(canvasId: string) {
    void deleteCanvasAndPersist(canvasId);
  }

  async function deleteCanvasAndPersist(canvasId: string) {
    const currentState = workspaceStateRef.current;
    const canvasToDelete = currentState.canvases.find((canvas) => canvas.id === canvasId);

    if (!canvasToDelete) {
      return;
    }

    const nextState = deleteCanvas(currentState, canvasId);
    setWorkspaceStateWithHistory(() => nextState);
    clearDirtyCanvasIds([canvasId]);
    clearSelection();
    setAddMenu(null);
    setEditingCanvasId(null);
    setViewport(defaultViewport);

    if (!rootDirectoryHandle || !folderStorageReady) {
      try {
        persistWorkspaceStateToLocalStorage(nextState);
        savedWorkspaceStateRef.current = nextState;
      } catch {
        setCanvasMessage('画布已删除，但本地索引写入失败，刷新后可能恢复。');
        return;
      }

      setCanvasMessage('画布已删除。');
      return;
    }

    try {
      await workspaceStore.deleteCanvasFolder(rootDirectoryHandle, canvasToDelete);
      const persistedState = await workspaceStore.persistWorkspaceToFolder(rootDirectoryHandle, nextState);
      persistWorkspaceStateToLocalStorage(persistedState);

      if (workspaceStateRef.current === nextState) {
        workspaceStateRef.current = persistedState;
        savedWorkspaceStateRef.current = persistedState;
        setWorkspaceState(persistedState);
        clearDirtyCanvasIds();
      } else {
        savedWorkspaceStateRef.current = persistedState;
      }

      setCanvasMessage('画布已删除。');
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

  function updateActiveDragFromPointer(input: { pointerId: number; clientX: number; clientY: number }) {
    const activeDragState = dragStateRef.current;

    if (!activeDragState || activeDragState.pointerId !== input.pointerId) {
      return;
    }

    if (activeDragState.mode === 'select') {
      updateDragState({
        ...activeDragState,
        current: getCanvasPointFromClient(input.clientX, input.clientY),
      });
      return;
    }

    const clientDelta = {
      dx: input.clientX - activeDragState.lastX,
      dy: input.clientY - activeDragState.lastY,
    };
    const delta = getCanvasDeltaFromClientDelta(clientDelta);

    if (activeDragState.mode === 'pan') {
      pulseCanvasNavigation();
      scheduleViewportUpdate((current) => panViewport(current, delta));
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
      lastX: input.clientX,
      lastY: input.clientY,
    };
  }

  function finishActiveDragFromPointer(input: { pointerId: number; clientX: number; clientY: number }) {
    const activeDragState = dragStateRef.current;

    if (activeDragState?.pointerId !== input.pointerId) {
      return;
    }

    if (activeDragState.mode === 'select') {
      const rect = normalizeCanvasSelectionRect(
        activeDragState.start,
        getCanvasPointFromClient(input.clientX, input.clientY),
      );
      const selectedIds =
        rect.width < 4 && rect.height < 4
          ? []
          : findNodesInSelectionRect(activeCanvas?.nodes ?? [], rect);

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
    } else if (activeDragState.mode === 'pan') {
      commitViewportState();
    }

    updateDragState(null);
    clearDragPreview();
  }

  function updateEdgeDraftFromPointer(input: { pointerId: number; clientX: number; clientY: number }) {
    if (!edgeDraft || edgeDraft.pointerId !== input.pointerId) {
      return false;
    }

    const to = getCanvasPointFromClient(input.clientX, input.clientY);
    const snapTarget = findNearestEdgeDraftTarget(to);

    setEdgeDraft((current) => {
      if (!current || current.pointerId !== input.pointerId) {
        return current;
      }

      return {
        ...current,
        to,
        snapTarget: snapTarget
          ? {
              nodeId: snapTarget.nodeId,
              portId: snapTarget.portId,
            }
          : undefined,
      };
    });

    return true;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      updateEdgeDraftFromPointer(event);
      return;
    }

    updateActiveDragFromPointer(event);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (edgeDraft) {
      if (edgeDraft.pointerId !== event.pointerId) {
        return;
      }

      finishEdgeDraftOnBlank(event);
      return;
    }

    finishActiveDragFromPointer(event);
  }

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleWindowPointerEnd = (event: globalThis.PointerEvent) => {
      finishActiveDragFromPointer({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [dragState]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useLayoutEffect(() => {
    applyViewportToCanvasPlane(viewport);
  }, [viewport]);

  useEffect(() => {
    if (!edgeDraft) {
      return;
    }

    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      updateEdgeDraftFromPointer({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handleWindowPointerEnd = (event: globalThis.PointerEvent) => {
      if (edgeDraft.pointerId !== event.pointerId) {
        return;
      }

      setEdgeDraft(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [edgeDraft]);

  function startEdgeDraft(event: PointerEvent<HTMLButtonElement>, node: CanvasNodeView) {
    if (!activeCanvas) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = getNodeOutputPoint(node);

    setAddMenu(null);
    updateDragState(null);
    clearDragPreview();
    selectSingleNode(node.id, { preserveInspector: true });
    setEdgeDraft({
      pointerId: event.pointerId,
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
      event.target.closest(
        '.output-modal, .canvas-asset-sidebar, .asset-picker-layer, .node-inspector, .inline-option-select, .inline-option-menu',
      )
    ) {
      return;
    }

    event.preventDefault();
    pulseCanvasNavigation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    scheduleViewportUpdate((current) =>
      zoomViewportAtPoint(
        current,
        getCanvasLocalPointFromClient(event.clientX, event.clientY),
        current.scale * zoomFactor,
      ),
    );
  }

  const handleModalScrollableWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.scrollTop += event.deltaY;
    event.currentTarget.scrollLeft += event.deltaX;
  }, []);

  function zoomBy(factor: number) {
    pulseCanvasNavigation();
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? { x: rect.width / 2, y: rect.height / 2 }
      : { x: 480, y: 320 };

    scheduleViewportUpdate((current) => zoomViewportAtPoint(current, center, current.scale * factor));
  }

  function resetViewport() {
    pulseCanvasNavigation();
    scheduleViewportUpdate(defaultViewport);
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

    pulseCanvasNavigation();
    scheduleViewportUpdate(
      getViewportForCanvasCenter(center, getViewportSizeForMinimap(), viewportRef.current.scale),
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
        width: getViewportSizeForMinimap().width / viewportRef.current.scale,
        height: getViewportSizeForMinimap().height / viewportRef.current.scale,
      },
    );

    pulseCanvasNavigation();
    scheduleViewportUpdate(
      getViewportForCanvasCenter(center, getViewportSizeForMinimap(), viewportRef.current.scale),
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
      commitViewportState();
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
    openProviderSettingsView();
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
    if (isChatLikeNode(node) || node.modelId === 'chat') {
      return findChatProviders(providers, getChatFormat(node));
    }

    if (node.kind === 'video') {
      return findProvidersForVideoFormat(providers, getVideoModelFormat(node));
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
          isChatLikeNode(node) ? 'chat' : undefined,
          node.kind === 'video' ? getVideoModelFormat(node) : undefined,
        )
      : [];
  }

  function findProviderModelsForNodeWithProvider(node: CanvasNodeView, provider: ProviderConfig) {
    return findProviderModelsForNodeModel(
      provider,
      node.modelId,
      getChatFormat(node),
      isChatLikeNode(node) ? 'chat' : undefined,
      node.kind === 'video' ? getVideoModelFormat(node) : undefined,
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
    setOutputSelectionToolbar(null);
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
    setOutputSelectionToolbar(null);
  }

  function closeOutputEditor() {
    setEditingOutputNodeId(null);
    setSelectedOutputVersionId(null);
    setDraftOutputText('');
    setOutputEditorMode('preview');
    setOutputSelectionToolbar(null);
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
    setOutputSelectionToolbar(null);
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
    setOutputSelectionToolbar(null);
  }

  function updateOutputSelectionToolbar(
    anchor?: {
      clientX: number;
      clientY: number;
    },
  ) {
    const preview = outputPreviewRef.current;
    const selection = window.getSelection();

    if (
      !preview ||
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed ||
      !selection.toString().trim()
    ) {
      setOutputSelectionToolbar(null);
      outputSelectionRangesRef.current = [];
      return;
    }

    outputSelectionSyncingRef.current = true;
    outputSelectionRangesRef.current = Array.from(
      { length: selection.rangeCount },
      (_, index) => selection.getRangeAt(index).cloneRange(),
    );

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    if (!commonAncestor || !preview.contains(commonAncestor)) {
      outputSelectionSyncingRef.current = false;
      setOutputSelectionToolbar(null);
      outputSelectionRangesRef.current = [];
      return;
    }

    const previewRect = preview.getBoundingClientRect();
    const toolbarWidth = 96;
    const selectionRect =
      typeof range.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect()
        : null;
    const preferredLeft = anchor
      ? anchor.clientX - previewRect.left - toolbarWidth / 2
      : (selectionRect?.left ?? previewRect.left) -
          previewRect.left +
          (selectionRect?.width ?? 0) / 2 -
          toolbarWidth / 2;
    const preferredTop = anchor
      ? anchor.clientY - previewRect.top - 44
      : (selectionRect?.top ?? previewRect.top + 44) - previewRect.top - 44;

    setOutputSelectionToolbar({
      text: selection.toString(),
      left: Math.max(10, Math.min(previewRect.width - toolbarWidth - 10, preferredLeft)),
      top: Math.max(10, preferredTop),
      copied: false,
    });
  }

  async function copySelectedOutputText() {
    const text = outputSelectionToolbar?.text?.trim();
    if (!text) {
      outputSelectionToolbarPointerDownRef.current = false;
      return;
    }

    const selection = window.getSelection();
    const preservedRanges =
      selection && selection.rangeCount > 0
        ? Array.from({ length: selection.rangeCount }, (_, index) =>
            selection.getRangeAt(index).cloneRange(),
          )
        : [];
    outputSelectionRangesRef.current = preservedRanges.map((range) => range.cloneRange());

    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();

        if (selection) {
          selection.removeAllRanges();
          preservedRanges.forEach((range) => selection.addRange(range));
        }
      }

      setOutputSelectionToolbar((current) =>
        current
          ? {
              ...current,
              copied: true,
            }
          : current,
      );
    } finally {
      outputSelectionToolbarPointerDownRef.current = false;
    }
  }

  const handleOutputPreviewPointerDown = useCallback(() => {
    setOutputSelectionToolbar(null);
  }, []);

  const handleOutputPreviewPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    window.requestAnimationFrame(() => {
      updateOutputSelectionToolbar({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    });
  }, []);

  const handleOutputPreviewKeyUp = useCallback(() => {
    window.requestAnimationFrame(() => {
      updateOutputSelectionToolbar();
    });
  }, []);

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
    let localVideoUrl: string | undefined;
    let savedVideoAssetName: string | undefined;
    let savedVideoMimeType: string | undefined;
    let generatedAssetNodeId: string | undefined;
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
          savedVideoAssetName = savedVideo.assetName;
          savedVideoPath = savedVideo.assetPath;
          localVideoUrl = savedVideo.assetDataUrl;
          savedVideoMimeType = savedVideo.mimeType;
        } catch (error) {
          saveWarnings.push(
            `视频结果未能保存到本地文件夹：${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

    }

    if (task.videoUrl && (savedVideoPath || localVideoUrl || !rootDirectoryHandle || !folderStorageReady)) {
      const nextAssetNodeId = createGeneratedNodeId('node_video_output');
      const assetNodeCreated = addGeneratedAssetNode({
        sourceNode: node,
        nodeId: nextAssetNodeId,
        title: '生成视频',
        kind: 'videoAsset',
        assetName: savedVideoAssetName ?? `${task.taskId ?? node.id}.mp4`,
        assetPath: savedVideoPath,
        assetDataUrl: localVideoUrl ?? task.videoUrl,
        assetMimeType: savedVideoMimeType ?? 'video/mp4',
      });
      generatedAssetNodeId = assetNodeCreated ? nextAssetNodeId : undefined;
    }

    updateNode(node.id, (current) => ({
      ...current,
      generationStatus: 'succeeded',
      generationError: saveWarnings.length > 0 ? saveWarnings.join(' | ') : undefined,
      outputUrl: task.videoUrl ?? current.outputUrl,
      outputDataUrl: localVideoUrl ?? current.outputDataUrl,
      outputPath: savedVideoPath ?? current.outputPath,
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
      outputAssetIds: [generatedAssetNodeId ?? node.id],
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
    const seedanceConfigModel =
      node.kind === 'video' ? getSeedanceConfigModel(node.modelId) : null;
    const estimatedVideoTokenCost =
      node.kind === 'video' && seedanceConfigModel
        ? estimateSeedanceTokens({
            model: seedanceConfigModel,
            resolution:
              node.videoResolution ??
              getVideoCapabilities(node.modelId).supportedResolutions[0] ??
              '720p',
            ratio:
              node.videoRatio ?? getDefaultVideoRatio(node.modelId),
            duration: getEstimatedVideoDurationSeconds(node),
            framespersecond:
              getVideoCapabilities(node.modelId).fixedFrameRate ?? 24,
            scenario: node.seedanceScenario ?? 'text_to_video',
            generateAudio: node.videoGenerateAudio ?? true,
            multimodalCount: countDirectVideoReferenceInputs(activeCanvas, node.id),
          })
        : undefined;
    addGenerationHistoryRecord({
      ...createGenerationRecord({
        id: generationRecordId,
        nodeId: node.id,
        nodeKind:
          node.kind === 'video'
            ? 'video'
            : node.kind === 'image'
              ? 'image'
              : node.kind === 'story'
                ? 'story'
                : 'chat',
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
      ...(isChatLikeNode(node)
        ? {
            modelOutputText: '',
            outputText: undefined,
          }
        : {}),
    }), { history: false });

    if (isChatLikeNode(node)) {
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

      const nextStoryStructuredOutput =
        node.kind === 'story' && result.output.kind === 'text'
          ? parseStoryStructuredOutput(result.output.text) ?? {
              ...(node.storyStructuredOutput ?? createEmptyStoryStructuredOutput()),
              storySummary: result.output.text.slice(0, 240),
              rawModelOutput: result.output.text,
            }
          : node.storyStructuredOutput;

      updateNode(node.id, (current) => {
        return {
          ...current,
          generationStatus: 'succeeded',
          generationError: undefined,
          modelOutputText: result.output.kind === 'text' ? result.output.text : current.modelOutputText,
          storyRawOutput:
            node.kind === 'story' && result.output.kind === 'text'
              ? result.output.text
              : current.storyRawOutput,
          storyStructuredOutput:
            node.kind === 'story' ? nextStoryStructuredOutput : current.storyStructuredOutput,
          outputVersions:
            result.output.kind === 'text'
              ? appendOutputVersion(getStoredOutputVersions(current), result.output.text, 'model')
              : current.outputVersions,
          outputText: undefined,
        };
      }, { history: false });
      updateGenerationHistoryRecord(generationRecordId, (record) => ({
        ...record,
        status: 'succeeded',
        outputAssetIds: [node.id],
        endedAt: new Date().toISOString(),
      }));
      if (node.kind === 'story' && nextStoryStructuredOutput) {
        removeDownstreamNodesForStoryNode(node.id);
        expandStoryNodeOutputs(node, nextStoryStructuredOutput);
      }
      return;
    }

    let generationCanvas = activeCanvas;

    if (
      node.kind === 'video' &&
      (getVideoModelFormat(node) === 'seedance' ||
        isSoraCompatibleVideoFormat(getVideoModelFormat(node)))
    ) {
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

      if (prepared.cacheUpdates.size > 0) {
        setWorkspaceState((current) => ({
          ...current,
          assetUploadCache: {
            ...(current.assetUploadCache ?? {}),
            ...Object.fromEntries(prepared.cacheUpdates),
          },
        }));
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

    let savedImageAsset:
      | {
          assetName: string;
          assetPath?: string;
          assetDataUrl?: string;
          mimeType: string;
        }
      | null = null;
    let imageSaveError: string | undefined;
    let generatedImageAssetNodeId: string | undefined;

    if (result.output.kind === 'image' && (result.output.dataUrl || result.output.url)) {
      const imageSource = result.output.dataUrl ?? result.output.url;

      if (imageSource) {
        try {
          const blob = await (await fetch(imageSource)).blob();
          const generatedName = `${node.id}-${Date.now()}.png`;
          savedImageAsset =
            rootDirectoryHandle && folderStorageReady
              ? await workspaceStore.saveGeneratedMediaBlobToCanvasFolder(
                  rootDirectoryHandle,
                  activeCanvas,
                  {
                    blob,
                    fileName: generatedName,
                    kind: 'image',
                  },
                )
              : {
                  assetName: generatedName,
                  assetPath: undefined,
                  assetDataUrl: result.output.dataUrl ?? result.output.url,
                  mimeType: blob.type || 'image/png',
                };
          const nextAssetNodeId = createGeneratedNodeId('node_image_output');
          const assetNodeCreated = addGeneratedAssetNode({
            sourceNode: node,
            nodeId: nextAssetNodeId,
            title: '生成图片',
            kind: 'imageAsset',
            assetName: savedImageAsset.assetName,
            assetPath: savedImageAsset.assetPath,
            assetDataUrl:
              savedImageAsset.assetDataUrl ?? result.output.dataUrl ?? result.output.url,
            assetMimeType: savedImageAsset.mimeType || 'image/png',
          });
          generatedImageAssetNodeId = assetNodeCreated ? nextAssetNodeId : undefined;
        } catch (error) {
          imageSaveError = `图片结果未能保存到本地文件夹：${
            error instanceof Error ? error.message : '未知错误'
          }`;
        }
      }
    }

    updateNode(node.id, (current) => {
      if (result.output.kind === 'image') {
        return {
          ...current,
          generationStatus: 'succeeded',
          generationError: imageSaveError,
          outputDataUrl: result.output.dataUrl,
          outputPath: savedImageAsset?.assetPath ?? current.outputPath,
          outputUrl: result.output.url,
          outputText: imageSaveError,
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
          ? [generatedImageAssetNodeId ?? node.id]
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
              {minimapNodeElements}
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

  function bringNodeToFront(nodeId: string) {
    setWorkspaceState((current) => ({
      ...current,
      canvases: current.canvases.map((canvas) => {
        if (!current.activeCanvasId || canvas.id !== current.activeCanvasId) {
          return canvas;
        }

        const index = canvas.nodes.findIndex((node) => node.id === nodeId);
        if (index === -1 || index === canvas.nodes.length - 1) {
          return canvas;
        }

        const nextNodes = canvas.nodes.slice();
        const [targetNode] = nextNodes.splice(index, 1);
        nextNodes.push(targetNode);

        return {
          ...canvas,
          nodes: nextNodes,
        };
      }),
    }));
  }

  function selectSingleNode(
    nodeId: string,
    options: {
      openInspector?: boolean;
      preserveInspector?: boolean;
    } = {},
  ) {
    bringNodeToFront(nodeId);
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
            <header className="sidebar-header">
              <div className="sidebar-brand-copy">
                <div className="sidebar-brand-row">
                  <h1>shot-agent</h1>
                </div>
                <p>无限画布视觉创作空间</p>
              </div>
            </header>
            <nav className="sidebar-primary-nav">
              <button
                type="button"
                className={showProviderManager ? 'is-active' : ''}
                onClick={() => openProviderSettingsView()}
              >
                <Settings size={18} />
                供应商管理
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
            <section className="panel canvas-panel">
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
              <Settings size={18} />
            ) : (
              <BoxSelect size={18} />
            )}
            {showProviderManager ? (
              <div className="toolbar-title-copy">
                <span>供应商管理</span>
                <small>统一管理供应商、模型映射与历史任务</small>
              </div>
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
                <div className="toolbar-title-copy">
                  <span className="canvas-title-name">
                    {activeCanvas?.name ?? '暂无画布'}
                    {activeCanvasIsDirty ? (
                      <span className="canvas-unsaved-dot" aria-label="未保存" title="未保存" />
                    ) : null}
                  </span>
                  <small>
                    {activeCanvas
                      ? `${activeCanvas.nodes.length} 个节点 · ${filteredCanvasAssets.length} 个资产`
                      : '选择一个画布开始创作'}
                  </small>
                </div>
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
            {!showProviderManager ? (
              <span
                className={`toolbar-status-chip ${
                  folderStorageReady && rootDirectoryHandle ? 'is-ready' : 'is-warning'
                }`}
              >
                {folderStorageReady && rootDirectoryHandle ? '文件夹已连接' : '未连接存储文件夹'}
              </span>
            ) : null}
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
          <div className="provider-manager-view">
            <div className="provider-settings-shell">
              <aside className="provider-settings-sidebar" aria-label="供应商列表">
                <div className="provider-sidebar-header">
                  <div>
                    <h2>服务商</h2>
                    <p>选择、映射并测试当前可用模型。</p>
                  </div>
                  <span className="provider-sidebar-count">{filteredProviderRows.length}</span>
                </div>
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
                          <p>
                            {getProviderProtocolLabel(selectedProviderView.protocol)} ·{' '}
                            {selectedProviderView.models.filter((model) => model.enabled).length} 个启用模型
                          </p>
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
                          aria-label="关闭供应商管理"
                          title="关闭供应商管理"
                          onClick={returnToCanvas}
                        >
                          <X size={17} />
                        </button>
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
                            <InlineOptionSelect
                              ariaLabel="API 风格"
                              value={selectedProviderView.protocol}
                              menuKey={`provider-protocol:${selectedProvider.id}`}
                              openMenuKey={openInlineSelectKey}
                              setOpenMenuKey={setOpenInlineSelectKey}
                              onChange={(value) =>
                                updateProviderDraft(selectedProvider.id, (current) => ({
                                  ...current,
                                  protocol: value as ProviderConfig['protocol'],
                                }))
                              }
                              options={[
                                { value: 'openai-compatible', label: 'OpenAI / Sora Compatible' },
                                { value: 'anthropic-compatible', label: 'Anthropic Compatible' },
                                { value: 'volcengine', label: '火山方舟' },
                                { value: 'custom', label: '自定义' },
                              ]}
                            />
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
                            <InlineOptionSelect
                              ariaLabel="每页展示"
                              value={providerVideoHistoryPageSize}
                              menuKey="provider-history-page-size"
                              openMenuKey={openInlineSelectKey}
                              setOpenMenuKey={setOpenInlineSelectKey}
                              onChange={(value) => {
                                setProviderVideoHistoryPageSize(Number(value));
                                setProviderVideoHistoryPage(1);
                              }}
                              options={[10, 20, 50, 100].map((size) => ({
                                value: String(size),
                                label: String(size),
                              }))}
                            />
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
        ) : (
        <div
          ref={canvasRef}
          className={`infinite-canvas ${dragState?.mode === 'pan' ? 'is-panning' : ''} ${
            isCanvasNavigating ? 'is-navigating' : ''
          } ${
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
              onWheelCapture={(event) => event.stopPropagation()}
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
                {(['all', 'image', 'video', 'audio', 'file'] as AssetFilter[]).map((filter) => (
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
                    const isMediaTile = asset.kind === 'image' || asset.kind === 'video';
                    return (
                      <article
                        className={`asset-list-item ${isMediaTile ? 'is-media' : ''}`}
                        key={asset.path}
                        title={asset.name}
                      >
                        <div className="asset-list-preview">
                          {asset.kind === 'image' ? (
                            asset.dataUrl ? <img src={asset.dataUrl} alt={asset.name} /> : <Image size={22} />
                          ) : asset.kind === 'video' ? (
                            asset.dataUrl ? (
                              <video src={asset.dataUrl} controls />
                            ) : (
                              <Video size={22} />
                            )
                          ) : asset.kind === 'audio' ? (
                            asset.dataUrl ? (
                              <audio src={asset.dataUrl} controls />
                            ) : (
                              <Music size={22} />
                            )
                          ) : (
                            <FileText size={22} />
                          )}
                        </div>
                        {isMediaTile ? null : (
                          <div className="asset-list-meta">
                            <strong title={asset.name}>{asset.name}</strong>
                            <small>{getAssetKindLabel(asset.kind)} · {asset.mimeType}</small>
                          </div>
                        )}
                        <div className="asset-list-actions">
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
          {assetPickerTarget ? (
            <div
              className="asset-picker-layer"
              onPointerDown={() => setAssetPickerTarget(null)}
              onWheel={(event) => event.stopPropagation()}
            >
              <section
                className="asset-picker-popover"
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
              >
                <header className="asset-picker-header">
                  <div>
                    <h2>选择{getAssetKindLabel(assetPickerTarget.kind)}资产</h2>
                    <p>从当前画布资产中选择</p>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="关闭资产选择"
                    title="关闭资产选择"
                    onClick={() => setAssetPickerTarget(null)}
                  >
                    <X size={15} />
                  </button>
                </header>
                <div className="asset-picker-body">
                  <div className="asset-picker-list">
                    {loadingCanvasAssets ? (
                      <div className="asset-empty-state">正在读取资产</div>
                    ) : assetPickerAssets.length > 0 ? (
                      assetPickerAssets.map((asset) => (
                        <button
                          key={asset.path}
                          type="button"
                          className="asset-picker-item"
                          title={asset.name}
                          onClick={() => selectCanvasAssetForTarget(asset)}
                        >
                          <span className="asset-picker-preview">
                            {asset.kind === 'image' ? (
                              asset.dataUrl ? <img src={asset.dataUrl} alt={asset.name} /> : <Image size={22} />
                            ) : asset.dataUrl ? (
                              <video src={asset.dataUrl} muted />
                            ) : (
                              <Video size={22} />
                            )}
                          </span>
                          <span>{asset.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="asset-empty-state">
                        当前画布没有{getAssetKindLabel(assetPickerTarget.kind)}资产
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
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
            ref={canvasPlaneRef}
            className="canvas-plane"
            style={{
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            }}
          >
            <svg className="edge-layer" aria-label="节点连线">
              {visibleCanvasEdges.map((edge) => {
                const fromNode = renderedCanvasNodeMap.get(edge.fromNodeId);
                const toNode = renderedCanvasNodeMap.get(edge.toNodeId);

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
            {visibleCanvasNodes.map((node) => {
              const Icon = getNodeIcon(node.kind);
              const providersForNode = findProvidersForNode(node);
              const isGenerating = runningNodeIds.has(node.id);
              const effectiveOutputText = getEffectiveNodeOutputText(node);
              const isLongOutput =
                effectiveOutputText !== undefined && shouldCollapseMarkdown(effectiveOutputText);
              const videoOutputStorageStatus =
                node.kind === 'video' ? getVideoOutputStorageStatus(node) : null;
              const nodeSettingSummary = getNodeSettingSummaryText(node);
              const videoInputPorts =
                node.kind === 'video'
                  ? getVideoInputPorts(node.seedanceScenario ?? 'text_to_video')
                  : [];

              return (
                <article
                  key={node.id}
                  data-node-id={node.id}
                  ref={observeNodeElement}
                  className={`canvas-node canvas-node-${node.kind} ${
                    node.id === selectedNodeId || selectedNodeIdSet.has(node.id)
                      ? 'is-selected'
                      : ''
                  }`}
                  style={{
                    transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                    width: `${getCanvasNodeWidth(node)}px`,
                    minHeight: `${getCanvasNodeHeight(node)}px`,
                  }}
                  onPointerDownCapture={(event) => {
                    if (isNodeInteractionTarget(event.target)) {
                      return;
                    }

                    bringNodeToFront(node.id);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    selectSingleNode(node.id, { preserveInspector: true });
                    setAddMenu(null);

                    if (isNodeInteractionTarget(event.target)) {
                      return;
                    }

                    handleNodePointerDown(event, node.id);
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
                  <header>
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
                            if (isNodeInteractionTarget(event.target)) {
                              event.stopPropagation();
                            }
                          }}
                          onMouseDown={(event) => {
                            if (event.detail >= 2) {
                              event.preventDefault();
                              event.stopPropagation();
                              startRenameNode(node, 'canvas');
                              return;
                            }
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
                      {node.kind === 'diamondMask' ? null : (
                        <p className="node-model-line">
                          <span>{node.modelId}</span>
                          {nodeSettingSummary ? (
                            <small className="node-model-summary">{nodeSettingSummary}</small>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </header>
                  <CanvasNodeBody
                    activeCanvas={activeCanvas}
                    node={node}
                    providers={providers}
                    isGenerating={isGenerating}
                    effectiveOutputText={effectiveOutputText}
                    openInlineSelectKey={openInlineSelectKey}
                    setOpenInlineSelectKey={setOpenInlineSelectKey}
                    rootDirectoryReady={Boolean(rootDirectoryHandle)}
                    folderStorageReady={folderStorageReady}
                    onOpenImagePreview={openImagePreview}
                    onReplaceDiamondMaskImage={(nodeId, file) => void replaceDiamondMaskImage(nodeId, file)}
                    onOpenAssetPicker={openAssetPicker}
                    onRequireDiamondMaskStorage={requestDiamondMaskStorageSetup}
                    onUpdateNode={updateNode}
                    onGenerateDiamondMaskAsset={(targetNode) => void generateDiamondMaskAsset(targetNode)}
                    onAddAssetNodeFromFile={addAssetNodeFromFile}
                    onRemovePlaceholderNode={(nodeId) =>
                      updateActiveCanvasNodes((nodes) => nodes.filter((current) => current.id !== nodeId))
                    }
                    onHandleVideoScenarioChange={handleVideoScenarioChange}
                    onSubmitNodeGeneration={submitNodeGeneration}
                    onRegenerateStoryNodes={(sourceNode, options) =>
                      regenerateStoryNodesFromStructuredOutput(sourceNode, {
                        structuredOutput: options.structuredOutput ?? undefined,
                        expansionMode: options.expansionMode,
                      })
                    }
                    onClearStoryOutputs={clearStoryNodeOutputs}
                    hasStoryDownstreamOutputs={storyNodeHasDownstreamNodes}
                    onOpenOutputEditor={openOutputEditor}
                  />
                  <button
                    type="button"
                    className={`node-resize-handle ${node.kind === 'textAsset' ? 'text-asset-resize-handle' : ''}`}
                    aria-label="调整节点大小"
                    title="调整节点大小"
                    onPointerDown={(event) => startNodeResize(event, node)}
                  />
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
            <aside
              className="node-inspector"
              onWheelCapture={(event) => event.stopPropagation()}
            >
              <header className="node-inspector-header">
                <div className="node-inspector-title-block">
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
                      <h2>{selectedNode.title}</h2>
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
                  {selectedNode.kind === 'diamondMask' ? null : <p>{selectedNode.modelId}</p>}
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="关闭节点详情"
                  title="关闭节点详情"
                  onClick={() => setInspectedNodeId(null)}
                >
                  <X size={15} />
                </button>
              </header>
              <button type="button" className="danger-button" onClick={deleteSelectedNode}>
                <Trash2 size={16} />
                删除节点
              </button>
              {selectedNode.kind === 'diamondMask' ? (
                <DiamondMaskNodeBody
                  node={selectedNode}
                  canChooseSource={Boolean(rootDirectoryHandle && folderStorageReady)}
                  onReplaceImage={(file) => void replaceDiamondMaskImage(selectedNode.id, file)}
                  onSelectAsset={() =>
                    openAssetPicker({
                      nodeId: selectedNode.id,
                      kind: 'image',
                      purpose: 'diamondMask',
                    })
                  }
                  onRequireStorage={requestDiamondMaskStorageSetup}
                  onUpdateNode={(updater) => updateNode(selectedNode.id, updater)}
                  onGenerate={() => void generateDiamondMaskAsset(selectedNode)}
                />
              ) : null}
              {isChatLikeNode(selectedNode) ? (
                <label>
                  调用格式
                  <InlineOptionSelect
                    ariaLabel="调用格式"
                    value={getChatFormat(selectedNode)}
                    menuKey={`chat-format:${selectedNode.id}`}
                    openMenuKey={openInlineSelectKey}
                    setOpenMenuKey={setOpenInlineSelectKey}
                    onChange={(value) => {
                      const nextFormat = value as ChatFormat;
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
                    options={[
                      { value: 'openai', label: 'OpenAI Chat Completions' },
                      { value: 'anthropic', label: 'Anthropic Messages' },
                    ]}
                  />
                </label>
              ) : null}
              {selectedNode.kind === 'story' ? (
                <div className="story-generation-settings">
                  <label>
                    执行方式
                    <InlineOptionSelect
                      ariaLabel="执行方式"
                      value={selectedNode.storyExecutionMode ?? 'structure_only'}
                      menuKey={`story-execution-mode:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyExecutionMode: value as StoryNodeExecutionMode,
                        }))
                      }
                      options={[
                        { value: 'structure_only', label: '仅拆解' },
                        { value: 'structure_and_nodes', label: '拆解并铺节点' },
                        { value: 'structure_and_generate_images', label: '拆解并执行生图' },
                        { value: 'fully_automatic', label: '拆解并全自动执行' },
                      ]}
                    />
                  </label>
                  <label>
                    展开级别
                    <InlineOptionSelect
                      ariaLabel="展开级别"
                      value={selectedNode.storyExpansionMode ?? 'full'}
                      menuKey={`story-expansion-mode:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyExpansionMode: value as StoryNodeExpansionMode,
                        }))
                      }
                      options={[
                        { value: 'structure_only', label: '仅生成结构' },
                        { value: 'global_assets', label: '结构 + 全局资产' },
                        { value: 'full', label: '展开全部节点' },
                      ]}
                    />
                  </label>
                  <label>
                    图片并发
                    <InlineOptionSelect
                      ariaLabel="故事图片并发"
                      value={getStoryImageConcurrencyLimit(selectedNode)}
                      menuKey={`story-image-concurrency:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyImageConcurrencyLimit: normalizeStoryAutoRunConcurrencyLimit(Number(value)),
                        }))
                      }
                      options={Array.from({ length: 10 }, (_, index) => ({
                        value: String(index + 1),
                        label: String(index + 1),
                      }))}
                    />
                  </label>
                  <label>
                    视频并发
                    <InlineOptionSelect
                      ariaLabel="故事视频并发"
                      value={getStoryVideoConcurrencyLimit(selectedNode)}
                      menuKey={`story-video-concurrency:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyVideoConcurrencyLimit: normalizeStoryAutoRunConcurrencyLimit(Number(value)),
                        }))
                      }
                      options={Array.from({ length: 10 }, (_, index) => ({
                        value: String(index + 1),
                        label: String(index + 1),
                      }))}
                    />
                  </label>
                  <label>
                    供应商
                    <InlineOptionSelect
                      value={selectedNodeProviderSelection?.effectiveProviderId ?? ''}
                      ariaLabel="供应商"
                      menuKey={`story-provider:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) => {
                        const nextProviderId = value || undefined;
                        const nextProvider = findProvidersForNode(selectedNode).find(
                          (provider) => provider.id === nextProviderId,
                        );
                        const nextModel = nextProvider
                          ? findProviderModelsForNodeWithProvider(selectedNode, nextProvider)[0]
                          : undefined;

                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          providerId: nextProviderId,
                          providerModelId: nextModel?.providerModelId,
                          modelId: nextModel?.providerModelId ?? current.modelId,
                        }));
                      }}
                      options={findProvidersForNode(selectedNode).map((provider) => ({
                        value: provider.id,
                        label: provider.name,
                      }))}
                    />
                  </label>
                  <label>
                    供应商模型
                    <InlineOptionSelect
                      value={selectedNodeProviderSelection?.effectiveProviderModelId ?? ''}
                      ariaLabel="供应商模型"
                      menuKey={`story-provider-model:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          providerModelId: value || undefined,
                          modelId: value || current.modelId,
                        }))
                      }
                      options={findProviderModelsForNode(selectedNode).map((model) => ({
                        value: model.providerModelId,
                        label: model.displayName ?? model.providerModelId,
                      }))}
                    />
                  </label>
                  <label>
                    提示词
                    <PromptTextarea
                      canvas={activeCanvas}
                      node={selectedNode}
                      ariaLabel="提示词"
                      placeholder={getNodePromptPlaceholder(selectedNode)}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          prompt: value,
                        }))
                      }
                    />
                  </label>
                  <label className="story-system-prompt-field">
                    故事内置提示词
                    <textarea
                      aria-label="故事内置提示词"
                      value={selectedNode.storySystemPrompt ?? buildStorySystemInstruction()}
                      onWheelCapture={(event) => event.stopPropagation()}
                      onWheel={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storySystemPrompt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {selectedStoryStructuredOutput &&
                  (selectedStoryStructuredOutput.storySummary.trim() ||
                    selectedStoryStructuredOutput.narrativeSegments.length > 0 ||
                    getStoryGlobalAssetCount(selectedStoryStructuredOutput) > 0) ? (
                      <section className="story-structured-panel" aria-label="故事结构概览">
                        <div className="story-structured-panel-header">
                          <h3>结构概览</h3>
                          <span>
                            {selectedStoryStructuredOutput.narrativeSegments.length > 0
                              ? `${selectedStoryStructuredOutput.narrativeSegments.length} 段`
                              : '待补充分段'}
                          </span>
                        </div>
                        <p className="story-structured-summary">
                          {selectedStoryStructuredOutput.storySummary || '当前还没有可用的结构化摘要。'}
                        </p>
                        <div className="story-structured-actions">
                          <button
                            type="button"
                            className="story-structured-action-button"
                            onClick={() => regenerateStoryNodesFromStructuredOutput(selectedNode)}
                          >
                            从当前 JSON 重新生成节点
                          </button>
                        </div>
                        <div className="story-structured-stats">
                          <article className="story-structured-stat">
                            <span>全局资产</span>
                            <strong>{getStoryGlobalAssetCount(selectedStoryStructuredOutput)}</strong>
                          </article>
                          <article className="story-structured-stat">
                            <span>叙事段落</span>
                            <strong>{selectedStoryStructuredOutput.narrativeSegments.length}</strong>
                          </article>
                          <article className="story-structured-stat">
                            <span>预计总时长</span>
                            <strong>{getStoryDurationSeconds(selectedStoryStructuredOutput)} 秒</strong>
                          </article>
                          <article className="story-structured-stat">
                            <span>分镜数量</span>
                            <strong>{getStoryShotCount(selectedStoryStructuredOutput)}</strong>
                          </article>
                        </div>
                        {selectedStoryStructuredOutput.styleNotes?.length ? (
                          <div className="story-structured-tags" aria-label="风格说明">
                            {selectedStoryStructuredOutput.styleNotes.map((note, index) => (
                              <span className="story-structured-tag" key={`${note}-${index}`}>
                                {note}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {selectedStoryStructuredOutput.narrativeSegments.length > 0 ? (
                          <div className="story-segment-list">
                            {selectedStoryStructuredOutput.narrativeSegments.map((segment) => (
                              <article className="story-segment-card" key={segment.id}>
                                <div className="story-segment-card-head">
                                  <strong>{segment.title}</strong>
                                  <span>{segment.durationSeconds} 秒</span>
                                </div>
                                <div className="story-segment-card-meta">
                                  <span>{segment.shots.length} 个分镜</span>
                                  <span>{segment.continuityNotes.length} 条连续性要求</span>
                                  <span>
                                    开场转场：{segment.openingTransition.description}
                                  </span>
                                </div>
                                <div className="story-segment-detail-grid">
                                  {getStorySegmentAssetSummary(segment).map((item) => (
                                    <section
                                      className="story-segment-detail-block"
                                      key={`${segment.id}:${item.label}`}
                                    >
                                      <h4>{item.label}</h4>
                                      <p>{formatStoryPromptPreview(item.prompt)}</p>
                                    </section>
                                  ))}
                                </div>
                                <section className="story-segment-detail-block">
                                  <h4>分镜详情</h4>
                                  <div className="story-shot-list">
                                    {segment.shots.map((shot) => (
                                      <article className="story-shot-card" key={shot.id}>
                                        <div className="story-shot-card-head">
                                          <strong>{shot.title}</strong>
                                          <span>{shot.durationSeconds} 秒</span>
                                        </div>
                                        <ul>
                                          {formatStoryShotMeta(shot).map((line) => (
                                            <li key={`${shot.id}:${line}`}>{line}</li>
                                          ))}
                                        </ul>
                                      </article>
                                    ))}
                                  </div>
                                </section>
                                {segment.continuityNotes.length > 0 ? (
                                  <section className="story-segment-detail-block">
                                    <h4>连续性说明</h4>
                                    <ul className="story-segment-note-list">
                                      {segment.continuityNotes.map((note, index) => (
                                        <li key={`${segment.id}:continuity:${index}`}>{note}</li>
                                      ))}
                                    </ul>
                                  </section>
                                ) : null}
                                <div className="story-segment-card-actions">
                                  <button
                                    type="button"
                                    className="story-structured-action-button"
                                    onClick={() =>
                                      regenerateStoryNodesFromStructuredOutput(selectedNode, {
                                        structuredOutput: {
                                          ...selectedStoryStructuredOutput,
                                          globalAssets: {
                                            scenePrompts: [],
                                            characterSheetPrompts: [],
                                            propSheetPrompts: [],
                                          },
                                          narrativeSegments: [segment],
                                        },
                                        expansionMode: 'full',
                                      })
                                    }
                                  >
                                    {`生成“${segment.title}”节点`}
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  <label>
                    结构化摘要
                    <input
                      aria-label="结构化摘要"
                      value={selectedNode.storyStructuredOutput?.storySummary ?? ''}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyStructuredOutput: {
                            ...(current.storyStructuredOutput ?? createEmptyStoryStructuredOutput()),
                            storySummary: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    原始结构化结果
                    <textarea
                      aria-label="原始结构化结果"
                      value={selectedNode.storyRawOutput ?? ''}
                      onChange={(event) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          storyRawOutput: event.target.value,
                          storyStructuredOutput: {
                            ...(current.storyStructuredOutput ?? createEmptyStoryStructuredOutput()),
                            rawModelOutput: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
              {selectedNode.kind === 'video' ? (
                <div className="video-generation-settings">
                  <div className="video-format-row">
                    <label>
                      类型
                      <InlineOptionSelect
                        ariaLabel="类型"
                        value={selectedVideoScenario}
                        menuKey={`video-scenario:${selectedNode.id}`}
                        openMenuKey={openInlineSelectKey}
                        setOpenMenuKey={setOpenInlineSelectKey}
                        onChange={(value) =>
                          handleVideoScenarioChange(
                            selectedNode.id,
                            value as SeedanceScenario,
                          )
                        }
                        options={getVideoScenarioOptions().map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                      />
                    </label>
                    <label className="video-format-field">
                      模型调用格式
                      <InlineOptionSelect
                        ariaLabel="模型调用格式"
                        value={selectedVideoFormat}
                        menuKey={`video-format:${selectedNode.id}`}
                        openMenuKey={openInlineSelectKey}
                        setOpenMenuKey={setOpenInlineSelectKey}
                        onChange={(value) => {
                          const nextFormat = value as VideoModelFormat;
                          const nodeForFormat = {
                            ...selectedNode,
                            videoModelFormat: nextFormat,
                            modelId: isSoraCompatibleVideoFormat(nextFormat) ? nextFormat : selectedNode.modelId,
                          };
                          const nextProviders = findProvidersForNode(nodeForFormat);
                          const nextProvider = nextProviders.find(
                            (provider) => provider.id === selectedNode.providerId,
                          ) ?? nextProviders[0];
                          const nextModel = nextProvider
                            ? findProviderModelsForNodeWithProvider(nodeForFormat, nextProvider)[0]
                            : undefined;
                          const nextProviderModelId = nextModel?.providerModelId;
                          const nextCanonicalModel =
                            isSoraCompatibleVideoFormat(nextFormat)
                              ? nextFormat
                              : nextModel && isSeedanceVideoModel(nextModel.canonicalModelId)
                                ? nextModel.canonicalModelId
                                : 'seedance2.0';
                          const nextCapabilities = getVideoCapabilities(nextCanonicalModel);
                          updateNode(selectedNode.id, (current) => ({
                            ...current,
                            videoModelFormat: nextFormat,
                            providerId: nextProvider?.id,
                            providerModelId: nextProviderModelId,
                            modelId: nextCanonicalModel,
                            videoResolution: nextCapabilities.supportedResolutions.includes(
                              current.videoResolution ?? '720p',
                            )
                              ? current.videoResolution
                              : nextCapabilities.supportedResolutions[0],
                            videoRatio: nextCapabilities.supportedRatios.includes(
                              current.videoRatio ?? getDefaultVideoRatio(nextCanonicalModel),
                            )
                              ? current.videoRatio ?? getDefaultVideoRatio(nextCanonicalModel)
                              : getDefaultVideoRatio(nextCanonicalModel),
                            videoDurationSeconds: normalizeVideoDurationSeconds(
                              nextCanonicalModel,
                              current.videoDurationSeconds ?? 5,
                            ),
                            videoFramesPerSecond: nextCapabilities.fixedFrameRate,
                          }));
                        }}
                        options={getVideoModelOptions({ allowSoraFormat: soraFormatAvailable }).map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                      />
                    </label>
                  </div>
                  {visibleVideoFields.includes('resolution') ||
                  visibleVideoFields.includes('ratio') ||
                  visibleVideoFields.includes('duration') ? (
                    <div className="video-top-inline-fields">
                      {visibleVideoFields.includes('resolution') ? (
                        <label className="video-inline-setting">
                          <span>分辨率</span>
                          <InlineOptionSelect
                            ariaLabel="分辨率"
                            value={
                              selectedNode.videoResolution ??
                              selectedVideoCapabilities?.supportedResolutions[0] ??
                              '720p'
                            }
                            menuKey={`video-resolution:${selectedNode.id}`}
                            openMenuKey={openInlineSelectKey}
                            setOpenMenuKey={setOpenInlineSelectKey}
                            variant="compact"
                            options={(selectedVideoCapabilities?.supportedResolutions ?? ['720p']).map(
                              (resolution) => ({
                                value: resolution,
                                label: resolution,
                              }),
                            )}
                            onChange={(resolution) =>
                              updateNode(selectedNode.id, (current) => ({
                                ...current,
                                videoResolution: resolution as '480p' | '720p' | '1080p',
                              }))
                            }
                          />
                        </label>
                      ) : null}
                      {visibleVideoFields.includes('ratio') ? (
                        <label className="video-inline-setting">
                          <span>比例</span>
                          <InlineOptionSelect
                            ariaLabel="比例"
                            value={
                              selectedNode.videoRatio ??
                              (selectedVideoCapabilities
                                ? getDefaultVideoRatio(selectedVideoModel)
                                : '16:9')
                            }
                            menuKey={`video-ratio:${selectedNode.id}`}
                            openMenuKey={openInlineSelectKey}
                            setOpenMenuKey={setOpenInlineSelectKey}
                            variant="compact"
                            options={(selectedVideoCapabilities?.supportedRatios ?? ['16:9']).map((ratio) => ({
                              value: ratio,
                              label: ratio === 'adaptive' ? 'adaptive' : ratio,
                            }))}
                            onChange={(ratio) =>
                              updateNode(selectedNode.id, (current) => ({
                                ...current,
                                videoRatio: ratio as SeedanceRatio,
                              }))
                            }
                          />
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
                              min={
                                selectedSeedanceConfigModel
                                  ? Math.max(4, getVideoDurationInputBounds(selectedVideoModel).min)
                                  : getVideoDurationInputBounds(selectedVideoModel).min
                              }
                              max={getVideoDurationInputBounds(selectedVideoModel).max}
                              step={1}
                              value={
                                selectedNode.videoDurationSeconds === -1
                                  ? getVideoCapabilities(selectedVideoModel).durationRangeSeconds.min
                                  : selectedNode.videoDurationSeconds ?? 5
                              }
                              disabled={selectedNode.videoDurationSeconds === -1}
                              onChange={(event) =>
                                updateNode(selectedNode.id, (current) => ({
                                  ...current,
                                  videoDurationSeconds: normalizeVideoDurationSeconds(
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
                                    : normalizeVideoDurationSeconds(
                                        selectedVideoModel,
                                        current.videoDurationSeconds === -1
                                          ? getVideoCapabilities(selectedVideoModel)
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
                  {getVideoModelFormatHint(selectedVideoFormat) ? (
                    <p className="video-scene-hint video-format-hint">
                      {getVideoModelFormatHint(selectedVideoFormat)}
                    </p>
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
              {selectedNode.kind === 'chat' ||
              selectedNode.kind === 'image' ||
              selectedNode.kind === 'video' ? (
                <>
                  <label>
                    供应商
                    <InlineOptionSelect
                      value={selectedNodeProviderSelection?.effectiveProviderId ?? ''}
                      ariaLabel="供应商"
                      menuKey={`node-provider:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) => {
                        const nextProviderId = value || undefined;
                        const nextProvider = findProvidersForNode(selectedNode).find(
                          (provider) => provider.id === nextProviderId,
                        );
                        const nextModel = nextProvider
                          ? findProviderModelsForNodeWithProvider(selectedNode, nextProvider)[0]
                          : undefined;
                        const nextProviderModelId =
                          nextModel?.providerModelId;

                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          providerId: nextProviderId,
                          providerModelId: nextProviderModelId,
                          modelId:
                            isChatLikeNode(selectedNode) && nextModel
                              ? nextModel.providerModelId
                              : selectedNode.kind === 'video' &&
                                  nextModel
                                ? nextModel.canonicalModelId
                              : current.modelId,
                        }));
                      }}
                      options={findProvidersForNode(selectedNode).map((provider) => ({
                        value: provider.id,
                        label: provider.name,
                      }))}
                    />
                  </label>
                  <label>
                    供应商模型
                    <InlineOptionSelect
                      value={selectedNodeProviderSelection?.effectiveProviderModelId ?? ''}
                      ariaLabel="供应商模型"
                      menuKey={`node-provider-model:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) => {
                        const nextProviderModelId = value || undefined;
                        const nextModel = findProviderModelsForNode(selectedNode).find(
                          (model) => model.providerModelId === nextProviderModelId,
                        );

                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          providerModelId: nextProviderModelId,
                          modelId:
                            isChatLikeNode(selectedNode) && nextProviderModelId
                              ? nextProviderModelId
                              : selectedNode.kind === 'video' &&
                                  nextModel
                                ? nextModel.canonicalModelId
                              : current.modelId,
                        }));
                      }}
                      options={findProviderModelsForNode(selectedNode).map((model) => ({
                        value: model.providerModelId,
                        label: model.displayName ?? model.providerModelId,
                      }))}
                    />
                  </label>
                </>
              ) : null}
              {selectedNode.kind === 'image' ? (
                <div className="image-generation-settings">
                  <label>
                    分辨率
                    <InlineOptionSelect
                      value={selectedNode.imageResolutionTier ?? defaultImageResolutionTier}
                      ariaLabel="图片分辨率"
                      menuKey={`image-resolution-tier:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) => {
                        const nextTier = value as ImageResolutionTier;
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
                      options={imageResolutionOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    />
                  </label>
                  <label>
                    比例
                    <InlineOptionSelect
                      value={selectedNode.imageAspectRatio ?? defaultImageAspectRatio}
                      ariaLabel="图片比例"
                      menuKey={`image-aspect-ratio:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          imageAspectRatio: value,
                        }))
                      }
                      options={getImageAspectOptions(
                        selectedNode.imageResolutionTier ?? defaultImageResolutionTier,
                      ).map((option) => ({
                        value: option.ratio,
                        label: getImageAspectOptionLabel(option),
                      }))}
                    />
                  </label>
                  <label>
                    质量
                    <InlineOptionSelect
                      value={selectedNode.imageQuality ?? defaultImageQuality}
                      ariaLabel="图片质量"
                      menuKey={`image-quality:${selectedNode.id}`}
                      openMenuKey={openInlineSelectKey}
                      setOpenMenuKey={setOpenInlineSelectKey}
                      onChange={(value) =>
                        updateNode(selectedNode.id, (current) => ({
                          ...current,
                          imageQuality: value as ImageQuality,
                        }))
                      }
                      options={imageQualityOptions.map((option) => ({
                        value: option.value,
                        label: `${option.label} - ${option.description}`,
                      }))}
                    />
                  </label>
                </div>
              ) : null}
              {selectedNode.kind === 'chat' ||
              selectedNode.kind === 'image' ||
              selectedNode.kind === 'video' ? (
                <label>
                  提示词
                  <PromptTextarea
                    canvas={activeCanvas}
                    node={selectedNode}
                    ariaLabel="提示词"
                    placeholder={getNodePromptPlaceholder(selectedNode)}
                    onChange={(value) =>
                      updateNode(selectedNode.id, (current) => ({
                        ...current,
                        prompt: value,
                      }))
                    }
                  />
                </label>
              ) : null}
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
                    {editingOutputNode.kind === 'story' &&
                    editingOutputStoryStructuredOutput &&
                    (editingOutputStoryStructuredOutput.storySummary.trim() ||
                      editingOutputStoryStructuredOutput.narrativeSegments.length > 0 ||
                      getStoryGlobalAssetCount(editingOutputStoryStructuredOutput) > 0) ? (
                        <div className="output-modal-story-actions">
                          <button
                            type="button"
                            className="story-structured-action-button"
                            onClick={() => regenerateStoryNodesFromStructuredOutput(editingOutputNode)}
                          >
                            从当前 JSON 重新生成节点
                          </button>
                          {editingOutputStoryStructuredOutput.narrativeSegments.map((segment) => (
                            <button
                              key={segment.id}
                              type="button"
                              className="story-structured-action-button"
                              onClick={() =>
                                regenerateStoryNodesFromStructuredOutput(editingOutputNode, {
                                  structuredOutput: {
                                    ...editingOutputStoryStructuredOutput,
                                    globalAssets: {
                                      scenePrompts: [],
                                      characterSheetPrompts: [],
                                      propSheetPrompts: [],
                                    },
                                    narrativeSegments: [segment],
                                  },
                                  expansionMode: 'full',
                                })
                              }
                            >
                              {`生成“${segment.title}”节点`}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    {outputEditorMode === 'preview' ? (
                      <div className="output-modal-preview-shell">
                        <OutputPreviewContent
                          html={renderMarkdownToHtml(draftOutputText)}
                          previewRef={outputPreviewRef}
                          onWheel={handleModalScrollableWheel}
                          onPointerDown={handleOutputPreviewPointerDown}
                          onPointerUp={handleOutputPreviewPointerUp}
                          onKeyUp={handleOutputPreviewKeyUp}
                        />
                        {outputSelectionToolbar ? (
                          <button
                            type="button"
                            className={`output-selection-copy-button ${
                              outputSelectionToolbar.copied ? 'is-copied' : ''
                            }`}
                            style={{
                              left: outputSelectionToolbar.left,
                              top: outputSelectionToolbar.top,
                            }}
                            onPointerDown={(event) => {
                              outputSelectionToolbarPointerDownRef.current = true;
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={() => void copySelectedOutputText()}
                          >
                            {outputSelectionToolbar.copied ? (
                              <>
                                <Check size={14} />
                                已复制
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                复制
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <textarea
                        className="output-modal-textarea"
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
