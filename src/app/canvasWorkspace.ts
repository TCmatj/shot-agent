import type { OutputVersion } from '../domain/outputVersions';
import type { GenerationRecord } from '../domain/generationHistory';
import type {
  StoryNodeExecutionMode,
  StoryNodeExpansionMode,
  StoryStructuredOutput,
} from '../domain/story';
import type {
  ImageQuality,
  ImageResolutionTier,
} from '../domain/imageGenerationOptions';
import type { VideoModelFormat } from '../domain/provider';
import {
  getSeedanceInputPorts,
  type SeedanceInputPortId,
  type SeedanceRatio,
} from '../domain/seedance';
import type { DiamondMaskColor, DiamondMaskRect } from '../models/diamondMask';

export type CanvasNodeKind =
  | 'image'
  | 'video'
  | 'chat'
  | 'story'
  | 'diamondMask'
  | 'textAsset'
  | 'imageAsset'
  | 'videoAsset'
  | 'audioAsset';

export type CanvasNodeView = {
  id: string;
  title: string;
  modelId: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  chatFormat?: 'openai' | 'anthropic';
  storyExecutionMode?: StoryNodeExecutionMode;
  storyExpansionMode?: StoryNodeExpansionMode;
  storyImageConcurrencyLimit?: number;
  storyVideoConcurrencyLimit?: number;
  storySystemPrompt?: string;
  storyStructuredOutput?: StoryStructuredOutput;
  storyRawOutput?: string;
  storySourceNodeId?: string;
  storyGenerationBatchId?: string;
  storySegmentId?: string;
  storyAssetRole?:
    | 'scene'
    | 'character_sheet'
    | 'prop_sheet'
    | 'segment_narrative'
    | 'segment_shots'
    | 'segment_first_frame'
    | 'segment_last_frame'
    | 'segment_motion_sketch'
    | 'segment_video';
  videoModelFormat?: VideoModelFormat;
  providerId?: string;
  providerModelId?: string;
  imageResolutionTier?: ImageResolutionTier;
  imageAspectRatio?: string;
  imageQuality?: ImageQuality;
  seedanceScenario?:
    | 'text_to_video'
    | 'image_to_video_first_frame'
    | 'image_to_video_first_last_frame'
    | 'multimodal_reference_video';
  videoResolution?: '480p' | '720p' | '1080p';
  videoRatio?: SeedanceRatio;
  videoDurationSeconds?: number;
  videoFramesPerSecond?: number;
  videoSeed?: number;
  videoGenerateAudio?: boolean;
  videoReturnLastFrame?: boolean;
  videoPriority?: number;
  estimatedTokenCost?: number;
  settledCompletionTokens?: number;
  settledTotalTokens?: number;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  prompt?: string;
  generationStatus?: 'idle' | 'running' | 'succeeded' | 'failed';
  generationError?: string;
  outputVersions?: OutputVersion[];
  modelOutputText?: string;
  outputText?: string;
  outputUrl?: string;
  outputDataUrl?: string;
  outputPath?: string;
  generationId?: string;
  maskImageName?: string;
  maskImagePath?: string;
  maskImageDataUrl?: string;
  maskImageMimeType?: string;
  maskImageWidth?: number;
  maskImageHeight?: number;
  maskLineWidth?: number;
  maskGridDensity?: number;
  maskColor?: DiamondMaskColor;
  maskRect?: DiamondMaskRect;
  textContent?: string;
  assetName?: string;
  assetPath?: string;
  assetDataUrl?: string;
  assetMimeType?: string;
};

export type CanvasEdgeView = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  toPortId?: SeedanceInputPortId | 'default';
};

export type CanvasSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasGroupBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasGroupView = {
  id: string;
  name: string;
  nodeIds: string[];
  // 手动设定的「最小框」（缩放/拖拽后记录）；实际渲染范围 = 该框 ∪ 所含节点并集，
  // 即节点拖出分组时分组自动扩大包含，拖入时不收缩（只扩不缩）。
  bounds?: CanvasGroupBounds;
};

