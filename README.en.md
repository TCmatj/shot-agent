# shot-agent

[中文](README.md)

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
- Open the first canvas by default with a canvas list in the sidebar
- Collapsible left sidebar
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
- Canvas project domain model
- Workflow node and edge domain operations
- Provider configuration and model mapping
- Provider management view replaces the canvas area and displays one provider per row
- Model mapping clearly separates provider model ID from mapped canonical model ID
- Prompt `@` reference parsing
- Generation history and retry rules
- Local canvas storage interfaces

## Documentation Maintenance

The Chinese main README and English README should be updated together for every future change.

## License

This project is licensed under the GNU General Public License v3.0 only. See [LICENSE](LICENSE) for details.
