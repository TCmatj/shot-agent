# Seedance 2.0 / Seedance 2.0 Fast

调研日期：2026-05-20

## 来源

- 火山方舟 Seedance 2.0 API 参考：[Seedance 2.0 API 参考](https://www.volcengine.com/docs/82379/1520757)
- 火山方舟视频生成 API：[视频生成 API](https://www.volcengine.com/docs/82379/1520758)
- 火山方舟查询视频生成任务 API：[查询视频生成任务 API](https://www.volcengine.com/docs/82379/1521309)
- 火山方舟查询视频生成任务列表：[查询视频生成任务列表](https://www.volcengine.com/docs/82379/1521675)
- 火山方舟取消或删除任务：[取消或删除视频生成任务](https://www.volcengine.com/docs/82379/1521720)
- 第三方网关参考：[AMUX 豆包 Seedance 2.0 系列](https://www.amux.ai/zh/docs/amux-api/video/doubao-seedance-2)

说明：火山官方文档页面部分正文依赖 JS 渲染。本文把官方页面可确认的信息、用户补充的接入决策、第三方网关信息分开记录；最终实现仍以火山官方接口实测结果为准。

## 定位

Seedance 2.0 / Seedance 2.0 Fast 是第一期视频节点生成能力。

- `Seedance 2.0`：优先画质和完整能力。
- `Seedance 2.0 Fast`：优先速度和成本，能力边界需要按官方接口实测。

项目中二者必须共用同一套 UI、任务状态和素材模型，只在模型配置层分化。

## 模型标识

火山官方控制台预计使用以下模型 ID：

```ts
type SeedanceModel =
  | 'doubao-seedance-2-0-260128'
  | 'doubao-seedance-2-0-fast-260128';
```

兼容第三方网关时，允许通过配置覆盖模型 ID。第三方常见模型 ID 还包括：

```ts
type SeedanceCompatibleModel =
  | 'doubao-seedance-2.0'
  | 'doubao-seedance-2.0-fast'
  | 'seedance2.0'
  | 'seedance2.0-fast'
  | string;
```

适配器不得把模型 ID 写死在 UI 中。

## 渠道配置

Seedance 适配器应支持官方火山方舟和第三方兼容网关：

```ts
type SeedanceProviderConfig = {
  provider: 'volcengine' | 'byteplus' | 'third-party';
  baseURL: string;
  apiKey: string;
  model: SeedanceModel | SeedanceCompatibleModel;
  headers?: Record<string, string>;
  callback?: {
    enabled: boolean;
    url?: string;
    secret?: string;
    fallbackToPolling: boolean;
  };
};
```

默认配置建议：

```ts
const defaultSeedanceConfig = {
  provider: 'volcengine',
  baseURL: 'https://ark.cn-beijing.volces.com',
  model: 'doubao-seedance-2-0-260128',
};
```

要求：

- `baseURL`、`apiKey`、`model` 都必须可配置。
- `apiKey` 只能来自环境变量、本地未提交配置或用户运行时输入。
- 第三方网关可能使用不同路径、模型名或字段名，必须通过 provider adapter 适配。
- 原始响应必须保存到 `rawResponse`，便于调试和后续补齐字段。

## 接口形态

视频生成按异步任务处理。官方 API 族包含：

- 创建视频生成任务
- 查询视频生成任务
- 查询视频生成任务列表
- 取消或删除视频生成任务

第三方网关和聚合文档中常见路径如下，火山官方接入时需要以官方接口实测为准：

```text
POST /api/v3/contents/generations/tasks
GET  /api/v3/contents/generations/tasks/{task_id}
GET  /api/v3/contents/generations/tasks
POST /api/v3/contents/generations/tasks/{task_id}/cancel
```

项目内部不要直接暴露供应商路径。统一封装为：

```ts
interface VideoGenerationProvider {
  createTask(input: SeedanceCreateTaskInput): Promise<SeedanceTask>;
  getTask(taskId: string): Promise<SeedanceTask>;
  listTasks(params?: SeedanceListTaskParams): Promise<SeedanceTaskList>;
  cancelTask(taskId: string): Promise<SeedanceTask>;
}
```

## 输入能力

Seedance 2.0 需要支持多模态输入：

- 文本 prompt
- 参考图片
- 首帧图片
- 末帧图片
- 参考视频
- 参考音频

项目内部输入结构：

```ts
type SeedanceCreateTaskInput = {
  prompt: string;
  model: SeedanceModel | SeedanceCompatibleModel;
  assets?: Array<{
    id: string;
    kind: 'image' | 'video' | 'audio';
    url: string;
    role:
      | 'first_frame'
      | 'last_frame'
      | 'reference_image'
      | 'reference_video'
      | 'reference_audio';
  }>;
  aspectRatio?: string;
  resolution?: '480p' | '720p' | '1080p' | string;
  durationSeconds?: number;
  fps?: number;
  seed?: number;
  callbackURL?: string;
};
```

第三方 AMUX 文档显示其 Seedance 2.0 网关支持文本、图像、视频、音频混合输入，并提到最多 9 张图、3 个视频片段、3 个音频片段。官方火山通道的精确数量限制需要接入实测确认。

## 标准版与 Fast 版

当前已知：

- 标准版模型 ID：`doubao-seedance-2-0-260128`
- Fast 版模型 ID：`doubao-seedance-2-0-fast-260128`
- 标准版优先画质和完整能力。
- Fast 版优先速度和成本。

已按火山官方文档页面正文确认：

- `Seedance 2.0` 支持 `480p / 720p / 1080p`
- `Seedance 2.0 Fast` 支持 `480p / 720p`，不支持 `1080p`
- `Seedance 2.0` 与 `Seedance 2.0 Fast` 都属于“Seedance 2.0 系列”，`duration` 支持 `4~15` 秒整数，或设置为 `-1`
- `Seedance 2.0` 系列文档没有开放自定义输出帧率；与时长换算相关的唯一明确帧率规则为固定 `24fps`

仍建议在真实官方接口调用时继续留意：

- Fast 版在不同参考素材组合下是否存在额外隐藏限制
- 文档中查询结果出现 `framespersecond=24`，但创建任务参数说明未开放自定义帧率，因此项目侧按固定 `24fps` 处理

## 任务状态

官方状态枚举按用户补充整理为：

```ts
type SeedanceRawStatus =
  | 'queued'
  | 'running'
  | 'cancelled'
  | 'succeeded'
  | 'failed';
```

项目内部统一状态：

```ts
type GenerationStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

状态映射：

```ts
const seedanceStatusMap = {
  queued: 'queued',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'canceled',
} as const;
```

未知状态处理：

- 保留原始状态字符串。
- 不要让 UI 直接依赖未知状态。
- 如果任务仍可继续查询，映射为 `running` 并记录调试信息。
- 如果接口返回明确失败语义，映射为 `failed` 并展示原始错误。

## Callback 与轮询

Seedance 适配器需要同时支持 callback 和轮询。

要求：

- callback URL 允许用户自定义配置。
- 默认可尝试使用本机公网 IP 生成 HTTP callback URL。
- 如果本机公网地址不可达、未配置端口映射、没有公网 IP，必须回退轮询。
- callback 请求应支持校验 secret 或签名，避免任意请求污染任务状态。
- 轮询需要指数退避或固定间隔限频，避免过度请求。
- callback 和轮询更新同一个任务状态存储，不要产生两套状态来源。

推荐策略：

```ts
type SeedanceCallbackStrategy =
  | {
      mode: 'callback';
      callbackURL: string;
      secret?: string;
      fallbackToPolling: true;
    }
  | {
      mode: 'polling';
      intervalMs: number;
      timeoutMs: number;
    };
```

## 输出结构

视频任务完成后统一映射为项目内部视频素材：

```ts
type GeneratedVideoAsset = {
  kind: 'video';
  provider: 'seedance';
  model: SeedanceModel | SeedanceCompatibleModel;
  taskId: string;
  url?: string;
  storageURL?: string;
  coverUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  hasAudio?: boolean;
  rawStatus?: string;
  rawResponse: unknown;
};
```

视频 API 返回的是素材，不直接等同于画布节点。画布层只消费 `GeneratedVideoAsset`，不直接消费供应商响应。

## 存储策略

视频生成完成后必须转存，避免供应商 URL 过期或无法离线访问。

存储优先级：

1. 用户创建画布项目时选择的本地项目目录。
2. Cloudflare R2。
3. 其他 S3 兼容存储或自定义云存储。

本地存储建议：

```text
<project-root>/
  assets/
    videos/
      <taskId>.mp4
    covers/
      <taskId>.jpg
```

云端存储建议：

```ts
type SeedanceAssetStorageConfig =
  | {
      kind: 'local';
      projectDir: string;
    }
  | {
      kind: 'r2';
      accountId: string;
      bucket: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseURL?: string;
    }
  | {
      kind: 's3-compatible';
      bucket: string;
      endpoint: string;
      region?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseURL?: string;
    };
```

要求：

- 生成结果入画布前优先转存。
- 转存后保存 `storageURL`，原始供应商 URL 仅作调试或短期回源。
- 本地路径和云端 key 应包含项目 ID 或画布 ID，避免不同项目素材冲突。
- R2 凭据不得提交到仓库。

## 与画布节点的关系

推荐流程：

1. 用户在画布中提交视频生成任务。
2. `models/seedance` 创建任务并保存 `taskId`。
3. 通过 callback 或轮询更新任务状态。
4. 任务成功后下载或回源读取视频。
5. 将视频存入本地项目目录或 Cloudflare R2。
6. 生成 `GeneratedVideoAsset`。
7. 画布层创建或更新 `video` 节点。

视频节点至少保存：

- 素材 ID
- 位置和尺寸
- 宽高和比例
- 时长
- 封面
- 播放状态
- 生成任务 ID

## 实现要求

- UI 不直接拼接 Seedance 请求体。
- UI 不直接依赖 Seedance 原始状态。
- 标准版和 Fast 版共享同一套任务流。
- 失败原因必须展示给用户。
- 取消任务失败时必须展示供应商错误。
- 所有任务结果必须保留 `rawResponse`。
- 所有生成视频必须支持转存到本地或 Cloudflare R2。

## 接入实测清单

- 使用 `doubao-seedance-2-0-260128` 创建一次文本生视频任务。
- 使用 `doubao-seedance-2-0-fast-260128` 创建一次文本生视频任务。
- 查询任务直到 `succeeded`。
- 验证 `queued`、`running`、`succeeded`、`failed`、`cancelled` 状态映射。
- 验证 callback URL 可用时能更新任务。
- 验证 callback 不可用时会回退轮询。
- 验证取消任务。
- 验证生成视频能保存到本地项目目录。
- 验证生成视频能保存到 Cloudflare R2。
- 验证标准版和 Fast 版在分辨率、时长、音频、参考素材数量上的差异。
