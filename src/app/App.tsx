import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BoxSelect,
  FilePlus2,
  FileText,
  FolderOpen,
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
  Save,
  Settings,
  SquareArrowUpRight,
  Trash2,
  Undo2,
  Redo2,
  Video,
  X,
} from 'lucide-react';
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
import {
  appendOutputVersion,
  getLatestOutputVersion,
  getOutputVersionsForDisplay,
  paginateOutputVersions,
} from '../domain/outputVersions';
import { removePromptReferenceAtCaret } from '../domain/promptReferences';
import { createGenerationRecord, type GenerationRecord } from '../domain/generationHistory';
import {
  getEffectiveNodeOutputText,
  resolveProviderToken,
  streamChatGenerationNode,
  submitGenerationNode,
} from '../models/generationClient';
import { renderMarkdownToHtml, shouldCollapseMarkdown } from '../lib/markdown';
import {
  addCanvasEdge,
  canConnectCanvasNodes,
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
  updateWorkspaceStorage,
  type CanvasNodeKind,
  type CanvasNodeView,
  type CanvasView,
} from './canvasWorkspace';
import {
  moveCanvasNode,
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
  parseStoredCanvasViewports,
  serializeStoredCanvasViewports,
  type StoredCanvasViewports,
} from './canvasViewports';

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

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<{ name: string }>;
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

type ModalDragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type CanvasActionRailProps = {
  canUndo: boolean;
  canRedo: boolean;
  onAddNode: (clientX: number, clientY: number) => void;
  onCreateCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportCanvas: () => void;
  onImportCanvas: () => void;
};

