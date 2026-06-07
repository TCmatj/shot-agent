import JSON5 from 'json5';

export type StoryNodeExecutionMode =
  | 'structure_only'
  | 'structure_and_nodes'
  | 'structure_and_generate_images'
  | 'fully_automatic';

export type StoryNodeExpansionMode = 'structure_only' | 'global_assets' | 'full';

export type StoryPromptItem = {
  id: string;
  title: string;
  prompt: string;
};

export type StoryTransitionSpec = {
  type:
    | 'hard_cut'
    | 'match_cut'
    | 'action_continuation'
    | 'camera_follow'
    | 'whip_pan'
    | 'fade'
    | 'dissolve'
    | 'time_jump'
    | 'space_shift'
    | 'emotion_bridge'
    | 'custom';
  description: string;
  durationSeconds: number;
  continuityFocus?: string[];
};

export type StoryShot = {
  id: string;
  title: string;
  durationSeconds: number;
  characters: string[];
  props?: string[];
  cameraMotion: string;
  composition?: string;
  action: string;
  dialogue?: string;
  dialoguePacing?: string;
  atmosphere?: string;
  bgm?: string;
  transitionToNext?: StoryTransitionSpec;
};

export type StoryNarrativeSegment = {
  id: string;
  title: string;
  durationSeconds: number;
  openingTransition: StoryTransitionSpec;
  prompt: string;
  atmosphere?: string;
  bgm?: string;
  shots: StoryShot[];
  firstFramePrompt: StoryPromptItem;
  lastFramePrompt: StoryPromptItem;
  motionSketchPrompt: StoryPromptItem;
  continuityNotes: string[];
};

export type StoryStructuredOutput = {
  version: 1;
  storySummary: string;
  styleNotes?: string[];
  globalAssets: {
    scenePrompts: StoryPromptItem[];
    characterSheetPrompts: StoryPromptItem[];
    propSheetPrompts: StoryPromptItem[];
  };
  narrativeSegments: StoryNarrativeSegment[];
  rawModelOutput?: string;
};

export function createEmptyStoryStructuredOutput(): StoryStructuredOutput {
  return {
    version: 1,
    storySummary: '',
    styleNotes: [],
    globalAssets: {
      scenePrompts: [],
      characterSheetPrompts: [],
      propSheetPrompts: [],
    },
    narrativeSegments: [],
    rawModelOutput: '',
  };
}

export function parseStoryStructuredOutput(value: string): StoryStructuredOutput | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = extractJsonBlock(trimmed);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = parseStoryRecord(candidate);
    const version = normalizeStoryVersion(parsed.version);
    const storySummary = normalizeStorySummary(parsed.storySummary);
    const globalAssets = normalizeStoryGlobalAssets(parsed.globalAssets);
    const narrativeSegments = normalizeStoryNarrativeSegments(parsed.narrativeSegments);

    if (!version || !storySummary || !globalAssets || !narrativeSegments) {
      return null;
    }

    return {
      version,
      storySummary,
      styleNotes: Array.isArray(parsed.styleNotes) ? parsed.styleNotes.filter(isString) : [],
      globalAssets,
      narrativeSegments,
      rawModelOutput: trimmed,
    };
  } catch {
    return null;
  }
}

function parseStoryRecord(candidate: string): Record<string, unknown> {
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return JSON5.parse(candidate) as Record<string, unknown>;
  }
}

function extractJsonBlock(value: string): string | null {
  const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i) ?? value.match(/```\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return value.slice(firstBrace, lastBrace + 1);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeNumberish(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const matched = value.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const normalized = normalizeOptionalString(item);
      return normalized ? [normalized] : [];
    });
  }

  if (typeof value === 'string') {
    return value
      .split(/[、,，/|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeStoryVersion(value: unknown): 1 | null {
  if (value === 1 || value === '1' || value === '1.0') {
    return 1;
  }

  return null;
}

function normalizeStorySummary(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const parts = Object.entries(record).flatMap(([key, entry]) => {
    if (typeof entry !== 'string') {
      return [];
    }

    const normalizedKey = key.trim();
    const normalizedValue = entry.trim();
    if (!normalizedValue) {
      return [];
    }

    return normalizedKey ? [`${normalizedKey}：${normalizedValue}`] : [normalizedValue];
  });

  return parts.length > 0 ? parts.join('\n') : null;
}

function normalizePromptItem(
  value: unknown,
  fallbackTitle: string,
  fallbackId: string,
): StoryPromptItem | null {
  if (typeof value === 'string') {
    const prompt = value.trim();
    if (!prompt) {
      return null;
    }

    return {
      id: fallbackId,
      title: fallbackTitle,
      prompt,
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  if (!prompt) {
    return null;
  }

  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : fallbackId;
  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : id || fallbackTitle;

  return {
    id,
    title,
    prompt,
  };
}

function normalizePromptItemArray(
  value: unknown,
  fallbackPrefix: string,
): StoryPromptItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const normalized = normalizePromptItem(
      item,
      `${fallbackPrefix} ${index + 1}`,
      `${fallbackPrefix.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
    );
    return normalized ? [normalized] : [];
  });
}

