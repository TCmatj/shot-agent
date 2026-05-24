import { browserWorkspaceStore } from './browserWorkspaceStore';
import { desktopWorkspaceStore } from './desktopWorkspaceStore';
import {
  hasBrowserDirectoryPicker,
  isTauriRuntime,
  resolveWorkspaceStoreKind,
} from './runtime';
import type { WorkspaceStore } from './workspaceStore';

const unsupportedWorkspaceStore: WorkspaceStore = {
  kind: 'unsupported',
  isSupported() {
    return false;
  },
  async pickRootDirectory() {
    return null;
  },
  async getStoredRootDirectoryHandle() {
    return null;
  },
  async storeRootDirectoryHandle() {
    throw new Error('当前运行环境不支持工作区存储');
  },
  async ensureDirectoryPermission() {
    return false;
  },
  async persistWorkspaceToFolder(_handle, state) {
    return state;
  },
  async readWorkspaceFromFolder(_handle, fallback) {
    return fallback;
  },
  async deleteCanvasFolder() {
    return undefined;
  },
  async saveAssetFileToCanvasFolder() {
    throw new Error('当前运行环境不支持工作区存储');
  },
  async saveDataUrlOutputToCanvasFolder() {
    throw new Error('当前运行环境不支持工作区存储');
  },
  async saveGeneratedMediaBlobToCanvasFolder() {
    throw new Error('当前运行环境不支持工作区存储');
  },
};

export function getWorkspaceStore(): WorkspaceStore {
  const kind = resolveWorkspaceStoreKind({
    isTauri: isTauriRuntime(),
    hasBrowserDirectoryPicker: hasBrowserDirectoryPicker(),
  });

  if (kind === 'desktop') {
    return desktopWorkspaceStore;
  }

  if (kind === 'browser') {
    return browserWorkspaceStore;
  }

  return unsupportedWorkspaceStore;
}
