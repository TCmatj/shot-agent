<p align="center">
  <img src="public/shot-agent-logo.svg" alt="shot-agent logo" width="124" />
</p>

<h1 align="center">shot-agent</h1>

<p align="center">A clean infinite canvas for AI image and video workflows.</p>

<p align="center">
  <a href="README.md">简体中文</a>
  |
  English
  |
  <a href="#browser-build">Browser Build</a>
  |
  <a href="#desktop-build">Desktop Build</a>
  |
  <a href="#current-capabilities">Current Capabilities</a>
  |
  <a href="#license">License</a>
</p>

`shot-agent` aims to provide a clean, minimal infinite canvas for visual creation.

The project will gradually integrate mainstream image and video generation models, making it easy to create, arrange, compare, and iterate on generated assets in one open workspace.

## Roadmap

The first phase focuses on integrating:

- `gpt-image-2`
- `seedance2.0`
- `seedance2.0-fast`

## Current Capabilities

- React + TypeScript + Vite application scaffold
- Black dotted infinite canvas interface
- Node dragging, canvas panning, and zooming
- New users start with an empty canvas state and a canvas list in the sidebar
- Collapsible left sidebar
- Rename and delete canvases directly from the sidebar canvas list
- Small `+` create button beside the canvas list title
- Canvases can all be deleted, showing an empty state afterward
- Create, rename, delete, import, and export canvases
- Rename the canvas inline from the pencil button beside the canvas title
- In-canvas left floating tools for creating, exporting, and importing canvases
- Add nodes from the in-canvas `+` button or context menu
- Create and connect a new node by dropping an edge on empty canvas space
- Text, image, and video asset nodes that act as output-only nodes
- Image assets can be imported, dropped, or pasted into the canvas
- Video assets can be imported or dropped into the canvas
- Create canvas node edges by dragging node connection handles
- Delete an edge after selecting it
- Inspect selected node details and configuration entry points
- Delete selected nodes or edges with `Delete` / `Backspace`
- Save the canvas list, active canvas, and node positions locally in the browser
- Desktop builds save canvases and assets to the `shotAgent` folder under the system app data directory by default
- Configure a custom canvas storage folder, with direct folder picking when the browser supports it
- Canvas project domain model
- Workflow node and edge domain operations
- Provider configuration and model mapping
- Provider management view replaces the canvas area and displays one provider per row
- Model mapping clearly separates provider model ID from mapped canonical model ID
- Providers can be deleted and fully removed from configuration
- Prompt `@` reference parsing
- Generation history and retry rules
- Local canvas storage interfaces

## Default Storage Paths

Desktop builds create and use these default folders on first launch:

- Windows: `%APPDATA%\shotAgent`
- macOS: `~/Library/Application Support/shotAgent`
- Linux: `$XDG_DATA_HOME/shotAgent`; when `XDG_DATA_HOME` is not set, this is usually `~/.local/share/shotAgent`

## Design Direction

- Black-first visual language with dotted canvas texture
- One workspace for image, video, chat, and asset nodes
- Dual runtime support for browser and desktop
- Provider management, model mapping, and local workspace files

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

This starts the Vite development server. Open the local URL shown in the terminal.

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

This starts the frontend dev server and launches the Tauri desktop window.

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

For local installation on macOS, you can open:

```text
src-tauri/target/release/bundle/macos/shot-agent.app
```

If a DMG is generated, it can also be distributed from `bundle/dmg/`.

## License

This project is licensed under the GNU General Public License v3.0 only. See [LICENSE](LICENSE) for details.