function normalizeStoryGlobalAssets(value: unknown): StoryStructuredOutput['globalAssets'] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    scenePrompts: normalizePromptItemArray(record.scenePrompts, '场景图'),
    characterSheetPrompts: normalizePromptItemArray(record.characterSheetPrompts, '角色板'),
    propSheetPrompts: normalizePromptItemArray(record.propSheetPrompts, '物品图'),
  };
}

function normalizeTransitionSpec(value: unknown): StoryTransitionSpec | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = normalizeOptionalString(record.type) ?? normalizeOptionalString(record.transitionType);
  const description =
    normalizeOptionalString(record.description)
    ?? normalizeOptionalString(record.summary)
    ?? normalizeOptionalString(record.prompt);
  const durationSeconds =
    normalizeNumberish(record.durationSeconds)
    ?? normalizeNumberish(record.duration)
    ?? normalizeNumberish(record.seconds);

  if (!type || !description || durationSeconds === null) {
    return null;
  }

  return {
    type: type as StoryTransitionSpec['type'],
    description,
    durationSeconds,
    continuityFocus: normalizeStringArray(record.continuityFocus),
  };
}

function normalizeStoryShot(value: unknown, index: number): StoryShot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const durationSeconds =
    normalizeNumberish(record.durationSeconds)
    ?? normalizeNumberish(record.duration)
    ?? normalizeNumberish(record.seconds);
  const characters = [
    ...normalizeStringArray(record.characters),
    ...normalizeStringArray(record.character),
  ];
  const cameraMotion =
    normalizeOptionalString(record.cameraMotion)
    ?? normalizeOptionalString(record.cameraMovement)
    ?? normalizeOptionalString(record.camera)
    ?? normalizeOptionalString(record.cameraMove)
    ?? normalizeOptionalString(record.cameraPath);
  const action =
    normalizeOptionalString(record.action)
    ?? normalizeOptionalString(record.description)
    ?? normalizeOptionalString(record.visual)
    ?? normalizeOptionalString(record.prompt);

  if (durationSeconds === null || !cameraMotion || !action) {
    return null;
  }

  return {
    id:
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : `shot_${index + 1}`,
    title:
      typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : `镜头 ${index + 1}`,
    durationSeconds,
    characters: characters.length > 0 ? characters : ['未指定'],
    props: normalizeStringArray(record.props),
    cameraMotion,
    composition:
      normalizeOptionalString(record.composition)
      ?? normalizeOptionalString(record.framing)
      ?? normalizeOptionalString(record.sceneComposition),
    action,
    dialogue:
      normalizeOptionalString(record.dialogue)
      ?? normalizeOptionalString(record.lines)
      ?? normalizeOptionalString(record.voiceOver),
    dialoguePacing:
      normalizeOptionalString(record.dialoguePacing)
      ?? normalizeOptionalString(record.dialogueRhythm)
      ?? normalizeOptionalString(record.pacing),
    atmosphere:
      normalizeOptionalString(record.atmosphere)
      ?? normalizeOptionalString(record.mood)
      ?? normalizeOptionalString(record.tone),
    bgm:
      normalizeOptionalString(record.bgm)
      ?? normalizeOptionalString(record.BGM)
      ?? normalizeOptionalString(record.backgroundMusic),
    transitionToNext:
      record.transitionToNext === undefined && record.transition === undefined && record.nextTransition === undefined
        ? undefined
        : normalizeTransitionSpec(record.transitionToNext ?? record.transition ?? record.nextTransition) ?? undefined,
  };
}

function normalizeMotionSketchPrompt(value: unknown, segmentId: string): StoryPromptItem | null {
  if (Array.isArray(value)) {
    const prompt = value.filter(isString).join('\n');
    if (!prompt.trim()) {
      return null;
    }

    return {
      id: `${segmentId}_motion_sketch`,
      title: '运镜合集',
      prompt,
    };
  }

  return normalizePromptItem(value, '运镜合集', `${segmentId}_motion_sketch`);
}

