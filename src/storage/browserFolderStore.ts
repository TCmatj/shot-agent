import {
  createWorkspaceState,
  parseWorkspaceState,
  serializeWorkspaceState,
  stripTransientAssetData,
  type CanvasNodeView,
  type CanvasView,
  type CanvasWorkspaceState,
} from '../app/canvasWorkspace';
import type { ReadWorkspaceOptions } from './workspaceStore';

type FileSystemPermissionMode = 'read' | 'readwrite';

export type ShotAgentDirectoryHandle = FileSystemDirectoryHandle & {
  requestPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
  queryPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
};

const dbName = 'shot-agent-folder-store';
const storeName = 'handles';
const rootHandleKey = 'root';

export function sanitizeFolderName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, ' ');

  return sanitized || '未命名画布';
}

export async function getStoredRootDirectoryHandle(): Promise<ShotAgentDirectoryHandle | null> {
  const db = await openHandleDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const request = tx.objectStore(storeName).get(rootHandleKey);

  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve((request.result as ShotAgentDirectoryHandle | undefined) ?? null);
      db.close();
    });
    request.addEventListener('error', () => {
      reject(request.error);
      db.close();
    });
  });
}

export async function storeRootDirectoryHandle(handle: ShotAgentDirectoryHandle): Promise<void> {
  const db = await openHandleDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(handle, rootHandleKey);

  await waitForTransaction(tx);
  db.close();
}

export async function ensureDirectoryPermission(
  handle: ShotAgentDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const descriptor = { mode };
  const current = await handle.queryPermission?.(descriptor);

  if (current === 'granted' || !handle.requestPermission) {
    return true;
  }

  return (await handle.requestPermission(descriptor)) === 'granted';
}

export async function persistWorkspaceToFolder(
  rootHandle: ShotAgentDirectoryHandle,
  state: CanvasWorkspaceState,
): Promise<CanvasWorkspaceState> {
  const canvasesWithPersistedAssets = await Promise.all(
    state.canvases.map(async (canvas) => {
      const canvasWithSyncedFolder = await syncCanvasFolderName(rootHandle, canvas);
      const persistedCanvas = await persistCanvasAssets(rootHandle, canvasWithSyncedFolder);
      return {
        ...persistedCanvas,
        storageFolderName: getCanvasFolderName(persistedCanvas),
      };
    }),
  );
  const persistableState: CanvasWorkspaceState = {
    ...state,
    canvases: stripTransientAssetData(canvasesWithPersistedAssets),
  };

  await writeTextFile(rootHandle, 'workspace.json', serializeWorkspaceState(persistableState));

  await Promise.all(
    persistableState.canvases.map(async (canvas) => {
      const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);

      await ensureProjectDirectories(canvasDir);
      await writeTextFile(canvasDir, 'canvas.json', JSON.stringify(canvas, null, 2));
      await writeTextFile(
        canvasDir,
        'workflow.json',
        JSON.stringify(
          {
            canvasId: canvas.id,
            nodes: canvas.nodes,
            edges: canvas.edges,
          },
          null,
          2,
        ),
      );
    }),
  );

  return hydrateWorkspaceAssetUrls(rootHandle, persistableState);
}