export type CanvasView = {
  id: string;
  name: string;
  storageFolderName?: string;
  updatedAt: string;
  nodes: CanvasNodeView[];
  edges: CanvasEdgeView[];
  groups?: CanvasGroupView[];
};

export type CanvasClipboardPayload = {
  nodes: CanvasNodeView[];
  edges: CanvasEdgeView[];
};

export type CanvasStorageConfig =
  | {
      mode: 'browser-local';
    }
  | {
      mode: 'custom-folder';
      folderName?: string;
      folderPath?: string;
    };

export type CanvasWorkspaceState = {
  activeCanvasId: string;
  canvases: CanvasView[];
  storage: CanvasStorageConfig;
  generationHistory: GenerationRecord[];
  assetUploadCache?: Record<string, string>;
};

const canvasNodeBaseWidth = 320;
const canvasNodeMaxWidth = canvasNodeBaseWidth * 3;
const storyNodeBaseWidth = 560;
const canvasNodeBaseHeight = 220;
const canvasNodeMaxHeight = 1600;
const canvasNodeResizableMaxWidth = 1800;

const storageVersion = 1;
const canvasExportVersion = 1;

type PersistedCanvasWorkspaceState = CanvasWorkspaceState & {
  version: number;
};

type CanvasExportPayload = {
  version: number;
  canvas: CanvasView;
};

function isCanvasNodeView(value: unknown): value is CanvasNodeView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as CanvasNodeView;
  return (
    typeof node.id === 'string' &&
    typeof node.title === 'string' &&
    typeof node.modelId === 'string' &&
    isCanvasNodeKind(node.kind) &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
  );
}

function isCanvasNodeKind(kind: unknown): kind is CanvasNodeKind {
  return (
    kind === 'image' ||
    kind === 'video' ||
    kind === 'chat' ||
    kind === 'story' ||
    kind === 'diamondMask' ||
    kind === 'textAsset' ||
    kind === 'imageAsset' ||
    kind === 'videoAsset' ||
    kind === 'audioAsset'
  );
}

function isCanvasEdgeView(value: unknown): value is CanvasEdgeView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const edge = value as CanvasEdgeView;
  return (
    typeof edge.id === 'string' &&
    typeof edge.fromNodeId === 'string' &&
    typeof edge.toNodeId === 'string' &&
    (edge.toPortId === undefined || typeof edge.toPortId === 'string')
  );
}

function isCanvasView(value: unknown): value is CanvasView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const canvas = value as CanvasView;
  return (
    typeof canvas.id === 'string' &&
    typeof canvas.name === 'string' &&
    typeof canvas.updatedAt === 'string' &&
    Array.isArray(canvas.nodes) &&
    canvas.nodes.every(isCanvasNodeView) &&
    (canvas.edges === undefined ||
      (Array.isArray(canvas.edges) && canvas.edges.every(isCanvasEdgeView))) &&
    (canvas.groups === undefined ||
      (Array.isArray(canvas.groups) && canvas.groups.every(isCanvasGroupView)))
  );
}

function isCanvasGroupView(value: unknown): value is CanvasGroupView {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const group = value as CanvasGroupView;
  return (
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    Array.isArray(group.nodeIds) &&
    group.nodeIds.every((id) => typeof id === 'string')
  );
}

function normalizeCanvas(canvas: CanvasView): CanvasView {
  const normalized: CanvasView = {
    ...canvas,
    nodes: canvas.nodes.map(normalizeNode),
    edges: canvas.edges ?? [],
  };
  if (canvas.groups) {
    normalized.groups = canvas.groups.filter(isCanvasGroupView).map(normalizeGroup);
  }
  return normalized;
}

function normalizeGroup(group: CanvasGroupView): CanvasGroupView {
  return {
    id: group.id,
    name: group.name,
    nodeIds: group.nodeIds.filter((id): id is string => typeof id === 'string'),
    ...(group.bounds ? { bounds: normalizeGroupBounds(group.bounds) } : {}),
  };
}

function normalizeGroupBounds(bounds: unknown): CanvasGroupBounds {
  const raw = bounds as Partial<CanvasGroupBounds>;
  return {
    x: typeof raw.x === 'number' ? raw.x : 0,
    y: typeof raw.y === 'number' ? raw.y : 0,
    width: typeof raw.width === 'number' && raw.width > 0 ? raw.width : 0,
    height: typeof raw.height === 'number' && raw.height > 0 ? raw.height : 0,
  };
}

