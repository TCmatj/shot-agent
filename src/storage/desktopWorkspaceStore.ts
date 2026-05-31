import { basename, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import {
  createWorkspaceState,
  parseWorkspaceState,
  serializeWorkspaceState,
  stripTransientAssetData,
  type CanvasNodeView,
  type CanvasView,
  type CanvasWorkspaceState,
} from '../app/canvasWorkspace';
import type { WorkspaceStore } from './workspaceStore';

const rootDirectoryStorageKey = 'shot-agent:desktop-root-directory-path';

export const desktopWorkspaceStore: WorkspaceStore = {
  kind: 'desktop',
  isSupported() {
    return true;
  },
  async pickRootDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
      recursive: true,
    });

    if (!selected || Array.isArray(selected)) {
      return null;
    }

    await authorizeWorkspaceDirectory(selected);

    return {
      kind: 'desktop-directory',
      name: await getPathLabel(selected),
      path: selected,
    };
  },
  async getStoredRootDirectoryHandle() {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedPath = window.localStorage.getItem(rootDirectoryStorageKey);
    const path = storedPath ?? await getDefaultWorkspaceRootPath();

    if (storedPath) {
      await authorizeWorkspaceDirectory(path);
    } else {
      window.localStorage.setItem(rootDirectoryStorageKey, path);
    }

    return {
      kind: 'desktop-directory',
      name: await getPathLabel(path),
      path,
    };
  },
  async storeRootDirectoryHandle(handle) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    window.localStorage.setItem(rootDirectoryStorageKey, handle.path);
  },
  async ensureDirectoryPermission(handle) {
    if (handle.kind === 'desktop-directory') {
      await authorizeWorkspaceDirectory(handle.path);
    }

    return handle.kind === 'desktop-directory';
  },
  async persistWorkspaceToFolder(handle, state) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const canvasesWithPersistedAssets = await Promise.all(
      state.canvases.map(async (canvas) => {
        const canvasWithSyncedFolder = await syncCanvasFolderName(handle.path, canvas);
        const persistedCanvas = await persistCanvasAssets(handle.path, canvasWithSyncedFolder);
        return {
          ...persistedCanvas,
          storageFolderName: persistedCanvas.storageFolderName ?? getCanvasFolderName(persistedCanvas),
        };
      }),
    );
    const persistableState: CanvasWorkspaceState = {
      ...state,
      canvases: stripTransientAssetData(canvasesWithPersistedAssets),
    };

    await writeTextFile(await join(handle.path, 'workspace.json'), serializeWorkspaceState(persistableState));

    await Promise.all(
      persistableState.canvases.map(async (canvas) => {
        const canvasDir = await getCanvasDirectory(handle.path, canvas, true);
        await ensureProjectDirectories(canvasDir);
        await writeTextFile(await join(canvasDir, 'canvas.json'), JSON.stringify(canvas, null, 2));
        await writeTextFile(
          await join(canvasDir, 'workflow.json'),
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

    return hydrateWorkspaceAssetUrls(handle.path, persistableState);
  },
  async readWorkspaceFromFolder(handle, fallback, options) {
    if (handle.kind !== 'desktop-directory') {
      return fallback;
    }

    let restoredState: CanvasWorkspaceState | null = null;

    try {
      const workspaceText = await readTextFile(await join(handle.path, 'workspace.json'));
      restoredState = parseWorkspaceState(workspaceText, createWorkspaceState([]));
    } catch {
      restoredState = null;
    }

    const shouldIncludeDiscoveredCanvases = options?.includeDiscoveredCanvases ?? true;
    const discoveredCanvases = shouldIncludeDiscoveredCanvases
      ? await discoverCanvasFolders(handle.path)
      : [];
    const mergedState = mergeDiscoveredCanvases(restoredState, discoveredCanvases, fallback);

    if (!mergedState) {
      return fallback;
    }

    return hydrateWorkspaceAssetUrls(handle.path, mergedState);
  },
  async deleteCanvasFolder(handle, canvas) {
    if (handle.kind !== 'desktop-directory') {
      return;
    }

    await removeCanvasFolderCandidates(handle.path, canvas);
  },
  async listCanvasAssets(handle, canvas) {
    if (handle.kind !== 'desktop-directory') {
      return [];
    }

    const canvasDir = await getCanvasDirectory(handle.path, canvas, false);
    const assetsDir = await join(canvasDir, 'assets');
    const folders: Array<{ directoryName: string; kind: 'image' | 'video' | 'audio' | 'file' }> = [
      { directoryName: 'images', kind: 'image' },
      { directoryName: 'videos', kind: 'video' },
      { directoryName: 'audios', kind: 'audio' },
      { directoryName: 'files', kind: 'file' },
    ];
    const assets = await Promise.all(
      folders.map(async ({ directoryName, kind }) => {
        const directoryPath = await join(assetsDir, directoryName);
        if (!(await exists(directoryPath))) {
          return [];
        }

        const entries = await readDir(directoryPath);
        return Promise.all(
          entries
            .filter((entry) => !entry.isDirectory)
            .map(async (entry) => {
              const assetPath = `assets/${directoryName}/${entry.name}`;
              return {
                name: entry.name,
                path: assetPath,
                kind,
                mimeType: getMimeTypeFromPath(assetPath),
                dataUrl: await readAssetObjectUrl(handle.path, canvas, assetPath),
              };
            }),
        );
      }),
    );

    return assets.flat().sort((first, second) => first.name.localeCompare(second.name));
  },
  async deleteCanvasAsset(handle, canvas, assetPath) {
    if (handle.kind !== 'desktop-directory') {
      return;
    }

    const canvasDir = await getCanvasDirectory(handle.path, canvas, false);
    const resolvedPath = await join(canvasDir, ...assetPath.split('/').filter(Boolean));
    if (await exists(resolvedPath)) {
      await remove(resolvedPath);
    }
  },
  async saveAssetFileToCanvasFolder(handle, canvas, file) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const canvasDir = await getCanvasDirectory(handle.path, canvas, true);
    const assetsDir = await join(canvasDir, 'assets');
    const mediaDirName = file.type.startsWith('video/')
      ? 'videos'
      : file.type.startsWith('audio/')
        ? 'audios'
        : 'images';
    const mediaDir = await join(assetsDir, mediaDirName);
    await mkdir(mediaDir, { recursive: true });
    const assetName = await makeUniqueFileName(mediaDir, file.name);
    const assetPath = await join(mediaDir, assetName);

    const bytes = await blobToBytes(file);
    await writeFile(assetPath, bytes);

    return {
      assetName,
      assetPath: `assets/${mediaDirName}/${assetName}`,
      assetDataUrl: bytesToDataUrl(bytes, file.type),
      assetMimeType: file.type,
    };
  },
  async persistCanvasToFolder(handle, state, canvasId) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const targetCanvas = state.canvases.find((canvas) => canvas.id === canvasId);
    if (!targetCanvas) {
      return state;
    }

    const canvasWithSyncedFolder = await syncCanvasFolderName(handle.path, targetCanvas);
    const persistedCanvas = await persistCanvasAssets(handle.path, canvasWithSyncedFolder);
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

    await writeTextFile(await join(handle.path, 'workspace.json'), serializeWorkspaceState(persistableState));

    const canvasDir = await getCanvasDirectory(handle.path, persistableCanvas, true);
    await ensureProjectDirectories(canvasDir);
    await writeTextFile(await join(canvasDir, 'canvas.json'), JSON.stringify(persistableCanvas, null, 2));
    await writeTextFile(
      await join(canvasDir, 'workflow.json'),
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

    return hydrateWorkspaceAssetUrls(handle.path, persistableState);
  },
  async saveDataUrlOutputToCanvasFolder(handle, canvas, dataUrl, input) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const blob = dataUrlToBlob(dataUrl);
    const extension = getExtensionFromMimeType(blob.type, input.kind);
    const file = new File([blob], `${input.nodeId}-${Date.now()}${extension}`, {
      type: blob.type,
    });
    const canvasDir = await getCanvasDirectory(handle.path, canvas, true);
    const assetsDir = await join(canvasDir, 'assets');
    const mediaDirName = input.kind === 'video' ? 'videos' : 'images';
    const mediaDir = await join(assetsDir, mediaDirName);
    await mkdir(mediaDir, { recursive: true });
    const assetName = await makeUniqueFileName(mediaDir, file.name);

    await writeFile(await join(mediaDir, assetName), new Uint8Array(await file.arrayBuffer()));

    return {
      outputPath: `assets/${mediaDirName}/${assetName}`,
      outputDataUrl: dataUrl,
    };
  },
  async saveGeneratedMediaBlobToCanvasFolder(handle, canvas, input) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const canvasDir = await getCanvasDirectory(handle.path, canvas, true);
    const assetsDir = await join(canvasDir, 'assets');
    const mediaDirName = input.kind === 'video' ? 'videos' : 'images';
    const mediaDir = await join(assetsDir, mediaDirName);
    await mkdir(mediaDir, { recursive: true });
    const extension = getExtensionFromMimeType(
      input.blob.type,
      input.kind === 'video' ? 'video' : 'image',
    );
    const assetName = await makeUniqueFileName(mediaDir, ensureFileExtension(input.fileName, extension));
    await writeFile(await join(mediaDir, assetName), await blobToBytes(input.blob));

    return {
      assetName,
      assetPath: `assets/${mediaDirName}/${assetName}`,
      mimeType: input.blob.type,
    };
  },
  async renameCanvasFolder(handle, canvas, nextName) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const currentDir = await getCanvasDirectory(handle.path, canvas, false);
    const nextFolderName = `${sanitizeFolderName(nextName)}__${sanitizeFolderName(canvas.id)}`;
    const nextDir = await join(handle.path, nextFolderName);

    if (currentDir === nextDir) {
      return {
        storageFolderName: nextFolderName,
      };
    }

    if (await exists(nextDir)) {
      throw new Error('目标画布文件夹已存在');
    }

    await rename(currentDir, nextDir);
    return {
      storageFolderName: nextFolderName,
    };
  },
  async saveGeneratedMediaUrlToCanvasFolder(handle, canvas, input) {
    if (handle.kind !== 'desktop-directory') {
      throw new Error('桌面存储仅支持本地文件夹路径');
    }

    const saved = await invoke<{
      assetName: string;
      assetPath: string;
      mimeType: string;
    }>('download_generated_media_to_canvas_folder', {
      rootPath: handle.path,
      canvasFolderName: getCanvasFolderName(canvas),
      url: input.url,
      fileName: input.fileName,
      kind: input.kind,
    });

    return {
      ...saved,
      assetDataUrl: await readAssetObjectUrl(handle.path, canvas, saved.assetPath, saved.mimeType),
    };
  },
};

