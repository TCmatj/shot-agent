import type { CanvasNodeView, CanvasView, CanvasWorkspaceState } from '../app/canvasWorkspace';

export type WorkspacePermissionMode = 'read' | 'readwrite';

export type BrowserWorkspaceRootHandle = {
  kind: 'browser-directory';
  name: string;
  directoryHandle: FileSystemDirectoryHandle;
};

export type DesktopWorkspaceRootHandle = {
  kind: 'desktop-directory';
  name: string;
  path: string;
};

export type WorkspaceRootHandle = BrowserWorkspaceRootHandle | DesktopWorkspaceRootHandle;

export type SavedNodeAsset = Pick<
  CanvasNodeView,
  'assetName' | 'assetPath' | 'assetDataUrl' | 'assetMimeType'
>;

export type SavedNodeOutput = Pick<CanvasNodeView, 'outputPath' | 'outputDataUrl'>;

export type SavedGeneratedMedia = {
  assetName: string;
  assetPath: string;
  mimeType: string;
};

export type WorkspaceStore = {
  kind: 'browser' | 'desktop' | 'unsupported';
  isSupported(): boolean;
  pickRootDirectory(): Promise<WorkspaceRootHandle | null>;
  getStoredRootDirectoryHandle(): Promise<WorkspaceRootHandle | null>;
  storeRootDirectoryHandle(handle: WorkspaceRootHandle): Promise<void>;
  ensureDirectoryPermission(
    handle: WorkspaceRootHandle,
    mode?: WorkspacePermissionMode,
  ): Promise<boolean>;
  persistWorkspaceToFolder(
    handle: WorkspaceRootHandle,
    state: CanvasWorkspaceState,
  ): Promise<CanvasWorkspaceState>;
  readWorkspaceFromFolder(
    handle: WorkspaceRootHandle,
    fallback: CanvasWorkspaceState,
  ): Promise<CanvasWorkspaceState>;
  saveAssetFileToCanvasFolder(
    handle: WorkspaceRootHandle,
    canvas: CanvasView,
    file: File,
  ): Promise<SavedNodeAsset>;
  saveDataUrlOutputToCanvasFolder(
    handle: WorkspaceRootHandle,
    canvas: CanvasView,
    dataUrl: string,
    input: {
      kind: 'image' | 'video';
      nodeId: string;
    },
  ): Promise<SavedNodeOutput>;
  saveGeneratedMediaBlobToCanvasFolder(
    handle: WorkspaceRootHandle,
    canvas: CanvasView,
    input: {
      blob: Blob;
      fileName: string;
      kind: 'image' | 'video' | 'cover';
    },
  ): Promise<SavedGeneratedMedia>;
  renameCanvasFolder(
    handle: WorkspaceRootHandle,
    canvas: CanvasView,
    nextName: string,
  ): Promise<Pick<CanvasView, 'storageFolderName'>>;
};
