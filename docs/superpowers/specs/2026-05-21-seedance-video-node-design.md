# Seedance 视频生成节点设计

日期：2026-05-21

## 1. 背景与目标

本次设计面向 `seedance2.0` 与 `seedance2.0-fast` 两个视频生成模型，目标是在现有无限画布中补齐一条稳定、可扩展、可调试的视频生成链路。

本次范围聚焦以下能力：

- 详细梳理 Seedance 2.0 / 2.0 Fast 的有效入参与关键返回值
- 在视频生成节点中按“场景预设”展示允许的输入与参数
- 提交前显示本地预估 token 消耗
- 任务完成后显示官方结算 token 消耗
- 异步任务创建后每 5 秒轮询一次查询结果
- 生成成功后支持把视频保存到本地项目目录

本次不包含：

- 供应商回调服务端落地
- 云端对象存储接入
- 第三方兼容网关的全量差异适配
- 视频编辑时间线、剪辑或拼接能力

## 2. 官方接口调研结论

### 2.1 创建任务接口

- 方法：`POST`
- 路径：`/api/v3/contents/generations/tasks`
- 官方文档：<https://www.volcengine.com/docs/82379/1520757?lang=zh>

已确认的请求结构要点：

- `model: string`
- `content: Array<...>`，支持以下输入类型：
  - `text`
  - `image_url`
  - `video_url`
  - `audio_url`
  - `draft_task`
- 顶层可配置参数：
  - `resolution`
  - `ratio`
  - `duration`
  - `frames`
  - `framespersecond`
  - `seed`
  - `camera_fixed`
  - `watermark`
  - `return_last_frame`
  - `callback_url`
  - `execution_expires_after`
  - `generate_audio`
  - `safety_identifier`
  - `priority`
  - `service_tier`

当前已确认的关键限制：

- Seedance 2.0 系列支持：
  - 文生视频
  - 图生视频（首帧）
  - 图生视频（首尾帧）
  - 多模态参考生视频
- `seedance2.0-fast` 不支持 `1080p`
- 参考图片数量：`1 ~ 9`
- 参考视频数量：`0 ~ 3`
- 参考音频数量：`0 ~ 3`
- 音频不能单独输入，至少需要同时存在 1 个参考图片或参考视频
- `image_url.role` 支持：
  - `first_frame`
  - `last_frame`
  - `reference_image`
- `video_url.role` 仅支持：
  - `reference_video`
- `audio_url.role` 仅支持：
  - `reference_audio`
- `generate_audio` 适用于 Seedance 2.0 系列
- `priority` 适用于 Seedance 2.0 系列
- `service_tier` 对 Seedance 2.0 系列不作为可配置用户参数开放

当前已确认的素材约束：

- 图片格式：`jpeg/png/webp/bmp/tiff/gif`，Seedance 2.0 额外支持 `heic/heif`
- 图片宽高：`300 ~ 6000`
- 图片宽高比：`0.4 ~ 2.5`
- 单张图片小于 `30MB`
- 请求体总大小小于 `64MB`
- 视频格式：`mp4/mov`
- 视频分辨率：`480p/720p/1080p`
- 单个参考视频时长：`2 ~ 15s`
- 参考视频总时长不超过 `15s`
- 视频宽高：`300 ~ 6000`
- 视频宽高比：`0.4 ~ 2.5`
- 视频像素总量：`409600 ~ 2086876`
- 单个参考视频小于 `50MB`
- 视频帧率：`24 ~ 60`
- 音频格式：`wav/mp3`
- 单个参考音频时长：`2 ~ 15s`
- 参考音频总时长不超过 `15s`
- 单个参考音频小于 `15MB`

### 2.2 查询任务接口

- 方法：`GET`
- 路径：`/api/v3/contents/generations/tasks/{id}`
- 官方文档：<https://www.volcengine.com/docs/82379/1521309?lang=zh>

已确认的返回字段：

- `id`
- `model`
- `status`
- `error`
- `created_at`
- `updated_at`
- `content.video_url`
- `content.last_frame_url`
- `seed`
- `resolution`
- `ratio`
- `duration`
- `frames`
- `framespersecond`
- `generate_audio`
- `tools`
- `safety_identifier`
- `priority`
- `draft`
- `draft_task_id`
- `service_tier`
- `execution_expires_after`
- `usage.completion_tokens`
- `usage.total_tokens`
- `usage.tool_usage`

已确认的状态值：

- `queued`
- `running`
- `cancelled`
- `succeeded`
- `failed`
- `expired`

已确认的计费语义：

