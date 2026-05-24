import {
  ensureDirectoryPermission as ensureBrowserDirectoryPermission,
  deleteCanvasFolder as deleteCanvasFolderFromBrowserFolder,
  getStoredRootDirectoryHandle as getStoredBrowserRootDirectoryHandle,
  persistWorkspaceToFolder as persistWorkspaceToBrowserFolder,
  readWorkspaceFromFolder as readWorkspaceFromBrowserFolder,
  saveAssetFileToCanvasFolder as saveAssetFileToBrowserCanvasFolder,
  saveDataUrlOutputToCanvasFolder as saveDataUrlOutputToBrowserCanvasFolder,
  saveGeneratedMediaBlobToCanvasFolder as saveGeneratedMediaBlobToBrowserCanvasFolder,
  storeRootDirectoryHandle as storeBrowserRootDirectoryHandle,
  type ShotAgentDirectoryHandle,
} from './browserFolderStore';
import type { WorkspaceStore } from './workspaceStore';

type BrowserWindow = Window & {
  showDirectoryPicker?: () => Promise<ShotAgentDirectoryHandle>;
};

export const browserWorkspaceStore: WorkspaceStore = {
  kind: 'browser',
  isSupported() {
    return typeof window !== 'undefined' && typeof (window as BrowserWindow).showDirectoryPicker === 'function';
  },
  async pickRootDirectory() {
    const picker = typeof window !== 'undefined' ? (window as BrowserWindow).showDirectoryPicker : undefined;

    if (!picker) {
      return null;
    }

    const handle = await picker();

    return {
      kind: 'browser-directory',
      name: handle.name,
      directoryHandle: handle,
    };
  },
  async getStoredRootDirectoryHandle() {
    const handle = await getStoredBrowserRootDirectoryHandle();

    if (!handle) {
      return null;
    }

    return {
      kind: 'browser-directory',
      name: handle.name,
      directoryHandle: handle,
    };
  },
  async storeRootDirectoryHandle(handle) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('浏览器存储仅支持浏览器目录句柄');
    }

    await storeBrowserRootDirectoryHandle(handle.directoryHandle as ShotAgentDirectoryHandle);
  },
  async ensureDirectoryPermission(handle, mode = 'readwrite') {
    if (handle.kind !== 'browser-directory') {
      return false;
    }

    return ensureBrowserDirectoryPermission(handle.directoryHandle as ShotAgentDirectoryHandle, mode);
  },
  async persistWorkspaceToFolder(handle, state) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('浏览器存储仅支持浏览器目录句柄');
    }

    return persistWorkspaceToBrowserFolder(handle.directoryHandle as ShotAgentDirectoryHandle, state);
  },
  async readWorkspaceFromFolder(handle, fallback) {
    if (handle.kind !== 'browser-directory') {
      return fallback;
    }

    return readWorkspaceFromBrowserFolder(handle.directoryHandle as ShotAgentDirectoryHandle, fallback);
  },
  async deleteCanvasFolder(handle, canvas) {
    if (handle.kind !== 'browser-directory') {
      return;
    }

    await deleteCanvasFolderFromBrowserFolder(handle.directoryHandle as ShotAgentDirectoryHandle, canvas);
  },
  async saveAssetFileToCanvasFolder(handle, canvas, file) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('浏览器存储仅支持浏览器目录句柄');
    }

    return saveAssetFileToBrowserCanvasFolder(handle.directoryHandle as ShotAgentDirectoryHandle, canvas, file);
  },
  async saveDataUrlOutputToCanvasFolder(handle, canvas, dataUrl, input) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('浏览器存储仅支持浏览器目录句柄');
    }

    return saveDataUrlOutputToBrowserCanvasFolder(
      handle.directoryHandle as ShotAgentDirectoryHandle,
      canvas,
      dataUrl,
      input,
    );
  },
  async saveGeneratedMediaBlobToCanvasFolder(handle, canvas, input) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('浏览器存储仅支持浏览器目录句柄');
    }

    return saveGeneratedMediaBlobToBrowserCanvasFolder(
      handle.directoryHandle as ShotAgentDirectoryHandle,
      canvas,
      input,
    );
  },
  async saveGeneratedMediaUrlToCanvasFolder(handle, canvas, input) {
    if (handle.kind !== 'browser-directory') {
      throw new Error('Browser storage only supports browser directory handles');
    }

    const response = await fetch(input.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const saved = await saveGeneratedMediaBlobToBrowserCanvasFolder(
      handle.directoryHandle as ShotAgentDirectoryHandle,
      canvas,
      {
        blob,
        fileName: input.fileName,
        kind: input.kind,
      },
    );

    return {
      ...saved,
      assetDataUrl: URL.createObjectURL(blob),
    };
  },
};