function isCanvasStorageConfig(value: unknown): value is CanvasStorageConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const storage = value as CanvasStorageConfig;

  if (storage.mode === 'browser-local') {
    return true;
  }

  if (storage.mode !== 'custom-folder') {
    return false;
  }

  return (
    (storage.folderName === undefined || typeof storage.folderName === 'string') &&
    (storage.folderPath === undefined || typeof storage.folderPath === 'string')
  );
}

function normalizeStorageConfig(storage?: CanvasStorageConfig): CanvasStorageConfig {
  if (!storage) {
    return {
      mode: 'custom-folder',
    };
  }

  if (storage.mode === 'browser-local') {
    return {
      mode: 'custom-folder',
    };
  }

  const folderName = storage.folderName?.trim();
  const folderPath = storage.folderPath?.trim();

  return {
    mode: 'custom-folder',
    ...(folderName ? { folderName } : {}),
    ...(folderPath ? { folderPath } : {}),
  };
}

export function createWorkspaceState(canvases: CanvasView[]): CanvasWorkspaceState {
  const firstCanvas = canvases[0];

  return {
    activeCanvasId: firstCanvas?.id ?? '',
    canvases,
    storage: {
      mode: 'custom-folder',
    },
    generationHistory: [],
    assetUploadCache: {},
  };
}

export function serializeWorkspaceState(state: CanvasWorkspaceState): string {
  return JSON.stringify({
    version: storageVersion,
    activeCanvasId: state.activeCanvasId,
    canvases: stripTransientAssetData(state.canvases),
    storage: normalizeStorageConfig(state.storage),
    generationHistory: state.generationHistory,
    assetUploadCache: normalizeAssetUploadCache(state.assetUploadCache),
  });
}

export function stripTransientAssetData(canvases: CanvasView[]): CanvasView[] {
  return canvases.map((canvas) => ({
    ...canvas,
    nodes: canvas.nodes.map((node) => ({
      ...node,
      assetDataUrl: node.assetPath ? undefined : node.assetDataUrl,
      maskImageDataUrl: node.maskImagePath ? undefined : node.maskImageDataUrl,
      outputDataUrl: node.outputPath ? undefined : node.outputDataUrl,
    })),
  }));
}

export function parseWorkspaceState(
  value: string | null,
  fallback: CanvasWorkspaceState,
): CanvasWorkspaceState {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedCanvasWorkspaceState>;

    if (
      parsed.version !== storageVersion ||
      typeof parsed.activeCanvasId !== 'string' ||
      !Array.isArray(parsed.canvases) ||
      !parsed.canvases.every(isCanvasView) ||
      (parsed.storage !== undefined && !isCanvasStorageConfig(parsed.storage))
    ) {
      return fallback;
    }

    const activeCanvasExists = parsed.canvases.some(
      (canvas) => canvas.id === parsed.activeCanvasId,
    );

    return {
      activeCanvasId: activeCanvasExists ? parsed.activeCanvasId : (parsed.canvases[0]?.id ?? ''),
      canvases: parsed.canvases.map(normalizeCanvas),
      storage: normalizeStorageConfig(parsed.storage),
      generationHistory: Array.isArray(parsed.generationHistory)
        ? parsed.generationHistory.filter(isGenerationRecord).map(normalizeGenerationRecord)
        : [],
      assetUploadCache: normalizeAssetUploadCache(parsed.assetUploadCache),
    };
  } catch {
    return fallback;
  }
}

function normalizeAssetUploadCache(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'string' &&
        entry[0].trim().length > 0 &&
        entry[1].trim().length > 0,
    ),
  );
}

function normalizeGenerationRecord(record: GenerationRecord): GenerationRecord {
  if (record.status !== 'running') {
    return record;
  }

  return {
    ...record,
    status: 'failed',
    errorMessage: '页面刷新后生成请求已中断，请重新提交。',
    endedAt: record.endedAt ?? new Date().toISOString(),
  };
}

