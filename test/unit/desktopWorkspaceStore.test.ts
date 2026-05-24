import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, mkdir, readFile, readTextFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { createWorkspaceState } from '../../src/app/canvasWorkspace';

const openMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/path', () => ({
  basename: vi.fn(async (path: string) => path.split(/[\\/]/).pop() ?? path),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('desktop workspace store permissions', () => {
  beforeEach(() => {
    openMock.mockReset();
    invokeMock.mockReset();
    vi.mocked(exists).mockReset();
    vi.mocked(mkdir).mockReset();
    vi.mocked(readFile).mockReset();
    vi.mocked(readTextFile).mockReset();
    vi.mocked(remove).mockReset();
    vi.mocked(writeFile).mockReset();
    window.localStorage.clear();
  });

  it('requests recursive access when picking a workspace folder', async () => {
    const { desktopWorkspaceStore } = await import('../../src/storage/desktopWorkspaceStore');
    openMock.mockResolvedValue('D:\\Shot Agent Workspace');

    const handle = await desktopWorkspaceStore.pickRootDirectory();

    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      recursive: true,
    });
    expect(invokeMock).toHaveBeenCalledWith('authorize_workspace_directory', {
      path: 'D:\\Shot Agent Workspace',
    });
    expect(handle).toMatchObject({
      kind: 'desktop-directory',
      path: 'D:\\Shot Agent Workspace',
    });
  });

  it('re-authorizes a restored workspace folder before using it', async () => {
    const { desktopWorkspaceStore } = await import('../../src/storage/desktopWorkspaceStore');
    window.localStorage.setItem('shot-agent:desktop-root-directory-path', 'D:\\Restored Workspace');

    const handle = await desktopWorkspaceStore.getStoredRootDirectoryHandle();

    expect(invokeMock).toHaveBeenCalledWith('authorize_workspace_directory', {
      path: 'D:\\Restored Workspace',
    });
    expect(handle).toMatchObject({
      kind: 'desktop-directory',
      path: 'D:\\Restored Workspace',
    });
  });

  it('uses the backend-created default desktop workspace when no folder was selected', async () => {
    const { desktopWorkspaceStore } = await import('../../src/storage/desktopWorkspaceStore');
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_default_workspace_directory') {
        return 'C:\\Users\\Tester\\AppData\\Roaming\\shotAgent';
      }

      return undefined;
    });

    const handle = await desktopWorkspaceStore.getStoredRootDirectoryHandle();

    expect(mkdir).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('get_default_workspace_directory');
    expect(invokeMock).not.toHaveBeenCalledWith('authorize_workspace_directory', expect.anything());
    expect(handle).toMatchObject({
      kind: 'desktop-directory',
      name: 'shotAgent',
      path: 'C:\\Users\\Tester\\AppData\\Roaming\\shotAgent',
    });
  });

  it('removes the persisted folder for a deleted canvas', async () => {
    const { desktopWorkspaceStore } = await import('../../src/storage/desktopWorkspaceStore');
    vi.mocked(remove).mockResolvedValue(undefined);
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    await desktopWorkspaceStore.deleteCanvasFolder(
      {
        kind: 'desktop-directory',
        name: 'Workspace',
        path: 'D:\\Workspace',
      },
      canvas,
    );

    expect(remove).toHaveBeenCalledWith('D:\\Workspace/Canvas__canvas_1', { recursive: true });
  });

  it('returns a data URL for imported desktop assets so model requests do not receive blob URLs', async () => {
    const { desktopWorkspaceStore } = await import('../../src/storage/desktopWorkspaceStore');
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    const result = await desktopWorkspaceStore.saveAssetFileToCanvasFolder(
      {
        kind: 'desktop-directory',
        name: 'Workspace',
        path: 'D:\\Workspace',
      },
      canvas,
      new File(['image'], 'input.png', { type: 'image/png' }),
    );

    expect(result).toMatchObject({
      assetName: 'input.png',
      assetPath: 'assets/images/input.png',
      assetMimeType: 'image/png',
    });
    expect(result.assetDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.assetDataUrl).not.toContain('blob:');
  });
});
