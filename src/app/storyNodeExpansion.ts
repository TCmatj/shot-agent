import type { StoryNodeExpansionMode, StoryStructuredOutput } from '../domain/story';
import type { SeedanceInputPortId } from '../domain/seedance';
import {
  createCanvasEdge,
  getCanvasNodeHeight,
  getCanvasNodeWidth,
  type CanvasNodeView,
  type CanvasView,
} from './canvasWorkspace';

type StoryAssetRole =
  | 'scene'
  | 'character_sheet'
  | 'prop_sheet'
  | 'segment_narrative'
  | 'segment_shots'
  | 'segment_first_frame'
  | 'segment_last_frame'
  | 'segment_motion_sketch'
  | 'segment_video';

export type StoryExpansionNode = CanvasNodeView & {
  storySourceNodeId: string;
  storyGenerationBatchId: string;
  storySegmentId?: string;
  storyAssetRole?: StoryAssetRole;
};

export type StoryExpansionResult = {
  nodes: StoryExpansionNode[];
  edges: CanvasView['edges'];
  autoRunNodeIds: string[];
};

export function buildStoryNodeExpansion(input: {
  canvas: CanvasView;
  storyNode: CanvasNodeView;
  structuredOutput: StoryStructuredOutput;
  expansionMode: StoryNodeExpansionMode;
  generationBatchId: string;
  createNodeId: (role: StoryAssetRole, segmentId?: string) => string;
}): StoryExpansionResult {
  if (input.expansionMode === 'structure_only') {
    return {
      nodes: [],
      edges: [],
      autoRunNodeIds: [],
    };
  }

  const nodes: StoryExpansionNode[] = [];
  const edges: CanvasView['edges'] = [];
  const autoRunNodeIds: string[] = [];
  const sourceNode = input.storyNode;
  const sourceWidth = getCanvasNodeWidth(sourceNode);
  const startX = sourceNode.x + sourceWidth + 220;
  const horizontalGap = 44;
  const textRowGap = 44;
  const imageRowGap = 56;
  const imageResultReserveGap = 164;
  const sectionGap = 188;
  const videoTopGap = 172;
  const generatedAssetOffsetX = 120;
  const generatedAssetSafeGap = 84;
  const generatedTextNodeWidth = 440;
  const generatedAssetPrototype: CanvasNodeView = {
    id: '__story_generated_asset__',
    title: '生成资产',
    modelId: 'asset-image',
    kind: 'imageAsset',
    x: 0,
    y: 0,
  };
  const generatedAssetWidth = getCanvasNodeWidth(generatedAssetPrototype);

  const getImageRowAdvance = (node: CanvasNodeView) =>
    getCanvasNodeHeight(node) + imageRowGap + imageResultReserveGap;
  const getGeneratedAssetLaneWidth = (node: CanvasNodeView) =>
    getCanvasNodeWidth(node) + generatedAssetOffsetX + generatedAssetWidth + generatedAssetSafeGap;

  const appendImageNode = (config: {
    title: string;
    prompt: string;
    role: StoryAssetRole;
    x: number;
    y: number;
    segmentId?: string;
  }) => {
    const id = input.createNodeId(config.role, config.segmentId);
    const node: StoryExpansionNode = {
      id,
      title: config.title,
      modelId: 'gpt-image-2',
      kind: 'image',
      x: config.x,
      y: config.y,
      prompt: config.prompt,
      storySourceNodeId: sourceNode.id,
      storyGenerationBatchId: input.generationBatchId,
      storySegmentId: config.segmentId,
      storyAssetRole: config.role,
    };
    nodes.push(node);
    edges.push(createCanvasEdge(sourceNode.id, id));
    autoRunNodeIds.push(id);
    return node;
  };

  const appendTextNode = (config: {
    title: string;
    textContent: string;
    role: StoryAssetRole;
    x: number;
    y: number;
    segmentId?: string;
  }) => {
    const id = input.createNodeId(config.role, config.segmentId);
    const node: StoryExpansionNode = {
      id,
      title: config.title,
      modelId: 'asset-text',
      kind: 'textAsset',
      x: config.x,
      y: config.y,
      width: generatedTextNodeWidth,
      minWidth: generatedTextNodeWidth,
      textContent: config.textContent,
      storySourceNodeId: sourceNode.id,
      storyGenerationBatchId: input.generationBatchId,
      storySegmentId: config.segmentId,
      storyAssetRole: config.role,
    };
    nodes.push(node);
    edges.push(createCanvasEdge(sourceNode.id, id));
    return node;
  };

  const appendVideoNode = (config: {
    title: string;
    prompt: string;
    durationSeconds: number;
    x: number;
    y: number;
    segmentId: string;
    narrativeNodeId?: string;
    shotsNodeId?: string;
    firstFrameNodeId?: string;
    lastFrameNodeId?: string;
  }) => {
    const id = input.createNodeId('segment_video', config.segmentId);
    const normalizedDurationSeconds = Math.trunc(config.durationSeconds);
    const node: StoryExpansionNode = {
      id,
      title: config.title,
      modelId: 'seedance2.0',
      kind: 'video',
      x: config.x,
      y: config.y,
      prompt: config.prompt,
      seedanceScenario: 'image_to_video_first_last_frame',
      videoDurationSeconds: normalizedDurationSeconds,
      storySourceNodeId: sourceNode.id,
      storyGenerationBatchId: input.generationBatchId,
      storySegmentId: config.segmentId,
      storyAssetRole: 'segment_video',
    };
    nodes.push(node);
    if (config.narrativeNodeId) {
      edges.push(createCanvasEdge(config.narrativeNodeId, id, 'text'));
    }
    if (config.shotsNodeId) {
      edges.push(createCanvasEdge(config.shotsNodeId, id, 'text'));
    }
    if (config.firstFrameNodeId) {
      edges.push(createCanvasEdge(config.firstFrameNodeId, id, 'text'));
    }
    if (config.lastFrameNodeId) {
      edges.push(createCanvasEdge(config.lastFrameNodeId, id, 'text'));
    }
    autoRunNodeIds.push(id);
    return node;
  };

  const globalAssetRows: Array<{
    titlePrefix: string;
    prompts: Array<{ id: string; title: string; prompt: string }>;
    role: StoryAssetRole;
  }> = [
    {
      titlePrefix: '场景图',
      prompts: input.structuredOutput.globalAssets.scenePrompts,
      role: 'scene',
    },
    {
      titlePrefix: '角色板',
      prompts: input.structuredOutput.globalAssets.characterSheetPrompts,
      role: 'character_sheet',
    },
    {
      titlePrefix: '物品图',
      prompts: input.structuredOutput.globalAssets.propSheetPrompts,
      role: 'prop_sheet',
    },
  ];

  let currentY = sourceNode.y;
  globalAssetRows.forEach((row) => {
    let rowX = startX;
    let rowMaxHeight = 0;
    row.prompts.forEach((promptItem, index) => {
      const node = appendImageNode({
        title: `${row.titlePrefix}${row.prompts.length > 1 ? ` ${index + 1}` : ''}`,
        prompt: promptItem.prompt,
        role: row.role,
        x: rowX,
        y: currentY,
      });
      rowX += getGeneratedAssetLaneWidth(node) + horizontalGap;
      rowMaxHeight = Math.max(rowMaxHeight, getCanvasNodeHeight(node));
    });
    currentY += Math.max(rowMaxHeight, 220) + imageRowGap + imageResultReserveGap;
  });

  if (input.expansionMode === 'global_assets') {
    return { nodes, edges, autoRunNodeIds };
  }

  currentY += sectionGap - imageRowGap;

  let currentSegmentX = startX;
  input.structuredOutput.narrativeSegments.forEach((segment) => {
    const narrativeNode = appendTextNode({
      title: `${segment.title} 叙事段落提示词`,
      textContent: formatNarrativeSegmentText(segment),
      role: 'segment_narrative',
      x: currentSegmentX,
      y: currentY,
      segmentId: segment.id,
    });
    const shotsNode = appendTextNode({
      title: `${segment.title} 分镜详情`,
      textContent: formatNarrativeShotsText(segment),
      role: 'segment_shots',
      x: currentSegmentX + getCanvasNodeWidth(narrativeNode) + horizontalGap,
      y: currentY,
      segmentId: segment.id,
    });

    const firstRowWidth =
      getCanvasNodeWidth(narrativeNode) +
      horizontalGap +
      getCanvasNodeWidth(shotsNode);
    const secondRowY =
      currentY +
      Math.max(getCanvasNodeHeight(narrativeNode), getCanvasNodeHeight(shotsNode)) +
      textRowGap;

    const firstFrameNode = appendImageNode({
      title: `${segment.title} 首帧图`,
      prompt: segment.firstFramePrompt.prompt,
      role: 'segment_first_frame',
      x: currentSegmentX,
      y: secondRowY,
      segmentId: segment.id,
    });
    const thirdRowY = secondRowY + getImageRowAdvance(firstFrameNode);

    const lastFrameNode = appendImageNode({
      title: `${segment.title} 尾帧图`,
      prompt: segment.lastFramePrompt.prompt,
      role: 'segment_last_frame',
      x: currentSegmentX,
      y: thirdRowY,
      segmentId: segment.id,
    });
    const fourthRowY = thirdRowY + getImageRowAdvance(lastFrameNode);
    const motionSketchNode = appendImageNode({
      title: `${segment.title} 运镜简笔画`,
      prompt: segment.motionSketchPrompt.prompt,
      role: 'segment_motion_sketch',
      x: currentSegmentX,
      y: fourthRowY,
      segmentId: segment.id,
    });
    const fifthRowY = fourthRowY + getImageRowAdvance(motionSketchNode) + videoTopGap;
    const videoX = currentSegmentX + 160;
    const videoNode = appendVideoNode({
      title: `${segment.title} 视频`,
      prompt: buildStorySegmentVideoPrompt({
        narrativeNodeId: narrativeNode.id,
        shotsNodeId: shotsNode.id,
        firstFrameNodeId: firstFrameNode.id,
        lastFrameNodeId: lastFrameNode.id,
      }),
      durationSeconds: segment.durationSeconds,
      x: videoX,
      y: fifthRowY,
      segmentId: segment.id,
      narrativeNodeId: narrativeNode.id,
      shotsNodeId: shotsNode.id,
      firstFrameNodeId: firstFrameNode.id,
      lastFrameNodeId: lastFrameNode.id,
    });

    const segmentWidth = Math.max(
      firstRowWidth,
      getGeneratedAssetLaneWidth(firstFrameNode),
      getGeneratedAssetLaneWidth(lastFrameNode),
      getGeneratedAssetLaneWidth(motionSketchNode),
      videoX - currentSegmentX + getCanvasNodeWidth(videoNode),
    );
    currentSegmentX += segmentWidth + generatedAssetSafeGap + horizontalGap;
  });

  return { nodes, edges, autoRunNodeIds };
}