function normalizeNode(node: CanvasNodeView): CanvasNodeView {
  const normalizedNode = normalizeChatNodeModelId(node);

  if (normalizedNode.generationStatus !== 'running') {
    return normalizedNode;
  }

  return {
    ...normalizedNode,
    generationStatus: 'failed',
    generationError: '页面刷新后生成请求已中断，请重新提交。',
  };
}

function normalizeChatNodeModelId(node: CanvasNodeView): CanvasNodeView {
  if (node.kind !== 'chat') {
    if (node.kind !== 'story') {
      return node;
    }
  }

  if (node.kind === 'story') {
    if (node.modelId === 'chat-openai') {
      return {
        ...node,
        modelId: 'gpt-5.4-mini',
        chatFormat: node.chatFormat ?? 'openai',
      };
    }

    if (node.modelId === 'chat-anthropic') {
      return {
        ...node,
        modelId: 'claude-sonnet-4-5',
        chatFormat: node.chatFormat ?? 'anthropic',
      };
    }

    return node;
  }

  if (node.modelId === 'chat-openai') {
    return {
      ...node,
      modelId: 'gpt-5.4-mini',
      chatFormat: node.chatFormat ?? 'openai',
    };
  }

  if (node.modelId === 'chat-anthropic') {
    return {
      ...node,
      modelId: 'claude-sonnet-4-5',
      chatFormat: node.chatFormat ?? 'anthropic',
    };
  }

  return node;
}

function isGenerationRecord(value: unknown): value is GenerationRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as GenerationRecord;
  return (
    typeof record.id === 'string' &&
    typeof record.nodeId === 'string' &&
    typeof record.nodeKind === 'string' &&
    typeof record.canonicalModelId === 'string' &&
    typeof record.providerId === 'string' &&
    typeof record.providerModelId === 'string' &&
    typeof record.prompt === 'string' &&
    Array.isArray(record.promptReferences) &&
    Array.isArray(record.inputAssetIds) &&
    Array.isArray(record.outputAssetIds) &&
    typeof record.status === 'string' &&
    typeof record.attempts === 'number' &&
    typeof record.createdAt === 'string'
  );
}

export function updateWorkspaceStorage(
  state: CanvasWorkspaceState,
  storage: CanvasStorageConfig,
): CanvasWorkspaceState {
  return {
    ...state,
    storage: normalizeStorageConfig(storage),
  };
}

export function renameCanvas(
  state: CanvasWorkspaceState,
  canvasId: string,
  name: string,
): CanvasWorkspaceState {
  const nextName = name.trim();

  if (!nextName) {
    return state;
  }

  if (isCanvasNameTaken(state, nextName, canvasId)) {
    return state;
  }

  return {
    ...state,
    canvases: state.canvases.map((canvas) =>
      canvas.id === canvasId ? { ...canvas, name: nextName, updatedAt: '刚刚' } : canvas,
    ),
  };
}

export function deleteCanvas(
  state: CanvasWorkspaceState,
  canvasId: string,
): CanvasWorkspaceState {
  const deletedIndex = state.canvases.findIndex((canvas) => canvas.id === canvasId);
  const canvases = state.canvases.filter((canvas) => canvas.id !== canvasId);

  if (state.activeCanvasId !== canvasId) {
    return {
      ...state,
      canvases,
    };
  }

  const fallbackCanvas = canvases[Math.max(0, deletedIndex - 1)] ?? canvases[0];

  return {
    ...state,
    activeCanvasId: fallbackCanvas?.id ?? '',
    canvases,
  };
}

export function exportCanvas(canvas: CanvasView): string {
  return JSON.stringify(
    {
      version: canvasExportVersion,
      canvas,
    },
    null,
    2,
  );
}