export async function persistCanvasToFolder(
  rootHandle: ShotAgentDirectoryHandle,
  state: CanvasWorkspaceState,
  canvasId: string,
): Promise<CanvasWorkspaceState> {
  const targetCanvas = state.canvases.find((canvas) => canvas.id === canvasId);
  if (!targetCanvas) {
    return state;
  }

  const canvasWithSyncedFolder = await syncCanvasFolderName(rootHandle, targetCanvas);
  const persistedCanvas = await persistCanvasAssets(rootHandle, canvasWithSyncedFolder);
  const persistableCanvas = stripTransientAssetData([
    {
      ...persistedCanvas,
      storageFolderName: getCanvasFolderName(persistedCanvas),
    },
  ])[0];
  const persistableState: CanvasWorkspaceState = {
    ...state,
    canvases: state.canvases.map((canvas) =>
      canvas.id === canvasId ? persistableCanvas : stripTransientAssetData([canvas])[0],
    ),
  };

  await writeTextFile(rootHandle, 'workspace.json', serializeWorkspaceState(persistableState));

  const canvasDir = await getCanvasDirectory(rootHandle, persistableCanvas, true);
  await ensureProjectDirectories(canvasDir);
  await writeTextFile(canvasDir, 'canvas.json', JSON.stringify(persistableCanvas, null, 2));
  await writeTextFile(
    canvasDir,
    'workflow.json',
    JSON.stringify(
      {
        canvasId: persistableCanvas.id,
        nodes: persistableCanvas.nodes,
        edges: persistableCanvas.edges,
      },
      null,
      2,
    ),
  );

  return hydrateWorkspaceAssetUrls(rootHandle, persistableState);
}

export async function readWorkspaceFromFolder(
  rootHandle: ShotAgentDirectoryHandle,
  fallback: CanvasWorkspaceState,
  options?: ReadWorkspaceOptions,
): Promise<CanvasWorkspaceState> {
  let restoredState: CanvasWorkspaceState | null = null;

  try {
    const workspaceFile = await rootHandle.getFileHandle('workspace.json');
    const workspaceText = await readBlobAsText(await workspaceFile.getFile());
    restoredState = parseWorkspaceState(workspaceText, createWorkspaceState([]));
  } catch {
    restoredState = null;
  }

  const shouldIncludeDiscoveredCanvases = options?.includeDiscoveredCanvases ?? true;
  const discoveredCanvases = shouldIncludeDiscoveredCanvases
    ? await discoverCanvasFolders(rootHandle)
    : [];
  const mergedState = mergeDiscoveredCanvases(restoredState, discoveredCanvases, fallback);

  if (!mergedState) {
    return fallback;
  }

  return hydrateWorkspaceAssetUrls(rootHandle, mergedState);
}

export async function deleteCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
): Promise<void> {
  await removeCanvasFolderCandidates(rootHandle, canvas);
}

export async function listCanvasAssets(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
): Promise<Array<{ name: string; path: string; kind: 'image' | 'video' | 'audio' | 'file'; mimeType: string; dataUrl?: string }>> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, false);
  const assetsDir = await canvasDir.getDirectoryHandle('assets');
  const folders: Array<{ directoryName: string; kind: 'image' | 'video' | 'audio' | 'file' }> = [
    { directoryName: 'images', kind: 'image' },
    { directoryName: 'videos', kind: 'video' },
    { directoryName: 'audios', kind: 'audio' },
    { directoryName: 'files', kind: 'file' },
  ];
  const assets = await Promise.all(
    folders.map(async ({ directoryName, kind }) => {
      try {
        const directory = await assetsDir.getDirectoryHandle(directoryName);
        const entries: Array<{ name: string; path: string; kind: 'image' | 'video' | 'audio' | 'file'; mimeType: string; dataUrl?: string }> = [];
        const iterableDirectory = directory as FileSystemDirectoryHandle & {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        };
        for await (const [name, handle] of iterableDirectory.entries()) {
          if (handle.kind !== 'file') {
            continue;
          }

          const assetPath = `assets/${directoryName}/${name}`;
          const file = await (handle as FileSystemFileHandle).getFile();
          entries.push({
            name,
            path: assetPath,
            kind,
            mimeType: file.type || getMimeTypeFromPath(assetPath),
            dataUrl: URL.createObjectURL(file),
          });
        }
        return entries;
      } catch {
        return [];
      }
    }),
  );

  return assets.flat().sort((first, second) => first.name.localeCompare(second.name));
}