function normalizeStoryNarrativeSegment(value: unknown, index: number): StoryNarrativeSegment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : `segment_${index + 1}`;
  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : `段落 ${index + 1}`;
  const durationSeconds =
    normalizeNumberish(record.durationSeconds)
    ?? normalizeNumberish(record.duration)
    ?? normalizeNumberish(record.seconds);
  const openingTransition =
    normalizeTransitionSpec(record.openingTransition)
    ?? normalizeTransitionSpec(record.startTransition)
    ?? {
      type: 'custom',
      description: '直接切入',
      durationSeconds: 0,
    };
  const prompt =
    normalizeOptionalString(record.prompt)
    ?? normalizeOptionalString(record.videoPrompt)
    ?? normalizeOptionalString(record.segmentPrompt)
    ?? normalizeOptionalString(record.narrativePrompt)
    ?? normalizeOptionalString(record.description);
  const shotSource =
    Array.isArray(record.shots) ? record.shots
      : Array.isArray(record.storyboards) ? record.storyboards
        : Array.isArray(record.shotList) ? record.shotList
          : Array.isArray(record.storyboardShots) ? record.storyboardShots
            : [];
  const shots = shotSource.flatMap((shot, shotIndex) => {
        const normalized = normalizeStoryShot(shot, shotIndex);
        return normalized ? [normalized] : [];
      });
  const firstFramePrompt = normalizePromptItem(
    record.firstFramePrompt ?? record.firstFrame ?? record.startFramePrompt,
    '首帧',
    `${id}_first_frame`,
  );
  const lastFramePrompt = normalizePromptItem(
    record.lastFramePrompt ?? record.lastFrame ?? record.endFramePrompt,
    '尾帧',
    `${id}_last_frame`,
  );
  const motionSketchPrompt = normalizeMotionSketchPrompt(
    record.motionSketchPrompt ?? record.cameraSketchPrompt ?? record.motionPrompt,
    id,
  );
  const continuityNotes = [
    ...normalizeStringArray(record.continuityNotes),
    ...normalizeStringArray(record.continuity),
  ];

  if (
    durationSeconds === null ||
    !openingTransition ||
    !prompt ||
    shots.length === 0 ||
    !firstFramePrompt ||
    !lastFramePrompt ||
    !motionSketchPrompt
  ) {
    return null;
  }

  return {
    id,
    title,
    durationSeconds,
    openingTransition,
    prompt,
    atmosphere:
      typeof record.atmosphere === 'string'
        ? record.atmosphere
        : typeof record.mood === 'string'
          ? record.mood
          : undefined,
    bgm:
      typeof record.bgm === 'string'
        ? record.bgm
        : typeof record.BGM === 'string'
          ? record.BGM
          : undefined,
    shots,
    firstFramePrompt,
    lastFramePrompt,
    motionSketchPrompt,
    continuityNotes,
  };
}

function normalizeStoryNarrativeSegments(value: unknown): StoryNarrativeSegment[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.flatMap((segment, index) => {
    const normalized = normalizeStoryNarrativeSegment(segment, index);
    return normalized ? [normalized] : [];
  });
}

function isStoryPromptItem(value: unknown): value is StoryPromptItem {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as StoryPromptItem).id === 'string'
    && typeof (value as StoryPromptItem).title === 'string'
    && typeof (value as StoryPromptItem).prompt === 'string';
}

function isStoryTransitionSpec(value: unknown): value is StoryTransitionSpec {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as StoryTransitionSpec).type === 'string'
    && typeof (value as StoryTransitionSpec).description === 'string'
    && typeof (value as StoryTransitionSpec).durationSeconds === 'number';
}

function isStoryShot(value: unknown): value is StoryShot {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as StoryShot).id === 'string'
    && typeof (value as StoryShot).title === 'string'
    && typeof (value as StoryShot).durationSeconds === 'number'
    && Array.isArray((value as StoryShot).characters)
    && typeof (value as StoryShot).cameraMotion === 'string'
    && typeof (value as StoryShot).action === 'string'
    && (
      (value as StoryShot).transitionToNext === undefined ||
      isStoryTransitionSpec((value as StoryShot).transitionToNext)
    );
}

function isStoryNarrativeSegment(value: unknown): value is StoryNarrativeSegment {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as StoryNarrativeSegment).id === 'string'
    && typeof (value as StoryNarrativeSegment).title === 'string'
    && typeof (value as StoryNarrativeSegment).durationSeconds === 'number'
    && isStoryTransitionSpec((value as StoryNarrativeSegment).openingTransition)
    && typeof (value as StoryNarrativeSegment).prompt === 'string'
    && Array.isArray((value as StoryNarrativeSegment).shots)
    && (value as StoryNarrativeSegment).shots.every(isStoryShot)
    && isStoryPromptItem((value as StoryNarrativeSegment).firstFramePrompt)
    && isStoryPromptItem((value as StoryNarrativeSegment).lastFramePrompt)
    && isStoryPromptItem((value as StoryNarrativeSegment).motionSketchPrompt)
    && Array.isArray((value as StoryNarrativeSegment).continuityNotes);
}
