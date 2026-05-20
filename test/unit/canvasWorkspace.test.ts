import { describe, expect, it } from 'vitest';
import {
  createWorkspaceState,
  parseWorkspaceState,
  serializeWorkspaceState,
  type CanvasView,
} from '../../src/app/canvasWorkspace';

const canvases: CanvasView[] = [
  {
    id: 'canvas_first',
    name: '默认画布',
    updatedAt: '刚刚',
    nodes: [],
  },
  {
    id: 'canvas_second',
    name: '第二画布',
    updatedAt: '刚刚',
    nodes: [],
  },
];

describe('canvas workspace persistence', () => {
  it('uses first canvas as default active canvas', () => {
    expect(createWorkspaceState(canvases).activeCanvasId).toBe('canvas_first');
  });

  it('serializes and parses workspace state', () => {
    const state = {
      activeCanvasId: 'canvas_second',
      canvases,
    };

    expect(parseWorkspaceState(serializeWorkspaceState(state), createWorkspaceState(canvases))).toEqual(
      state,
    );
  });

  it('falls back when storage payload is invalid', () => {
    const fallback = createWorkspaceState(canvases);

    expect(parseWorkspaceState('{bad json', fallback)).toEqual(fallback);
    expect(parseWorkspaceState('{"version":1,"activeCanvasId":"missing","canvases":[]}', fallback)).toEqual(
      fallback,
    );
  });
});