export async function deleteCanvasAsset(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  assetPath: string,
): Promise<void> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, false);
  const segments = assetPath.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'assets') {
    return;
  }

  const assetsDir = await canvasDir.getDirectoryHandle('assets');
  const mediaDir = await assetsDir.getDirectoryHandle(segments[1]);
  await mediaDir.removeEntry(segments.slice(2).join('/'));
}

export async function saveAssetFileToCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  file: File,
): Promise<Pick<CanvasNodeView, 'assetName' | 'assetPath' | 'assetDataUrl' | 'assetMimeType'>> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  const mediaDirName = file.type.startsWith('video/')
    ? 'videos'
    : file.type.startsWith('audio/')
      ? 'audios'
      : 'images';
  const mediaDir = await assetsDir.getDirectoryHandle(mediaDirName, { create: true });
  const assetName = await makeUniqueFileName(mediaDir, file.name);
  const fileHandle = await mediaDir.getFileHandle(assetName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(file);
  await writable.close();

  return {
    assetName,
    assetPath: `assets/${mediaDirName}/${assetName}`,
    assetDataUrl: await fileToDataUrl(file),
    assetMimeType: file.type,
  };
}

export async function saveDataUrlOutputToCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  dataUrl: string,
  input: {
    kind: 'image' | 'video';
    nodeId: string;
  },
): Promise<Pick<CanvasNodeView, 'outputPath' | 'outputDataUrl'>> {
  const blob = await (await fetch(dataUrl)).blob();
  const extension = getExtensionFromMimeType(blob.type, input.kind);
  const file = new File([blob], `${input.nodeId}-${Date.now()}${extension}`, {
    type: blob.type,
  });
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  const mediaDirName = input.kind === 'video' ? 'videos' : 'images';
  const mediaDir = await assetsDir.getDirectoryHandle(mediaDirName, { create: true });
  const assetName = await makeUniqueFileName(mediaDir, file.name);
  const fileHandle = await mediaDir.getFileHandle(assetName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(file);
  await writable.close();

  return {
    outputPath: `assets/${mediaDirName}/${assetName}`,
    outputDataUrl: dataUrl,
  };
}

export async function saveGeneratedMediaBlobToCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  input: {
    blob: Blob;
    fileName: string;
    kind: 'image' | 'video';
  },
): Promise<{ assetName: string; assetPath: string; mimeType: string }> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  const mediaDirName = input.kind === 'video' ? 'videos' : 'images';
  const mediaDir = await assetsDir.getDirectoryHandle(mediaDirName, { create: true });
  const extension = getExtensionFromMimeType(
    input.blob.type,
    input.kind === 'video' ? 'video' : 'image',
  );
  const assetName = await makeUniqueFileName(
    mediaDir,
    ensureFileExtension(input.fileName, extension),
  );
  const fileHandle = await mediaDir.getFileHandle(assetName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(input.blob);
  await writable.close();

  return {
    assetName,
    assetPath: `assets/${mediaDirName}/${assetName}`,
    mimeType: input.blob.type,
  };
}

export async function renameCanvasFolder(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  nextName: string,
): Promise<Pick<CanvasView, 'storageFolderName'>> {
  const currentDir = await getCanvasDirectory(rootHandle, canvas, false);
  const nextFolderName = `${sanitizeFolderName(nextName)}__${sanitizeFolderName(canvas.id)}`;

  if (currentDir.name === nextFolderName) {
    return {
      storageFolderName: nextFolderName,
    };
  }

  const nextDir = await rootHandle.getDirectoryHandle(nextFolderName, { create: true });
  await copyDirectoryContents(currentDir, nextDir);
  await rootHandle.removeEntry(currentDir.name, { recursive: true });

  return {
    storageFolderName: nextFolderName,
  };
}