export function importCanvas(
  state: CanvasWorkspaceState,
  value: string,
  nextId: string,
): CanvasWorkspaceState {
  const parsed = JSON.parse(value) as Partial<CanvasExportPayload>;

  if (parsed.version !== canvasExportVersion || !isCanvasView(parsed.canvas)) {
    throw new Error('画布文件格式无效');
  }

  const canvas = normalizeCanvas(parsed.canvas);
  if (isCanvasNameTaken(state, canvas.name)) {
    throw new Error('已存在同名画布');
  }
  const importedCanvas: CanvasView = {
    ...canvas,
    id: nextId,
    updatedAt: '刚刚',
    nodes: canvas.nodes.map((node) => ({ ...node })),
    edges: canvas.edges.map((edge) => ({ ...edge })),
  };

  return {
    ...state,
    activeCanvasId: importedCanvas.id,
    canvases: [...state.canvases, importedCanvas],
  };
}

export function getNextAvailableCanvasName(
  state: CanvasWorkspaceState,
  baseName = '新画布',
): string {
  let index = 1;
  let candidate = `${baseName} ${index}`;

  while (isCanvasNameTaken(state, candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }

  return candidate;
}

function isCanvasNameTaken(
  state: CanvasWorkspaceState,
  name: string,
  excludeCanvasId?: string,
): boolean {
  const target = name.trim();

  return state.canvases.some(
    (canvas) => canvas.id !== excludeCanvasId && canvas.name.trim() === target,
  );
}

export function getNodeCenter(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + getCanvasNodeWidth(node) / 2,
    y: node.y + getCanvasNodeHeight(node) / 2,
  };
}

export function getCanvasNodeWidth(node: CanvasNodeView): number {
  const defaultWidth = getCanvasNodeDefaultWidth(node);
  const minWidth = resolveCanvasNodeMinimumWidth(node, defaultWidth);
  const maxWidth = getCanvasNodeMaximumWidth(node);

  if (typeof node.width === 'number' && Number.isFinite(node.width)) {
    return clampCanvasNodeDimension(node.width, minWidth, maxWidth);
  }

  return clampCanvasNodeDimension(defaultWidth, minWidth, maxWidth);
}

export function getCanvasNodeHeight(node: CanvasNodeView): number {
  const defaultHeight = getCanvasNodeDefaultHeight(node);
  const minHeight = resolveCanvasNodeMinimumHeight(node, defaultHeight);

  if (typeof node.height === 'number' && Number.isFinite(node.height)) {
    return clampCanvasNodeDimension(node.height, minHeight, canvasNodeMaxHeight);
  }

  return clampCanvasNodeDimension(defaultHeight, minHeight, canvasNodeMaxHeight);
}

export function getCanvasNodeMinimumWidth(node: CanvasNodeView): number {
  return resolveCanvasNodeMinimumWidth(node, getCanvasNodeDefaultWidth(node));
}

export function getCanvasNodeMinimumHeight(node: CanvasNodeView): number {
  return resolveCanvasNodeMinimumHeight(node, getCanvasNodeDefaultHeight(node));
}

function getCanvasNodeDefaultWidth(node: CanvasNodeView): number {
  if (node.kind === 'story') {
    const prompt = node.prompt?.trim() ?? '';
    if (!prompt) {
      return storyNodeBaseWidth;
    }

    const lines = prompt.split(/\r?\n/);
    const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const estimatedWidth = Math.max(
      storyNodeBaseWidth,
      240 + Math.max(prompt.length * 2.8, longestLineLength * 9.5),
    );

    return Math.min(canvasNodeMaxWidth, Math.round(estimatedWidth));
  }

  if (node.kind === 'textAsset' || node.kind === 'imageAsset' || node.kind === 'videoAsset' || node.kind === 'audioAsset' || node.kind === 'diamondMask') {
    return canvasNodeBaseWidth;
  }

  const prompt = node.prompt?.trim() ?? '';
  if (!prompt) {
    return canvasNodeBaseWidth;
  }

  const lines = prompt.split(/\r?\n/);
  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const estimatedWidth = Math.max(
    canvasNodeBaseWidth,
    220 + Math.max(prompt.length * 2.6, longestLineLength * 9),
  );

  return Math.min(canvasNodeMaxWidth, Math.round(estimatedWidth));
}

function getCanvasNodeDefaultHeight(node: CanvasNodeView): number {
  if (node.kind === 'textAsset') {
    return 180;
  }

  return canvasNodeBaseHeight;
}

