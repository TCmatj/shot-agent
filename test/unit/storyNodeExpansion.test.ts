import { describe, expect, it } from 'vitest';
import type { CanvasView } from '../../src/app/canvasWorkspace';
import { buildStoryNodeExpansion } from '../../src/app/storyNodeExpansion';
import type { StoryStructuredOutput } from '../../src/domain/story';

const canvas: CanvasView = {
  id: 'canvas_story',
  name: '故事画布',
  updatedAt: '刚刚',
  nodes: [
    {
      id: 'node_story_1',
      title: '故事拆解',
      modelId: 'gpt-5.4-mini',
      kind: 'story',
      x: 100,
      y: 120,
      prompt: '生成并拆解故事',
    },
  ],
  edges: [],
};

const structuredOutput: StoryStructuredOutput = {
  version: 1,
  storySummary: '无厘头早餐店故事',
  styleNotes: ['荒诞喜剧'],
  globalAssets: {
    scenePrompts: [{ id: 'scene_1', title: '早餐店', prompt: '复古早餐店，清晨逆光，桌椅拥挤' }],
    characterSheetPrompts: [{ id: 'character_1', title: '主角', prompt: '瘦高青年，卷发，绿色风衣，多角度角色板' }],
    propSheetPrompts: [{ id: 'prop_1', title: '巨大菠萝包', prompt: '巨大菠萝包，白底，多角度，酥皮细节清晰' }],
  },
  narrativeSegments: [
    {
      id: 'segment_1',
      title: '早餐店开场',
      durationSeconds: 6,
      openingTransition: {
        type: 'hard_cut',
        description: '从黑场切入早餐店门口',
        durationSeconds: 1,
      },
      prompt: '第一段视频提示词，主角冲进早餐店，镜头推近，节奏慌张滑稽',
      shots: [
        {
          id: 'shot_1',
          title: '冲门',
          durationSeconds: 2,
          characters: ['主角'],
          cameraMotion: '快速推进',
          action: '主角撞门而入',
        },
      ],
      firstFramePrompt: { id: 'ff_1', title: '首帧', prompt: '早餐店门口，主角抬脚准备冲入' },
      lastFramePrompt: { id: 'lf_1', title: '尾帧', prompt: '主角站到柜台前，店员震惊' },
      motionSketchPrompt: { id: 'ms_1', title: '运镜合集', prompt: '门口到柜台的推镜和横摇简笔画' },
      continuityNotes: ['保持主角绿色风衣连续'],
    },
  ],
  rawModelOutput: '{"version":1}',
};

describe('story node expansion', () => {
  it('creates full downstream image and video nodes for a story result', () => {
    const result = buildStoryNodeExpansion({
      canvas,
      storyNode: canvas.nodes[0],
      structuredOutput,
      expansionMode: 'full',
      generationBatchId: 'batch_1',
      createNodeId: (role, segmentId) => `${role}_${segmentId ?? 'global'}`,
    });

    expect(result.nodes.map((node) => node.storyAssetRole)).toEqual([
      'scene',
      'character_sheet',
      'prop_sheet',
      'segment_first_frame',
      'segment_last_frame',
      'segment_motion_sketch',
      'segment_video',
    ]);
    const videoNode = result.nodes.find((node) => node.storyAssetRole === 'segment_video');
    expect(videoNode).toMatchObject({
      kind: 'video',
      prompt: '第一段视频提示词，主角冲进早餐店，镜头推近，节奏慌张滑稽',
      seedanceScenario: 'image_to_video_first_last_frame',
      videoDurationSeconds: 6,
    });
    expect(
      result.edges.some(
        (edge) => edge.toNodeId === videoNode?.id && edge.toPortId === 'first_frame_image',
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) => edge.toNodeId === videoNode?.id && edge.toPortId === 'last_frame_image',
      ),
    ).toBe(true);
    expect(result.autoRunNodeIds).toContain(videoNode?.id);
  });

  it('creates only global asset image nodes in global assets mode', () => {
    const result = buildStoryNodeExpansion({
      canvas,
      storyNode: canvas.nodes[0],
      structuredOutput,
      expansionMode: 'global_assets',
      generationBatchId: 'batch_1',
      createNodeId: (role, segmentId) => `${role}_${segmentId ?? 'global'}`,
    });

    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.every((node) => node.kind === 'image')).toBe(true);
    expect(result.nodes.map((node) => node.storyAssetRole)).toEqual([
      'scene',
      'character_sheet',
      'prop_sheet',
    ]);
  });
});
