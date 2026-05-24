import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('desktop workspace store permissions', () => {
  beforeEach(() => {
    openMock.mockReset();
    invokeMock.mockReset();
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
});
