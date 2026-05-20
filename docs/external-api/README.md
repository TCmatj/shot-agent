# 外部模型 API 文档

本目录用于保存 `shot-agent` 计划接入的外部图片、视频模型 API 调研与适配说明。

## 目录

- 图片模型
  - [OpenAI / gpt-image-2](image/openai/gpt-image-2.md)
- 视频模型
  - [Seedance 2.0 / Seedance 2.0 Fast](video/seedance/seedance-2.md)

## 维护规则

- 文档使用中文编写。
- 每个模型独立成文档，路径按 `类型/渠道/模型.md` 组织。
- 调研外部 API 时必须记录来源链接和调研日期。
- 不要在文档中写入真实 API key、token、账号、私有 endpoint。
- 如果官方文档有变更，应同步更新对应文档，并在“待确认项”中移除过期假设。
- 项目实现时以本目录文档为参考，但最终以官方最新文档和实际接口返回为准。
