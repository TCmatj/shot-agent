import { basename, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readFile, readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import {
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

    const path = window.localStorage.getItem(rootDirectoryStorageKey);

    if (!path) {
      return null;
    }

    await authorizeWorkspaceDirectory(path);

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
        const persistedCanvas = await persistCanvasAssets(handle.path, canvas);
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
  async readWorkspaceFromFolder(handle, fallback) {
    if (handle.kind !== 'desktop-directory') {
      return fallback;
    }

    try {
      const workspaceText = await readTextFile(await join(handle.path, 'workspace.json'));
      const parsed = parseWorkspaceState(workspaceText, fallback);
      return hydrateWorkspaceAssetUrls(handle.path, parsed);
    } catch {
      return fallback;
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

    await writeFile(assetPath, new Uint8Array(await file.arrayBuffer()));

    return {
      assetName,
      assetPath: `assets/${mediaDirName}/${assetName}`,
      assetDataUrl: URL.createObjectURL(file),
      assetMimeType: file.type,
    };
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
    const mediaDirName =
      input.kind === 'video' ? 'videos' : input.kind === 'cover' ? 'covers' : 'images';
    const mediaDir = await join(assetsDir, mediaDirName);
    await mkdir(mediaDir, { recursive: true });
    const extension = getExtensionFromMimeType(
      input.blob.type,
      input.kind === 'video' ? 'video' : 'image',
    );
    const assetName = await makeUniqueFileName(mediaDir, ensureFileExtension(input.fileName, extension));
    await writeFile(await join(mediaDir, assetName), new Uint8Array(await input.blob.arrayBuffer()));

    return {
      assetName,
      assetPath: `assets/${mediaDirName}/${assetName}`,
      mimeType: input.blob.type,
    };
  },
};

async function authorizeWorkspaceDirectory(path: string): Promise<void> {
  await invoke('authorize_workspace_directory', { path });
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
          outputDataUrl: node.outputPath
            ? await readAssetObjectUrl(rootPath, canvas, node.outputPath)
            : node.outputDataUrl,
          outputCoverDataUrl: node.outputCoverPath
            ? await readAssetObjectUrl(rootPath, canvas, node.outputCoverPath)
            : node.outputCoverDataUrl,
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

        if (nextNode.outputCoverDataUrl && !nextNode.outputCoverPath) {
          const savedCover = await saveDataUrlAssetToCanvasDirectory(canvasDir, nextNode.outputCoverDataUrl, {
            kind: 'image',
            fileName: `${nextNode.id}-cover-${Date.now()}`,
            directoryName: 'covers',
          });
          nextNode = {
            ...nextNode,
            outputCoverPath: savedCover.assetPath,
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
    directoryName?: 'images' | 'videos' | 'audios' | 'files' | 'covers';
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
  await writeFile(await join(mediaDir, assetName), new Uint8Array(await blob.arrayBuffer()));

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
    return URL.createObjectURL(new Blob([bytes], { type: mimeType ?? getMimeTypeFromPath(assetPath) }));
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
  await mkdir(await join(canvasDir, 'assets', 'covers'), { recursive: true });
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
