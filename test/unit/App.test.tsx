import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import {
  createCanvasEdge,
  createWorkspaceState,
  serializeWorkspaceState,
  type CanvasWorkspaceState,
} from '../../src/app/canvasWorkspace';

const workspaceStorageKey = 'shot-agent:canvas-workspace';

describe('App image preview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'PointerEvent',
      class PointerEvent extends MouseEvent {
        pointerId: number;

        constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
        }
      },
    );

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('opens the shared image preview modal when a node image is double-clicked', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_images',
          name: '图片画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'asset_1',
              title: '素材图',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'image_1',
              title: '生成图',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 360,
              y: 0,
              outputDataUrl: 'data:image/png;base64,b3V0cHV0',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));
    expect(document.querySelector('.prompt-reference-image-modal img')?.getAttribute('src')).toBe(
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();

    fireEvent.pointerDown(document.querySelector('.prompt-reference-image-backdrop')!);

    fireEvent.doubleClick(await screen.findByAltText('生成图 输出'));
    expect(document.querySelector('.prompt-reference-image-modal img')?.getAttribute('src')).toBe(
      'data:image/png;base64,b3V0cHV0',
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });
});

describe('App video node inspector', () => {
  beforeEach(() => {
    window.localStorage.clear();

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('shows scene preset controls for video nodes', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));

    expect(screen.getByLabelText('类型')).toBeTruthy();
    expect(screen.queryByText('节点名称')).toBeNull();
    expect(screen.getAllByText('模式').length).toBeGreaterThan(0);
  });

  it('does not show 1080p for seedance2.0-fast', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));
    await userEvent.selectOptions(screen.getByLabelText('模型'), 'seedance2.0-fast');

    expect(screen.queryByRole('option', { name: '1080p' })).toBeNull();
  });

  it('renders estimated and settled token usage for video nodes', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));

    expect(screen.getByText(/预计消耗：/)).toBeTruthy();
    expect(screen.getByText(/实际消耗：等待官方结算/)).toBeTruthy();
  });

  it('renders inline editable duration and fps inputs with datalist options', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));

    const durationInput = screen.getByLabelText('时长');
    const fpsInput = screen.getByLabelText('帧率');

    expect(durationInput.getAttribute('list')).toBe('video-duration-options');
    expect(fpsInput.getAttribute('list')).toBe('video-fps-options');
  });

  it('shows role-based input ports for first-last-frame mode', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));
    await userEvent.selectOptions(screen.getByLabelText('类型'), 'image_to_video_first_last_frame');

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('尾帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });

  it('shows multimodal prompt guidance for text, image, video, and audio references', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));
    await userEvent.selectOptions(screen.getByLabelText('类型'), 'multimodal_reference_video');

    expect(
      screen.getByText(
        '多模态参考视频模式下，连线用于提供可引用的参考素材范围；提示词中使用 @文本 / @图片 / @视频 / @音频 引用到的内容才会参与本次请求上传。',
      ),
    ).toBeTruthy();

    const videoPromptEditor = document.querySelector(
      '.canvas-node-video .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(videoPromptEditor?.dataset.placeholder).toBe(
      '输入提示词，支持 @文本 / @图片 / @视频 / @音频；连线仅提供可引用范围，只有提示词中引用的图片、视频和音频才会上传',
    );
  });

  it('keeps the selected scenario after clearing incompatible edges', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_mode',
          name: '视频模式画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_asset_1',
              title: '图片素材',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 320,
              y: 0,
              seedanceScenario: 'image_to_video_first_last_frame',
            },
          ],
          edges: [createCanvasEdge('image_asset_1', 'video_1', 'first_frame_image')],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await userEvent.click(await screen.findByText('视频生成'));

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText('类型'), 'text_to_video');

    expect((screen.getByLabelText('类型') as HTMLSelectElement).value).toBe('text_to_video');
    expect(within(videoNode!).queryByText('首帧图')).toBeNull();
    expect(within(videoNode!).queryByText('尾帧图')).toBeNull();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });
});

describe('App canvas dragging', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    vi.stubGlobal(
      'PointerEvent',
      class PointerEvent extends MouseEvent {
        pointerId: number;

        constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
        }
      },
    );

    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('applies node drag deltas from the latest pointer position inside a single batch', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_drag',
          name: '拖动画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_text_1',
              title: '文本节点',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 0,
              y: 0,
              textContent: '拖动测试',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const header = container.querySelector('.canvas-node header') as HTMLElement | null;
    const node = container.querySelector('.canvas-node') as HTMLElement | null;

    expect(canvas).toBeTruthy();
    expect(header).toBeTruthy();
    expect(node).toBeTruthy();

    act(() => {
      fireEvent.pointerDown(header!, {
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      canvas!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          clientX: 110,
          clientY: 100,
        }),
      );
      canvas!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          clientX: 120,
          clientY: 100,
        }),
      );
      canvas!.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 1,
          clientX: 120,
          clientY: 100,
        }),
      );
    });

    expect(node!.style.transform).toContain('translate(20px, 0px)');
  });
});
