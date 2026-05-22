export type SeedanceModelId = 'seedance2.0' | 'seedance2.0-fast';

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
  supportsGenerateAudio: boolean;
  supportsPriority: boolean;
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
};

const capabilities: Record<SeedanceModelId, SeedanceCapabilities> = {
  'seedance2.0': {
    supportedResolutions: ['480p', '720p', '1080p'],
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
  'seedance2.0-fast': {
    supportedResolutions: ['480p', '720p'],
    supportsGenerateAudio: true,
    supportsPriority: true,
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
  },
};

export function getSeedanceCapabilities(model: SeedanceModelId): SeedanceCapabilities {
  return capabilities[model];
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
    'framespersecond',
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
  duration: number;
  framespersecond: number;
  scenario: SeedanceScenario;
  generateAudio: boolean;
  multimodalCount: number;
}): number {
  const resolutionFactor =
    input.resolution === '1080p' ? 2.1 : input.resolution === '720p' ? 1.4 : 1;
  const fpsFactor = input.framespersecond / 24;
  const audioFactor = input.generateAudio ? 1.1 : 1;
  const scenarioFactor =
    input.scenario === 'multimodal_reference_video'
      ? 1.2
      : input.scenario === 'image_to_video_first_last_frame'
        ? 1.1
        : 1;

  return Math.round(
    Math.max(
      1,
      9000 * input.duration * resolutionFactor * fpsFactor * audioFactor * scenarioFactor +
        input.multimodalCount * 1200,
    ),
  );
}
