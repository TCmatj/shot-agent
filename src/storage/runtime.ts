export type WorkspaceStoreKind = 'browser' | 'desktop' | 'unsupported';

type RuntimeOptions = {
  isTauri: boolean;
  hasBrowserDirectoryPicker: boolean;
};

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

export function hasBrowserDirectoryPicker(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export function resolveWorkspaceStoreKind(options: RuntimeOptions): WorkspaceStoreKind {
  if (options.isTauri) {
    return 'desktop';
  }

  if (options.hasBrowserDirectoryPicker) {
    return 'browser';
  }

  return 'unsupported';
}