function resolveCanvasNodeMinimumWidth(
  node: CanvasNodeView,
  fallbackWidth: number,
): number {
  const preferredMinimumWidth =
    node.kind === 'image'
      ? Math.max(fallbackWidth, 440)
      : node.kind === 'video'
        ? Math.max(fallbackWidth, 640)
        : fallbackWidth;
  return clampCanvasNodeDimension(
    node.minWidth,
    preferredMinimumWidth,
    getCanvasNodeMaximumWidth(node),
  );
}

function resolveCanvasNodeMinimumHeight(
  node: CanvasNodeView,
  fallbackHeight: number,
): number {
  return clampCanvasNodeDimension(node.minHeight, fallbackHeight, canvasNodeMaxHeight);
}

function getCanvasNodeMaximumWidth(node: CanvasNodeView): number {
  if (node.kind === 'story') {
    return canvasNodeResizableMaxWidth;
  }

  return canvasNodeResizableMaxWidth;
}

function clampCanvasNodeDimension(
  value: number | undefined,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getNodeInputPoint(
  node: CanvasNodeView,
  portId?: SeedanceInputPortId | 'default',
): { x: number; y: number } {
  if (node.kind === 'video' && portId && portId !== 'default') {
    const ports = getSeedanceInputPorts(node.seedanceScenario ?? 'text_to_video');
    const portIndex = ports.findIndex((port) => port.id === portId);

    if (portIndex >= 0) {
      return {
        x: node.x,
        y: node.y + 60 + portIndex * 36,
      };
    }
  }

  return {
    x: node.x,
    y: node.y + 110,
  };
}

export function getNodeOutputPoint(node: CanvasNodeView): { x: number; y: number } {
  return {
    x: node.x + getCanvasNodeWidth(node),
    y: node.y + 110,
  };
}

export function normalizeCanvasSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): CanvasSelectionRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function findNodesInSelectionRect(
  nodes: CanvasNodeView[],
  rect: CanvasSelectionRect,
): string[] {
  return nodes
    .filter((node) =>
      rectanglesIntersect(rect, {
        x: node.x,
        y: node.y,
        width: getCanvasNodeWidth(node),
        height: getCanvasNodeHeight(node),
      }),
    )
    .map((node) => node.id);
}

export function moveCanvasNodes(
  nodes: CanvasNodeView[],
  nodeIds: string[],
  delta: { dx: number; dy: number },
): CanvasNodeView[] {
  const selectedIds = new Set(nodeIds);

  return nodes.map((node) =>
    selectedIds.has(node.id)
      ? {
          ...node,
          x: node.x + delta.dx,
          y: node.y + delta.dy,
        }
      : node,
  );
}

export function copyCanvasSelection(
  canvas: CanvasView,
  nodeIds: string[],
): CanvasClipboardPayload | null {
  const selectedNodeIds = new Set(nodeIds);
  const nodes = canvas.nodes.filter((node) => selectedNodeIds.has(node.id));

  if (nodes.length === 0) {
    return null;
  }

  return {
    nodes: nodes.map((node) => ({ ...node })),
    edges: canvas.edges
      .filter(
        (edge) => selectedNodeIds.has(edge.fromNodeId) && selectedNodeIds.has(edge.toNodeId),
      )
      .map((edge) => ({ ...edge })),
  };
}

export function pasteCanvasClipboard(
  canvas: CanvasView,
  payload: CanvasClipboardPayload,
  options: {
    createNodeId(node: CanvasNodeView): string;
    offset?: { dx: number; dy: number };
  },
): { canvas: CanvasView; pastedNodeIds: string[] } {
  const offset = options.offset ?? { dx: 36, dy: 36 };
  const idMap = new Map<string, string>();

  payload.nodes.forEach((node) => {
    idMap.set(node.id, options.createNodeId(node));
  });

  const pastedNodes = payload.nodes.map((node) => {
    const nextId = idMap.get(node.id)!;

    return {
      ...node,
      id: nextId,
      x: node.x + offset.dx,
      y: node.y + offset.dy,
      prompt: node.prompt ? remapPromptNodeReferences(node.prompt, idMap) : node.prompt,
      generationStatus: undefined,
      generationError: undefined,
      generationId: undefined,
    };
  });
  const pastedEdges = payload.edges.flatMap((edge) => {
    const fromNodeId = idMap.get(edge.fromNodeId);
    const toNodeId = idMap.get(edge.toNodeId);

    return fromNodeId && toNodeId
      ? [createCanvasEdge(fromNodeId, toNodeId, edge.toPortId)]
      : [];
  });

  return {
    canvas: {
      ...canvas,
      updatedAt: '刚刚',
      nodes: [...canvas.nodes, ...pastedNodes],
      edges: [...canvas.edges, ...pastedEdges],
    },
    pastedNodeIds: pastedNodes.map((node) => node.id),
  };
}

