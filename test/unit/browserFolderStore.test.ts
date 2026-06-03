import { describe, expect, it } from 'vitest';
import {
  deleteCanvasFolder,
  persistWorkspaceToFolder,
  readWorkspaceFromFolder,
  renameCanvasFolder,
  saveAssetFileToCanvasFolder,
  saveGeneratedMediaBlobToCanvasFolder,
} from '../../src/storage/browserFolderStore';
import { createWorkspaceState, type CanvasWorkspaceState } from '../../src/app/canvasWorkspace';

class MemoryFileHandle {
  public readonly kind = 'file';

  constructor(
    public readonly name: string,
    private readonly files: Map<string, Blob | string>,
  ) {}

  async createWritable() {
    return {
      write: async (value: Blob | string) => {
        this.files.set(this.name, value);
      },
      close: async () => undefined,
    };
  }

  async getFile() {
    const value = this.files.get(this.name) ?? '';
    return value instanceof Blob ? new File([value], this.name, { type: value.type }) : new File([value], this.name);
  }
}

class MemoryDirectoryHandle {
  public readonly kind = 'directory';
  public readonly directories = new Map<string, MemoryDirectoryHandle>();
  public readonly files = new Map<string, Blob | string>();

  constructor(public readonly name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.directories.get(name);

    if (existing) {
      return existing;
    }

    if (!options?.create) {
      throw new DOMException('Not found', 'NotFoundError');
    }

    const directory = new MemoryDirectoryHandle(name);
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) {
      throw new DOMException('Not found', 'NotFoundError');
    }

    if (!this.files.has(name)) {
      this.files.set(name, '');
    }

    return new MemoryFileHandle(name, this.files);
  }

  async removeEntry(name: string, options?: { recursive?: boolean }) {
    if (this.files.delete(name)) {
      return;
    }

    const directory = this.directories.get(name);

    if (!directory) {
      throw new DOMException('Not found', 'NotFoundError');
    }

    if (!options?.recursive && (directory.files.size > 0 || directory.directories.size > 0)) {
      throw new DOMException('Directory is not empty', 'InvalidModificationError');
    }

    this.directories.delete(name);
  }

  async *values() {
    for (const directory of this.directories.values()) {
      yield Object.assign(directory, { kind: 'directory' as const });
    }

    for (const fileName of this.files.keys()) {
      yield {
        kind: 'file' as const,
        name: fileName,
        getFile: async () => {
          const value = this.files.get(fileName) ?? '';
          return value instanceof Blob
            ? new File([value], fileName, { type: value.type })
            : new File([value], fileName);
        },
      };
    }
  }

  async *entries() {
    for (const entry of this.directories.entries()) {
      yield entry;
    }

    for (const entry of this.files.keys()) {
      yield [entry, new MemoryFileHandle(entry, this.files)] as const;
    }
  }
}

