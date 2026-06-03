# 故事拆解节点设计

日期：2026-06-03

## 1. 背景与目标

本次设计新增一个面向前期创作规划的 `story` 节点，用于把故事文本与参考图片拆解成稳定的结构化创作内容，并在画布中自动生成后续图片节点与视频节点。

目标不是做一个泛化聊天节点，而是做一个贴近影视前期策划与镜头拆解的生产型节点，解决以下问题：

- 用户有一段故事、梗概、剧本或分场描述，但不想手动逐条写所有图片与视频提示词
- 用户希望先得到结构化拆解，再批量展开成下游节点
- 用户希望在需要时启用全自动，让结构化结果直接驱动图片与视频生成
- 用户希望保留可编辑性，既能看结构化面板，也能看原始模型输出

第一期范围聚焦：

- 新增 `story` 节点
- 支持故事文本 + 文本引用 + 图片引用/连线输入
- 产出双层结构化结果
- 支持自动生成图片节点、视频节点
- 支持可配置的自动执行

本次不包含：

- 视频或音频作为故事节点输入
- 多分支剧情控制
- 循环执行与复杂调度器
- 结构化结果与人工改动的细粒度自动合并
- 多故事节点联合编排

## 2. 用户输入与输出边界

### 2.1 故事节点允许的输入

故事节点只接收以下输入：

- 节点内直接输入的故事正文
- `@文本`
- `@图片`
- 上游文本节点连线
- 上游图片节点连线

不允许作为故事节点输入的内容：

- 视频
- 音频

设计理由：

- 第一阶段故事拆解主要依赖叙事文本与视觉参考图
- 先收紧输入类型，可以降低结构化输出的不确定性
- 与当前画布的图片资产体系更容易稳定对接

### 2.2 故事节点的输出目标

故事节点输出不是最终资产，而是结构化创作计划，分为两层：

1. 全局资产层
2. 叙事段落层

并基于这个结构自动生成下游节点。

## 3. 结构化输出模型

### 3.1 顶层结构

推荐的内部结构如下：

```ts
type StoryStructuredOutput = {
  version: 1;
  storySummary: string;
  styleNotes?: string[];
  globalAssets: StoryGlobalAssetGroup;
  narrativeSegments: StoryNarrativeSegment[];
  rawModelOutput?: string;
};
```

### 3.2 全局资产层

全局资产层用于沉淀后续各段会反复复用的素材提示词：

```ts
type StoryGlobalAssetGroup = {
  scenePrompts: StoryPromptItem[];
  characterSheetPrompts: StoryCharacterSheetPrompt[];
  propSheetPrompts: StoryPropSheetPrompt[];
};
```

约定：

- `scenePrompts`：场景设定图提示词，可用于统一空间、光线、时代、氛围
- `characterSheetPrompts`：关键人物多角度角色板提示词
- `propSheetPrompts`：关键物品多角度白底图提示词

### 3.3 叙事段落层

每个叙事段落对应一个后续视频节点，时长范围为 `4 ~ 15 秒`。

```ts
type StoryNarrativeSegment = {
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
```

说明：

- `openingTransition`：该段落开头与上一段之间如何衔接
- `prompt`：填充到视频生成节点的段落级总提示词
- `shots`：段落内部的分镜列表
- `firstFramePrompt` / `lastFramePrompt`：用于自动生成首尾帧图片节点
- `motionSketchPrompt`：用于生成该段运镜合集图
- `continuityNotes`：用于描述人物状态、空间关系、动作延续等跨镜头一致性要求

### 3.4 分镜结构

```ts
type StoryShot = {
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
```

### 3.5 衔接结构

这部分是本次新增的关键约束，必须单独建模，不能只写在自由文本里。

```ts
type StoryTransitionSpec = {
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
```

约定：

- `openingTransition` 表示该叙事段落开始时，如何从上一段衔接过来
- `transitionToNext` 表示当前分镜如何进入下一个分镜
- `durationSeconds` 必须计入总时长，不能被视为纯备注
- `continuityFocus` 用于强调衔接时必须保持的内容，例如：
  - 角色位置
  - 视线方向
  - 手部动作延续
  - 道具状态
  - 镜头方向
  - 光线与时间连续性

