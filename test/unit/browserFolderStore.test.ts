import { describe, expect, it } from 'vitest';
import {
  persistWorkspaceToFolder,
  renameCanvasFolder,
  saveAssetFileToCanvasFolder,
  saveGeneratedMediaBlobToCanvasFolder,
} from '../../src/storage/browserFolderStore';
import { createWorkspaceState, type CanvasWorkspaceState } from '../../src/app/canvasWorkspace';

class MemoryFileHandle {
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
    if (this.files.has(name)) {
      this.files.delete(name);
      return;
    }

    const existingDir = this.directories.get(name);
    if (!existingDir) {
      throw new DOMException('Not found', 'NotFoundError');
    }

    if (!options?.recursive && (existingDir.directories.size > 0 || existingDir.files.size > 0)) {
      throw new DOMException('Directory not empty', 'InvalidModificationError');
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

    const canvasDir = root.directories.get('素材画布__canvas_assets');
    const imageDir = canvasDir?.directories.get('assets')?.directories.get('images');
    expect(imageDir?.files.has('input.png')).toBe(true);
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

  it('saves last frame cover into assets/covers', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const canvas = createWorkspaceState([
      { id: 'canvas_1', name: 'Canvas', updatedAt: 'now', nodes: [], edges: [] },
    ]).canvases[0];

    const result = await saveGeneratedMediaBlobToCanvasFolder(
      root as unknown as FileSystemDirectoryHandle,
      canvas,
      {
        blob: new Blob(['image'], { type: 'image/png' }),
        fileName: 'task_1.png',
        kind: 'cover',
      },
    );

    expect(result.assetPath).toBe('assets/covers/task_1.png');
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

  it('keeps using the original canvas folder after renaming the canvas', async () => {
    const root = new MemoryDirectoryHandle('Shot Agent');
    const initialState = createWorkspaceState([
      { id: 'canvas_1', name: '旧画布名', updatedAt: 'now', nodes: [], edges: [] },
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

    expect(root.directories.has('旧画布名__canvas_1')).toBe(true);
    expect(root.directories.has('新画布名__canvas_1')).toBe(false);
    expect(secondPersisted.canvases[0].storageFolderName).toBe('旧画布名__canvas_1');
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
});
