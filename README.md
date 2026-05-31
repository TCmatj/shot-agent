<p align="center">
  <img src="public/shot-agent-logo.svg" alt="shot-agent logo" width="124" />
</p>

<h1 align="center">shot-agent</h1>

<p align="center">一个干净、简洁的 AI 图像与视频工作流画布。</p>

<p align="center">
  中文
  |
  <a href="README.en.md">English</a>
  |
  <a href="#浏览器版本">浏览器版本</a>
  |
  <a href="#桌面版本">桌面版本</a>
  |
  <a href="#内嵌素材上传服务">内嵌素材上传服务</a>
  |
  <a href="#许可证">许可证</a>
</p>

`shot-agent` 目标是提供一个干净、简洁的无限画布，用于视觉创作。项目会逐步接入主流图片生成模型和视频生成模型，让用户可以在一个开放工作区中创建、摆放、对比和迭代生成素材。

## 路线图

第一期重点接入：

- `gpt-image-2`
- `seedance2.0`
- `seedance2.0-fast`

## 当前能力

- React + TypeScript + Vite 应用骨架。
- 黑色格点无限画布界面。
- 节点拖拽、画布平移与缩放。
- 新用户首次打开为空画布状态。
- 画布新建、重命名、删除、导入和导出。
- 图片、视频、音频资产导入和拖入。
- 节点连线、选择、删除和配置面板。
- 供应商配置、模型映射、生成历史和重试规则。
- Seedance 视频节点支持文本、图片、视频和音频参考输入。
- 桌面端默认将画布和素材保存到本地 `shotAgent` 文件夹。
- 视频生成结果支持保存到当前画布的本地资产目录。

## 默认存储路径

桌面版首次启动时会自动创建并使用以下默认目录：

- Windows：`%APPDATA%\shotAgent`
- macOS：`~/Library/Application Support/shotAgent`
- Linux：`$XDG_DATA_HOME/shotAgent`，未设置 `XDG_DATA_HOME` 时通常为 `~/.local/share/shotAgent`

## 环境准备

建议使用：

- `Node.js 20+`
- `npm 10+`

桌面版额外需要：

- `Rust` 和 `cargo`
- macOS 可使用以下命令安装：

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source ~/.cargo/env
```

安装项目依赖：

```bash
npm install
```

## 浏览器版本

本地开发：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

构建产物输出到：

```text
dist/
```

## 桌面版本

本地开发：

```bash
source ~/.cargo/env
npm run desktop:dev
```

桌面构建：

```bash
source ~/.cargo/env
npm run desktop:build
```

构建产物位于：

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

## 内嵌素材上传服务

仓库提供一个轻量 Go 服务，路径为 `apps/server/`，用于 Web 端在不暴露 R2 密钥的情况下上传视频生成所需的参考图片、视频和音频。

服务接口：

- `GET /health`：健康检查。
- `POST /api/assets/reference-upload`：接收 `multipart/form-data` 中的 `file`、`canvasId`、`nodeId`，上传到 Cloudflare R2，并返回公网 URL。

服务端环境变量使用 `R2_*`，不要使用 `VITE_*` 保存密钥：

```env
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://assets.example.com
MAX_UPLOAD_MB=100
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

本地启动：

```bash
cd apps/server
cp .env.example .env
go run .
```

Docker Compose 启动：

```bash
cp apps/server/.env.example apps/server/.env
docker compose up --build shot-agent-server
```

前端只需要配置上传服务地址：

```env
VITE_ASSET_UPLOAD_ENDPOINT=http://localhost:8787/api/assets/reference-upload
```

配置 `VITE_ASSET_UPLOAD_ENDPOINT` 后，视频生成前的本地参考素材会先上传到该服务，再使用返回的 URL 调用视频模型。未配置该变量时，桌面或本地开发环境会回退到前端直传 R2 的 `VITE_R2_*` 配置。

## 许可证

本项目使用 GNU General Public License v3.0 only 开源协议。详情见 [LICENSE](LICENSE)。
