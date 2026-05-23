export type SeedanceModelId = 'seedance2.0' | 'seedance2.0-fast';
export type SeedanceRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive';

export type SeedanceScenario =
  | 'text_to_video'
  | 'image_to_video_first_frame'
  | 'image_to_video_first_last_frame'
  | 'multimodal_reference_video';

export type SeedanceInputPortId =
  | 'text'
  | 'first_frame_image'
  | 'last_frame_image'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

export type SeedanceInputPort = {
  id: SeedanceInputPortId;
  label: string;
};

export type SeedanceVisibleField =
  | 'prompt'
  | 'firstFrame'
  | 'lastFrame'
  | 'referenceImages'
  | 'referenceVideos'
  | 'referenceAudios'
  | 'resolution'
  | 'ratio'
  | 'duration'
  | 'framespersecond'
  | 'seed'
  | 'generateAudio'
  | 'returnLastFrame'
  | 'priority';

type SeedanceCapabilities = {
  supportedResolutions: Array<'480p' | '720p' | '1080p'>;
  supportedRatios: SeedanceRatio[];
  durationRangeSeconds: {
    min: number;
    max: number;
    supportsAuto: boolean;
  };
  fixedFrameRate: number;
  supportsGenerateAudio: boolean;
  supportsPriority: boolean;
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
};

const capabilities: Record<SeedanceModelId, SeedanceCapabilities> = {
  'seedance2.0': {
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
    durationRangeSeconds: {
      min: 4,
      max: 15,
      supportsAuto: true,
    },
    fixedFrameRate: 24,
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
  'seedance2.0-fast': {
    supportedResolutions: ['480p', '720p'],
    supportedRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
    durationRangeSeconds: {
      min: 4,
      max: 15,
      supportsAuto: true,
    },
    fixedFrameRate: 24,
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
};

const officialSeedanceBillingSizes: Record<
  Exclude<SeedanceRatio, 'adaptive'>,
  Record<'480p' | '720p' | '1080p', { width: number; height: number }>
> = {
  '16:9': {
    '480p': { width: 864, height: 496 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
  },
  '9:16': {
    '480p': { width: 496, height: 864 },
    '720p': { width: 720, height: 1280 },
    '1080p': { width: 1080, height: 1920 },
  },
  '4:3': {
    '480p': { width: 752, height: 560 },
    '720p': { width: 1112, height: 834 },
    '1080p': { width: 1664, height: 1248 },
  },
  '3:4': {
    '480p': { width: 560, height: 752 },
    '720p': { width: 834, height: 1112 },
    '1080p': { width: 1248, height: 1664 },
  },
  '1:1': {
    '480p': { width: 640, height: 640 },
    '720p': { width: 960, height: 960 },
    '1080p': { width: 1440, height: 1440 },
  },
  '21:9': {
    '480p': { width: 992, height: 432 },
    '720p': { width: 1470, height: 630 },
    '1080p': { width: 2205, height: 945 },
  },
};

export function getSeedanceCapabilities(model: SeedanceModelId): SeedanceCapabilities {
  return capabilities[model];
}

export function getDefaultSeedanceRatio(model: SeedanceModelId): SeedanceRatio {
  return capabilities[model].supportedRatios[0];
}

export function getVisibleSeedanceFields(input: {
  model: SeedanceModelId;
  scenario: SeedanceScenario;
}): SeedanceVisibleField[] {
  const base: SeedanceVisibleField[] = [
    'prompt',
    'resolution',
    'ratio',
    'duration',
    'seed',
    'returnLastFrame',
  ];

  if (capabilities[input.model].supportsGenerateAudio) {
    base.push('generateAudio');
  }
  if (capabilities[input.model].supportsPriority) {
    base.push('priority');
  }
  if (input.scenario === 'image_to_video_first_frame') {
    return [...base, 'firstFrame'];
  }
  if (input.scenario === 'image_to_video_first_last_frame') {
    return [...base, 'firstFrame', 'lastFrame'];
  }
  if (input.scenario === 'multimodal_reference_video') {
    return [...base, 'referenceImages', 'referenceVideos', 'referenceAudios'];
  }

  return base;
}

export function getSeedanceInputPorts(scenario: SeedanceScenario): SeedanceInputPort[] {
  if (scenario === 'image_to_video_first_frame') {
    return [
      { id: 'first_frame_image', label: '首帧图' },
      { id: 'text', label: '文本' },
    ];
  }

  if (scenario === 'image_to_video_first_last_frame') {
    return [
      { id: 'first_frame_image', label: '首帧图' },
      { id: 'last_frame_image', label: '尾帧图' },
      { id: 'text', label: '文本' },
    ];
  }

  if (scenario === 'multimodal_reference_video') {
    return [
      { id: 'text', label: '文本' },
      { id: 'reference_image', label: '图片' },
      { id: 'reference_video', label: '视频' },
      { id: 'reference_audio', label: '音频' },
    ];
  }

  return [{ id: 'text', label: '文本' }];
}

export function estimateSeedanceTokens(input: {
  model: SeedanceModelId;
  resolution: '480p' | '720p' | '1080p';
  ratio?: SeedanceRatio;
  duration: number;
  framespersecond?: number;
  scenario: SeedanceScenario;
  generateAudio: boolean;
  multimodalCount: number;
}): number {
  const ratio = input.ratio && input.ratio !== 'adaptive' ? input.ratio : '16:9';
  const { width, height } = officialSeedanceBillingSizes[ratio][input.resolution];
  const fps = input.framespersecond ?? capabilities[input.model].fixedFrameRate;

  return Math.max(1, Math.round((width * height * fps * input.duration) / 1024));
}

export function getSeedanceDurationInputBounds(model: SeedanceModelId): { min: number; max: number } {
  const duration = capabilities[model].durationRangeSeconds;

  return {
    min: duration.supportsAuto ? -1 : duration.min,
    max: duration.max,
  };
}

export function normalizeSeedanceDurationSeconds(
  model: SeedanceModelId,
  value: number,
): number {
  const duration = capabilities[model].durationRangeSeconds;

  if (!Number.isFinite(value)) {
    return duration.min;
  }

  const integerValue = Math.round(value);

  if (duration.supportsAuto && integerValue === -1) {
    return -1;
  }

  return Math.min(duration.max, Math.max(duration.min, integerValue));
}