async function authorizeWorkspaceDirectory(path: string): Promise<void> {
  await invoke('authorize_workspace_directory', { path });
}

async function getDefaultWorkspaceRootPath(): Promise<string> {
  return invoke<string>('get_default_workspace_directory');
}

async function hydrateWorkspaceAssetUrls(
  rootPath: string,
  state: CanvasWorkspaceState,
): Promise<CanvasWorkspaceState> {
  const canvases = await Promise.all(
    state.canvases.map(async (canvas) => ({
      ...canvas,
      nodes: await Promise.all(
        canvas.nodes.map(async (node) => ({
          ...node,
          assetDataUrl: node.assetPath
            ? await readAssetObjectUrl(rootPath, canvas, node.assetPath, node.assetMimeType)
            : node.assetDataUrl,
          maskImageDataUrl: node.maskImagePath
            ? await readAssetObjectUrl(rootPath, canvas, node.maskImagePath, node.maskImageMimeType)
            : node.maskImageDataUrl,
          outputDataUrl: node.outputPath
            ? await readAssetObjectUrl(rootPath, canvas, node.outputPath)
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

async function persistCanvasAssets(rootPath: string, canvas: CanvasView): Promise<CanvasView> {
  const canvasDir = await getCanvasDirectory(rootPath, canvas, true);
  await ensureProjectDirectories(canvasDir);

  return {
    ...canvas,
    nodes: await Promise.all(
      canvas.nodes.map(async (node) => {
        let nextNode = { ...node };

        if (nextNode.assetDataUrl && !nextNode.assetPath) {
          const savedAsset = await saveDataUrlAssetToCanvasDirectory(canvasDir, nextNode.assetDataUrl, {
            kind: getNodeAssetKind(nextNode),
            fileName: nextNode.assetName ?? nextNode.id,
          });
          nextNode = {
            ...nextNode,
            assetName: savedAsset.assetName,
            assetPath: savedAsset.assetPath,
            assetMimeType: nextNode.assetMimeType ?? savedAsset.mimeType,
          };
        }

        if (nextNode.maskImageDataUrl && !nextNode.maskImagePath) {
          const savedMaskImage = await saveDataUrlAssetToCanvasDirectory(canvasDir, nextNode.maskImageDataUrl, {
            kind: 'image',
            fileName: nextNode.maskImageName ?? `${nextNode.id}-mask-source`,
          });
          nextNode = {
            ...nextNode,
            maskImageName: savedMaskImage.assetName,
            maskImagePath: savedMaskImage.assetPath,
            maskImageMimeType: nextNode.maskImageMimeType ?? savedMaskImage.mimeType,
          };
        }

        if (nextNode.outputDataUrl && !nextNode.outputPath) {
          const savedOutput = await saveDataUrlAssetToCanvasDirectory(canvasDir, nextNode.outputDataUrl, {
            kind: getNodeOutputKind(nextNode),
            fileName: `${nextNode.id}-${Date.now()}`,
          });
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
  canvasDir: string,
  dataUrl: string,
  input: {
    kind: 'image' | 'video' | 'audio' | 'file';
    fileName: string;
    directoryName?: 'images' | 'videos' | 'audios' | 'files';
  },
): Promise<{ assetName: string; assetPath: string; mimeType: string }> {
  const blob = dataUrlToBlob(dataUrl);
  const assetsDir = await join(canvasDir, 'assets');
  const mediaDirName = input.directoryName ?? getMediaDirectoryName(input.kind);
  const mediaDir = await join(assetsDir, mediaDirName);
  await mkdir(mediaDir, { recursive: true });
  const extension = getExtensionFromMimeType(
    blob.type,
    input.kind === 'video' ? 'video' : input.kind === 'audio' ? 'audio' : 'image',
  );
  const assetName = await makeUniqueFileName(mediaDir, ensureFileExtension(input.fileName, extension));
  await writeFile(await join(mediaDir, assetName), await blobToBytes(blob));

  return {
    assetName,
    assetPath: `assets/${mediaDirName}/${assetName}`,
    mimeType: blob.type,
  };
}

async function readAssetObjectUrl(
  rootPath: string,
  canvas: CanvasView,
  assetPath: string,
  mimeType?: string,
): Promise<string | undefined> {
  try {
    const canvasDir = await getCanvasDirectory(rootPath, canvas, false);
    const resolvedPath = await join(canvasDir, ...assetPath.split('/').filter(Boolean));
    const bytes = await readFile(resolvedPath);
    return bytesToDataUrl(bytes, mimeType ?? getMimeTypeFromPath(assetPath));
  } catch {
    return undefined;
  }
}

async function getCanvasDirectory(rootPath: string, canvas: CanvasView, create: boolean): Promise<string> {
  const primaryFolderName = getCanvasFolderName(canvas);
  const primaryPath = await join(rootPath, primaryFolderName);

  if (create) {
    await mkdir(primaryPath, { recursive: true });
    return primaryPath;
  }

  if (await exists(primaryPath)) {
    return primaryPath;
  }

  return join(rootPath, sanitizeFolderName(canvas.name));
}

function getCanvasFolderName(canvas: CanvasView): string {
  return canvas.storageFolderName ?? `${sanitizeFolderName(canvas.name)}__${sanitizeFolderName(canvas.id)}`;
}

async function removeCanvasFolderCandidates(rootPath: string, canvas: CanvasView): Promise<void> {
  const candidateNames = [
    getCanvasFolderName(canvas),
    `${sanitizeFolderName(canvas.name)}__${sanitizeFolderName(canvas.id)}`,
    sanitizeFolderName(canvas.name),
  ];
  let lastError: unknown;

  for (const folderName of Array.from(new Set(candidateNames))) {
    const canvasDir = await join(rootPath, folderName);

    try {
      if (!(await exists(canvasDir))) {
        continue;
      }

      await remove(canvasDir, { recursive: true });
      lastError = undefined;
    } catch (error) {
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

async function discoverCanvasFolders(rootPath: string): Promise<CanvasView[]> {
  const entries = await readDir(rootPath);
  const canvases = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory)
      .map(async (entry) => restoreCanvasFromDirectory(await join(rootPath, entry.name), entry.name)),
  );

  return canvases.filter((canvas): canvas is CanvasView => Boolean(canvas));
}

async function restoreCanvasFromDirectory(
  directoryPath: string,
  directoryName: string,
): Promise<CanvasView | null> {
  const canvasText = await readTextFileIfExists(await join(directoryPath, 'canvas.json'));
  const workflowText = await readTextFileIfExists(await join(directoryPath, 'workflow.json'));
  const canvasFromFile = canvasText ? parseCanvasFromText(canvasText) : null;

  if (canvasFromFile) {
    return {
      ...canvasFromFile,
      storageFolderName: canvasFromFile.storageFolderName ?? directoryName,
    };
  }

  if (!workflowText) {
    return null;
  }

  return parseCanvasFromWorkflowText(workflowText, directoryName);
}

async function readTextFileIfExists(path: string): Promise<string | null> {
  try {
    return await readTextFile(path);
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

async function syncCanvasFolderName(rootPath: string, canvas: CanvasView): Promise<CanvasView> {
  const expectedFolderName = getExpectedCanvasFolderName(canvas);

  if (!canvas.storageFolderName || canvas.storageFolderName === expectedFolderName) {
    return {
      ...canvas,
      storageFolderName: expectedFolderName,
    };
  }

  const oldPath = await join(rootPath, canvas.storageFolderName);
  const newPath = await join(rootPath, expectedFolderName);

  try {
    if ((await exists(oldPath)) && !(await exists(newPath))) {
      await rename(oldPath, newPath);
    }
  } catch {
    // 目录同步失败时仍继续使用确定性的目标目录名。
  }

  return {
    ...canvas,
    storageFolderName: expectedFolderName,
  };
}

function sanitizeFolderName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, ' ');

  return sanitized || '未命名画布';
}

async function ensureProjectDirectories(canvasDir: string): Promise<void> {
  await mkdir(await join(canvasDir, 'history', 'workflow-snapshots'), { recursive: true });
  await mkdir(await join(canvasDir, 'prompts'), { recursive: true });
  await mkdir(await join(canvasDir, 'assets', 'images'), { recursive: true });
  await mkdir(await join(canvasDir, 'assets', 'videos'), { recursive: true });
  await mkdir(await join(canvasDir, 'assets', 'audios'), { recursive: true });
  await mkdir(await join(canvasDir, 'assets', 'files'), { recursive: true });
  await mkdir(await join(canvasDir, 'exports'), { recursive: true });
}

async function makeUniqueFileName(directory: string, fileName: string): Promise<string> {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);
  let candidate = fileName || `asset-${Date.now()}`;
  let index = 1;

  while (await exists(await join(directory, candidate))) {
    candidate = `${baseName || 'asset'}-${index}${extension}`;
    index += 1;
  }

  return candidate;
}

async function getPathLabel(path: string): Promise<string> {
  try {
    return await basename(path);
  } catch {
    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? path;
  }
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

  return node.assetMimeType?.startsWith('image/') || node.kind === 'imageAsset' ? 'image' : 'file';
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

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function blobToBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = reader.result;
      resolve(new Uint8Array(result instanceof ArrayBuffer ? result : new ArrayBuffer(0)));
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsArrayBuffer(file);
  });
}