function remapPromptNodeReferences(prompt: string, idMap: Map<string, string>): string {
  return prompt.replace(/@(text|image|video|audio|file):([a-zA-Z0-9_-]+)/g, (token, kind, nodeId) => {
    const nextNodeId = idMap.get(nodeId);

    return nextNodeId ? `@${kind}:${nextNodeId}` : token;
  });
}

export function getUpstreamNodeIds(canvas: CanvasView, nodeId: string): string[] {
  const upstreamNodeIds: string[] = [];
  const visited = new Set<string>([nodeId]);
  const queue = canvas.edges
    .filter((edge) => edge.toNodeId === nodeId)
    .map((edge) => edge.fromNodeId);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);
    upstreamNodeIds.push(currentNodeId);

    canvas.edges
      .filter((edge) => edge.toNodeId === currentNodeId)
      .forEach((edge) => queue.push(edge.fromNodeId));
  }

  return upstreamNodeIds;
}

function rectanglesIntersect(first: CanvasSelectionRect, second: CanvasSelectionRect): boolean {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

export function canNodeReceiveInput(node: CanvasNodeView): boolean {
  return (
    node.kind === 'image' ||
    node.kind === 'video' ||
    node.kind === 'chat' ||
    node.kind === 'story'
  );
}

export function canConnectCanvasNodes(fromNode: CanvasNodeView, toNode: CanvasNodeView): boolean {
  if (fromNode.id === toNode.id) {
    return false;
  }

  if (!canNodeReceiveInput(toNode)) {
    return false;
  }

  if (
    toNode.kind === 'chat' &&
    (fromNode.kind === 'video' || fromNode.kind === 'videoAsset' || fromNode.kind === 'audioAsset')
  ) {
    return false;
  }

  if (
    toNode.kind === 'story' &&
    (fromNode.kind === 'video' || fromNode.kind === 'videoAsset' || fromNode.kind === 'audioAsset')
  ) {
    return false;
  }

  return true;
}

export function createSequentialEdges(nodes: CanvasNodeView[]): CanvasEdgeView[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    fromNodeId: node.id,
    toNodeId: nodes[index + 1].id,
  }));
}

export function createCanvasEdge(
  fromNodeId: string,
  toNodeId: string,
  toPortId?: SeedanceInputPortId | 'default',
): CanvasEdgeView {
  return {
    id: `edge_${fromNodeId}_${toNodeId}${toPortId ? `_${toPortId}` : ''}`,
    fromNodeId,
    toNodeId,
    ...(toPortId ? { toPortId } : {}),
  };
}

export function addCanvasEdge(
  edges: CanvasEdgeView[],
  fromNodeId: string,
  toNodeId: string,
  toPortId?: SeedanceInputPortId | 'default',
): CanvasEdgeView[] {
  if (fromNodeId === toNodeId) {
    return edges;
  }

  if (
    edges.some(
      (edge) =>
        edge.fromNodeId === fromNodeId &&
        edge.toNodeId === toNodeId &&
        (edge.toPortId ?? 'default') === (toPortId ?? 'default'),
    )
  ) {
    return edges;
  }

  return [...edges, createCanvasEdge(fromNodeId, toNodeId, toPortId)];
}

export function removeCanvasEdge(edges: CanvasEdgeView[], edgeId: string): CanvasEdgeView[] {
  return edges.filter((edge) => edge.id !== edgeId);
}

