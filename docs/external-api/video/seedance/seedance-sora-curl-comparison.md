# Seedance Sora 格式 curl 对比

调研日期：2026-05-31

本文记录 `shot-agent` 中 `seedance-sora` 兼容调用方式与 Seedance 官方原生调用方式的 curl 对比。目标是明确同一类视频生成任务在两种接口格式中的字段位置，避免把 `content[].image_url`、`metadata`、本地文件上传等参数放错位置。

## 来源

- 火山方舟 Seedance 2.0 API 参考：[Seedance 2.0 API reference](https://www.volcengine.com/docs/82379/1520757)
- BytePlus ModelArk Seedance 2.0 API 参考：[Seedance 2.0 API reference](https://docs.byteplus.com/en/docs/ModelArk/1520757)
- 第三方 OpenAI/Sora 兼容格式参考：[AMUX Doubao Seedance 2 API](https://www.amux.ai/docs/amux-api/video/doubao-seedance-2)
- 用户提供的 OpenAI 视频格式说明：`POST /v1/videos`、`GET /v1/videos/{video_id}`、`GET /v1/videos/{video_id}/content`

## 核心差异

| 维度 | Sora 兼容格式 | Seedance 官方格式 |
| --- | --- | --- |
| 创建任务 | `POST /v1/videos` | `POST /api/v3/contents/generations/tasks` |
| 请求体 | `multipart/form-data` | `application/json` |
| 鉴权 | `Authorization: Bearer sk-xxx` | `Authorization: Bearer xxx` |
| 提示词 | 表单字段 `prompt` | `content[]` 中的 `{ "type": "text", "text": "..." }` |
| 本地首帧图 | 表单字段 `input_reference=@file` | 需要先上传到对象存储，再传 URL |
| URL 图片/视频/音频 | 建议放入 `metadata.content[]` | 放入顶层 `content[]` |
| 扩展参数 | 表单字段 `metadata`，值为 JSON 字符串 | 顶层 JSON 字段 |
| 查询任务 | `GET /v1/videos/{id}` | `GET /api/v3/contents/generations/tasks/{id}` |
| 下载视频 | `GET /v1/videos/{id}/content` | 查询结果中的视频 URL，或按网关返回处理 |

重要约定：

- Seedance 官方格式中，`image_url`、`video_url`、`audio_url` 应使用对象结构，例如 `{ "url": "https://..." }`，不要直接传字符串。
- 本地图片只有 Sora 兼容格式可以通过 `input_reference=@./file.png` 直接上传。Seedance 官方 JSON 格式需要先把本地文件上传到对象存储，拿到可访问 URL 后再提交。
- `metadata` 是 Sora 兼容格式承载 Seedance 专有参数的桥梁，必须是 JSON 字符串。
- 下面所有 key 均为示例，不得提交真实密钥。

## 通用变量

```bash
export SORA_BASE_URL="https://你的-newapi-服务地址"
export SORA_API_KEY="sk-xxx"

export ARK_BASE_URL="https://ark.cn-beijing.volces.com"
export ARK_API_KEY="xxx"
export SEEDANCE_MODEL="doubao-seedance-2-0-fast-260128"
```

## 1. 文生视频

### Sora 兼容格式

```bash
curl "$SORA_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $SORA_API_KEY" \
  -F "prompt=航拍雪山峡谷，清晨金色阳光，电影感，缓慢推进" \
  -F "model=seedance-sora" \
  -F "seconds=5" \
  -F "size=16:9" \
  -F 'metadata={"resolution":"720p","ratio":"16:9","duration":5,"seed":12345,"watermark":false,"generate_audio":true}'
```

### Seedance 官方格式

```bash
curl "$ARK_BASE_URL/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "content": [
      {
        "type": "text",
        "text": "航拍雪山峡谷，清晨金色阳光，电影感，缓慢推进"
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "seed": 12345,
    "watermark": false,
    "generate_audio": true
  }'
```

## 2. 首帧图生视频

### Sora 兼容格式，本地图片

```bash
curl "$SORA_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $SORA_API_KEY" \
  -F "prompt=让图片中的人物轻微转头，背景有风吹动，镜头缓慢推近" \
  -F "model=seedance-sora" \
  -F "seconds=5" \
  -F "size=16:9" \
  -F "input_reference=@./assets/start.png" \
  -F 'metadata={"resolution":"720p","ratio":"16:9","duration":5,"seed":12345,"watermark":false,"role":"first_frame"}'
```

### Seedance 官方格式，图片 URL

```bash
curl "$ARK_BASE_URL/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "content": [
      {
        "type": "text",
        "text": "让图片中的人物轻微转头，背景有风吹动，镜头缓慢推近"
      },
      {
        "type": "image_url",
        "role": "first_frame",
        "image_url": {
          "url": "https://assets.example.com/start.png"
        }
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "seed": 12345,
    "watermark": false
  }'
```

## 3. 首尾帧视频

### Sora 兼容格式

```bash
curl "$SORA_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $SORA_API_KEY" \
  -F "prompt=从白天街景平滑过渡到夜晚霓虹街景，镜头稳定推进" \
  -F "model=seedance-sora" \
  -F "seconds=6" \
  -F "size=16:9" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"16:9",
    "duration":6,
    "seed":12345,
    "watermark":false,
    "content":[
      {
        "type":"image_url",
        "role":"first_frame",
        "image_url":{"url":"https://assets.example.com/day.png"}
      },
      {
        "type":"image_url",
        "role":"last_frame",
        "image_url":{"url":"https://assets.example.com/night.png"}
      }
    ]
  }'
```

### Seedance 官方格式

```bash
curl "$ARK_BASE_URL/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "content": [
      {
        "type": "text",
        "text": "从白天街景平滑过渡到夜晚霓虹街景，镜头稳定推进"
      },
      {
        "type": "image_url",
        "role": "first_frame",
        "image_url": {
          "url": "https://assets.example.com/day.png"
        }
      },
      {
        "type": "image_url",
        "role": "last_frame",
        "image_url": {
          "url": "https://assets.example.com/night.png"
        }
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 6,
    "seed": 12345,
    "watermark": false
  }'
```

## 4. 多模态参考：文本 + 图片 + 视频 + 音频

### Sora 兼容格式

```bash
curl "$SORA_BASE_URL/v1/videos" \
  -H "Authorization: Bearer $SORA_API_KEY" \
  -F "prompt=参考 @Image1 的角色、@Video1 的动作节奏、@Audio1 的鼓点，生成一段赛博舞台表演" \
  -F "model=seedance-sora" \
  -F "seconds=8" \
  -F "size=9:16" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"9:16",
    "duration":8,
    "seed":12345,
    "watermark":false,
    "generate_audio":true,
    "content":[
      {
        "type":"image_url",
        "role":"reference_image",
        "image_url":{"url":"https://assets.example.com/character.png"}
      },
      {
        "type":"video_url",
        "role":"reference_video",
        "video_url":{"url":"https://assets.example.com/motion.mp4"}
      },
      {
        "type":"audio_url",
        "role":"reference_audio",
        "audio_url":{"url":"https://assets.example.com/beat.mp3"}
      }
    ]
  }'
```

### Seedance 官方格式

```bash
curl "$ARK_BASE_URL/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "content": [
      {
        "type": "text",
        "text": "参考 @Image1 的角色、@Video1 的动作节奏、@Audio1 的鼓点，生成一段赛博舞台表演"
      },
      {
        "type": "image_url",
        "role": "reference_image",
        "image_url": {
          "url": "https://assets.example.com/character.png"
        }
      },
      {
        "type": "video_url",
        "role": "reference_video",
        "video_url": {
          "url": "https://assets.example.com/motion.mp4"
        }
      },
      {
        "type": "audio_url",
        "role": "reference_audio",
        "audio_url": {
          "url": "https://assets.example.com/beat.mp3"
        }
      }
    ],
    "resolution": "720p",
    "ratio": "9:16",
    "duration": 8,
    "seed": 12345,
    "watermark": false,
    "generate_audio": true
  }'
```

## 查询与下载

### Sora 兼容格式

```bash
curl "$SORA_BASE_URL/v1/videos/video_123" \
  -H "Authorization: Bearer $SORA_API_KEY"

curl "$SORA_BASE_URL/v1/videos/video_123/content" \
  -H "Authorization: Bearer $SORA_API_KEY" \
  -o output.mp4
```

### Seedance 官方格式

```bash
curl "$ARK_BASE_URL/api/v3/contents/generations/tasks/cgt_xxx" \
  -H "Authorization: Bearer $ARK_API_KEY"
```

## 适配器实现建议

- UI 中选择 `seedance-sora` 时仍复用 Seedance 节点参数，例如时长、比例、分辨率、种子、水印、音频等。
- 如果请求中有本地图片、视频、音频，且最终要走 Seedance 官方 JSON 字段，应先上传到对象存储，再把返回 URL 写入 `metadata.content[]` 或官方 `content[]`。
- 若未配置对象存储，应隐藏 `seedance-sora` 选项，避免本地文件无法转换成公网 URL。
- 保存原始提交响应和轮询响应，失败任务应展示 `error.code` 与 `error.message`。
