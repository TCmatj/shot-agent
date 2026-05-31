import { describe, expect, it } from 'vitest';
import { createCanvasProject } from '../../src/domain/canvasProject';
import { getCanvasDirectories, makeUniqueAssetName } from '../../src/storage/pathUtils';

describe('createCanvasProject', () => {
  it('creates a canvas with a stable id, name, and folder layout', () => {
    const project = createCanvasProject({
      name: '测试画布',
      rootDir: '/tmp/shot-agent-demo',
      now: '2026-05-20T00:00:00.000Z',
      id: 'canvas_abc123',
    });

    expect(project.id).toBe('canvas_abc123');
    expect(project.name).toBe('测试画布');
    expect(project.rootDir).toBe('/tmp/shot-agent-demo');
    expect(project.paths.workflow).toBe('workflow.json');
    expect(project.paths.assets.images).toBe('assets/images');
    expect(project.createdAt).toBe('2026-05-20T00:00:00.000Z');
  });
});

describe('path utils', () => {
  it('returns all required canvas directories', () => {
    expect(getCanvasDirectories()).toEqual([
      'history',
      'history/workflow-snapshots',
      'prompts',
      'assets/images',
      'assets/videos',
      'assets/files',
      'exports',
    ]);
  });

  it('creates a non-conflicting asset name', () => {
    expect(makeUniqueAssetName('image.png', new Set(['image.png']))).toBe('image-1.png');
    expect(makeUniqueAssetName('image.png', new Set(['other.png']))).toBe('image.png');
  });
});
