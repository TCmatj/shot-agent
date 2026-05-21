import { describe, expect, it } from 'vitest';
import {
  parseStoredCanvasViewports,
  serializeStoredCanvasViewports,
} from '../../src/app/canvasViewports';

describe('canvas viewports storage', () => {
  it('round-trips per-canvas viewport state', () => {
    const serialized = serializeStoredCanvasViewports({
      canvas_first: { x: -120, y: 48, scale: 1.4 },
    });

    expect(parseStoredCanvasViewports(serialized)).toEqual({
      canvas_first: { x: -120, y: 48, scale: 1.4 },
    });
  });

  it('drops invalid viewport values when parsing', () => {
    expect(
      parseStoredCanvasViewports(
        JSON.stringify({
          canvas_first: { x: 0, y: 0, scale: 0 },
          canvas_second: { x: 10, y: 20, scale: 1.2 },
          canvas_bad: { x: '10', y: 20, scale: 1 },
        }),
      ),
    ).toEqual({
      canvas_second: { x: 10, y: 20, scale: 1.2 },
    });
  });

  it('returns an empty map for missing or malformed values', () => {
    expect(parseStoredCanvasViewports(null)).toEqual({});
    expect(parseStoredCanvasViewports('{bad json')).toEqual({});
  });
});