- `usage.completion_tokens` 是视频生成计费 token
- 视频生成不计算输入 token
- 因此在官方结算中一般有：`total_tokens = completion_tokens`

已确认的重要时效限制：

- `content.video_url` 有效期约为 `24h`
- 因此生成成功后需要尽快转存本地，不能只依赖供应商 URL

### 2.3 当前仍保留为实现期验证项

虽然官方页面已经确认存在以下参数，但具体枚举或模型差异仍建议在接入测试时再次核验：

- `duration` 在两个模型中的可选值
- `frames` 与 `duration` 的互斥或优先级规则
- `framespersecond` 的默认值与边界值
- `seed` 的允许范围
- `camera_fixed` 的布尔语义与默认值
- `watermark` 的默认值与可配置性

设计上先为这些参数预留类型与适配位置，但不在第一版 UI 中一次性全部开放。

## 3. 用户交互方案

### 3.1 采用场景预设面板

用户已经确认采用“场景预设面板”方案。视频生成节点先选择场景，再展示该场景允许的输入区和参数区。

第一版预设场景：

1. `文生视频`
2. `首帧图生视频`
3. `首尾帧图生视频`
4. `多模态参考视频`

交互原则：

- 场景决定表单骨架
- 模型决定可选参数与可选值
- 不适用的参数不显示，不做灰态堆叠
- 场景切换时，清理当前场景不再适用的输入与参数
- 切换前如果会丢失已填写内容，需要给出轻量确认

### 3.2 场景与输入关系

#### 文生视频

- 必填：提示词
- 可选：通用视频参数
- 不显示：图片、视频、音频输入区

#### 首帧图生视频

- 必填：首帧图片、提示词
- 可选：通用视频参数
- 不显示：末帧图片、参考视频、参考音频

#### 首尾帧图生视频

- 必填：首帧图片、末帧图片、提示词
- 可选：通用视频参数
- 不显示：参考视频、参考音频

#### 多模态参考视频

- 必填：提示词
- 可选：参考图片、参考视频、参考音频
- 规则：
  - 音频不能单独存在
  - 至少需要 1 个参考图片或参考视频
  - 参考资源数量受模型能力与官方约束共同限制

### 3.3 参数分组

节点参数面板建议分为三组：

1. 基础参数
   - 模型
   - 分辨率
   - 比例
   - 时长
   - 帧率
   - 随机种子

2. 生成控制
   - 是否生成音频
   - 是否返回末帧
   - 优先级

3. 高级参数
   - 相机固定
   - 水印
   - 安全标识
   - 执行过期时间

第一版可以把“高级参数”折叠显示，但仍遵守“仅显示当前场景与模型允许项”的原则。

## 4. 内部领域模型

### 4.1 场景类型

```ts
export type SeedanceScenario =
  | 'text_to_video'
  | 'image_to_video_first_frame'
  | 'image_to_video_first_last_frame'
  | 'multimodal_reference_video';
```

### 4.2 输入角色

```ts
export type SeedanceInputRole =
  | 'prompt'
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';
```

### 4.3 视频节点草稿参数

```ts
export type SeedanceVideoNodeDraft = {
  scenario: SeedanceScenario;
  model: 'seedance2.0' | 'seedance2.0-fast';
  prompt: string;
  inputs: Array<{
    assetId: string;
    kind: 'image' | 'video' | 'audio';
    role: SeedanceInputRole;
    sourceUrl: string;
    mimeType?: string;
  }>;
  params: {
    resolution?: '480p' | '720p' | '1080p';
    ratio?: string;
    duration?: number;
    frames?: number;
    framespersecond?: number;
    seed?: number;
    cameraFixed?: boolean;
    watermark?: boolean;
    returnLastFrame?: boolean;
    generateAudio?: boolean;
    priority?: number;
    safetyIdentifier?: string;
    executionExpiresAfter?: number;
  };
};
```

说明：

- UI 只读写内部草稿结构
- 供应商请求体由适配器负责转换
- `service_tier` 不放在节点可编辑参数中

### 4.4 统一任务状态

