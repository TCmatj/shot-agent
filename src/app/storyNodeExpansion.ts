import type { StoryNodeExpansionMode, StoryStructuredOutput } from '../domain/story';
import type { SeedanceInputPortId } from '../domain/seedance';
import { createCanvasEdge, getCanvasNodeWidth, type CanvasNodeView, type CanvasView } from './canvasWorkspace';

type StoryAssetRole =
  | 'scene'
  | 'character_sheet'
  | 'prop_sheet'
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
  let rowY = sourceNode.y;

  const appendImageNode = (config: {
    title: string;
    prompt: string;
    role: StoryAssetRole;
    x: number;
    y: number;
    segmentId?: string;
  }) => {
    const id = input.createNodeId(config.role, config.segmentId);
    nodes.push({
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
    });
    edges.push(createCanvasEdge(sourceNode.id, id));
    autoRunNodeIds.push(id);
    return id;
  };

  const appendVideoNode = (config: {
    title: string;
    prompt: string;
    durationSeconds: number;
    x: number;
    y: number;
    segmentId: string;
    firstFrameNodeId?: string;
    lastFrameNodeId?: string;
  }) => {
    const id = input.createNodeId('segment_video', config.segmentId);
    nodes.push({
      id,
      title: config.title,
      modelId: 'seedance2.0',
      kind: 'video',
      x: config.x,
      y: config.y,
      prompt: config.prompt,
      seedanceScenario:
        config.firstFrameNodeId && config.lastFrameNodeId
          ? 'image_to_video_first_last_frame'
          : config.firstFrameNodeId
            ? 'image_to_video_first_frame'
            : 'text_to_video',
      videoDurationSeconds: config.durationSeconds,
      storySourceNodeId: sourceNode.id,
      storyGenerationBatchId: input.generationBatchId,
      storySegmentId: config.segmentId,
      storyAssetRole: 'segment_video',
    });
    edges.push(createCanvasEdge(sourceNode.id, id));
    if (config.firstFrameNodeId) {
      edges.push(createCanvasEdge(config.firstFrameNodeId, id, 'first_frame_image'));
    }
    if (config.lastFrameNodeId) {
      edges.push(createCanvasEdge(config.lastFrameNodeId, id, 'last_frame_image'));
    }
    autoRunNodeIds.push(id);
    return id;
  };

  const appendPromptGroup = (
    titlePrefix: string,
    prompts: Array<{ id: string; title: string; prompt: string }>,
    role: StoryAssetRole,
    baseX: number,
    baseY: number,
  ) => {
    prompts.forEach((promptItem, index) => {
      appendImageNode({
        title: `${titlePrefix}${prompts.length > 1 ? ` ${index + 1}` : ''}`,
        prompt: promptItem.prompt,
        role,
        x: baseX + index * 360,
        y: baseY,
      });
    });
  };

  appendPromptGroup('场景图', input.structuredOutput.globalAssets.scenePrompts, 'scene', startX, rowY);
  rowY += 252;
  appendPromptGroup(
    '角色板',
    input.structuredOutput.globalAssets.characterSheetPrompts,
    'character_sheet',
    startX,
    rowY,
  );
  rowY += 252;
  appendPromptGroup('物品图', input.structuredOutput.globalAssets.propSheetPrompts, 'prop_sheet', startX, rowY);

  if (input.expansionMode === 'global_assets') {
    return { nodes, edges, autoRunNodeIds };
  }

  rowY += 320;

  input.structuredOutput.narrativeSegments.forEach((segment, segmentIndex) => {
    const segmentX = startX + segmentIndex * 1120;
    const firstFrameNodeId = appendImageNode({
      title: `${segment.title} 首帧`,
      prompt: segment.firstFramePrompt.prompt,
      role: 'segment_first_frame',
      x: segmentX,
      y: rowY,
      segmentId: segment.id,
    });
    const lastFrameNodeId = appendImageNode({
      title: `${segment.title} 尾帧`,
      prompt: segment.lastFramePrompt.prompt,
      role: 'segment_last_frame',
      x: segmentX + 360,
      y: rowY,
      segmentId: segment.id,
    });
    appendImageNode({
      title: `${segment.title} 运镜合集`,
      prompt: segment.motionSketchPrompt.prompt,
      role: 'segment_motion_sketch',
      x: segmentX + 720,
      y: rowY,
      segmentId: segment.id,
    });
    appendVideoNode({
      title: `${segment.title} 视频`,
      prompt: segment.prompt,
      durationSeconds: segment.durationSeconds,
      x: segmentX + 360,
      y: rowY + 252,
      segmentId: segment.id,
      firstFrameNodeId,
      lastFrameNodeId,
    });
  });

  return { nodes, edges, autoRunNodeIds };
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