function CanvasActionRail({
  canUndo,
  canRedo,
  onAddNode,
  onCreateCanvas,
  onUndo,
  onRedo,
  onExportCanvas,
  onImportCanvas,
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
      </div>
    </div>
  );
}

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
        id: 'model_openai_gpt_image_2',
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
      {
        id: 'model_openai_chat',
        providerModelId: 'gpt-5.4-mini',
        canonicalModelId: 'chat-openai',
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
        id: 'model_seedance_2_0',
        providerModelId: 'doubao-seedance-2-0-260128',
        canonicalModelId: 'seedance2.0',
        enabled: true,
      },
      {
        id: 'model_seedance_2_0_fast',
        providerModelId: 'doubao-seedance-2-0-fast-260128',
        canonicalModelId: 'seedance2.0-fast',
        enabled: true,
      },
    ],
  },
  {
    id: 'provider_anthropic',
    name: 'Anthropic 官方',
    protocol: 'anthropic-compatible',
    baseURL: 'https://api.anthropic.com/v1',
    apiTokenRef: 'secret_anthropic',
    enabled: true,
    models: [
      {
        id: 'model_anthropic_chat',
        providerModelId: 'claude-sonnet-4-5',
        canonicalModelId: 'chat-anthropic',
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
        modelId: 'gpt-5.4-mini',
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
const deletedProviderStorageKey = 'shot-agent:deleted-providers';
const canvasViewportStorageKey = 'shot-agent:canvas-viewports';
const canvasNodeSize = { width: 320, height: 220 };
const minimapSize = { width: 220, height: 150 };
const defaultViewport: CanvasViewport = { x: 80, y: 72, scale: 1 };

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
  textPreview?: string;
};

type PromptReferencePreview = PromptReferenceSuggestion & {
  kind: 'text' | 'image';
};

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

function getPromptReferenceSuggestions(
  canvas: CanvasView | null,
  currentNodeId: string,
): PromptReferenceSuggestion[] {
  if (!canvas) {
    return [];
  }

  return canvas.nodes.flatMap<PromptReferenceSuggestion>((node) => {
    if (node.id === currentNodeId) {
      return [];
    }

    const textPreview = getNodeTextReferencePreview(node);
    if (textPreview) {
      return [
        {
          token: `@text:${node.id}`,
          title: node.title,
          subtitle: node.id,
          kindLabel: '文本',
          textPreview,
        },
      ];
    }

    const imageUrl = getNodeImageReferenceUrl(node);
    if (imageUrl) {
      return [
        {
          token: `@image:${node.id}`,
          title: node.title,
          subtitle: node.id,
          kindLabel: '图片',
          imageUrl,
        },
      ];
    }

    return [];
  });
}

function getPromptReferencePreviews(
  canvas: CanvasView | null,
  currentNodeId: string,
  prompt: string,
): PromptReferencePreview[] {
  if (!canvas) {
    return [];
  }

  const seenTokens = new Set<string>();

  return Array.from(prompt.matchAll(/@(text|image):([a-zA-Z0-9_-]+)/g)).flatMap<PromptReferencePreview>(
    (match) => {
      const kind = match[1] as 'text' | 'image';
      const nodeId = match[2];
      const token = match[0];

      if (seenTokens.has(token)) {
        return [];
      }
      seenTokens.add(token);

      const referencedNode = canvas.nodes.find(
        (candidate) => candidate.id === nodeId && candidate.id !== currentNodeId,
      );
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
    },
  );
}

function getPromptReferenceTrigger(value: string, caret: number) {
  const prefix = value.slice(0, caret);
  const match = prefix.match(/(@[a-zA-Z]*(?::[a-zA-Z0-9_-]*)?)$/);

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
    const searchable = `${suggestion.token} ${suggestion.title} ${suggestion.subtitle}`.toLowerCase();

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
    label.textContent = reference.textPreview ?? reference.title;
    token.append(label);
  }

  return token;
}

function renderPromptEditorContent(
  root: HTMLElement,
  value: string,
  references: PromptReferencePreview[],
  onPreviewImage: (reference: PromptReferencePreview) => void,
) {
  const referenceByToken = new Map(references.map((reference) => [reference.token, reference]));
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of value.matchAll(/@(text|image):([a-zA-Z0-9_-]+)/g)) {
    const token = match[0];
    const start = match.index ?? 0;
    const reference = referenceByToken.get(token);

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
  const [trigger, setTrigger] = useState<ReturnType<typeof getPromptReferenceTrigger>>(null);
  const [previewImage, setPreviewImage] = useState<PromptReferencePreview | null>(null);
  const suggestions = getPromptReferenceSuggestions(canvas, node.id);
  const referencePreviews = getPromptReferencePreviews(canvas, node.id, node.prompt ?? '');
  const visibleSuggestions = trigger
    ? filterPromptReferenceSuggestions(suggestions, trigger.query).slice(0, 8)
    : [];

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) {
      return;
    }

    renderPromptEditorContent(editor, node.prompt ?? '', referencePreviews, setPreviewImage);
  }, [node.prompt, referencePreviews]);

  function syncEditorValue(nextValue: string, nextCaret?: number) {
    const editor = editorRef.current;
    if (!editor) {
      onChange(nextValue);
      return;
    }

    renderPromptEditorContent(editor, nextValue, getPromptReferencePreviews(canvas, node.id, nextValue), setPreviewImage);
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      editor.focus();
      setPromptEditorCaretOffset(editor, nextCaret ?? nextValue.length);
    });
  }

  function refreshTrigger(target: HTMLElement) {
    const value = serializePromptEditor(target);
    setTrigger(getPromptReferenceTrigger(value, getPromptEditorCaretOffset(target)));
  }

  function handleEditorInput(target: HTMLElement) {
    onChange(serializePromptEditor(target));
    refreshTrigger(target);
  }

  function insertSuggestion(suggestion: PromptReferenceSuggestion) {
    if (!trigger) {
      return;
    }

    const value = node.prompt ?? '';
    const nextValue = `${value.slice(0, trigger.start)}${suggestion.token} ${value.slice(trigger.end)}`;
    const nextCaret = trigger.start + suggestion.token.length + 1;

    setTrigger(null);
    syncEditorValue(nextValue, nextCaret);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
        onKeyUp={(event) => refreshTrigger(event.currentTarget)}
        onKeyDown={handleEditorKeyDown}
        onInput={(event) => handleEditorInput(event.currentTarget)}
      />
      {visibleSuggestions.length > 0 ? (
        <div className="prompt-reference-menu">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion.token}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertSuggestion(suggestion)}
            >
              {suggestion.imageUrl ? (
                <img src={suggestion.imageUrl} alt={suggestion.title} />
              ) : (
                <span>{suggestion.kindLabel}</span>
              )}
              <strong>{suggestion.title}</strong>
              <small>{suggestion.textPreview ? `@${suggestion.textPreview}` : suggestion.token}</small>
            </button>
          ))}
        </div>
      ) : null}
      {previewImage?.imageUrl
        ? createPortal(
            <div
              className="prompt-reference-image-backdrop"
              onPointerDown={() => setPreviewImage(null)}
            >
              <div
                className="prompt-reference-image-modal"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header>
                  <strong>{previewImage.title}</strong>
                  <button type="button" onClick={() => setPreviewImage(null)}>
                    <X size={16} />
                    关闭
                  </button>
                </header>
                <img src={previewImage.imageUrl} alt={previewImage.title} />
              </div>
            </div>,
            document.body,
          )
        : null}
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
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderConfig>>({});
  const [editingProviderIds, setEditingProviderIds] = useState<string[]>([]);
  const [showProviderManager, setShowProviderManager] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspaceState, setWorkspaceState] = useState(() => {
    if (typeof window === 'undefined') {
      return initialWorkspaceState;
    }

    return parseWorkspaceState(
      window.localStorage.getItem(workspaceStorageKey),
      initialWorkspaceState,
    );
  });
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
  const [workspaceHistory, setWorkspaceHistory] =
    useState<WorkspaceHistory<typeof workspaceState>>(createWorkspaceHistory);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [canvasMessage, setCanvasMessage] = useState<string | null>(null);
  const [isRenamingCanvas, setIsRenamingCanvas] = useState(false);
  const [draftCanvasName, setDraftCanvasName] = useState('');
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [draftListCanvasName, setDraftListCanvasName] = useState('');
  const [editingOutputNodeId, setEditingOutputNodeId] = useState<string | null>(null);
  const [editingNodeTitleId, setEditingNodeTitleId] = useState<string | null>(null);
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [selectedOutputVersionId, setSelectedOutputVersionId] = useState<string | null>(null);
  const [outputVersionPage, setOutputVersionPage] = useState(1);
  const [draftOutputText, setDraftOutputText] = useState('');
  const [outputEditorMode, setOutputEditorMode] = useState<'preview' | 'edit'>('preview');
  const [outputModalPosition, setOutputModalPosition] = useState({ x: 0, y: 0 });
  const [modalDragState, setModalDragState] = useState<ModalDragState | null>(null);
  const { activeCanvasId, canvases, storage } = workspaceState;
  const canUndoWorkspace = workspaceHistory.past.length > 0;
  const canRedoWorkspace = workspaceHistory.future.length > 0;
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId) ?? null;
  const selectedNode =
    activeCanvas?.nodes.find((node) => node.id === selectedNodeId) ?? null;
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
  const minimapBounds = getCanvasContentBounds(activeCanvas?.nodes ?? [], canvasNodeSize);
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
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
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
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setAddMenu(null);
    setEdgeDraft(null);
  }

  useEffect(() => {
    workspaceStateRef.current = workspaceState;
  }, [workspaceState]);

  useEffect(() => {
    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(workspaceState));
  }, [workspaceState]);

  useEffect(() => {
    window.localStorage.setItem(
      canvasViewportStorageKey,
      serializeStoredCanvasViewports(canvasViewports),
    );
  }, [canvasViewports]);

  useEffect(() => {
    window.localStorage.setItem(providerStorageKey, JSON.stringify(providers));
  }, [providers]);

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
      const key = event.key.toLowerCase();
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z';
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        ((event.shiftKey && key === 'z') || key === 'y');

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
        setWorkspaceStateWithHistory((current) => ({
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
  }, [canRedoWorkspace, canUndoWorkspace, selectedEdgeId, selectedNodeId, workspaceHistory]);

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

  function selectCanvasFromSidebar(canvasId: string) {
    setActiveCanvasId(canvasId);
    setShowProviderManager(false);
    setAddMenu(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function updateActiveCanvasNodes(
    updater: (nodes: CanvasNodeView[]) => CanvasNodeView[],
    options: { history?: boolean } = {},
  ) {
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

  function addGenerationHistoryRecord(record: GenerationRecord) {
    setWorkspaceStateWithHistory((current) => ({
      ...current,
      generationHistory: [record, ...(current.generationHistory ?? [])],
    }));
  }

  function updateGenerationHistoryRecord(
    recordId: string,
    updater: (record: GenerationRecord) => GenerationRecord,
  ) {
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

  function addNode(template: NodeTemplate) {
    if (!activeCanvas) {
      return;
    }

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
      const fromNode = activeCanvas.nodes.find((node) => node.id === addMenu.fromNodeId);
      const toNode = { id: nodeId, title: template.title, modelId: template.modelId, kind: template.kind, x: point.x, y: point.y };

      if (fromNode && canConnectCanvasNodes(fromNode, toNode)) {
        updateActiveCanvasEdges((edges) => addCanvasEdge(edges, addMenu.fromNodeId!, nodeId));
      }
    }
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
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

  function startRenameNode(node: CanvasNodeView) {
    setEditingNodeTitleId(node.id);
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
    setDraftNodeTitle('');
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
    setWorkspaceStateWithHistory((current) => ({
      ...current,
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
    setViewport(defaultViewport);
    setCanvasMessage(null);
  }

  async function chooseCanvasStorageFolder() {
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;

    if (!picker) {
      setWorkspaceStateWithHistory((current) =>
        updateWorkspaceStorage(current, {
          mode: 'custom-folder',
          folderName: current.storage.mode === 'custom-folder' ? current.storage.folderName : undefined,
          folderPath: current.storage.mode === 'custom-folder' ? current.storage.folderPath : undefined,
        }),
      );
      setCanvasMessage('当前浏览器不支持直接选择文件夹，可手动填写存储路径或名称');
      return;
    }

    try {
      const directory = await picker();
      setWorkspaceStateWithHistory((current) =>
        updateWorkspaceStorage(current, {
          mode: 'custom-folder',
          folderName: directory.name,
          folderPath: directory.name,
        }),
      );
      setCanvasMessage(`画布存储文件夹已设置为：${directory.name}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setCanvasMessage('选择画布存储文件夹失败');
    }
  }

  function updateCanvasStorageFolder(value: string) {
    const folderValue = value.trim();

    setWorkspaceStateWithHistory((current) =>
      updateWorkspaceStorage(
        current,
        folderValue
          ? {
              mode: 'custom-folder',
              folderPath: folderValue,
            }
          : {
              mode: 'browser-local',
            },
      ),
    );
  }

  function renameActiveCanvas(name: string) {
    setWorkspaceStateWithHistory((current) => renameCanvas(current, current.activeCanvasId, name));
  }

  function startRenameActiveCanvas() {
    if (!activeCanvas) {
      return;
    }

    setDraftCanvasName(activeCanvas.name);
    setIsRenamingCanvas(true);
  }

  function commitRenameActiveCanvas() {
    renameActiveCanvas(draftCanvasName);
    setIsRenamingCanvas(false);
  }

  function deleteActiveCanvas() {
    if (!activeCanvasId) {
      return;
    }

    setWorkspaceStateWithHistory((current) => deleteCanvas(current, current.activeCanvasId));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setAddMenu(null);
    setViewport(defaultViewport);
    setCanvasMessage(null);
  }

  function deleteCanvasById(canvasId: string) {
    setWorkspaceStateWithHistory((current) => deleteCanvas(current, canvasId));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setAddMenu(null);
    setEditingCanvasId(null);
    setViewport(defaultViewport);
  }

  function startRenameCanvasFromList(canvas: CanvasView) {
    setEditingCanvasId(canvas.id);
    setDraftListCanvasName(canvas.name);
  }

  function commitRenameCanvasFromList(canvasId: string) {
    setWorkspaceStateWithHistory((current) => renameCanvas(current, canvasId, draftListCanvasName));
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
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
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
    setWorkspaceHistory((history) => pushWorkspaceHistory(history, workspaceState));
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

    const clientDelta = {
      dx: event.clientX - dragState.lastX,
      dy: event.clientY - dragState.lastY,
    };
    const delta = getCanvasDeltaFromClientDelta(clientDelta);

    if (dragState.mode === 'pan') {
      setViewport((current) => panViewport(current, delta));
    } else {
      updateActiveCanvasNodes((nodes) =>
        nodes.map((node) =>
          node.id === dragState.nodeId
            ? { ...node, ...moveCanvasNode(node, delta, viewport.scale) }
            : node,
        ),
        { history: false },
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
    if (!activeCanvas) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const from = getNodeOutputPoint(node);

    setAddMenu(null);
    setDragState(null);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
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

    const fromNode = activeCanvas?.nodes.find((node) => node.id === edgeDraft.fromNodeId);
    const toNode = activeCanvas?.nodes.find((node) => node.id === toNodeId);

    if (!fromNode || !toNode || !canConnectCanvasNodes(fromNode, toNode)) {
      setCanvasMessage('视频节点暂不允许连接到文本生成节点');
      setEdgeDraft(null);
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

  function focusMinimapPoint(event: PointerEvent<HTMLButtonElement>) {
    if (!activeCanvas) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const bounds = getCanvasContentBounds(activeCanvas.nodes, canvasNodeSize);
    const xRatio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
    const yRatio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    const center = {
      x: bounds.minX + bounds.width * Math.min(1, Math.max(0, xRatio)),
      y: bounds.minY + bounds.height * Math.min(1, Math.max(0, yRatio)),
    };
    const canvas = canvasRef.current;

    setViewport(
      getViewportForCanvasCenter(
        center,
        canvasSize ??
          (canvas
            ? { width: canvas.offsetWidth, height: canvas.offsetHeight }
            : { width: 960, height: 640 }),
        viewport.scale,
      ),
    );
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
    const inputAssetIds = activeCanvas.edges
      .filter((edge) => edge.toNodeId === node.id)
      .map((edge) => edge.fromNodeId);
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
      generationId: generationRecordId,
      generationStatus: 'running',
      generationError: undefined,
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

    const result = await submitGenerationNode({
      canvas: activeCanvas,
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

    updateNode(node.id, (current) => {
      if (result.output.kind === 'image') {
        return {
          ...current,
          generationStatus: 'succeeded',
          generationError: undefined,
          outputDataUrl: result.output.dataUrl,
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
          outputUrl: undefined,
        };
      }

      return {
        ...current,
        generationStatus: result.output.videoUrl ? 'succeeded' : 'running',
        generationError: undefined,
        generationId: result.output.taskId ?? generationRecordId,
        outputUrl: result.output.videoUrl,
        outputText: result.output.status ? `任务状态：${result.output.status}` : undefined,
      };
    }, { history: false });
    updateGenerationHistoryRecord(generationRecordId, (record) => ({
      ...record,
      status: result.output.kind === 'video-task' && !result.output.videoUrl ? 'running' : 'succeeded',
      outputAssetIds:
        result.output.kind === 'image' && (result.output.dataUrl || result.output.url)
          ? [node.id]
          : result.output.kind === 'video-task' && result.output.videoUrl
            ? [node.id]
            : record.outputAssetIds,
      endedAt:
        result.output.kind === 'video-task' && !result.output.videoUrl
          ? record.endedAt
          : new Date().toISOString(),
    }));
  }

  const canvasNavigationPanel =
    !showProviderManager && activeCanvas
      ? (
          <div
            className="canvas-navigation-panel"
            style={{
              left: isSidebarCollapsed ? '66px' : 'min(219px, calc(100vw - 252px))',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="canvas-minimap"
              aria-label="缩略位置图"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={focusMinimapPoint}
            >
              {activeCanvas.nodes.map((node) => (
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
              {minimapViewport ? (
                <span
                  className="canvas-minimap-window"
                  style={{
                    left: (minimapViewport.x - minimapBounds.minX) * minimapScale,
                    top: (minimapViewport.y - minimapBounds.minY) * minimapScale,
                    width: Math.max(14, minimapViewport.width * minimapScale),
                    height: Math.max(10, minimapViewport.height * minimapScale),
                  }}
                />
              ) : null}
            </button>
          </div>
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
          <button type="button" onClick={() => setShowProviderManager(true)}>
            <Settings size={18} />
            供应商管理
          </button>
        </nav>
        <section className="panel storage-panel">
          <div className="panel-title-row">
            <h2>存储</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="选择画布存储文件夹"
              title="选择画布存储文件夹"
              onClick={() => void chooseCanvasStorageFolder()}
            >
              <FolderOpen size={15} />
            </button>
          </div>
          <label>
            画布存储文件夹
            <input
              value={storage.mode === 'custom-folder' ? storage.folderPath ?? storage.folderName ?? '' : ''}
              placeholder="默认使用浏览器本地存储"
              onChange={(event) => updateCanvasStorageFolder(event.target.value)}
            />
          </label>
          <p>
            {storage.mode === 'custom-folder'
              ? `当前：${storage.folderName ?? storage.folderPath ?? '自定义文件夹'}`
              : '当前：浏览器本地存储'}
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
                        <strong>{canvas.name}</strong>
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
                <span>{activeCanvas?.name ?? '暂无画布'}</span>
                {activeCanvas ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="重命名画布"
                    title="重命名画布"
                    onClick={startRenameActiveCanvas}
                  >
                    <Pencil size={15} />
                  </button>
                ) : null}
              </>
            )}
          </div>
          <div className="toolbar-actions">
            {showProviderManager ? (
              <div className="toolbar-provider-actions">
                <button type="button" onClick={addProvider}>
                  <Plus size={18} />
                  新增供应商
                </button>
              </div>
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
            <div className="provider-manager-header">
              <span>供应商管理</span>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭供应商管理"
                title="关闭供应商管理"
                onClick={returnToCanvas}
              >
                <X size={18} />
              </button>
            </div>
            <div className="provider-table provider-table-header">
              <span>供应商名称</span>
              <span>Base URL</span>
              <span>API Key / 引用</span>
              <span>协议</span>
              <span>状态</span>
              <span>模型映射</span>
              <span>操作</span>
            </div>
            <div className="provider-list">
              {providerRows.map((provider) => {
                const isEditingProvider = editingProviderIds.includes(provider.id);
                const providerView = providerDrafts[provider.id] ?? provider;

                return (
                <section
                  key={provider.id}
                  className={`provider-row ${isEditingProvider ? 'is-editing' : ''}`}
                >
                  <label>
                    供应商名称
                    <input
                      value={providerView.name}
                      disabled={!isEditingProvider}
                      onChange={(event) =>
                        updateProviderDraft(provider.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Base URL
                    <input
                      value={providerView.baseURL}
                      disabled={!isEditingProvider}
                      onChange={(event) =>
                        updateProviderDraft(provider.id, (current) => ({
                          ...current,
                          baseURL: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    API Key / 引用
                    <input
                      value={providerView.apiTokenRef}
                      disabled={!isEditingProvider}
                      onChange={(event) =>
                        updateProviderDraft(provider.id, (current) => ({
                          ...current,
                          apiTokenRef: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    协议
                    <select
                      value={providerView.protocol}
                      disabled={!isEditingProvider}
                      onChange={(event) =>
                        updateProviderDraft(provider.id, (current) => ({
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
                      checked={providerView.enabled}
                      disabled={!isEditingProvider}
                      onChange={(event) =>
                        updateProviderDraft(provider.id, (current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    启用
                  </label>
                  <div className="provider-models">
                    {providerView.models.map((model, modelIndex) => (
                      <div key={model.id ?? `model_${modelIndex}`}>
                        <label>
                          供应商模型 ID
                          <input
                            value={model.providerModelId}
                            disabled={!isEditingProvider}
                            onChange={(event) =>
                              updateProviderDraft(provider.id, (current) => ({
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
                            disabled={!isEditingProvider}
                            onChange={(event) =>
                              updateProviderDraft(provider.id, (current) => ({
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
                            disabled={!isEditingProvider}
                            onChange={(event) =>
                              updateProviderDraft(provider.id, (current) => ({
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
                    <button
                      type="button"
                      disabled={!isEditingProvider}
                      onClick={() => addProviderModel(provider.id)}
                    >
                      <Plus size={16} />
                      添加模型映射
                    </button>
                  </div>
                  <div className="provider-row-actions">
                    {isEditingProvider ? (
                      <>
                        <button type="button" onClick={() => saveEditedProvider(provider.id)}>
                          <Save size={16} />
                          保存
                        </button>
                        <button type="button" onClick={() => cancelEditProvider(provider.id)}>
                          <X size={16} />
                          取消
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => startEditProvider(provider)}>
                        <Pencil size={16} />
                        编辑
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-button"
                      disabled={isEditingProvider}
                      onClick={() => deleteProvider(provider.id)}
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                </section>
                );
              })}
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
          <CanvasActionRail
            canUndo={canUndoWorkspace}
            canRedo={canRedoWorkspace}
            onAddNode={(clientX, clientY) => openAddMenu(clientX, clientY)}
            onCreateCanvas={createCanvas}
            onUndo={undoWorkspace}
            onRedo={redoWorkspace}
            onExportCanvas={downloadActiveCanvas}
            onImportCanvas={() => importInputRef.current?.click()}
          />
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
              {activeCanvas?.edges.map((edge) => {
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
            {activeCanvas?.nodes.map((node) => {
              const Icon = getNodeIcon(node.kind);
              const providersForNode = findProvidersForNode(node);
              const isGenerating = runningNodeIds.has(node.id);
              const effectiveOutputText = getEffectiveNodeOutputText(node);
              const isLongOutput =
                effectiveOutputText !== undefined && shouldCollapseMarkdown(effectiveOutputText);

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
                      {editingNodeTitleId === node.id ? (
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
                              setDraftNodeTitle('');
                            }
                          }}
                        />
                      ) : (
                        <h2
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            startRenameNode(node);
                          }}
                        >
                          {node.title}
                        </h2>
                      )}
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
                        <PromptTextarea
                          canvas={activeCanvas}
                          node={node}
                          placeholder="输入提示词，使用 @text:节点ID 引用全文，@image:节点ID 引用图片"
                          stopPointerDown
                          onChange={(value) =>
                            updateNode(node.id, (current) => ({
                              ...current,
                              prompt: value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={isGenerating}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => void submitNodeGeneration(node)}
                        >
                          {isGenerating ? '提交中' : '生成'}
                        </button>
                        {node.generationError ? (
                          <p className="node-error">{node.generationError}</p>
                        ) : null}
                        {node.outputDataUrl || node.outputUrl ? (
                          node.kind === 'video' ? (
                            <video
                              className="asset-preview"
                              src={node.outputDataUrl ?? node.outputUrl}
                              controls
                            />
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
          {selectedNode ? (
            <aside className="node-inspector">
              <header>
                {editingNodeTitleId === selectedNode.id ? (
                  <input
                    className="node-title-input"
                    value={draftNodeTitle}
                    autoFocus
                    onBlur={() => commitRenameNode(selectedNode.id)}
                    onChange={(event) => setDraftNodeTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitRenameNode(selectedNode.id);
                      }

                      if (event.key === 'Escape') {
                        setEditingNodeTitleId(null);
                        setDraftNodeTitle('');
                      }
                    }}
                  />
                ) : (
                  <h2 onDoubleClick={() => startRenameNode(selectedNode)}>
                    {selectedNode.title}
                  </h2>
                )}
                <p>{selectedNode.modelId}</p>
              </header>
              <button type="button" className="danger-button" onClick={deleteSelectedNode}>
                <Trash2 size={16} />
                删除节点
              </button>
              <label>
                节点名称
                <input
                  value={selectedNode.title}
                  onChange={(event) =>
                    updateNode(selectedNode.id, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
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
              <label>
                提示词
                <PromptTextarea
                  canvas={activeCanvas}
                  node={selectedNode}
                  placeholder="输入节点提示词，支持 @text:节点ID 和 @image:节点ID"
                  onChange={(value) =>
                    updateNode(selectedNode.id, (current) => ({
                      ...current,
                      prompt: value,
                    }))
                  }
                />
              </label>
            </aside>
          ) : null}
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
        </div>
        )}
      </section>
      {canvasNavigationPanel ? createPortal(canvasNavigationPanel, document.body) : null}
    </main>
  );
}
