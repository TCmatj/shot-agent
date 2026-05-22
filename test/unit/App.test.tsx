import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { createWorkspaceState, serializeWorkspaceState, type CanvasWorkspaceState } from '../../src/app/canvasWorkspace';

const workspaceStorageKey = 'shot-agent:canvas-workspace';

describe('App image preview', () => {
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
});