function buildStorySegmentVideoPrompt(input: {
  narrativeNodeId: string;
  shotsNodeId: string;
  firstFrameNodeId: string;
  lastFrameNodeId: string;
}): string {
  return [
    `@text:${input.narrativeNodeId}`,
    '',
    `@text:${input.shotsNodeId}`,
    '',
    '叙事段落首帧：',
    `@text:${input.firstFrameNodeId}`,
    '叙事段落尾帧：',
    `@text:${input.lastFrameNodeId}`,
  ].join('\n');
}

export function isStoryExpansionEdgePort(value: unknown): value is SeedanceInputPortId | 'default' {
  return (
    value === 'default' ||
    value === 'text' ||
    value === 'first_frame_image' ||
    value === 'last_frame_image' ||
    value === 'reference_image' ||
    value === 'reference_video' ||
    value === 'reference_audio'
  );
}

function formatNarrativeSegmentText(
  segment: StoryStructuredOutput['narrativeSegments'][number],
): string {
  const lines = [
    `段落：${segment.title}`,
    `时长：${segment.durationSeconds} 秒`,
    `开场转场：${segment.openingTransition.description}（${segment.openingTransition.type}，${segment.openingTransition.durationSeconds} 秒）`,
  ];

  if (segment.atmosphere?.trim()) {
    lines.push(`气氛：${segment.atmosphere.trim()}`);
  }

  if (segment.bgm?.trim()) {
    lines.push(`BGM：${segment.bgm.trim()}`);
  }

  lines.push('', '段落提示词：', segment.prompt);

  if (segment.continuityNotes.length > 0) {
    lines.push('', '连续性说明：', ...segment.continuityNotes.map((note) => `- ${note}`));
  }

  return lines.join('\n');
}

