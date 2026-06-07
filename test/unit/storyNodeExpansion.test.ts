import { describe, expect, it } from 'vitest';
import type { CanvasView } from '../../src/app/canvasWorkspace';
import { getCanvasNodeWidth } from '../../src/app/canvasWorkspace';
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
    const decimalDurationOutput: StoryStructuredOutput = {
      ...structuredOutput,
      narrativeSegments: [
        {
          ...structuredOutput.narrativeSegments[0],
          durationSeconds: 6.9,
        },
      ],
    };
    const result = buildStoryNodeExpansion({
      canvas,
      storyNode: canvas.nodes[0],
      structuredOutput: decimalDurationOutput,
      expansionMode: 'full',
      generationBatchId: 'batch_1',
      createNodeId: (role, segmentId) => `${role}_${segmentId ?? 'global'}`,
    });

    expect(result.nodes.map((node) => node.storyAssetRole)).toEqual([
      'scene',
      'character_sheet',
      'prop_sheet',
      'segment_narrative',
      'segment_shots',
      'segment_first_frame',
      'segment_last_frame',
      'segment_motion_sketch',
      'segment_video',
    ]);
    expect(result.nodes.map((node) => node.title)).toEqual([
      '场景图',
      '角色板',
      '物品图',
      '早餐店开场 叙事段落提示词',
      '早餐店开场 分镜详情',
      '早餐店开场 首帧图',
      '早餐店开场 尾帧图',
      '早餐店开场 运镜简笔画',
      '早餐店开场 视频',
    ]);
    const videoNode = result.nodes.find((node) => node.storyAssetRole === 'segment_video');
    expect(videoNode).toMatchObject({
      kind: 'video',
      seedanceScenario: 'image_to_video_first_last_frame',
      videoDurationSeconds: 6,
    });
    expect(videoNode?.prompt).toBe(
      [
        '@text:segment_narrative_segment_1',
        '',
        '@text:segment_shots_segment_1',
        '',
        '叙事段落首帧：',
        '@text:segment_first_frame_segment_1',
        '叙事段落尾帧：',
        '@text:segment_last_frame_segment_1',
      ].join('\n'),
    );
    expect(
      result.edges.some(
        (edge) => edge.fromNodeId === 'node_story_1' && edge.toNodeId === videoNode?.id,
      ),
    ).toBe(false);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromNodeId === 'segment_narrative_segment_1' &&
          edge.toNodeId === videoNode?.id &&
          edge.toPortId === 'text',
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromNodeId === 'segment_shots_segment_1' &&
          edge.toNodeId === videoNode?.id &&
          edge.toPortId === 'text',
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromNodeId === 'segment_first_frame_segment_1' &&
          edge.toNodeId === videoNode?.id &&
          edge.toPortId === 'text',
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromNodeId === 'segment_last_frame_segment_1' &&
          edge.toNodeId === videoNode?.id &&
          edge.toPortId === 'text',
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) => edge.toNodeId === videoNode?.id && edge.toPortId === 'first_frame_image',
      ),
    ).toBe(false);
    expect(
      result.edges.some(
        (edge) => edge.toNodeId === videoNode?.id && edge.toPortId === 'last_frame_image',
      ),
    ).toBe(false);
    expect(result.autoRunNodeIds).toContain(videoNode?.id);
  });

  it('lays out global assets and narrative groups in separate rows without stacking on top of each other', () => {
    const multiAssetOutput: StoryStructuredOutput = {
      ...structuredOutput,
      globalAssets: {
        scenePrompts: [
          { id: 'scene_1', title: '早餐店', prompt: '复古早餐店，清晨逆光，桌椅拥挤' },
          { id: 'scene_2', title: '后厨', prompt: '后厨蒸汽弥漫，灶台与铁锅密集' },
        ],
        characterSheetPrompts: [
          { id: 'character_1', title: '主角', prompt: '瘦高青年，卷发，绿色风衣，多角度角色板' },
          { id: 'character_2', title: '店员', prompt: '店员围裙、短发、惊讶表情，多角度角色板' },
        ],
        propSheetPrompts: [
          { id: 'prop_1', title: '巨大菠萝包', prompt: '巨大菠萝包，白底，多角度，酥皮细节清晰' },
          { id: 'prop_2', title: '铁锅', prompt: '老旧铁锅，白底，多角度，金属反光清晰' },
        ],
      },
      narrativeSegments: [
        structuredOutput.narrativeSegments[0],
        {
          ...structuredOutput.narrativeSegments[0],
          id: 'segment_2',
          title: '柜台对峙',
          firstFramePrompt: {
            id: 'ff_2',
            title: '首帧',
            prompt: '柜台前，主角与店员对峙，蒸汽从锅边升起',
          },
          lastFramePrompt: {
            id: 'lf_2',
            title: '尾帧',
            prompt: '主角举起菠萝包，店员后仰',
          },
          motionSketchPrompt: {
            id: 'ms_2',
            title: '运镜合集',
            prompt: '柜台前横摇到特写的运镜简笔画',
          },
        },
      ],
    };

    const result = buildStoryNodeExpansion({
      canvas,
      storyNode: canvas.nodes[0],
      structuredOutput: multiAssetOutput,
      expansionMode: 'full',
      generationBatchId: 'batch_layout',
      createNodeId: (role, segmentId) => `${role}_${segmentId ?? 'global'}_${Math.random().toString(36).slice(2, 6)}`,
    });

    const sceneNodes = result.nodes.filter((node) => node.storyAssetRole === 'scene');
    const characterNodes = result.nodes.filter((node) => node.storyAssetRole === 'character_sheet');
    const propNodes = result.nodes.filter((node) => node.storyAssetRole === 'prop_sheet');

    expect(sceneNodes).toHaveLength(2);
    expect(characterNodes).toHaveLength(2);
    expect(propNodes).toHaveLength(2);
    expect(sceneNodes[0].y).toBe(sceneNodes[1].y);
    expect(characterNodes[0].y).toBe(characterNodes[1].y);
    expect(propNodes[0].y).toBe(propNodes[1].y);
    expect(sceneNodes[0].y).toBeLessThan(characterNodes[0].y);
    expect(characterNodes[0].y).toBeLessThan(propNodes[0].y);
    expect(sceneNodes[0].x).toBeLessThan(sceneNodes[1].x);
    expect(characterNodes[0].x).toBeLessThan(characterNodes[1].x);
    expect(propNodes[0].x).toBeLessThan(propNodes[1].x);
    const generatedAssetWidth = getCanvasNodeWidth({
      id: 'asset_probe',
      title: '生成资产',
      modelId: 'asset-image',
      kind: 'imageAsset',
      x: 0,
      y: 0,
    });
    const requiredImageOutputLane = getCanvasNodeWidth(sceneNodes[0]) + 120 + generatedAssetWidth;
    expect(sceneNodes[1].x - sceneNodes[0].x).toBeGreaterThanOrEqual(requiredImageOutputLane);

    const firstSegmentNarrative = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_narrative' && node.storySegmentId === 'segment_1',
    );
    const firstSegmentShots = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_shots' && node.storySegmentId === 'segment_1',
    );
    const firstSegmentFirstFrame = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_first_frame' && node.storySegmentId === 'segment_1',
    );
    const firstSegmentLastFrame = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_last_frame' && node.storySegmentId === 'segment_1',
    );
    const firstSegmentMotionSketch = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_motion_sketch' && node.storySegmentId === 'segment_1',
    );
    const firstSegmentVideo = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_video' && node.storySegmentId === 'segment_1',
    );
    const secondSegmentNarrative = result.nodes.find(
      (node) => node.storyAssetRole === 'segment_narrative' && node.storySegmentId === 'segment_2',
    );

    expect(firstSegmentNarrative).toBeTruthy();
    expect(firstSegmentShots).toBeTruthy();
    expect(firstSegmentFirstFrame).toBeTruthy();
    expect(firstSegmentLastFrame).toBeTruthy();
    expect(firstSegmentMotionSketch).toBeTruthy();
    expect(firstSegmentVideo).toBeTruthy();
    expect(secondSegmentNarrative).toBeTruthy();
    expect(getCanvasNodeWidth(firstSegmentNarrative!)).toBe(440);
    expect(getCanvasNodeWidth(firstSegmentShots!)).toBe(440);

    expect(firstSegmentNarrative!.y).toBeGreaterThan(propNodes[0].y);
    expect(firstSegmentNarrative!.y).toBe(firstSegmentShots!.y);
    expect(firstSegmentNarrative!.x).toBeLessThan(firstSegmentShots!.x);
    expect(firstSegmentFirstFrame!.y).toBeGreaterThan(firstSegmentNarrative!.y);
    expect(firstSegmentLastFrame!.y).toBeGreaterThan(firstSegmentFirstFrame!.y);
    expect(firstSegmentMotionSketch!.y).toBeGreaterThan(firstSegmentLastFrame!.y);
    expect(firstSegmentMotionSketch!.x).toBe(firstSegmentFirstFrame!.x);
    expect(firstSegmentVideo!.y).toBeGreaterThan(firstSegmentMotionSketch!.y);
    expect(firstSegmentLastFrame!.y - firstSegmentFirstFrame!.y).toBeGreaterThanOrEqual(420);
    expect(firstSegmentMotionSketch!.y - firstSegmentLastFrame!.y).toBeGreaterThanOrEqual(420);
    expect(firstSegmentVideo!.y - firstSegmentMotionSketch!.y).toBeGreaterThanOrEqual(600);
    expect(secondSegmentNarrative!.x - firstSegmentFirstFrame!.x).toBeGreaterThanOrEqual(
      getCanvasNodeWidth(firstSegmentFirstFrame!) + 120 + generatedAssetWidth,
    );
    expect(secondSegmentNarrative!.x).toBeGreaterThan(firstSegmentShots!.x);
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
