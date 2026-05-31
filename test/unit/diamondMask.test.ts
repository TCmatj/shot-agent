import { describe, expect, it } from 'vitest';
import {
  buildDiamondMaskLineSegments,
  createDefaultDiamondMaskRect,
  normalizeDiamondMaskDensity,
  normalizeDiamondMaskLineWidth,
  normalizeDiamondMaskRect,
} from '../../src/models/diamondMask';

describe('diamondMask', () => {
  it('normalizes line width and density to supported ranges', () => {
    expect(normalizeDiamondMaskLineWidth(0)).toBe(1);
    expect(normalizeDiamondMaskLineWidth(3.4)).toBe(3);
    expect(normalizeDiamondMaskLineWidth(9)).toBe(5);
    expect(normalizeDiamondMaskDensity(12)).toBe(20);
    expect(normalizeDiamondMaskDensity(43.6)).toBe(44);
    expect(normalizeDiamondMaskDensity(99)).toBe(70);
  });

  it('keeps the mask rectangle inside the image bounds', () => {
    expect(
      normalizeDiamondMaskRect(
        { x: -20, y: 190, width: 500, height: 10 },
        300,
        200,
      ),
    ).toEqual({ x: 0, y: 176, width: 300, height: 24 });
  });

  it('creates a centered default mask rectangle', () => {
    expect(createDefaultDiamondMaskRect(1000, 800)).toEqual({
      x: 210,
      y: 232,
      width: 580,
      height: 336,
    });
  });

  it('builds both diagonal directions for the diamond grid', () => {
    const segments = buildDiamondMaskLineSegments(
      { x: 10, y: 20, width: 100, height: 80 },
      40,
    );

    expect(segments[0]).toEqual({ x1: -70, y1: 20, x2: 10, y2: 100 });
    expect(segments[1]).toEqual({ x1: -70, y1: 100, x2: 10, y2: 20 });
    expect(segments.length).toBeGreaterThan(4);
  });
});