```ts
export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

状态映射建议：

```ts
const seedanceStatusMap = {
  queued: 'queued',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'canceled',
  expired: 'failed',
} as const;
```

将 `expired` 映射为 `failed`，同时在错误详情中保留“任务已过期”的原始语义。

## 5. 模型能力矩阵

需要在 `models/` 或 `domain/` 下维护一份独立能力矩阵，不允许把规则散落在组件条件分支里。

建议结构：

```ts
export type SeedanceModelCapabilities = {
  model: 'seedance2.0' | 'seedance2.0-fast';
  providerModelId: string;
  scenarios: SeedanceScenario[];
  supportedResolutions: Array<'480p' | '720p' | '1080p'>;
  supportedRatios: string[];
  durationRangeSeconds: { min: number; max: number };
  fpsRange: { min: number; max: number };
  supportsGenerateAudio: boolean;
  supportsPriority: boolean;
  supportsReferenceVideo: boolean;
  supportsReferenceAudio: boolean;
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
};
```

第一版默认矩阵：

### `seedance2.0`

- 支持所有预设场景
- 支持 `480p / 720p / 1080p`
- 支持 `generate_audio`
- 支持 `priority`
- 支持参考视频
- 支持参考音频

### `seedance2.0-fast`

- 支持所有预设场景
- 支持 `480p / 720p`
- 不显示 `1080p`
- 先按 2.0 系列能力接入 `generate_audio`
- 先按 2.0 系列能力接入 `priority`
- 参考视频与参考音频能力按官方说明接入，具体边界在实测阶段复核

如果后续实测发现能力与文档不一致，应只更新能力矩阵与适配器，不改 UI 组件结构。

## 6. 请求适配设计

### 6.1 适配边界

视频节点组件不得直接组装 Volcengine 请求体。统一由模型适配器完成：

```ts
buildSeedanceCreateTaskRequest(
  draft: SeedanceVideoNodeDraft,
  capabilities: SeedanceModelCapabilities,
): SeedanceCreateTaskRequest
```

### 6.2 目标请求结构

```ts
type SeedanceCreateTaskRequest = {
  model: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; role?: string } }
    | { type: 'video_url'; video_url: { url: string; role: 'reference_video' } }
    | { type: 'audio_url'; audio_url: { url: string; role: 'reference_audio' } }
  >;
  resolution?: string;
  ratio?: string;
  duration?: number;
  frames?: number;
  framespersecond?: number;
  seed?: number;
  camera_fixed?: boolean;
  watermark?: boolean;
  return_last_frame?: boolean;
  callback_url?: string;
  execution_expires_after?: number;
  generate_audio?: boolean;
  safety_identifier?: string;
  priority?: number;
};
```

### 6.3 场景到请求体的映射

#### 文生视频

- `content` 仅包含 1 个 `text`

#### 首帧图生视频

- `content` 包含：
  - 1 个 `text`
  - 1 个 `image_url`，`role = first_frame`

#### 首尾帧图生视频

- `content` 包含：
  - 1 个 `text`
  - 1 个 `image_url`，`role = first_frame`
  - 1 个 `image_url`，`role = last_frame`

#### 多模态参考视频

- `content` 包含：
  - 1 个 `text`
  - `1 ~ 9` 个 `image_url`，`role = reference_image`
  - `0 ~ 3` 个 `video_url`，`role = reference_video`
  - `0 ~ 3` 个 `audio_url`，`role = reference_audio`

适配器需要在提交前做最终校验：

- 禁止音频单独提交
- 禁止超出模型能力矩阵数量上限
- 禁止提交模型不支持的分辨率
- 禁止同时提交不兼容的场景输入

## 7. 异步任务与轮询设计

### 7.1 任务创建

提交成功后，适配器返回统一任务数据：

```ts
type VideoGenerationTaskSnapshot = {
  provider: 'seedance';
  model: string;
  taskId: string;
  status: GenerationStatus;
  rawStatus?: string;
  rawResponse: unknown;
};
```

### 7.2 轮询策略

用户已明确要求每 5 秒轮询一次。

默认策略：

- 间隔：`5000ms`
- 起点：任务创建成功后立即进入轮询管理
- 停止条件：
  - `succeeded`
  - `failed`
  - `cancelled`
  - `expired`

轮询更新内容：

- 当前任务状态
- 最新错误信息
- 官方 token 使用量
- 生成结果 URL
- 最后更新时间

### 7.3 轮询实现边界

建议轮询由单独任务控制层管理，而不是散落在 React 组件内部的 `setInterval`。

建议接口：

```ts
type TrackSeedanceTaskOptions = {
  taskId: string;
  pollIntervalMs: number;
  onUpdate(task: SeedanceQueriedTask): void;
  onFinished(task: SeedanceQueriedTask): void;
  onFailed(task: SeedanceQueriedTask): void;
};
```

这样有几个好处：

- 组件卸载时容易取消监听
- 后续接回调模式时可以共用同一份状态更新入口
- 更容易写单元测试与状态流转测试

## 8. 视频转存与本地保存

### 8.1 保存时机

任务查询到 `succeeded` 后，如果返回了 `content.video_url`，应立即开始本地保存。

### 8.2 存储目录

建议使用项目目录下的固定结构：

```text
assets/
  videos/
    <taskId>.mp4
  covers/
    <taskId>.png