async function hydrateWorkspaceAssetUrls(
  rootHandle: ShotAgentDirectoryHandle,
  state: CanvasWorkspaceState,
): Promise<CanvasWorkspaceState> {
  const canvases = await Promise.all(
    state.canvases.map(async (canvas) => ({
      ...canvas,
      nodes: await Promise.all(
        canvas.nodes.map(async (node) => ({
          ...node,
          assetDataUrl: node.assetPath
            ? await readAssetObjectUrl(rootHandle, canvas, node.assetPath)
            : node.assetDataUrl,
          maskImageDataUrl: node.maskImagePath
            ? await readAssetObjectUrl(rootHandle, canvas, node.maskImagePath)
            : node.maskImageDataUrl,
          outputDataUrl: node.outputPath
            ? await readAssetObjectUrl(rootHandle, canvas, node.outputPath)
            : node.outputDataUrl,
        })),
      ),
    })),
  );

  return {
    ...state,
    canvases,
  };
}

async function persistCanvasAssets(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
): Promise<CanvasView> {
  const canvasDir = await getCanvasDirectory(rootHandle, canvas, true);
  await ensureProjectDirectories(canvasDir);

  return {
    ...canvas,
    nodes: await Promise.all(
      canvas.nodes.map(async (node) => {
        let nextNode = { ...node };

        if (nextNode.assetDataUrl && !nextNode.assetPath) {
          const savedAsset = await saveDataUrlAssetToCanvasDirectory(
            canvasDir,
            nextNode.assetDataUrl,
            {
              kind: getNodeAssetKind(nextNode),
              fileName: nextNode.assetName ?? nextNode.id,
            },
          );
          nextNode = {
            ...nextNode,
            assetName: savedAsset.assetName,
            assetPath: savedAsset.assetPath,
            assetMimeType: nextNode.assetMimeType ?? savedAsset.mimeType,
          };
        }

        if (nextNode.maskImageDataUrl && !nextNode.maskImagePath) {
          const savedMaskImage = await saveDataUrlAssetToCanvasDirectory(
            canvasDir,
            nextNode.maskImageDataUrl,
            {
              kind: 'image',
              fileName: nextNode.maskImageName ?? `${nextNode.id}-mask-source`,
            },
          );
          nextNode = {
            ...nextNode,
            maskImageName: savedMaskImage.assetName,
            maskImagePath: savedMaskImage.assetPath,
            maskImageMimeType: nextNode.maskImageMimeType ?? savedMaskImage.mimeType,
          };
        }

        if (nextNode.outputDataUrl && !nextNode.outputPath) {
          const savedOutput = await saveDataUrlAssetToCanvasDirectory(
            canvasDir,
            nextNode.outputDataUrl,
            {
              kind: getNodeOutputKind(nextNode),
              fileName: `${nextNode.id}-${Date.now()}`,
            },
          );
          nextNode = {
            ...nextNode,
            outputPath: savedOutput.assetPath,
          };
        }

        return nextNode;
      }),
    ),
  };
}

