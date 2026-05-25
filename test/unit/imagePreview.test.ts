import { describe, expect, it } from 'vitest';
import {
  clampPreviewImageZoom,
  getNextPreviewImageZoom,
  getPreviewZoomedScrollPosition,
} from '../../src/app/imagePreview';

describe('image preview helpers', () => {
  it('clamps zoom into the supported range', () => {
    expect(clampPreviewImageZoom(20)).toBe(50);
    expect(clampPreviewImageZoom(120)).toBe(120);
    expect(clampPreviewImageZoom(800)).toBe(500);
  });

  it('calculates the next zoom level from deltas', () => {
    expect(getNextPreviewImageZoom(100, 10)).toBe(110);
    expect(getNextPreviewImageZoom(100, -80)).toBe(50);
    expect(getNextPreviewImageZoom(490, 40)).toBe(500);
  });

  it('preserves the hovered point by shifting scroll during zoom', () => {
    expect(
      getPreviewZoomedScrollPosition({
        currentZoom: 100,
        nextZoom: 110,
        scrollLeft: 20,
        scrollTop: 10,
        anchorX: 100,
        anchorY: 50,
      }),
    ).toEqual({
      scrollLeft: 32,
      scrollTop: 16,
    });
  });
});