function formatNarrativeShotsText(
  segment: StoryStructuredOutput['narrativeSegments'][number],
): string {
  const lines = [`分镜：${segment.title}`];

  segment.shots.forEach((shot, index) => {
    lines.push(
      '',
      `${index + 1}. ${shot.title}`,
      `时长：${shot.durationSeconds} 秒`,
      `角色：${shot.characters.join('、') || '未指定'}`,
    );

    if (shot.props?.length) {
      lines.push(`关键物品：${shot.props.join('、')}`);
    }

    lines.push(`运镜：${shot.cameraMotion}`);

    if (shot.composition?.trim()) {
      lines.push(`构图：${shot.composition.trim()}`);
    }

    lines.push(`动作：${shot.action}`);

    if (shot.dialogue?.trim()) {
      lines.push(`对白：${shot.dialogue.trim()}`);
    }

    if (shot.dialoguePacing?.trim()) {
      lines.push(`对白节奏：${shot.dialoguePacing.trim()}`);
    }

    if (shot.atmosphere?.trim()) {
      lines.push(`气氛：${shot.atmosphere.trim()}`);
    }

    if (shot.bgm?.trim()) {
      lines.push(`BGM：${shot.bgm.trim()}`);
    }

    if (shot.transitionToNext) {
      lines.push(
        `转场到下一镜：${shot.transitionToNext.description}（${shot.transitionToNext.type}，${shot.transitionToNext.durationSeconds} 秒）`,
      );
    }
  });

  return lines.join('\n');
}
