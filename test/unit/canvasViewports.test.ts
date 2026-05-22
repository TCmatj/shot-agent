import { describe, expect, it } from 'vitest';
import {
  calculateCanvasCenterFromMinimapFrame,
  calculateMinimapViewportFrame,
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

  it('keeps the minimap viewport frame inside the minimap bounds', () => {
    expect(
      calculateMinimapViewportFrame(
        { x: -120, y: 20, width: 760, height: 420 },
        { minX: 0, minY: 0, maxX: 640, maxY: 360, width: 640, height: 360 },
        { width: 220, height: 150 },
      ),
    ).toEqual({
      left: 0,
      top: expect.any(Number),
      width: 220,
      height: expect.any(Number),
    });
  });

  it('maps a dragged minimap viewport frame back to canvas center coordinates', () => {
    expect(
      calculateCanvasCenterFromMinimapFrame(
        { left: 40, top: 30, width: 110, height: 75 },
        { minX: -80, minY: -80, maxX: 640, maxY: 400, width: 720, height: 480 },
        { width: 220, height: 150 },
        { width: 360, height: 240 },
      ),
    ).toEqual({
      x: expect.closeTo(230.909, 3),
      y: expect.closeTo(138.182, 3),
    });
  });
});
