import { describe, expect, it } from 'vitest';
import { createCanvasProject } from '../../src/domain/canvasProject';

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
