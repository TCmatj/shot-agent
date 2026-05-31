<p align="center">
  <img src="public/shot-agent-logo.svg" alt="shot-agent logo" width="124" />
</p>

<h1 align="center">shot-agent</h1>

<p align="center">A clean infinite canvas for AI image and video workflows.</p>

<p align="center">
  <a href="README.md">中文</a>
  |
  English
  |
  <a href="#browser-build">Browser Build</a>
  |
  <a href="#desktop-build">Desktop Build</a>
  |
  <a href="#embedded-asset-upload-server">Asset Upload Server</a>
  |
  <a href="#license">License</a>
</p>

`shot-agent` provides a clean, minimal infinite canvas for visual creation. It gradually integrates mainstream image and video generation models so users can create, arrange, compare, and iterate on generated assets in one open workspace.

## Roadmap

The first phase focuses on:

- `gpt-image-2`
- `seedance2.0`
- `seedance2.0-fast`

## Current Capabilities

- React + TypeScript + Vite application scaffold.
- Black dotted infinite canvas interface.
- Node dragging, canvas panning, and zooming.
- Empty first-launch canvas state for new users.
- Canvas creation, renaming, deletion, import, and export.
- Image, video, and audio asset import and drag-in.
- Node connections, selection, deletion, and inspector configuration.
- Provider configuration, model mapping, generation history, and retry rules.
- Seedance video nodes with text, image, video, and audio reference inputs.
- Desktop builds save canvases and assets to the local `shotAgent` folder by default.
- Generated videos can be saved to the current canvas asset folder.

## Default Storage Paths

Desktop builds create and use these default folders on first launch:

- Windows: `%APPDATA%\shotAgent`
- macOS: `~/Library/Application Support/shotAgent`
- Linux: `$XDG_DATA_HOME/shotAgent`; when `XDG_DATA_HOME` is not set, this is usually `~/.local/share/shotAgent`

## Environment Setup

Recommended versions:

- `Node.js 20+`
- `npm 10+`

Desktop builds also require:

- `Rust` and `cargo`
- On macOS you can install them with:

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source ~/.cargo/env
```

Install project dependencies:

```bash
npm install
```

## Browser Build

Start local development:

```bash
npm run dev
```

Create a production browser build:

```bash
npm run build
```

Build output:

```text
dist/
```

## Desktop Build

Start desktop development:

```bash
source ~/.cargo/env
npm run desktop:dev
```

Create a desktop production build:

```bash
source ~/.cargo/env
npm run desktop:build
```

Build outputs are generated under:

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

## Embedded Asset Upload Server

The repository includes a lightweight Go service under `apps/server/`. It lets the Web build upload reference images, videos, and audio for video generation without exposing R2 credentials to users.

Service endpoints:

- `GET /health`: health check.
- `POST /api/assets/reference-upload`: accepts `file`, `canvasId`, and `nodeId` as `multipart/form-data`, uploads the file to Cloudflare R2, and returns a public URL.

Use server-side `R2_*` environment variables for secrets. Do not put these values in `VITE_*` variables:

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

Run locally:

```bash
cd apps/server
cp .env.example .env
go run .
```

Run with Docker Compose:

```bash
cp apps/server/.env.example apps/server/.env
docker compose up --build shot-agent-server
```

The frontend only needs the upload service URL:

```env
VITE_ASSET_UPLOAD_ENDPOINT=http://localhost:8787/api/assets/reference-upload
```

When `VITE_ASSET_UPLOAD_ENDPOINT` is configured, local reference assets are uploaded through this service before calling the video model. Without it, desktop or local development builds fall back to direct frontend R2 upload through `VITE_R2_*`.

## License

This project is licensed under the GNU General Public License v3.0 only. See [LICENSE](LICENSE) for details.
