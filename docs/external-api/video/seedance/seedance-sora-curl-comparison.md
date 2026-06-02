# Seedance 与 Sora 四种模式调用对比

本文档描述 `shot-agent` 当前实现下，两种视频节点调用格式的实际请求结构对比：

- `seedance`：对应火山方舟 `/api/v3/contents/generations/tasks`
- `sora`：对应 OpenAI 兼容 `/videos`

说明：

- 本文档以**当前代码实现**为准，不等同于各官方平台未来可能调整后的最佳实践。
- `sora` 格式下，当前实现**不传 `size`**，也**不使用 `input_reference`**。
- `sora` 格式下，除顶层 `prompt / model / seconds` 外，其余 seedance 语义参数统一放入 `metadata`。
- `metadata.content` 仅在存在图片、视频、音频引用时传入；若为空数组，则**不传该字段**。

## 顶层字段对比

### seedance

顶层直接传：

- `model`
- `content`
- `resolution`
- `ratio`
- `duration`
- `seed`
- `return_last_frame`
- `generate_audio`
- `priority`

### sora

顶层仅传：

- `prompt`
- `model`
- `seconds`
- `metadata`

其中：

- `prompt` 对应 seedance 的 `content` 中 `type=text` 的内容
- `seconds` 对应 seedance 的 `duration`
- `metadata` 包裹以下内容：
  - `resolution`
  - `ratio`
  - `seed`
  - `return_last_frame`
  - `generate_audio`
  - `priority`
  - `content` 中除文本外的所有素材项

---

## 1. 文生视频

### seedance

```bash
curl -X POST "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "一只白猫坐在窗边，午后阳光，镜头缓慢推进。"
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

### sora

```bash
curl -X POST "https://api.openai.com/v1/videos" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=一只白猫坐在窗边，午后阳光，镜头缓慢推进。" \
  -F "seconds=5" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"16:9",
    "generate_audio":true
  }'
```

---

## 2. 首帧图生视频

### seedance

```bash
curl -X POST "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "人物保持原构图，从静止照片自然起身并向前走两步。"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/assets/first-frame.png"
        },
        "role": "first_frame"
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

### sora

```bash
curl -X POST "https://api.openai.com/v1/videos" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=人物保持原构图，从静止照片自然起身并向前走两步。" \
  -F "seconds=5" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"16:9",
    "generate_audio":true,
    "content":[
      {
        "type":"image_url",
        "image_url":{
          "url":"https://example.com/assets/first-frame.png"
        },
        "role":"first_frame"
      }
    ]
  }'
```

---

## 3. 首尾帧图生视频

### seedance

```bash
curl -X POST "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "从第一张图平滑过渡到第二张图的姿态与场景，保持人物一致。"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/assets/start.png"
        },
        "role": "first_frame"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/assets/end.png"
        },
        "role": "last_frame"
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

### sora

```bash
curl -X POST "https://api.openai.com/v1/videos" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=从第一张图平滑过渡到第二张图的姿态与场景，保持人物一致。" \
  -F "seconds=5" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"16:9",
    "generate_audio":true,
    "content":[
      {
        "type":"image_url",
        "image_url":{
          "url":"https://example.com/assets/start.png"
        },
        "role":"first_frame"
      },
      {
        "type":"image_url",
        "image_url":{
          "url":"https://example.com/assets/end.png"
        },
        "role":"last_frame"
      }
    ]
  }'
```

---

## 4. 多模态参考视频

### seedance

```bash
curl -X POST "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "参考图片1的人物造型，参考视频1的运镜节奏，使用音频1作为背景音乐，生成一条室内短片。"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/assets/ref-image-1.png"
        },
        "role": "reference_image"
      },
      {
        "type": "video_url",
        "video_url": {
          "url": "https://example.com/assets/ref-video-1.mp4"
        },
        "role": "reference_video"
      },
      {
        "type": "audio_url",
        "audio_url": {
          "url": "https://example.com/assets/ref-audio-1.mp3"
        },
        "role": "reference_audio"
      }
    ],
    "resolution": "720p",
    "ratio": "16:9",
    "duration": 5,
    "generate_audio": true
  }'
```

### sora

```bash
curl -X POST "https://api.openai.com/v1/videos" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=参考图片1的人物造型，参考视频1的运镜节奏，使用音频1作为背景音乐，生成一条室内短片。" \
  -F "seconds=5" \
  -F 'metadata={
    "resolution":"720p",
    "ratio":"16:9",
    "generate_audio":true,
    "content":[
      {
        "type":"image_url",
        "image_url":{
          "url":"https://example.com/assets/ref-image-1.png"
        },
        "role":"reference_image"
      },
      {
        "type":"video_url",
        "video_url":{
          "url":"https://example.com/assets/ref-video-1.mp4"
        },
        "role":"reference_video"
      },
      {
        "type":"audio_url",
        "audio_url":{
          "url":"https://example.com/assets/ref-audio-1.mp3"
        },
        "role":"reference_audio"
      }
    ]
  }'
```

---

## 实现差异总结

### seedance 调用格式

- 多模态素材直接进入顶层 `content`
- 文本和素材角色完全平铺
- `duration`、`resolution`、`ratio` 也是顶层参数

### sora 调用格式

- 顶层只保留：
  - `prompt`
  - `model`
  - `seconds`
- `size` 当前实现不发送
- `input_reference` 当前实现不发送
- 图片、视频、音频等素材都进入 `metadata.content`
- 其余 seedance 风格参数统一进入 `metadata`

### 当前实现里的映射关系

- seedance `content` 中的文本项：
  - 提升为 sora 顶层 `prompt`
- seedance `duration`：
  - 映射为 sora 顶层 `seconds`
- seedance 其他非文本能力：
  - 统一保留在 sora 顶层 `metadata`

