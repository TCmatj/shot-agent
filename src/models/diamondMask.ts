export type DiamondMaskColor = 'white' | 'red' | 'yellow' | 'blue' | 'green';

export type DiamondMaskRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiamondMaskSettings = {
  lineWidth: number;
  density: number;
  color: DiamondMaskColor;
  rect: DiamondMaskRect;
};

export type DiamondMaskLineSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const diamondMaskColorValues: Record<DiamondMaskColor, string> = {
  white: '#ffffff',
  red: '#ff2a1f',
  yellow: '#ffd84a',
  blue: '#3b82f6',
  green: '#22c55e',
};

export function normalizeDiamondMaskLineWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

export function normalizeDiamondMaskDensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 38;
  }

  return Math.min(70, Math.max(20, Math.round(value)));
}

export function normalizeDiamondMaskRect(
  rect: DiamondMaskRect,
  imageWidth: number,
  imageHeight: number,
): DiamondMaskRect {
  const minSize = 24;
  const maxWidth = Math.max(minSize, imageWidth);
  const maxHeight = Math.max(minSize, imageHeight);
  const width = Math.min(maxWidth, Math.max(minSize, rect.width));
  const height = Math.min(maxHeight, Math.max(minSize, rect.height));

  return {
    x: Math.min(Math.max(0, rect.x), Math.max(0, imageWidth - width)),
    y: Math.min(Math.max(0, rect.y), Math.max(0, imageHeight - height)),
    width,
    height,
  };
}

export function createDefaultDiamondMaskRect(
  imageWidth: number,
  imageHeight: number,
): DiamondMaskRect {
  const width = Math.max(80, imageWidth * 0.58);
  const height = Math.max(80, imageHeight * 0.42);

  return normalizeDiamondMaskRect(
    {
      x: (imageWidth - width) / 2,
      y: (imageHeight - height) / 2,
      width,
      height,
    },
    imageWidth,
    imageHeight,
  );
}

export function buildDiamondMaskLineSegments(
  rect: DiamondMaskRect,
  density: number,
): DiamondMaskLineSegment[] {
  const spacing = normalizeDiamondMaskDensity(density);
  const segments: DiamondMaskLineSegment[] = [];
  const start = -rect.height;
  const end = rect.width + rect.height;

  for (let offset = start; offset <= end; offset += spacing) {
    segments.push({
      x1: rect.x + offset,
      y1: rect.y,
      x2: rect.x + offset + rect.height,
      y2: rect.y + rect.height,
    });
    segments.push({
      x1: rect.x + offset,
      y1: rect.y + rect.height,
      x2: rect.x + offset + rect.height,
      y2: rect.y,
    });
  }

  return segments;
}

export async function createDiamondMaskImageDataUrl(input: {
  imageUrl: string;
  settings: DiamondMaskSettings;
  imageWidth?: number;
  imageHeight?: number;
}): Promise<string> {
  const image = await loadImage(input.imageUrl);
  const imageWidth = input.imageWidth ?? image.naturalWidth;
  const imageHeight = input.imageHeight ?? image.naturalHeight;
  const rect = normalizeDiamondMaskRect(input.settings.rect, imageWidth, imageHeight);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('当前浏览器不支持图片处理画布。');
  }

  canvas.width = imageWidth;
  canvas.height = imageHeight;
  context.drawImage(image, 0, 0, imageWidth, imageHeight);
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.strokeStyle = diamondMaskColorValues[input.settings.color];
  context.lineWidth = normalizeDiamondMaskLineWidth(input.settings.lineWidth);
  context.lineCap = 'butt';
  context.globalAlpha = 0.82;

  for (const segment of buildDiamondMaskLineSegments(rect, input.settings.density)) {
    context.beginPath();
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);
    context.stroke();
  }

  context.restore();
  return canvas.toDataURL('image/png');
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('读取遮罩图片失败，请重新选择图片。'));
    image.src = source;
  });
}
