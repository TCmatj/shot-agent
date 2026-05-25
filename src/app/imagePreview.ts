export const previewImageZoomMin = 50;
export const previewImageZoomMax = 500;
export const previewImageZoomStep = 10;

export function clampPreviewImageZoom(value: number): number {
  return Math.min(previewImageZoomMax, Math.max(previewImageZoomMin, value));
}

export function getNextPreviewImageZoom(currentZoom: number, delta: number): number {
  return clampPreviewImageZoom(currentZoom + delta);
}

export function getPreviewZoomedScrollPosition(input: {
  currentZoom: number;
  nextZoom: number;
  scrollLeft: number;
  scrollTop: number;
  anchorX: number;
  anchorY: number;
}) {
  const ratio = input.nextZoom / input.currentZoom;

  return {
    scrollLeft: (input.scrollLeft + input.anchorX) * ratio - input.anchorX,
    scrollTop: (input.scrollTop + input.anchorY) * ratio - input.anchorY,
  };
}
