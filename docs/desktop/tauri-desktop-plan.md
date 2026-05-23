# shot-agent 桌面化第一阶段

本文档记录 `shot-agent` 从 Web 应用演进到三平台桌面应用的第一阶段落地结果。

## 当前已完成

- 接入 `Tauri 2` 项目骨架
- 增加本地桌面开发命令：
  - `npm run desktop:dev`
  - `npm run desktop:build`
- 新增 `src-tauri/`：
  - Rust 入口
  - Tauri 配置
  - 默认 capabilities
  - 基础插件：`dialog`、`fs`、`opener`
- 增加 GitHub Actions 三平台桌面构建工作流草案：
  - `macos-latest`
  - `ubuntu-22.04`
  - `windows-latest`

## 当前未完成

- 本地环境安装 Rust toolchain
- 真实验证 `tauri dev` / `tauri build`
- 桌面端文件系统能力替换浏览器目录句柄实现
- 自动更新与更新签名
- macOS 代码签名与 notarization
- Windows 代码签名
- 应用图标与安装包品牌资源

## 本地开发前置

需要先安装：

- Rust stable toolchain
- 平台对应的 Tauri 构建依赖

官方文档：

- Tauri 2 分发总览：<https://v2.tauri.app/distribute/>
- GitHub Actions：<https://v2.tauri.app/distribute/pipelines/github/>

## GitHub Secrets 清单

工作流已经预留以下 secrets；没有全部配置前，不建议直接触发正式发布：

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

## 下一阶段

第二阶段优先做以下事情：

1. 在前端增加桌面运行时检测
2. 抽象统一文件系统接口
3. 把画布目录选择、资产读写迁移到 Tauri 原生能力
4. 为 GitHub Actions 增加可验证的桌面构建检查