```

说明：

- 视频文件保存到 `assets/videos/`
- 如果启用了 `return_last_frame` 且接口返回 `content.last_frame_url`，则保存封面到 `assets/covers/`
- 节点最终应优先引用本地保存路径，而不是临时远程 URL

### 8.3 节点输出结构

```ts
type GeneratedVideoAsset = {
  kind: 'video';
  provider: 'seedance';
  model: string;
  taskId: string;
  localPath?: string;
  sourceUrl?: string;
  coverLocalPath?: string;
  coverSourceUrl?: string;
  width?: number;
  height?: number;
  ratio?: string;
  durationSeconds?: number;
  fps?: number;
  hasAudio?: boolean;
  usage?: {
    estimatedTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  rawStatus?: string;
  rawResponse: unknown;
};
```

## 9. Token 展示设计

用户已明确要求同时显示：

- 本地预估 token
- 官方结算 token

### 9.1 提交前预估

提交前基于以下因素做本地规则估算：

- 模型
- 分辨率
- 时长
- 帧率
- 是否生成音频
- 场景类型
- 是否存在多模态参考输入

第一版目标：

- 提供相对稳定的预估值
- 明确标注“预估”
- 不承诺与官方最终完全一致

建议显示文案：

- `预计消耗：xxxx tokens（本地预估）`

### 9.2 完成后结算

任务查询完成后，从接口返回中读取：

- `usage.completion_tokens`
- `usage.total_tokens`

建议显示文案：

- `实际消耗：xxxx completion tokens / xxxx total tokens`

如果查询接口尚未返回 `usage`，则继续显示：

- `实际消耗：等待官方结算`

### 9.3 预估策略边界

由于官方没有提供提交前精确计费预估接口，第一版采用本地规则表。后续如果供应商补充正式计费接口，再替换估算实现，不改变 UI 结构。

## 10. 错误处理

必须覆盖以下错误类型：

- 提交前校验失败
- 创建任务接口失败
- 轮询接口失败
- 任务状态失败
- 任务过期
- 视频下载失败
- 本地保存失败

错误展示原则：

- 用户看到的是可理解的中文错误
- 节点内部保留供应商原始错误码与原始响应
- 不把供应商原始英文或结构化对象直接暴露到主要 UI 文案

建议保留结构：

```ts
type GenerationErrorInfo = {
  message: string;
  providerCode?: string;
  providerMessage?: string;
  rawResponse?: unknown;
};
```

## 11. 测试方案

第一版至少覆盖以下测试：

### 11.1 单元测试

- 场景预设切换后的表单字段过滤
- 模型能力矩阵对参数显示的裁剪
- `seedance2.0-fast` 不显示 `1080p`
- 请求体映射正确
- 音频不能单独提交
- 参考素材数量校验正确
- 状态映射正确
- token 预估规则输出稳定

### 11.2 集成测试

- 创建任务后每 5 秒轮询一次
- `queued -> running -> succeeded` 状态流转
- `queued -> failed`
- `queued -> expired`
- 查询成功后触发视频下载与本地保存
- 返回 `last_frame_url` 时保存封面
- 查询结果中的 `usage` 能正确写回节点

### 11.3 残余风险

第一版主要残余风险：

- 官方部分参数边界仍依赖接入期实测
- 本地 token 预估只能近似，不能视为结算结果
- 下载与本地保存链路可能受浏览器权限或目录授权影响

## 12. 分阶段实施建议

建议按以下顺序实现：

1. 补齐 Seedance 能力矩阵与内部类型
2. 实现“场景预设面板”与参数显示过滤
3. 扩展请求适配器，支持完整场景映射
4. 引入任务轮询控制层，固定 5 秒查询
5. 补齐 token 预估与官方 usage 展示
6. 接入视频下载与本地保存
7. 增补测试

## 13. 验收标准

满足以下条件即可视为本次设计目标达成：

- 用户能在视频节点中选择 4 类预设场景
- 节点只显示当前场景与模型允许的参数
- `seedance2.0-fast` 不展示 `1080p`
- 创建任务后系统每 5 秒轮询一次
- 任务成功后能展示官方 usage token
- 任务成功后能把视频保存到本地项目目录
- 节点中同时可见“预计消耗”和“实际消耗”
- 失败、取消、过期状态都有明确反馈