## 4. 时间规则

### 4.1 叙事段落时长约束

- 每个叙事段落总时长必须在 `4 ~ 15 秒`
- 段落对应一个视频节点

### 4.2 分镜与衔接的时长计算

段落时长计算必须明确：

```text
段落总时长
= 段落开头衔接时长
+ 各分镜时长总和
+ 各分镜之间衔接时长总和
```

要求：

- 结构化输出中必须能追溯总时长由哪些部分组成
- 如果模型给出的总时长超出 `4 ~ 15 秒`，需要在故事节点结果中标记为需修正
- 自动生成视频节点时，以修正后的合法时长为准

### 4.3 当前段落开头衔接

用户已明确要求：当前叙事段落的开头衔接必须写清楚，并且开头衔接本身需要计算时间。

因此：

- 第一段也允许存在 `openingTransition`
  - 如果它从“黑场、静止场景建立、环境音先入、字幕先入”开始，也要显式描述
- 非第一段必须明确说明它如何承接上一段
- 不允许只写“自然衔接”这类过于空泛的描述

## 5. 画布节点展开策略

### 5.1 故事节点的展开级别

故事节点支持三种展开级别：

1. 仅生成结构
2. 生成结构 + 全局资产节点
3. 完整展开全部下游节点

### 5.2 完整展开后的节点集合

完整展开时，自动生成以下节点：

- 场景图片节点
- 角色板图片节点
- 物品白底图图片节点
- 每个叙事段落的首帧图片节点
- 每个叙事段落的尾帧图片节点
- 每个叙事段落的运镜合集图片节点
- 每个叙事段落的视频节点

### 5.3 自动连线规则

建议默认建立以下关系：

- 故事节点 -> 全部自动生成节点
- 每个段落的首帧节点 -> 该段视频节点
- 每个段落的尾帧节点 -> 该段视频节点

第一期先不强制自动把全局资产图全部接入视频节点，避免默认图过多导致调用不稳定。后续可以扩展为可选参考图接入。

### 5.4 自动布局原则

建议布局：

- 故事节点位于最左
- 全局资产节点位于右上成组排列
- 每个叙事段落形成一列或一组
- 段落内顺序为：
  - 首帧
  - 尾帧
  - 运镜合集
  - 视频节点

要求：

- 自动生成节点后不覆盖已有节点
- 新生成节点与已有内容保持至少一个节点宽度的间距
- 同一批次生成的节点应带有可追踪分组关系

## 6. 自动执行策略

### 6.1 执行模式

故事节点支持三种执行模式：

- 仅拆解
- 拆解并铺节点
- 拆解、铺节点并自动执行

### 6.2 自动执行顺序

推荐顺序：

1. 全局场景图
2. 角色板图
3. 物品白底图
4. 各段首帧图
5. 各段尾帧图
6. 各段运镜合集图
7. 各段视频节点

原因：

- 先生成基础视觉资产，便于用户中途介入修正
- 后续视频节点可以稳定引用已生成并落盘的图片

### 6.3 自动执行中的人工可控性

即使启用全自动，也应保留：

- 暂停后续执行
- 单个节点重试
- 单个节点跳过
- 整批次取消

第一期可以先做到：

- 当前节点失败后停止后续自动执行
- 提供“继续执行后续节点”入口

## 7. 双视图编辑体验

故事节点详情页采用双视图：

1. 结构化视图
2. 原始结果视图

### 7.1 结构化视图

结构化视图用于按组编辑：

- 故事摘要
- 全局场景图提示词
- 角色板提示词
- 物品提示词
- 叙事段落
- 分镜
- 段落开头衔接
- 分镜间衔接

### 7.2 原始结果视图

原始结果视图保留模型生成的原始结构化内容，建议支持：

- 格式化 JSON
- 可读 Markdown

其作用：

- 调试模型输出
- 便于复制与外部比对
- 在结构化视图之外保留完整原始语义

