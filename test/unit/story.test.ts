import { describe, expect, it } from 'vitest';
import { parseStoryStructuredOutput } from '../../src/domain/story';

describe('story structured output', () => {
  it('parses a fenced json story structure', () => {
    const parsed = parseStoryStructuredOutput(`
\`\`\`json
{
  "version": 1,
  "storySummary": "一个无厘头故事",
  "styleNotes": ["荒诞", "快速剪辑"],
  "globalAssets": {
    "scenePrompts": [],
    "characterSheetPrompts": [],
    "propSheetPrompts": []
  },
  "narrativeSegments": [
    {
      "id": "segment_1",
      "title": "开场",
      "durationSeconds": 6,
      "openingTransition": {
        "type": "hard_cut",
        "description": "黑场切入",
        "durationSeconds": 1
      },
      "prompt": "主角冲进早餐店",
      "shots": [
        {
          "id": "shot_1",
          "title": "进门",
          "durationSeconds": 2,
          "characters": ["主角"],
          "cameraMotion": "推镜",
          "action": "撞开门",
          "transitionToNext": {
            "type": "action_continuation",
            "description": "动作延续到下一镜",
            "durationSeconds": 1
          }
        }
      ],
      "firstFramePrompt": { "id": "ff_1", "title": "首帧", "prompt": "早餐店门口" },
      "lastFramePrompt": { "id": "lf_1", "title": "尾帧", "prompt": "主角站到柜台前" },
      "motionSketchPrompt": { "id": "ms_1", "title": "运镜", "prompt": "门口到柜台推镜草图" },
      "continuityNotes": ["保持主角冲刺动作连贯"]
    }
  ]
}
\`\`\`
    `);

    expect(parsed?.storySummary).toBe('一个无厘头故事');
    expect(parsed?.narrativeSegments).toHaveLength(1);
    expect(parsed?.rawModelOutput).toContain('一个无厘头故事');
  });

  it('returns null for plain text that is not valid structured json', () => {
    expect(parseStoryStructuredOutput('这是普通回答，不是结构化 JSON')).toBeNull();
  });

  it('normalizes looser story json variants used by real model outputs', () => {
    const parsed = parseStoryStructuredOutput(`
{
  "version": "1.0",
  "storySummary": "包子参选街道主任",
  "styleNotes": ["荒诞", "明亮"],
  "globalAssets": {
    "scenePrompts": [
      {
        "id": "scene_01",
        "prompt": "雨后档案室"
      }
    ],
    "characterSheetPrompts": [
      {
        "id": "character_01",
        "prompt": "年轻男文员角色板"
      }
    ],
    "propSheetPrompts": [
      {
        "id": "prop_01",
        "prompt": "红色官方印章"
      }
    ]
  },
  "narrativeSegments": [
    {
      "id": "seg_01",
      "title": "蒸汽里冒出候选人",
      "durationSeconds": 10,
      "openingTransition": {
        "type": "蒸汽遮幅硬切",
        "description": "白汽遮幅转场",
        "durationSeconds": 0.5
      },
      "prompt": "清晨档案室里包子宣布参选。",
      "shots": [
        {
          "durationSeconds": 2.5,
          "characters": ["小李"],
          "cameraMovement": "缓慢推近",
          "action": "小李掀开蒸笼",
          "mood": "安静",
          "BGM": "轻木琴"
        }
      ],
      "firstFramePrompt": "清晨档案室蒸笼冒汽",
      "lastFramePrompt": "包子站在桌沿宣布参选",
      "motionSketchPrompt": [
        "镜头1：固定中远景",
        "镜头2：微距推近包子"
      ],
      "continuityNotes": "蒸汽持续存在"
    }
  ]
}
    `);

    expect(parsed?.version).toBe(1);
    expect(parsed?.globalAssets.scenePrompts[0]).toMatchObject({
      id: 'scene_01',
      title: 'scene_01',
      prompt: '雨后档案室',
    });
    expect(parsed?.narrativeSegments[0].shots[0]).toMatchObject({
      title: '镜头 1',
      cameraMotion: '缓慢推近',
      atmosphere: '安静',
      bgm: '轻木琴',
    });
    expect(parsed?.narrativeSegments[0].firstFramePrompt.prompt).toBe('清晨档案室蒸笼冒汽');
    expect(parsed?.narrativeSegments[0].motionSketchPrompt.prompt).toContain('镜头1：固定中远景');
  });
});