describe('browser folder store', () => {
  it('migrates browser-only node asset data urls into canvas asset files', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_assets',
          name: '素材画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_image_asset',
              title: '图片',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetMimeType: 'image/png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'node_image_output',
              title: '图片生成',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 300,
              y: 0,
              outputDataUrl: 'data:image/png;base64,b3V0cHV0',
            },
            {
              id: 'node_mask',
              title: '菱形遮罩',
              modelId: 'diamond-mask',
              kind: 'diamondMask',
              x: 600,
              y: 0,
              maskImageName: 'mask-source.png',
              maskImageDataUrl: 'data:image/png;base64,bWFzaw==',
              maskImageMimeType: 'image/png',
            },
          ],
          edges: [],
        },
      ]),
    };

    const migrated = await persistWorkspaceToFolder(root as unknown as FileSystemDirectoryHandle, state);

    const canvas = migrated.canvases[0];
    expect(canvas.nodes[0]).toMatchObject({
      assetPath: 'assets/images/input.png',
    });
    expect(canvas.nodes[0].assetDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(canvas.nodes[1].outputPath).toMatch(/^assets\/images\/node_image_output-\d+\.png$/);
    expect(canvas.nodes[1].outputDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(canvas.nodes[2].maskImagePath).toBe('assets/images/mask-source.png');
    expect(canvas.nodes[2].maskImageDataUrl).toMatch(/^data:image\/png;base64,/);

    const canvasDir = root.directories.get('素材画布__canvas_assets');
    const imageDir = canvasDir?.directories.get('assets')?.directories.get('images');
    expect(imageDir?.files.has('input.png')).toBe(true);
    expect(imageDir?.files.has('mask-source.png')).toBe(true);
    expect([...imageDir?.files.keys() ?? []].some((fileName) => fileName.startsWith('node_image_output-'))).toBe(true);
    expect(String(root.files.get('workspace.json'))).not.toContain('data:image/png;base64');
  });

  it('saves fetched video output into assets/videos', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    const result = await saveGeneratedMediaBlobToCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      canvas,
      {
        blob: new Blob(['video'], { type: 'video/mp4' }),
        fileName: 'task_1.mp4',
        kind: 'video',
      },
    );

    expect(result.assetPath).toBe('assets/videos/task_1.mp4');
  });

  it('stores imported audio assets in a dedicated audio directory', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    const result = await saveAssetFileToCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      canvas,
      new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' }),
    );

    expect(result.assetPath).toBe('assets/audios/voice.mp3');
    const canvasDir = root.directories.get('Canvas__canvas_1');
    expect(canvasDir?.directories.get('assets')?.directories.get('audios')?.files.has('voice.mp3')).toBe(true);
  });

  it('reuses the existing image asset when the same image is imported again in the same canvas', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];
    const duplicateImage = new File(['same-image'], 'input.png', { type: 'image/png' });

    const first = await saveAssetFileToCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      canvas,
      duplicateImage,
    );
    const second = await saveAssetFileToCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      canvas,
      new File(['same-image'], 'another-name.png', { type: 'image/png' }),
    );

    expect(first.assetPath).toBe('assets/images/input.png');
    expect(second.assetPath).toBe(first.assetPath);
    expect(second.assetName).toBe(first.assetName);

    const canvasDir = root.directories.get('Canvas__canvas_1');
    const imageDir = canvasDir?.directories.get('assets')?.directories.get('images');
    expect([...imageDir?.files.keys() ?? []]).toEqual(['input.png']);
  });

  it('renames the canvas folder when the canvas name changes', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const initialState = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '旧画布名',
        updatedAt: 'now',
        nodes: [
          {
            id: 'node_image_1',
            title: '图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
          },
        ],
        edges: [],
      },
    ]);

    const firstPersisted = await persistWorkspaceToFolder(
      root as unknown as FileSystemDirectoryHandle,
      initialState,
    );

    const renamedState = {
      ...firstPersisted,
      canvases: firstPersisted.canvases.map((canvas) =>
        canvas.id === 'canvas_1'
          ? { ...canvas, name: '新画布名', updatedAt: '刚刚' }
          : canvas,
      ),
    };

    const secondPersisted = await persistWorkspaceToFolder(
      root as unknown as FileSystemDirectoryHandle,
      renamedState,
    );

    expect(root.directories.has('旧画布名__canvas_1')).toBe(false);
    expect(root.directories.has('新画布名__canvas_1')).toBe(true);
    expect(secondPersisted.canvases[0].storageFolderName).toBe('新画布名__canvas_1');
    expect(
      root.directories
        .get('新画布名__canvas_1')
        ?.directories.get('assets')
        ?.directories.get('images')
        ?.files.has('node_image_1.png'),
    ).toBe(true);
  });

  it('renames the canvas folder to the new canvas name', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const initialState = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '旧画布名',
        updatedAt: 'now',
        nodes: [
          {
            id: 'image_asset_1',
            title: '图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetName: 'input.png',
            assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            assetMimeType: 'image/png',
          },
        ],
        edges: [],
      },
    ]);

    const persisted = await persistWorkspaceToFolder(
      root as unknown as FileSystemDirectoryHandle,
      initialState,
    );
    const renamed = await renameCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      persisted.canvases[0],
      '新画布名',
    );

    expect(renamed.storageFolderName).toBe('新画布名__canvas_1');
    expect(root.directories.has('旧画布名__canvas_1')).toBe(false);
    expect(root.directories.has('新画布名__canvas_1')).toBe(true);
    expect(
      root.directories
        .get('新画布名__canvas_1')
        ?.directories.get('assets')
        ?.directories.get('images')
        ?.files.has('input.png'),
    ).toBe(true);
  });

  it('removes legacy canvas folder names when deleting a canvas', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    await root.getDirectoryHandle('Legacy Canvas', { create: true });
    await root.getDirectoryHandle('Legacy Canvas__canvas_legacy', { create: true });
    const canvas = createWorkspaceState([
      { id: 'canvas_legacy', name: 'Legacy Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    await deleteCanvasFolder(root as unknown as FileSystemDirectoryHandle, canvas);

    expect(root.directories.has('Legacy Canvas')).toBe(false);
    expect(root.directories.has('Legacy Canvas__canvas_legacy')).toBe(false);
  });

  it('loads canvases from subfolders when workspace.json is missing', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvasDir = await root.getDirectoryHandle('外部画布__canvas_external', { create: true });

    root.files.delete('workspace.json');
    canvasDir.files.set(
      'canvas.json',
      JSON.stringify({
        id: 'canvas_external',
        name: '外部画布',
        storageFolderName: '外部画布__canvas_external',
        updatedAt: '刚刚',
        nodes: [],
        edges: [],
      }),
    );
    canvasDir.files.set(
      'workflow.json',
      JSON.stringify({
        canvasId: 'canvas_external',
        nodes: [],
        edges: [],
      }),
    );

    const restored = await readWorkspaceFromFolder(
      root as unknown as FileSystemDirectoryHandle,
      createWorkspaceState([{ id: 'fallback', name: 'Fallback', updatedAt: 'now', nodes: [], edges: [] }]),
    );

    expect(restored.canvases.map((canvas) => canvas.id)).toEqual(['canvas_external']);
    expect(restored.activeCanvasId).toBe('canvas_external');
  });

  it('can skip discovered subfolders when restoring an automatic default workspace', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvasDir = await root.getDirectoryHandle('Legacy Canvas__canvas_legacy', { create: true });

    root.files.delete('workspace.json');
    canvasDir.files.set(
      'canvas.json',
      JSON.stringify({
        id: 'canvas_legacy',
        name: 'Legacy Canvas',
        storageFolderName: 'Legacy Canvas__canvas_legacy',
        updatedAt: 'now',
        nodes: [],
        edges: [],
      }),
    );

    const fallback = createWorkspaceState([]);
    const restored = await readWorkspaceFromFolder(
      root as unknown as FileSystemDirectoryHandle,
      fallback,
      { includeDiscoveredCanvases: false },
    );

    expect(restored).toEqual(fallback);
  });

  it('merges missing canvases from subfolders even when workspace.json exists', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const workspaceState = createWorkspaceState([
      { id: 'canvas_saved', name: '已保存画布', updatedAt: 'now', nodes: [], edges: [] },
    ]);

    await persistWorkspaceToFolder(root as unknown as FileSystemDirectoryHandle, workspaceState);

    const extraCanvasDir = await root.getDirectoryHandle('额外画布__canvas_extra', { create: true });
    extraCanvasDir.files.set(
      'canvas.json',
      JSON.stringify({
        id: 'canvas_extra',
        name: '额外画布',
        storageFolderName: '额外画布__canvas_extra',
        updatedAt: '刚刚',
        nodes: [],
        edges: [],
      }),
    );
    extraCanvasDir.files.set(
      'workflow.json',
      JSON.stringify({
        canvasId: 'canvas_extra',
        nodes: [],
        edges: [],
      }),
    );

    const restored = await readWorkspaceFromFolder(
      root as unknown as FileSystemDirectoryHandle,
      createWorkspaceState([]),
    );

    expect(restored.canvases.map((canvas) => canvas.id)).toEqual(['canvas_saved', 'canvas_extra']);
  });
});