## 8. 节点与数据模型扩展建议

### 8.1 新节点类型

建议在画布节点类型中新增：

```ts
type CanvasNodeKind =
  | 'image'
  | 'video'
  | 'chat'
  | 'story'
  | 'diamondMask'
  | 'textAsset'
  | 'imageAsset'
  | 'videoAsset'
  | 'audioAsset';
```

### 8.2 故事节点字段

```ts
type StoryNodeConfig = {
  executionMode: 'structure_only' | 'structure_and_nodes' | 'fully_automatic';
  expansionMode: 'structure_only' | 'global_assets' | 'full';
  autoRunImages: boolean;
  autoRunVideos: boolean;
};
```

节点视图上建议新增：

- 结构化结果摘要
- 当前展开批次状态
- 是否已生成下游节点

### 8.3 批次与来源关系

自动生成节点需要记录：

```ts
type StoryGeneratedNodeMeta = {
  sourceStoryNodeId: string;
  generationBatchId: string;
  segmentId?: string;
  assetRole?:
    | 'scene'
    | 'character_sheet'
    | 'prop_sheet'
    | 'segment_first_frame'
    | 'segment_last_frame'
    | 'segment_motion_sketch'
    | 'segment_video';
};
```

这些关系将用于：

- 重新展开时识别旧批次
- 段落级局部重建
- 过滤查看某个故事节点产生的全部内容

## 9. 供应商与模型适配建议

故事节点本质上是一个结构化内容生成节点，第一期更接近 `chat` 类能力，但不建议直接复用普通对话节点的交互壳。

建议：

- 供应商选择沿用当前对话节点的供应商体系
- 支持 `openai` 风格与 `anthropic` 风格的语言模型
- 输出结构化内容时优先要求严格 JSON 或可解析 Markdown

第一期内部实现可以复用现有语言模型流式输出能力，但对外仍表现为独立节点类型 `story`。

## 10. 重新生成与覆盖策略

故事节点再次执行时，不建议直接静默覆盖所有旧节点。

建议策略：

1. 保留原结构化结果版本
2. 生成新的 `generationBatchId`
3. 让用户选择：
   - 仅更新结构，不重建节点
   - 追加新批次节点
   - 替换尚未人工修改的旧批次节点

第一期可以先落最保守版本：

- 默认追加新批次节点
- 不自动删除历史节点

## 11. 失败与异常处理

需要重点处理以下情况：

- 模型未产出合法结构
- 段落总时长超出限制
- 分镜没有首尾逻辑或衔接缺失
- 自动生成节点过程中部分节点创建失败
- 自动执行中某个图片/视频节点失败

建议：

- 对结构校验失败给出明确错误列表
- 对每个段落标记“可生成 / 需修正”
- 自动执行链路中止时保留已完成节点与中间结果

## 12. 第一阶段建议实现顺序

1. 定义 `story` 节点与结构化 schema
2. 实现故事节点详情双视图
3. 接入结构化输出校验
4. 实现下游节点自动铺设
5. 实现批次关系与来源关系
6. 实现可选全自动执行
7. 再补局部重建、批次管理与细节交互

## 13. 待实现前再次确认的事项

虽然本次设计已经可以进入实现计划，但在动手前仍建议明确以下实现细节：

- 结构化输出采用 JSON 为主还是 Markdown + JSON 混合
- 自动布局采用横向泳道还是纵向段落栈
- 视频节点默认是否自动连接首尾帧
- 运镜合集图是普通图片节点还是后续独立草图节点
- 自动执行失败后是否默认停止整批次

## 14. 结论

本次推荐方案是：

- 新增独立 `story` 节点
- 输入仅支持文本与图片参考
- 输出采用“全局资产层 + 叙事段落层”的双层结构
- 段落内显式建模“开头衔接”和“分镜衔接”，并把衔接时间纳入总时长计算
- 通过可配置的展开与自动执行，把结构化结果自动转成图片节点与视频节点

该方案与现有画布、节点、供应商和存储体系兼容度较高，且足够贴近真实创作流程，适合作为下一阶段功能实现的基础规格。
