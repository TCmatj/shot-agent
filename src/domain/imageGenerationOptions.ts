export type ImageResolutionTier = '1k' | '2k' | '4k';
export type ImageQuality = 'low' | 'medium' | 'high';

export type ImageAspectOption = {
  ratio: string;
  orientation: string;
  width?: number;
  height?: number;
};

export const defaultImageResolutionTier: ImageResolutionTier = '1k';
export const defaultImageAspectRatio = '16:9';
export const defaultImageQuality: ImageQuality = 'high';

const imageAspectOptionsByTier: Record<ImageResolutionTier, ImageAspectOption[]> = {
  '1k': [
    { ratio: 'auto', orientation: 'Auto' },
    { ratio: '1:1', orientation: '正方形', width: 1024, height: 1024 },
    { ratio: '4:5', orientation: '竖版', width: 1024, height: 1280 },
    { ratio: '5:4', orientation: '横版', width: 1280, height: 1024 },
    { ratio: '3:4', orientation: '竖版', width: 768, height: 1024 },
    { ratio: '4:3', orientation: '横版', width: 1024, height: 768 },
    { ratio: '2:3', orientation: '竖版', width: 1024, height: 1536 },
    { ratio: '3:2', orientation: '横版', width: 1536, height: 1024 },
    { ratio: '9:16', orientation: '竖版', width: 720, height: 1280 },
    { ratio: '16:9', orientation: '横版', width: 1280, height: 720 },
    { ratio: '5:8', orientation: '竖版', width: 800, height: 1280 },
    { ratio: '8:5', orientation: '横版', width: 1280, height: 800 },
    { ratio: '9:21', orientation: '超长竖版', width: 720, height: 1680 },
    { ratio: '21:9', orientation: '超宽横版', width: 1680, height: 720 },
    { ratio: '1:2', orientation: '长竖版', width: 640, height: 1280 },
    { ratio: '2:1', orientation: '长横版', width: 1280, height: 640 },
    { ratio: '1:3', orientation: '超长竖版', width: 512, height: 1536 },
    { ratio: '3:1', orientation: '超宽横版', width: 1536, height: 512 },
    { ratio: '7:10', orientation: '印刷竖版', width: 896, height: 1280 },
    { ratio: '10:7', orientation: '印刷横版', width: 1280, height: 896 },
    { ratio: '10:19', orientation: '长竖版', width: 640, height: 1216 },
    { ratio: '19:10', orientation: '长横版', width: 1216, height: 640 },
  ],
  '2k': [
    { ratio: 'auto', orientation: 'Auto' },
    { ratio: '1:1', orientation: '正方形', width: 2048, height: 2048 },
    { ratio: '4:5', orientation: '竖版', width: 1600, height: 2000 },
    { ratio: '5:4', orientation: '横版', width: 2000, height: 1600 },
    { ratio: '3:4', orientation: '竖版', width: 1536, height: 2048 },
    { ratio: '4:3', orientation: '横版', width: 2048, height: 1536 },
    { ratio: '2:3', orientation: '竖版', width: 1344, height: 2016 },
    { ratio: '3:2', orientation: '横版', width: 2016, height: 1344 },
    { ratio: '9:16', orientation: '竖版', width: 1152, height: 2048 },
    { ratio: '16:9', orientation: '横版', width: 2048, height: 1152 },
    { ratio: '5:8', orientation: '竖版', width: 1280, height: 2048 },
    { ratio: '8:5', orientation: '横版', width: 2048, height: 1280 },
    { ratio: '9:21', orientation: '超长竖版', width: 864, height: 2016 },
    { ratio: '21:9', orientation: '超宽横版', width: 2016, height: 864 },
    { ratio: '1:2', orientation: '长竖版', width: 1024, height: 2048 },
    { ratio: '2:1', orientation: '长横版', width: 2048, height: 1024 },
    { ratio: '1:3', orientation: '超长竖版', width: 672, height: 2016 },
    { ratio: '3:1', orientation: '超宽横版', width: 2016, height: 672 },
    { ratio: '7:10', orientation: '印刷竖版', width: 1344, height: 1920 },
    { ratio: '10:7', orientation: '印刷横版', width: 1920, height: 1344 },
    { ratio: '10:19', orientation: '长竖版', width: 1120, height: 2128 },
    { ratio: '19:10', orientation: '长横版', width: 2128, height: 1120 },
  ],
  '4k': [
    { ratio: 'auto', orientation: 'Auto' },
    { ratio: '1:1', orientation: '正方形', width: 2880, height: 2880 },
    { ratio: '4:5', orientation: '竖版', width: 2560, height: 3200 },
    { ratio: '5:4', orientation: '横版', width: 3200, height: 2560 },
    { ratio: '3:4', orientation: '竖版', width: 2448, height: 3264 },
    { ratio: '4:3', orientation: '横版', width: 3264, height: 2448 },
    { ratio: '2:3', orientation: '竖版', width: 2336, height: 3504 },
    { ratio: '3:2', orientation: '横版', width: 3504, height: 2336 },
    { ratio: '9:16', orientation: '竖版', width: 2160, height: 3840 },
    { ratio: '16:9', orientation: '横版', width: 3840, height: 2160 },
    { ratio: '5:8', orientation: '竖版', width: 2240, height: 3584 },
    { ratio: '8:5', orientation: '横版', width: 3584, height: 2240 },
    { ratio: '9:21', orientation: '超长竖版', width: 1584, height: 3696 },
    { ratio: '21:9', orientation: '超宽横版', width: 3696, height: 1584 },
    { ratio: '1:2', orientation: '长竖版', width: 1920, height: 3840 },
    { ratio: '2:1', orientation: '长横版', width: 3840, height: 1920 },
    { ratio: '1:3', orientation: '超长竖版', width: 1280, height: 3840 },
    { ratio: '3:1', orientation: '超宽横版', width: 3840, height: 1280 },
    { ratio: '7:10', orientation: '印刷竖版', width: 2352, height: 3360 },
    { ratio: '10:7', orientation: '印刷横版', width: 3360, height: 2352 },
    { ratio: '10:19', orientation: '长竖版', width: 1920, height: 3648 },
    { ratio: '19:10', orientation: '长横版', width: 3648, height: 1920 },
  ],
};