export function removeCanvasNode(canvas: CanvasView, nodeId: string): CanvasView {
  return {
    ...canvas,
    nodes: canvas.nodes.filter((node) => node.id !== nodeId),
    edges: canvas.edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
    ),
    ...(canvas.groups
      ? {
          groups: canvas.groups.map((group) => ({
            ...group,
            nodeIds: group.nodeIds.filter((id) => id !== nodeId),
          })),
        }
      : {}),
  };
}

// 分组顶部 title 行预留高度（title 独立占一行，与内容区分开）。
const GROUP_TITLE_HEIGHT = 40;

// 计算分组的实际渲染范围：所含节点并集 ∪ 手动 bounds（节点超出仍包含，只扩不缩）。
export function getGroupRenderBounds(
  group: CanvasGroupView,
  nodes: CanvasNodeView[],
  measuredHeights?: Map<string, number>,
): CanvasGroupBounds | null {
  const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));
  if (groupNodes.length === 0) {
    return group.bounds ?? null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of groupNodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + getCanvasNodeWidth(node));
    const measuredHeight = measuredHeights?.get(node.id);
    maxY = Math.max(maxY, node.y + (measuredHeight ?? getCanvasNodeHeight(node)));
  }

  if (group.bounds) {
    minX = Math.min(minX, group.bounds.x);
    minY = Math.min(minY, group.bounds.y);
    maxX = Math.max(maxX, group.bounds.x + group.bounds.width);
    maxY = Math.max(maxY, group.bounds.y + group.bounds.height);
  }

  return {
    x: minX,
    y: minY - GROUP_TITLE_HEIGHT,
    width: maxX - minX,
    height: maxY - minY + GROUP_TITLE_HEIGHT,
  };
}

export function createCanvasGroup(
  canvas: CanvasView,
  nodeIds: string[],
  createId: () => string,
): { canvas: CanvasView; groupId: string } {
  const existing = new Set(canvas.nodes.map((node) => node.id));
  const groupId = createId();
  const group: CanvasGroupView = {
    id: groupId,
    name: '分组',
    nodeIds: nodeIds.filter((id) => existing.has(id)),
  };

  return {
    canvas: {
      ...canvas,
      groups: [...(canvas.groups ?? []), group],
      updatedAt: '刚刚',
    },
    groupId,
  };
}

export function moveCanvasGroup(
  canvas: CanvasView,
  groupId: string,
  delta: { dx: number; dy: number },
): CanvasView {
  const group = canvas.groups?.find((current) => current.id === groupId);
  if (!group) {
    return canvas;
  }

  const groupNodeIds = new Set(group.nodeIds);
  const nodes = canvas.nodes.map((node) =>
    groupNodeIds.has(node.id)
      ? { ...node, x: node.x + delta.dx, y: node.y + delta.dy }
      : node,
  );
  const groups = (canvas.groups ?? []).map((current) =>
    current.id === groupId && current.bounds
      ? {
          ...current,
          bounds: {
            ...current.bounds,
            x: current.bounds.x + delta.dx,
            y: current.bounds.y + delta.dy,
          },
        }
      : current,
  );

  return { ...canvas, nodes, groups, updatedAt: '刚刚' };
}

export function setCanvasGroupBounds(
  canvas: CanvasView,
  groupId: string,
  bounds: CanvasGroupBounds,
): CanvasView {
  const groups = (canvas.groups ?? []).map((current) =>
    current.id === groupId ? { ...current, bounds } : current,
  );
  return { ...canvas, groups, updatedAt: '刚刚' };
}

export function renameCanvasGroup(
  canvas: CanvasView,
  groupId: string,
  name: string,
): CanvasView {
  const nextName = name.trim() || '分组';
  const groups = (canvas.groups ?? []).map((current) =>
    current.id === groupId ? { ...current, name: nextName } : current,
  );
  return { ...canvas, groups, updatedAt: '刚刚' };
}

export function removeCanvasGroup(canvas: CanvasView, groupId: string): CanvasView {
  const groups = (canvas.groups ?? []).filter((current) => current.id !== groupId);
  return { ...canvas, groups, updatedAt: '刚刚' };
}
