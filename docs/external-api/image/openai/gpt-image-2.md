# OpenAI / gpt-image-2

调研日期：2026-05-20

## 来源

- 官方模型文档：[GPT Image 2 Model](https://developers.openai.com/api/docs/models/gpt-image-2)
- 官方图片生成指南：[Image generation](https://developers.openai.com/api/docs/guides/image-generation)

## 定位

`gpt-image-2` 是 OpenAI 的图片生成与编辑模型，适合在 `shot-agent` 中作为第一期图片节点生成能力。

## 模态能力

根据官方模型文档：

- 文本：仅输入
- 图片：输入和输出
- 音频：不支持
- 视频：不支持

因此该模型应接入为图片模型，不应直接承担视频节点生成。

## 可用接口

官方模型页列出的相关端点包括：

- `v1/images/generations`：图片生成
- `v1/images/edits`：图片编辑
- `v1/responses`：通过 Responses API 调用图片能力

项目实现时优先把 OpenAI 具体请求封装在 `src/models/openai/` 下，不要在 UI 组件中直接拼接请求体。

## 调用方式

本项目必须同时支持两种调用方式：

### 官方 SDK

用于默认 OpenAI 官方通道。适合直接使用 OpenAI 官方 SDK 的类型、重试、错误对象和文件上传能力。

配置项建议：

```ts
type OpenAISdkProviderConfig = {
  mode: 'sdk';
  apiKey: string;
  organization?: string;
  project?: string;
};
```

### HTTP 调用

用于官方 HTTP 调用和第三方 OpenAI-compatible 网关。用户可以手动输入第三方 `baseURL` 和 `apiKey`。

配置项建议：

```ts
type OpenAIHttpProviderConfig = {
  mode: 'http';
  baseURL: string;
  apiKey: string;
  headers?: Record<string, string>;
};
```

实现要求：

- `baseURL` 不写死为 OpenAI 官方地址，默认值可为 `https://api.openai.com`。
- HTTP 适配器必须支持用户配置第三方兼容网关，例如自定义 `https://example.com` 或 `https://example.com/v1`。
- 请求路径由适配器统一拼接，避免出现重复 `/v1/v1` 或遗漏 `/v1`。
- `apiKey` 只允许来自环境变量、本地未提交配置或用户运行时输入，不得写入仓库。
- SDK 与 HTTP 两种路径都必须映射到同一个项目内部输入/输出结构。
- 第三方网关可能不完整支持官方能力；适配器需要保留能力探测或错误提示。

## 官方能力覆盖

实现目标是支持 `gpt-image-2` 当前官方开放的全部图片能力。根据官方图片生成指南，需要覆盖：

- 文本生成图片。
- 图片编辑：基于 prompt 修改已有图片，可整体或局部编辑。
- 多轮图片编辑：通过 Responses API 支持对图片进行连续编辑。
- 图片输入：支持图片 bytes；Responses API 还支持 File ID 形式的图片输入。
- 批量输出：支持 `n` 参数生成多张图片。
- 输出自定义：支持尺寸、质量、格式、压缩和背景相关参数。
- 内容审核强度：支持官方 `moderation` 参数。

与 `gpt-image-2` 相关的当前限制也必须体现到 UI 或适配层：

- `gpt-image-2` 不支持透明背景，不能发送 `background: "transparent"`。
- `gpt-image-2` 的图片输入会自动以高保真处理，不允许通过 `input_fidelity` 调整。
- `gpt-image-2` 支持大量合法分辨率，但最大边长需符合官方限制；适配层应保留官方错误并给出可读提示。

## 存储策略

模型输出不应只依赖供应商返回的临时内容。项目需要支持可配置对象存储：

```ts
type AssetStorageConfig =
  | {
      kind: 'local';
      rootDir: string;
      publicBaseURL?: string;
    }
  | {
      kind: 'cloud';
      provider: 's3' | 'oss' | 'cos' | 'tos' | 'r2' | 'custom';
      bucket?: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      publicBaseURL?: string;
    };
```

要求：

- 本地存储用于开发环境和单机部署。
- 云端存储用于生产环境和多人协作，第一期优先支持 Cloudflare R2。
- 所有生成结果在落库或进入画布前，应先转存到项目配置的存储后端。
- 存储结果统一返回稳定 URL、MIME、大小、宽高和校验信息。
- 云端密钥不得写入仓库，只能通过环境变量或部署平台密钥管理注入。

## 项目内适配建议

建议抽象为：

```ts
type OpenAIImageGenerationInput = {
  prompt: string;
  transport: 'sdk' | 'http';
  sourceImages?: Array<{
    id: string;
    url?: string;
    file?: File;
    role: 'source_image' | 'reference_image';
  }>;
  size?: string;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  compression?: number;
  background?: 'auto' | 'opaque';
  moderation?: 'auto' | 'low';
};
```

输出统一映射到项目内部素材结构：

```ts
type GeneratedImageAsset = {
  kind: 'image';
  provider: 'openai';
  model: 'gpt-image-2';
  url?: string;
  storageURL?: string;
  b64Json?: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
  checksum?: string;
  rawResponse: unknown;
};
```

## 与画布节点的关系

图片 API 返回的是素材，不直接等同于画布节点。推荐流程：

1. 用户在画布或生成面板中提交 prompt。
2. `models/openai` 适配器创建图片生成任务。
3. 任务成功后生成 `GeneratedImageAsset`。
4. 画布层把素材挂载到 `image` 节点。
5. 节点保存位置、尺寸、选中状态、缩放等画布信息。

## 错误与状态

图片生成可能是相对短任务，但项目内部仍应统一走任务状态：

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

这样后续可以和视频任务保持一致的 UI 体验。

## 待确认项

- 第三方 OpenAI-compatible 网关对 `gpt-image-2` 的官方能力覆盖程度，需要逐个网关实测。
- 官方 SDK 和 HTTP 路径在文件上传、多图输入、错误对象上的差异，需要在适配器测试中固化。
- Cloudflare R2 的 bucket、endpoint、publicBaseURL、签名访问策略需要在存储适配器中固化。