export const imageResolutionOptions: Array<{
  value: ImageResolutionTier;
  label: string;
}> = [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K / 最大' },
];

export const imageQualityOptions: Array<{
  value: ImageQuality;
  label: string;
  description: string;
}> = [
  { value: 'low', label: 'Low', description: '低质量，速度更快，适合草稿测试' },
  { value: 'medium', label: 'Medium', description: '均衡质量与速度，适合日常生成' },
  { value: 'high', label: 'High', description: '高质量，耗时更长，适合最终出图' },
];

export function getImageAspectOptions(tier: ImageResolutionTier): ImageAspectOption[] {
  return imageAspectOptionsByTier[tier] ?? imageAspectOptionsByTier[defaultImageResolutionTier];
}

export function getImageGenerationSize(
  tier: ImageResolutionTier | undefined,
  ratio: string | undefined,
): string {
  const effectiveTier = tier ?? defaultImageResolutionTier;
  const effectiveRatio = ratio ?? defaultImageAspectRatio;
  const option =
    getImageAspectOptions(effectiveTier).find((current) => current.ratio === effectiveRatio) ??
    getImageAspectOptions(effectiveTier).find(
      (current) => current.ratio === defaultImageAspectRatio,
    ) ??
    getImageAspectOptions(defaultImageResolutionTier)[0];

  if (!option.width || !option.height) {
    return 'auto';
  }

  return `${option.width}x${option.height}`;
}

export function getImageAspectOptionLabel(option: ImageAspectOption): string {
  if (!option.width || !option.height) {
    return option.orientation;
  }

  return `${option.ratio} (${option.orientation} - ${option.width}x${option.height})`;
}