async function saveDataUrlAssetToCanvasDirectory(
  canvasDir: FileSystemDirectoryHandle,
  dataUrl: string,
  input: {
    kind: 'image' | 'video' | 'audio' | 'file';
    fileName: string;
    directoryName?: 'images' | 'videos' | 'audios' | 'files';
  },
): Promise<{ assetName: string; assetPath: string; mimeType: string }> {
  const blob = dataUrlToBlob(dataUrl);
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  const mediaDirName = input.directoryName ?? getMediaDirectoryName(input.kind);
  const mediaDir = await assetsDir.getDirectoryHandle(mediaDirName, { create: true });
  const extension = getExtensionFromMimeType(
    blob.type,
    input.kind === 'video' ? 'video' : input.kind === 'audio' ? 'audio' : 'image',
  );
  const assetName = await makeUniqueFileName(
    mediaDir,
    ensureFileExtension(input.fileName, extension),
  );
  const fileHandle = await mediaDir.getFileHandle(assetName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(blob);
  await writable.close();

  return {
    assetName,
    assetPath: `assets/${mediaDirName}/${assetName}`,
    mimeType: blob.type,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid data URL');
  }

  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getNodeAssetKind(node: CanvasNodeView): 'image' | 'video' | 'audio' | 'file' {
  if (node.kind === 'videoAsset' || node.assetMimeType?.startsWith('video/')) {
    return 'video';
  }

  if (node.kind === 'audioAsset' || node.assetMimeType?.startsWith('audio/')) {
    return 'audio';
  }

  return node.assetMimeType?.startsWith('image/') || node.kind === 'imageAsset'
    ? 'image'
    : 'file';
}

function getNodeOutputKind(node: CanvasNodeView): 'image' | 'video' {
  return node.kind === 'video' ? 'video' : 'image';
}

function getMediaDirectoryName(
  kind: 'image' | 'video' | 'audio' | 'file',
): 'images' | 'videos' | 'audios' | 'files' {
  if (kind === 'video') {
    return 'videos';
  }

  if (kind === 'audio') {
    return 'audios';
  }

  return kind === 'file' ? 'files' : 'images';
}

function ensureFileExtension(fileName: string, extension: string): string {
  return /\.[a-z0-9]+$/i.test(fileName) ? fileName : `${fileName}${extension}`;
}

async function readAssetObjectUrl(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
  assetPath: string,
): Promise<string | undefined> {
  try {
    const canvasDir = await getCanvasDirectory(rootHandle, canvas, false);
    const segments = assetPath.split('/').filter(Boolean);
    let currentDir: FileSystemDirectoryHandle = canvasDir;

    for (const segment of segments.slice(0, -1)) {
      currentDir = await currentDir.getDirectoryHandle(segment);
    }

    const fileHandle = await currentDir.getFileHandle(segments[segments.length - 1]);
    return fileToDataUrl(await fileHandle.getFile());
  } catch {
    return undefined;
  }
}

async function getCanvasDirectory(
  rootHandle: FileSystemDirectoryHandle,
  canvas: CanvasView,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const primaryFolderName = getCanvasFolderName(canvas);

  if (create) {
    return rootHandle.getDirectoryHandle(primaryFolderName, { create: true });
  }

  try {
    return await rootHandle.getDirectoryHandle(primaryFolderName);
  } catch {
    return rootHandle.getDirectoryHandle(sanitizeFolderName(canvas.name), { create: false });
  }
}

function getCanvasFolderName(canvas: CanvasView): string {
  return canvas.storageFolderName ?? `${sanitizeFolderName(canvas.name)}__${sanitizeFolderName(canvas.id)}`;
}

async function removeCanvasFolderCandidates(
  rootHandle: ShotAgentDirectoryHandle,
  canvas: CanvasView,
): Promise<void> {
  const candidateNames = [
    getCanvasFolderName(canvas),
    `${sanitizeFolderName(canvas.name)}__${sanitizeFolderName(canvas.id)}`,
    sanitizeFolderName(canvas.name),
  ];
  let lastError: unknown;

  for (const folderName of Array.from(new Set(candidateNames))) {
    try {
      await rootHandle.removeEntry(folderName, { recursive: true });
      lastError = undefined;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        continue;
      }

      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function mergeDiscoveredCanvases(
  restoredState: CanvasWorkspaceState | null,
  discoveredCanvases: CanvasView[],
  fallback: CanvasWorkspaceState,
): CanvasWorkspaceState | null {
  if (!restoredState && discoveredCanvases.length === 0) {
    return null;
  }

  const baseState = restoredState ?? createWorkspaceState([]);
  const existingIds = new Set(baseState.canvases.map((canvas) => canvas.id));
  const mergedCanvases = [
    ...baseState.canvases,
    ...discoveredCanvases.filter((canvas) => !existingIds.has(canvas.id)),
  ];

  if (mergedCanvases.length === 0) {
    return fallback;
  }

  const activeCanvasId = mergedCanvases.some((canvas) => canvas.id === baseState.activeCanvasId)
    ? baseState.activeCanvasId
    : mergedCanvases[0]?.id ?? '';

  return {
    ...baseState,
    activeCanvasId,
    canvases: mergedCanvases,
  };
}

async function discoverCanvasFolders(rootHandle: ShotAgentDirectoryHandle): Promise<CanvasView[]> {
  const canvases: CanvasView[] = [];

  for await (const entry of iterateDirectoryEntries(rootHandle)) {
    if (entry.kind !== 'directory') {
      continue;
    }

    const canvas = await restoreCanvasFromDirectory(entry as FileSystemDirectoryHandle);
    if (canvas) {
      canvases.push(canvas);
    }
  }

  return canvases;
}

async function restoreCanvasFromDirectory(
  directory: FileSystemDirectoryHandle,
): Promise<CanvasView | null> {
  const canvasText = await readTextFileIfExists(directory, 'canvas.json');
  const workflowText = await readTextFileIfExists(directory, 'workflow.json');
  const canvasFromFile = canvasText ? parseCanvasFromText(canvasText) : null;

  if (canvasFromFile) {
    return {
      ...canvasFromFile,
      storageFolderName: canvasFromFile.storageFolderName ?? directory.name,
    };
  }

  if (!workflowText) {
    return null;
  }

  return parseCanvasFromWorkflowText(workflowText, directory.name);
}

async function readTextFileIfExists(
  directory: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string | null> {
  try {
    const fileHandle = await directory.getFileHandle(fileName);
    return await readBlobAsText(await fileHandle.getFile());
  } catch {
    return null;
  }
}

function parseCanvasFromText(text: string): CanvasView | null {
  try {
    const parsed = JSON.parse(text);
    const state = parseWorkspaceState(
      JSON.stringify({
        version: 1,
        activeCanvasId: 'canvas_from_folder',
        canvases: [parsed],
        storage: { mode: 'custom-folder' },
        generationHistory: [],
      }),
      createWorkspaceState([]),
    );

    return state.canvases[0] ?? null;
  } catch {
    return null;
  }
}

function parseCanvasFromWorkflowText(
  text: string,
  directoryName: string,
): CanvasView | null {
  try {
    const parsed = JSON.parse(text) as {
      canvasId?: unknown;
      nodes?: unknown;
      edges?: unknown;
    };
    const synthesizedCanvas = {
      id:
        typeof parsed.canvasId === 'string' && parsed.canvasId.trim()
          ? parsed.canvasId
          : directoryName,
      name: directoryName.split('__')[0] || directoryName,
      storageFolderName: directoryName,
      updatedAt: '已发现',
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };

    return parseCanvasFromText(JSON.stringify(synthesizedCanvas));
  } catch {
    return null;
  }
}

function getExpectedCanvasFolderName(canvas: CanvasView): string {
  return `${sanitizeFolderName(canvas.name)}__${sanitizeFolderName(canvas.id)}`;
}

async function syncCanvasFolderName(
  rootHandle: FileSystemDirectoryHandle,
  canvas: CanvasView,
): Promise<CanvasView> {
  const expectedFolderName = getExpectedCanvasFolderName(canvas);

  if (!canvas.storageFolderName || canvas.storageFolderName === expectedFolderName) {
    return {
      ...canvas,
      storageFolderName: expectedFolderName,
    };
  }

  try {
    const oldDirectory = await rootHandle.getDirectoryHandle(canvas.storageFolderName);
    const newDirectory = await rootHandle.getDirectoryHandle(expectedFolderName, { create: true });
    await copyDirectoryContents(oldDirectory, newDirectory);
    await rootHandle.removeEntry(canvas.storageFolderName, { recursive: true });
  } catch {
    // If the old folder is already gone, continue with the new deterministic folder name.
  }

  return {
    ...canvas,
    storageFolderName: expectedFolderName,
  };
}

type IterableFileSystemDirectoryHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  entries?: () => AsyncIterable<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
  [Symbol.asyncIterator]?: () => AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
};

async function copyDirectoryContents(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const handle of iterateDirectoryEntries(source)) {
    const name = handle.name;
    if (handle.kind === 'directory') {
      const nextTarget = await target.getDirectoryHandle(name, { create: true });
      await copyDirectoryContents(handle, nextTarget);
      continue;
    }

    const file = await handle.getFile();
    const fileHandle = await target.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  }
}

async function* iterateDirectoryEntries(
  directory: FileSystemDirectoryHandle,
): AsyncGenerator<FileSystemDirectoryHandle | FileSystemFileHandle, void, void> {
  const iterableDirectory = directory as IterableFileSystemDirectoryHandle;

  if (typeof iterableDirectory.values === 'function') {
    yield* iterableDirectory.values();
    return;
  }

  if (typeof iterableDirectory.entries === 'function') {
    for await (const [, entry] of iterableDirectory.entries()) {
      yield entry;
    }
    return;
  }

  const iterator = iterableDirectory[Symbol.asyncIterator];
  if (typeof iterator === 'function') {
    yield* iterator.call(iterableDirectory);
    return;
  }

  throw new Error('当前浏览器不支持遍历目录内容');
}

async function ensureProjectDirectories(canvasDir: FileSystemDirectoryHandle): Promise<void> {
  const historyDir = await canvasDir.getDirectoryHandle('history', { create: true });
  await historyDir.getDirectoryHandle('workflow-snapshots', { create: true });
  await canvasDir.getDirectoryHandle('prompts', { create: true });
  const assetsDir = await canvasDir.getDirectoryHandle('assets', { create: true });
  await assetsDir.getDirectoryHandle('images', { create: true });
  await assetsDir.getDirectoryHandle('videos', { create: true });
  await assetsDir.getDirectoryHandle('audios', { create: true });
  await assetsDir.getDirectoryHandle('files', { create: true });
  await canvasDir.getDirectoryHandle('exports', { create: true });
}

async function writeTextFile(
  directory: FileSystemDirectoryHandle,
  fileName: string,
  value: string,
): Promise<void> {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(value);
  await writable.close();
}

async function makeUniqueFileName(
  directory: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string> {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);
  let candidate = fileName || `asset-${Date.now()}`;
  let index = 1;

  while (await fileExists(directory, candidate)) {
    candidate = `${baseName || 'asset'}-${index}${extension}`;
    index += 1;
  }

  return candidate;
}

async function fileExists(directory: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
  try {
    await directory.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function readBlobAsText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

function getMimeTypeFromPath(assetPath: string): string {
  const lowerCasePath = assetPath.toLowerCase();

  if (lowerCasePath.endsWith('.png')) {
    return 'image/png';
  }

  if (lowerCasePath.endsWith('.jpg') || lowerCasePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (lowerCasePath.endsWith('.webp')) {
    return 'image/webp';
  }

  if (lowerCasePath.endsWith('.mp4')) {
    return 'video/mp4';
  }

  if (lowerCasePath.endsWith('.mp3')) {
    return 'audio/mpeg';
  }

  if (lowerCasePath.endsWith('.wav')) {
    return 'audio/wav';
  }

  return 'application/octet-stream';
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(storeName);
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener('complete', () => resolve());
    tx.addEventListener('error', () => reject(tx.error));
    tx.addEventListener('abort', () => reject(tx.error));
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getExtensionFromMimeType(mimeType: string, kind: 'image' | 'video' | 'audio'): string {
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

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return '.mp3';
  }

  if (mimeType.includes('wav')) {
    return '.wav';
  }

  return kind === 'video' ? '.mp4' : kind === 'audio' ? '.mp3' : '.png';
}
