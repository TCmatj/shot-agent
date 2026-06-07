import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import * as generationClient from '../../src/models/generationClient';
import {
  createCanvasEdge,
  createWorkspaceState,
  serializeWorkspaceState,
  type CanvasWorkspaceState,
} from '../../src/app/canvasWorkspace';

const workspaceStorageKey = 'shot-agent:canvas-workspace';
const providerStorageKey = 'shot-agent:providers';

function createDefaultVideoWorkspaceState(): CanvasWorkspaceState {
  return {
    ...createWorkspaceState([
      {
        id: 'canvas_default_video',
        name: '默认画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_video_1',
            title: '视频生成',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 520,
            y: 240,
          },
        ],
        edges: [],
      },
    ]),
  };
}

function seedDefaultVideoWorkspace() {
  window.localStorage.setItem(
    workspaceStorageKey,
    serializeWorkspaceState(createDefaultVideoWorkspaceState()),
  );
}

async function openNodeInspectorByTitle(title: string) {
  const headings = await screen.findAllByRole('heading', { name: title });
  const canvasHeading = headings.find((heading) => heading.closest('article'));

  expect(canvasHeading).toBeTruthy();

  const nodeCard = canvasHeading!.closest('article');
  expect(nodeCard).toBeTruthy();

  await userEvent.click(within(nodeCard!).getByRole('button', { name: '打开节点配置' }));
  return nodeCard!;
}

async function chooseInlineOption(
  ariaLabel: string,
  optionLabel: string | RegExp,
  scope: Pick<typeof screen, 'getByRole'> = screen,
) {
  await userEvent.click(scope.getByRole('button', { name: ariaLabel }));
  const listbox = screen.getByRole('listbox', { name: ariaLabel });
  await userEvent.click(within(listbox).getByRole('option', { name: optionLabel }));
}

async function openOutputEditorByTitle(title: string) {
  const headings = await screen.findAllByRole('heading', { name: title });
  const canvasHeading = headings.find((heading) => heading.closest('article'));

  expect(canvasHeading).toBeTruthy();

  const nodeCard = canvasHeading!.closest('article');
  expect(nodeCard).toBeTruthy();

  await userEvent.click(within(nodeCard!).getByRole('button', { name: '查看 / 编辑完整输出' }));
}

function setPromptEditorValue(editor: HTMLDivElement, value: string) {
  editor.focus();
  editor.textContent = value;

  const selection = window.getSelection();
  const range = document.createRange();
  if (editor.firstChild) {
    range.setStart(editor.firstChild, value.length);
  } else {
    range.selectNodeContents(editor);
  }
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

  fireEvent.input(editor);
}

describe('App image preview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('keeps asset panel wheel events scrollable inside the canvas', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '资产' }));

    const assetPanel = document.querySelector('.canvas-asset-sidebar');
    expect(assetPanel).toBeTruthy();

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });

    assetPanel!.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
  });

  it('keeps node inspector wheel events inside the inspector instead of zooming the canvas', async () => {
    seedDefaultVideoWorkspace();
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });

    inspector!.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(screen.getByText('100%')).toBeTruthy();
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

  it('supports zooming the preview image with wheel and toolbar controls', async () => {
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
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));

    const zoomOutButton = screen.getByRole('button', { name: '缩小图片' });
    const zoomInButton = screen.getByRole('button', { name: '放大图片' });
    const resetZoomButton = screen.getByRole('button', { name: '重置图片缩放' });
    const previewStage = document.querySelector('.prompt-reference-image-stage') as HTMLDivElement;
    const previewImage = document.querySelector('.prompt-reference-image-preview') as HTMLImageElement;
    vi.spyOn(previewStage, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(previewStage, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(previewStage, 'clientHeight', { configurable: true, value: 300 });
    previewStage.scrollLeft = 20;
    previewStage.scrollTop = 10;

    expect(screen.getByRole('button', { name: '当前缩放 100%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('100%');

    fireEvent.wheel(previewStage, { deltaY: -48, clientX: 100, clientY: 50 });
    expect(screen.getByRole('button', { name: '当前缩放 110%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('110%');
    expect(previewStage.scrollLeft).toBe(32);
    expect(previewStage.scrollTop).toBe(16);

    await userEvent.click(zoomInButton);
    expect(screen.getByRole('button', { name: '当前缩放 120%' })).toBeTruthy();

    await userEvent.click(zoomOutButton);
    expect(screen.getByRole('button', { name: '当前缩放 110%' })).toBeTruthy();

    for (let index = 0; index < 60; index += 1) {
      fireEvent.wheel(previewStage!, { deltaY: -48 });
    }
    expect(screen.getByRole('button', { name: '当前缩放 500%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('500%');

    for (let index = 0; index < 80; index += 1) {
      fireEvent.wheel(previewStage!, { deltaY: 48 });
    }
    expect(screen.getByRole('button', { name: '当前缩放 50%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('50%');

    await userEvent.click(resetZoomButton);
    expect(screen.getByRole('button', { name: '当前缩放 100%' })).toBeTruthy();
    expect(previewImage.style.width).toBe('100%');
  });

  it('supports dragging a zoomed image and requesting fullscreen preview', async () => {
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
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    fireEvent.doubleClick(await screen.findByAltText('input.png'));

    const previewStage = document.querySelector('.prompt-reference-image-stage') as HTMLDivElement;
    Object.defineProperty(previewStage, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(previewStage, 'clientHeight', { configurable: true, value: 300 });

    await userEvent.click(screen.getByRole('button', { name: '放大图片' }));
    await userEvent.click(screen.getByRole('button', { name: '放大图片' }));

    previewStage.scrollLeft = 120;
    previewStage.scrollTop = 80;

    fireEvent.pointerDown(previewStage, { pointerId: 1, button: 0, clientX: 120, clientY: 80 });
    fireEvent.pointerMove(previewStage, { pointerId: 1, clientX: 90, clientY: 60 });

    expect(previewStage.scrollLeft).toBe(150);
    expect(previewStage.scrollTop).toBe(100);

    fireEvent.pointerUp(previewStage, { pointerId: 1, clientX: 90, clientY: 60 });

    await userEvent.click(screen.getByRole('button', { name: '全屏查看图片' }));
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalled();
  });

  it('shows succeeded video generation history in provider manager for volcengine providers', async () => {
    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_seedance',
          name: '火山方舟',
          protocol: 'volcengine',
          baseURL: 'https://ark.cn-beijing.volces.com',
          apiTokenRef: 'sk-test-seedance',
          enabled: true,
          models: [
            {
              providerModelId: 'doubao-seedance-2-0-260128',
              canonicalModelId: 'seedance2.0',
              enabled: true,
            },
          ],
        },
      ]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            total: 1,
            tasks: [
              {
                id: 'task_history_1',
                model: 'doubao-seedance-2-0-260128',
                status: 'succeeded',
                created_at: 1_717_799_003,
                updated_at: 1_717_799_123,
                content: {
                  video_url: 'https://example.com/history.mp4',
                  last_frame_url: 'https://example.com/history.png',
                },
                usage: {
                  completion_tokens: 3456,
                },
                ratio: '16:9',
                duration: 5,
              },
            ],
          },
        }),
      }),
    );

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '供应商管理' }));

    expect(await screen.findByText('视频生成历史')).toBeTruthy();
    expect(await screen.findByText('共 1 条成功任务')).toBeTruthy();
    expect(await screen.findByText(/task_history_1/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '打开视频' }).getAttribute('href')).toBe(
      'https://example.com/history.mp4',
    );
    expect(screen.getByText('第 1 / 1 页')).toBeTruthy();
  });
});

describe('App object storage settings', () => {
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
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it('does not show Cloudflare configuration in the application UI', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /供应商管理/ }));

    expect(screen.queryByRole('button', { name: /Cloudflare/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Cloudflare/ })).toBeNull();
    expect(screen.queryByLabelText(/Bucket/)).toBeNull();
  });
});

describe('App empty startup', () => {
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

  it('starts without a default canvas for new users', () => {
    render(<App />);

    expect(screen.getAllByText('暂无画布').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /新建画布/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('默认画布')).toBeNull();
  });

  it('removes legacy starter canvases from stored browser state', () => {
    const state = createWorkspaceState([
      {
        id: 'canvas_default',
        name: '默认画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_image',
            title: '图片生成',
            modelId: 'gpt-image-2',
            kind: 'image',
            x: 0,
            y: 0,
          },
          {
            id: 'node_video',
            title: '视频生成',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 360,
            y: 0,
          },
          {
            id: 'node_chat',
            title: '文本生成',
            modelId: 'gpt-4o-mini',
            kind: 'chat',
            x: 720,
            y: 0,
          },
        ],
        edges: [],
      },
      {
        id: 'canvas_product',
        name: '产品短片',
        updatedAt: '示例',
        nodes: [],
        edges: [],
      },
      {
        id: 'canvas_user',
        name: '用户画布',
        updatedAt: 'now',
        nodes: [],
        edges: [],
      },
    ]);

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    expect(screen.queryByText('默认画布')).toBeNull();
    expect(screen.queryByText('产品短片')).toBeNull();
    expect(screen.getAllByText('用户画布').length).toBeGreaterThan(0);
  });
});

describe('App diamond mask node', () => {
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

  it('guides the user to connect a storage folder before selecting a mask image', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_mask',
          name: '遮罩画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_mask',
              title: '菱形遮罩',
              modelId: 'diamond-mask',
              kind: 'diamondMask',
              x: 0,
              y: 0,
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const nodeCard = (await screen.findAllByRole('heading', { name: '菱形遮罩' }))[0].closest('article');
    expect(nodeCard).toBeTruthy();
    expect(within(nodeCard!).getByText('请先选择画布存储文件夹，再导入或选择遮罩图片。')).toBeTruthy();

    const chooseImageButton = within(nodeCard!).getByRole('button', { name: '选择图片' });
    const chooseAssetButton = within(nodeCard!).getByRole('button', { name: '选择资产' });

    expect(chooseImageButton.getAttribute('aria-disabled')).toBe('true');
    expect(chooseAssetButton.getAttribute('aria-disabled')).toBe('true');

    await userEvent.click(chooseImageButton);
    expect(document.querySelector('.canvas-message')?.textContent).toBe(
      '请先选择画布存储文件夹，再导入或选择遮罩图片。',
    );
  });

  it('uses 1px as the default line width for a new diamond mask node', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_mask_default',
          name: '遮罩画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_mask_default',
              title: '菱形遮罩',
              modelId: 'diamond-mask',
              kind: 'diamondMask',
              x: 0,
              y: 0,
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const nodeCard = (await screen.findAllByRole('heading', { name: '菱形遮罩' }))[0].closest('article');
    expect(nodeCard).toBeTruthy();
    expect(within(nodeCard!).getByText('1px')).toBeTruthy();
  });
});

describe('App video node inspector', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_ASSET_UPLOAD_ENDPOINT', '');
    vi.stubEnv('VITE_R2_ACCOUNT_ID', '');
    vi.stubEnv('VITE_R2_BUCKET_NAME', '');
    vi.stubEnv('VITE_R2_ACCESS_KEY_ID', '');
    vi.stubEnv('VITE_R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('VITE_R2_ENDPOINT', '');
    vi.stubEnv('VITE_R2_PUBLIC_BASE_URL', '');
    window.localStorage.clear();
    seedDefaultVideoWorkspace();

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

    await openNodeInspectorByTitle('视频生成');
    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    const inspectorQueries = within(inspector as HTMLElement);

    expect(inspectorQueries.getByRole('button', { name: '类型' })).toBeTruthy();
    expect(screen.queryByText('节点名称')).toBeNull();
    expect(inspectorQueries.getByText(/文生视频模式仅读取提示词内容/)).toBeTruthy();
  });

  it('does not show 1080p for seedance2.0-fast', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_fast',
          name: '默认画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_video_1',
              title: '视频生成',
              modelId: 'seedance2.0-fast',
              kind: 'video',
              x: 520,
              y: 240,
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await userEvent.click(screen.getByRole('button', { name: '分辨率' }));

    expect(screen.queryByRole('option', { name: '1080p' })).toBeNull();
  });

  it('renders estimated and settled token usage for video nodes', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    expect(screen.getByText(/预计消耗：/)).toBeTruthy();
    expect(screen.getByText(/实际消耗：等待官方结算/)).toBeTruthy();
  });

  it('renders duration slider, auto-duration toggle, ratio options, and fixed fps', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationInput = screen.getByLabelText('时长');
    const autoDurationToggle = screen.getByLabelText('自动时长') as HTMLInputElement;

    expect(durationInput.getAttribute('type')).toBe('range');
    expect(durationInput.className).toContain('video-duration-range');
    expect(durationInput.getAttribute('min')).toBe('4');
    expect(durationInput.getAttribute('max')).toBe('15');
    expect(durationInput.getAttribute('step')).toBe('1');
    expect(autoDurationToggle.checked).toBe(false);
    expect(autoDurationToggle.getAttribute('title')).toBe('自动时长');
    expect(screen.queryByText('自动时长')).toBeNull();
    expect(screen.queryByText('4s')).toBeNull();
    expect(screen.queryByText('15s')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '比例' }));
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.textContent?.trim()),
    ).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);
    await userEvent.click(screen.getByRole('option', { name: '16:9' }));
    expect(screen.getByLabelText('帧率 24fps（官方固定）')).toBeTruthy();
  });

  it('keeps the duration label and current value on one line without slider edge markers', async () => {
    const { container } = render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationRow = container.querySelector('.video-duration-row') as HTMLDivElement | null;
    const durationLabel = container.querySelector(
      '.video-duration-label',
    ) as HTMLLabelElement | null;

    expect(durationRow).toBeTruthy();
    expect(durationLabel).toBeTruthy();
    expect(screen.queryByText('15s')).toBeNull();
    expect(durationRow?.textContent).toContain('时长');
    expect(durationRow?.textContent).toContain('5s');
  });

  it('disables the duration slider when auto duration is enabled', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    const durationInput = screen.getByLabelText('时长') as HTMLInputElement;
    const autoDurationToggle = screen.getByLabelText('自动时长') as HTMLInputElement;

    expect(durationInput.disabled).toBe(false);
    await userEvent.click(autoDurationToggle);
    expect(autoDurationToggle.checked).toBe(true);
    expect(durationInput.disabled).toBe(true);
  });

  it('shows selected video settings on the node card outside the inspector', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_meta',
          name: '视频参数画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              videoResolution: '1080p',
              videoRatio: '21:9',
              videoDurationSeconds: -1,
              videoFramesPerSecond: 24,
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    const videoNode = screen.getByRole('heading', { name: '视频生成' }).closest('article');

    expect(videoNode).toBeTruthy();
    const videoQueries = within(videoNode!);
    expect(videoQueries.getByRole('button', { name: '节点分辨率' }).textContent).toContain('1080p');
    expect(videoQueries.getByRole('button', { name: '节点比例' }).textContent).toContain('21:9');
    expect(videoQueries.getByText(/Auto 时长/)).toBeTruthy();
    expect(videoNode?.querySelector('.node-inline-readonly-field strong')?.textContent).toBe('24fps');
    expect(videoNode?.querySelector('.node-model-summary')?.textContent).toContain('1080p');
  });

  it('shows saved video storage status on the node card and in the inspector', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_storage',
          name: '视频存储画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              outputUrl: 'https://example.com/video.mp4',
              outputPath: 'assets/videos/task_1.mp4',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    expect(screen.getByText('已保存到本地')).toBeTruthy();

    await openNodeInspectorByTitle('视频生成');
    expect(screen.getByText('保存状态：已保存到本地 · assets/videos/task_1.mp4')).toBeTruthy();
  });

  it('shows the submitted Seedance generation id below the generate button', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_video_generation_id',
          name: '视频生成 ID 画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'video_1',
              title: '视频生成',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 0,
              y: 0,
              generationId: 'task_1',
              generationStatus: 'running',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const videoNode = screen.getByRole('heading', { name: '视频生成' }).closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('生成ID：task_1')).toBeTruthy();
  });

  it('shows role-based input ports for first-last-frame mode', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await chooseInlineOption('类型', '首尾帧图生视频');

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('尾帧图')).toBeTruthy();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });

  it('shows multimodal prompt guidance for text, image, video, and audio references', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');
    await chooseInlineOption('类型', '多模态参考视频');

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

    await openNodeInspectorByTitle('视频生成');

    const videoNode = screen.getAllByRole('heading', { name: '视频生成' })[0].closest('article');
    expect(videoNode).toBeTruthy();
    expect(within(videoNode!).getByText('首帧图')).toBeTruthy();

    await chooseInlineOption('类型', '文生视频');

    expect(screen.getByRole('button', { name: '类型' }).textContent).toContain('文生视频');
    expect(within(videoNode!).queryByText('首帧图')).toBeNull();
    expect(within(videoNode!).queryByText('尾帧图')).toBeNull();
    expect(within(videoNode!).getByText('文本')).toBeTruthy();
  });

  it('opens inspector only from the config button instead of clicking the node body', async () => {
    render(<App />);

    const headings = await screen.findAllByRole('heading', { name: '视频生成' });
    const canvasHeading = headings.find((heading) => heading.closest('article'));
    expect(canvasHeading).toBeTruthy();

    await userEvent.click(canvasHeading!);
    expect(document.querySelector('.node-inspector')).toBeNull();

    const card = canvasHeading!.closest('article');
    expect(card).toBeTruthy();
    await userEvent.click(within(card!).getByRole('button', { name: '打开节点配置' }));

    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    expect(within(inspector as HTMLElement).getByRole('button', { name: '类型' })).toBeTruthy();
  });

  it('defaults to multimodal mode when creating a Seedance node from an image connection', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_add_video',
          name: '新增视频节点',
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
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const imageNode = screen.getByRole('heading', { name: '图片素材' }).closest('article');

    expect(canvas).toBeTruthy();
    expect(imageNode).toBeTruthy();

    fireEvent.pointerDown(within(imageNode!).getByRole('button', { name: '从此节点连线' }), {
      button: 0,
      pointerId: 1,
      clientX: 180,
      clientY: 120,
    });
    fireEvent.pointerMove(canvas!, {
      pointerId: 1,
      clientX: 360,
      clientY: 180,
    });
    fireEvent.pointerUp(canvas!, {
      pointerId: 1,
      clientX: 360,
      clientY: 180,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));
    await openNodeInspectorByTitle('视频生成');

    expect(screen.getByRole('button', { name: '类型' }).textContent).toContain('多模态参考视频');
  });

  it('ignores edge draft pointer moves from a different pointer id', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_edge_pointer',
          name: 'Edge pointer canvas',
          updatedAt: 'now',
          nodes: [
            {
              id: 'image_asset_1',
              title: 'Image asset',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 0,
              assetName: 'input.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const edgeHandle = container.querySelector('.edge-handle-output') as HTMLButtonElement | null;

    expect(canvas).toBeTruthy();
    expect(edgeHandle).toBeTruthy();

    fireEvent.pointerDown(edgeHandle!, {
      button: 0,
      pointerId: 1,
      clientX: 180,
      clientY: 120,
    });

    const initialDraft = container.querySelector('.edge-draft')?.getAttribute('d');
    expect(initialDraft).toBeTruthy();

    fireEvent.pointerMove(canvas!, {
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });

    expect(container.querySelector('.edge-draft')?.getAttribute('d')).toBe(initialDraft);

    fireEvent.pointerMove(canvas!, {
      pointerId: 1,
      clientX: 360,
      clientY: 180,
    });

    expect(container.querySelector('.edge-draft')?.getAttribute('d')).not.toBe(initialDraft);
  });

  it('hides Seedance-Sora from the model dropdown when object storage is not configured', async () => {
    render(<App />);

    await openNodeInspectorByTitle('视频生成');

    expect(screen.queryByRole('option', { name: 'seedance-sora' })).toBeNull();
    expect(screen.queryByText(/当前模型使用 Sora 格式调用/)).toBeNull();
  });

  it('selects Seedance-Sora from the Seedance video node model dropdown when object storage is configured', async () => {
    vi.stubEnv('VITE_ASSET_UPLOAD_ENDPOINT', 'http://localhost:8787/api/assets/reference-upload');
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    expect(screen.queryByRole('button', { name: 'seedance-sora' })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));

    expect(screen.getByRole('heading', { name: '视频生成' })).toBeTruthy();
    await openNodeInspectorByTitle('视频生成');
    expect(screen.getByRole('button', { name: '模型调用格式' })).toBeTruthy();
    await chooseInlineOption('模型调用格式', 'sora');
    expect(screen.getByRole('button', { name: '模型调用格式' }).textContent).toContain('sora');
    expect(screen.getByRole('button', { name: '比例' }).textContent).toContain('16:9');
    const durationInput = screen.getByLabelText('时长');
    expect(durationInput.getAttribute('min')).toBe('4');
    expect(durationInput.getAttribute('max')).toBe('15');
    expect(screen.getByLabelText('自动时长')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '比例' }));
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.textContent?.trim()),
    ).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);
    await userEvent.click(screen.getByRole('option', { name: '16:9' }));
    expect(screen.queryByText('预计消耗：0 tokens（本地预估）')).toBeNull();
    expect(screen.getByText(/当前节点会按 sora 调用格式提交/)).toBeTruthy();
  });

  it('creates a story node from the add menu and shows story-specific prompt guidance', async () => {
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));

    expect(screen.getByRole('heading', { name: '故事拆解' })).toBeTruthy();
    const storyHeadings = screen.getAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    await openNodeInspectorByTitle('故事拆解');

    const promptEditor = screen.getByLabelText('提示词');
    expect(promptEditor.getAttribute('data-placeholder')).toContain(
      '支持 @文本 / @图片 引用已连线的上游资产',
    );
    expect(screen.getByRole('button', { name: '调用格式' })).toBeTruthy();
    expect(storyNodeCardQueries.getByRole('button', { name: '执行方式' }).textContent).toContain('仅拆解');
    expect(screen.getByRole('button', { name: '展开级别' }).textContent).toContain('展开全部节点');
    expect(screen.getByLabelText('结构化摘要')).toBeTruthy();
    expect(screen.getByLabelText('原始结构化结果')).toBeTruthy();
  });

  it('defaults new image and video nodes to 16:9 presets and shows concrete provider selections on the node card', async () => {
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: 'gpt-image-2 生成节点' }));

    const imageHeading = await screen.findByRole('heading', { name: '图片生成' });
    const imageNodeCard = imageHeading.closest('article');
    expect(imageNodeCard).toBeTruthy();
    expect(within(imageNodeCard!).getByRole('button', { name: '图片分辨率' }).textContent).toContain('1K');
    expect(within(imageNodeCard!).getByRole('button', { name: '图片比例' }).textContent).toContain('16:9');
    expect(within(imageNodeCard!).getByRole('button', { name: '图片质量' }).textContent).toContain('High');
    expect(within(imageNodeCard!).getByRole('button', { name: '供应商' }).textContent).not.toContain('自动选择');
    expect(within(imageNodeCard!).getByRole('button', { name: '供应商模型' }).textContent).not.toContain('自动选择');

    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));

    const videoHeadings = screen.getAllByRole('heading', { name: '视频生成' });
    const videoNodeCard = videoHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(videoNodeCard).toBeTruthy();
    expect(within(videoNodeCard!).getByRole('button', { name: '节点类型' }).textContent).toContain('首尾帧图生视频');
    expect(within(videoNodeCard!).getByRole('button', { name: '节点模型调用格式' }).textContent).toContain('seedance');
    expect(within(videoNodeCard!).getByRole('button', { name: '节点分辨率' }).textContent).toContain('480p');
    expect(within(videoNodeCard!).getByRole('button', { name: '节点比例' }).textContent).toContain('16:9');
    expect(within(videoNodeCard!).getByRole('button', { name: '供应商' }).textContent).not.toContain('自动选择');
    expect(within(videoNodeCard!).getByRole('button', { name: '供应商模型' }).textContent).not.toContain('自动选择');
  });

  it('updates image and video parameters directly from the node card', async () => {
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: 'gpt-image-2 生成节点' }));
    const imageNodeCard = (await screen.findByRole('heading', { name: '图片生成' })).closest('article');
    expect(imageNodeCard).toBeTruthy();
    const imageQueries = within(imageNodeCard!);

    await chooseInlineOption('图片分辨率', '2K', imageQueries);
    await chooseInlineOption('图片比例', /^1:1/, imageQueries);
    await chooseInlineOption('图片质量', 'Medium', imageQueries);
    expect(imageQueries.getByRole('button', { name: '图片分辨率' }).textContent).toContain('2K');
    expect(imageQueries.getByRole('button', { name: '图片比例' }).textContent).toContain('1:1');
    expect(imageQueries.getByRole('button', { name: '图片质量' }).textContent).toContain('Medium');

    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: 'seedance2.0 生成节点' }));
    const videoHeadings = screen.getAllByRole('heading', { name: '视频生成' });
    const videoNodeCard = videoHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(videoNodeCard).toBeTruthy();
    const videoQueries = within(videoNodeCard!);

    await chooseInlineOption('节点类型', '文生视频', videoQueries);
    await chooseInlineOption('节点分辨率', '720p', videoQueries);
    await chooseInlineOption('节点比例', '21:9', videoQueries);
    expect(videoQueries.getByRole('button', { name: '节点类型' }).textContent).toContain('文生视频');
    expect(videoQueries.getByRole('button', { name: '节点分辨率' }).textContent).toContain('720p');
    expect(videoQueries.getByRole('button', { name: '节点比例' }).textContent).toContain('21:9');
  });

  it('shows provider and provider model selects on chat node cards without auto options', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_chat_provider_card',
          name: '对话节点画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'chat_provider_card_1',
              title: '提示词整理',
              modelId: 'gpt-5.4-mini',
              kind: 'chat',
              x: 160,
              y: 120,
              prompt: '整理一下提示词',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const chatHeading = await screen.findByRole('heading', { name: '提示词整理' });
    const chatNodeCard = chatHeading.closest('article');
    expect(chatNodeCard).toBeTruthy();
    expect(within(chatNodeCard!).getByRole('button', { name: '供应商' }).textContent).not.toContain('自动选择');
    expect(within(chatNodeCard!).getByRole('button', { name: '供应商模型' }).textContent).not.toContain('自动选择');
  });

  it('expands structured story output into downstream nodes after generation', async () => {
    const storyOutput = JSON.stringify({
      version: 1,
      storySummary: '一个无厘头但可拍摄的短故事',
      styleNotes: ['黑色幽默', '商业广告质感'],
      globalAssets: {
        scenePrompts: [
          {
            id: 'scene_1',
            title: '商场中庭',
            prompt: '现代商场中庭，玻璃穹顶，自然光混合广告灯箱光，黑色幽默广告片质感。',
          },
        ],
        characterSheetPrompts: [
          {
            id: 'character_1',
            title: '主角角色板',
            prompt: '25岁男性，夸张惊讶表情，四视图角色板，服装细节完整。',
          },
        ],
        propSheetPrompts: [
          {
            id: 'prop_1',
            title: '菠萝蜜果茶',
            prompt: '白底产品图，多角度展示透明杯、标签与果肉细节。',
          },
        ],
      },
      narrativeSegments: [
        {
          id: 'segment_1',
          title: '第一段',
          durationSeconds: 6,
          openingTransition: {
            type: 'hard_cut',
            description: '从上一个段落直接切入主角特写',
            durationSeconds: 0.2,
          },
          prompt:
            '第一人称短片，主角在商场中庭举起一杯夸张巨大的菠萝蜜果茶，镜头快速推进，强调荒诞喜剧与高级商业广告质感。',
          atmosphere: '夸张、明亮、节奏快速',
          bgm: '轻快电子加打击乐',
          shots: [
            {
              id: 'shot_1',
              title: '举杯开场',
              durationSeconds: 2.4,
              characters: ['主角'],
              cameraMotion: '快速推进',
              action: '主角把果茶举到镜头前',
              dialogue: '今天就喝这个。',
              dialoguePacing: '短促有力',
              atmosphere: '兴奋',
              bgm: '鼓点起',
              transitionToNext: {
                type: 'camera_follow',
                description: '镜头跟随杯子下移到桌面',
                durationSeconds: 0.3,
              },
            },
          ],
          firstFramePrompt: {
            id: 'first_1',
            title: '首帧',
            prompt: '主角手举果茶，商场中庭背景，广告摄影质感，高清首帧。',
          },
          lastFramePrompt: {
            id: 'last_1',
            title: '尾帧',
            prompt: '果茶停留在画面中央，标签清晰，尾帧定格。',
          },
          motionSketchPrompt: {
            id: 'motion_1',
            title: '运镜草图',
            prompt: '简笔画分镜，标明推进和跟随路径。',
          },
          continuityNotes: ['保持主角服装一致', '杯子标签始终朝向镜头'],
        },
      ],
    });

    vi.spyOn(generationClient, 'streamChatGenerationNode').mockImplementation(async (input) => {
      input.onDelta(storyOutput, storyOutput);
      return {
        ok: true,
        output: {
          kind: 'text',
          text: storyOutput,
          rawResponse: {},
        },
      };
    });

    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_openai_story',
          name: 'OpenAI',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-story',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));
    await openNodeInspectorByTitle('故事拆解');
    const storyHeadings = screen.getAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    await chooseInlineOption('执行方式', '拆解并铺节点', storyNodeCardQueries);
    await chooseInlineOption('展开级别', '展开全部节点', screen);

    const promptEditor = screen.getByLabelText('节点提示词') as HTMLDivElement;
    setPromptEditorValue(promptEditor, '生成一个无厘头的故事，之后进行拆解。');
    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '场景图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '角色板' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '物品图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 尾帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 运镜简笔画' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(screen.getByText('已从故事节点生成 9 个下游节点。')).toBeTruthy();
  });

  it('shows a structured story summary panel in the inspector', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_summary',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_summary_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyStructuredOutput: {
                version: 1,
                storySummary: '荒诞商场果茶广告故事',
                styleNotes: ['广告质感', '轻喜剧'],
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '商场中庭', prompt: '商场中庭提示词' }],
                  characterSheetPrompts: [{ id: 'character_1', title: '主角角色板', prompt: '角色板提示词' }],
                  propSheetPrompts: [{ id: 'prop_1', title: '果茶道具', prompt: '道具提示词' }],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 6,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2.4,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
                    continuityNotes: ['保持服装一致'],
                  },
                ],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('故事拆解');

    expect(screen.getByText('结构概览')).toBeTruthy();
    expect(screen.getByText('全局资产')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('叙事段落')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('预计总时长')).toBeTruthy();
    expect(screen.getAllByText('6 秒').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('第一段')).toBeTruthy();
    expect(screen.getByText('1 个分镜')).toBeTruthy();
    expect(screen.getByText('广告质感')).toBeTruthy();
    expect(screen.getByText('叙事段落提示词')).toBeTruthy();
    expect(screen.getByText('第一段视频提示词')).toBeTruthy();
    expect(screen.getByText('首帧图')).toBeTruthy();
    expect(screen.getByText('首帧提示词')).toBeTruthy();
    expect(screen.getByText('尾帧图')).toBeTruthy();
    expect(screen.getByText('尾帧提示词')).toBeTruthy();
    expect(screen.getByText('运镜简笔画')).toBeTruthy();
    expect(screen.getByText('运镜提示词')).toBeTruthy();
    expect(screen.getByText('分镜详情')).toBeTruthy();
    expect(screen.getByText('运镜：推进')).toBeTruthy();
    expect(screen.getByText('动作：举杯')).toBeTruthy();
    expect(screen.getByText('连续性说明')).toBeTruthy();
    expect(screen.getByText('保持服装一致')).toBeTruthy();
  });

  it('auto-runs generated image nodes when story execution mode is fully automatic', async () => {
    const storyOutput = JSON.stringify({
      version: 1,
      storySummary: '全自动故事',
      globalAssets: {
        scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景图提示词' }],
        characterSheetPrompts: [{ id: 'character_1', title: '角色板', prompt: '角色板提示词' }],
        propSheetPrompts: [{ id: 'prop_1', title: '物品图', prompt: '物品图提示词' }],
      },
      narrativeSegments: [],
    });

    vi.spyOn(generationClient, 'streamChatGenerationNode').mockImplementation(async (input) => {
      input.onDelta(storyOutput, storyOutput);
      return {
        ok: true,
        output: {
          kind: 'text',
          text: storyOutput,
          rawResponse: {},
        },
      };
    });

    const submitSpy = vi
      .spyOn(generationClient, 'submitGenerationNode')
      .mockResolvedValue({
        ok: true,
        output: {
          kind: 'image',
          dataUrl: 'data:image/png;base64,aW1hZ2U=',
          rawResponse: {},
        },
      });

    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_story_auto',
          name: 'OpenAI',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-story',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
            {
              providerModelId: 'gpt-image-2',
              canonicalModelId: 'gpt-image-2',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));
    await openNodeInspectorByTitle('故事拆解');
    const storyHeadings = screen.getAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    await chooseInlineOption('执行方式', '拆解并全自动执行', storyNodeCardQueries);
    await chooseInlineOption('展开级别', '结构 + 全局资产', screen);

    const promptEditor = screen.getByLabelText('节点提示词') as HTMLDivElement;
    setPromptEditorValue(promptEditor, '生成一个无厘头的故事，之后进行拆解。');
    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.getByText('已从故事节点生成 3 个下游节点。')).toBeTruthy();
      expect(submitSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('auto-runs only generated image nodes when story execution mode is 拆解并执行生图', async () => {
    const storyOutput = JSON.stringify({
      version: 1,
      storySummary: '自动生图故事',
      globalAssets: {
        scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景图提示词' }],
        characterSheetPrompts: [],
        propSheetPrompts: [],
      },
      narrativeSegments: [
        {
          id: 'segment_1',
          title: '第一段',
          durationSeconds: 5,
          openingTransition: {
            type: 'hard_cut',
            description: '直接切入',
            durationSeconds: 0.2,
          },
          prompt: '第一段视频提示词',
          shots: [
            {
              id: 'shot_1',
              title: '镜头一',
              durationSeconds: 2,
              characters: ['主角'],
              cameraMotion: '推进',
              action: '举杯',
            },
          ],
          firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
          lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
          motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
          continuityNotes: [],
        },
      ],
    });

    vi.spyOn(generationClient, 'streamChatGenerationNode').mockImplementation(async (input) => {
      input.onDelta(storyOutput, storyOutput);
      return {
        ok: true,
        output: {
          kind: 'text',
          text: storyOutput,
          rawResponse: {},
        },
      };
    });

    const submitSpy = vi.spyOn(generationClient, 'submitGenerationNode').mockImplementation(async (input) => {
      const node = input.canvas.nodes.find((current) => current.id === input.nodeId);

      if (node?.kind === 'video') {
        return {
          ok: true,
          output: {
            kind: 'video-task',
            taskId: 'video-task-1',
            status: 'queued',
            rawResponse: {},
          },
        };
      }

      return {
        ok: true,
        output: {
          kind: 'image',
          dataUrl: 'data:image/png;base64,aW1hZ2U=',
          rawResponse: {},
        },
      };
    });

    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_story_image_auto',
          name: 'OpenAI',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-story',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
            {
              providerModelId: 'gpt-image-2',
              canonicalModelId: 'gpt-image-2',
              enabled: true,
            },
          ],
        },
        {
          id: 'provider_story_video_auto',
          name: '火山方舟',
          protocol: 'volcengine',
          baseURL: 'https://ark.cn-beijing.volces.com',
          apiTokenRef: 'sk-test-volc',
          enabled: true,
          models: [
            {
              providerModelId: 'doubao-seedance-2-0-250428',
              canonicalModelId: 'seedance2.0',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));
    await openNodeInspectorByTitle('故事拆解');
    const storyHeadings = screen.getAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    await chooseInlineOption('执行方式', '拆解并执行生图', storyNodeCardQueries);
    await chooseInlineOption('展开级别', '展开全部节点', screen);

    const promptEditor = screen.getByLabelText('节点提示词') as HTMLDivElement;
    setPromptEditorValue(promptEditor, '生成一个无厘头的故事，之后进行拆解。');
    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(4);
    });

    const calledNodeKinds = submitSpy.mock.calls
      .map(([input]) => input.canvas.nodes.find((current) => current.id === input.nodeId)?.kind)
      .filter(Boolean);
    expect(calledNodeKinds).toEqual(['image', 'image', 'image', 'image']);
  });

  it('rebuilds downstream nodes from the current structured json without re-running the model', async () => {
    const streamSpy = vi.spyOn(generationClient, 'streamChatGenerationNode');
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_regenerate',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_regenerate_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '重新铺节点测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 5,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
                    continuityNotes: [],
                  },
                ],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('故事拆解');
    await userEvent.click(screen.getByRole('button', { name: '从当前 JSON 重新生成节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '场景图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(streamSpy).not.toHaveBeenCalled();
    expect(screen.getByText('已从故事节点生成 7 个下游节点。')).toBeTruthy();
  });

  it('prefers reparsing richer raw story output when stored structured output is stale', async () => {
    const streamSpy = vi.spyOn(generationClient, 'streamChatGenerationNode');
    const rawStructuredOutput = JSON.stringify({
      version: 1,
      storySummary: '旧结构需要修复',
      globalAssets: {
        scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
        characterSheetPrompts: [],
        propSheetPrompts: [],
      },
      narrativeSegments: [
        {
          id: 'segment_1',
          title: '第一段',
          durationSeconds: 5,
          openingTransition: {
            type: 'hard_cut',
            description: '直接切入',
            durationSeconds: 0.2,
          },
          prompt: '第一段视频提示词',
          shots: [
            {
              id: 'shot_1',
              title: '镜头一',
              durationSeconds: 2,
              characters: ['主角'],
              cameraMotion: '推进',
              action: '举杯',
            },
          ],
          firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
          lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
          motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
          continuityNotes: [],
        },
      ],
    });
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_reparse',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_reparse_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyRawOutput: rawStructuredOutput,
              storyStructuredOutput: {
                version: 1,
                storySummary: '旧结构需要修复',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [],
                rawModelOutput: rawStructuredOutput,
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('故事拆解');
    await userEvent.click(screen.getByRole('button', { name: '从当前 JSON 重新生成节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 尾帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 运镜简笔画' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(streamSpy).not.toHaveBeenCalled();
    expect(screen.getByText('已从故事节点生成 7 个下游节点。')).toBeTruthy();
  });

  it('shows inline story rebuild controls on the node card and defaults rebuild type to full', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_inline_rebuild',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_inline_rebuild_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '节点外重建测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();

    expect(within(storyNodeCard!).getByRole('button', { name: '重建类型' }).textContent).toContain(
      '展开全部节点',
    );
    expect(within(storyNodeCard!).getByRole('button', { name: '重建节点' })).toBeTruthy();

    const storyNodeCardQueries = within(storyNodeCard!);
    const rebuildLabel = storyNodeCardQueries.getByRole('button', { name: '重建类型' }).closest('label');
    const promptLabel = storyNodeCardQueries.getByLabelText('节点提示词').closest('label');

    expect(rebuildLabel).toBeTruthy();
    expect(promptLabel).toBeTruthy();
    expect(rebuildLabel!.compareDocumentPosition(promptLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows story execution and provider selects on the node card outside the inspector', async () => {
    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_story_openai_a',
          name: 'OpenAI A',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-a',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    expect(storyNodeCardQueries.getByRole('button', { name: '执行方式' })).toBeTruthy();
    expect(storyNodeCardQueries.getByRole('button', { name: '供应商' })).toBeTruthy();
    expect(storyNodeCardQueries.getByRole('button', { name: '供应商模型' })).toBeTruthy();
    expect(storyNodeCardQueries.queryByRole('button', { name: '图片并发' })).toBeNull();
    expect(storyNodeCardQueries.queryByRole('button', { name: '视频并发' })).toBeNull();
    expect(storyNodeCardQueries.getByLabelText('节点提示词')).toBeTruthy();
    expect(storyNodeCardQueries.queryByLabelText('故事内置提示词')).toBeNull();

    const providerLabel = storyNodeCardQueries.getByRole('button', { name: '供应商' }).closest('label');
    const providerModelLabel = storyNodeCardQueries.getByRole('button', { name: '供应商模型' }).closest('label');
    const rebuildLabel = storyNodeCardQueries.queryByRole('button', { name: '重建类型' })?.closest('label');
    const promptLabel = storyNodeCardQueries.getByLabelText('节点提示词').closest('label');

    expect(providerLabel).toBeTruthy();
    expect(providerModelLabel).toBeTruthy();
    expect(promptLabel).toBeTruthy();
    expect(providerLabel!.compareDocumentPosition(providerModelLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    if (rebuildLabel) {
      expect(providerModelLabel!.compareDocumentPosition(rebuildLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(rebuildLabel.compareDocumentPosition(promptLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    } else {
      expect(providerModelLabel!.compareDocumentPosition(promptLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('shows story provider, prompt, and built-in prompt controls below video concurrency in the inspector', async () => {
    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_story_openai_a',
          name: 'OpenAI A',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-a',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));
    await openNodeInspectorByTitle('故事拆解');

    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    const inspectorQueries = within(inspector as HTMLElement);

    expect(inspectorQueries.getByRole('button', { name: '供应商' })).toBeTruthy();
    expect(inspectorQueries.getByRole('button', { name: '供应商模型' })).toBeTruthy();
    expect(inspectorQueries.getByLabelText('提示词')).toBeTruthy();
    expect(
      (inspectorQueries.getByLabelText('故事内置提示词') as HTMLTextAreaElement).value,
    ).toContain('影视故事拆解节点');

    const videoConcurrencyLabel = inspectorQueries.getByRole('button', { name: '故事视频并发' }).closest('label');
    const providerLabel = inspectorQueries.getByRole('button', { name: '供应商' }).closest('label');
    const providerModelLabel = inspectorQueries.getByRole('button', { name: '供应商模型' }).closest('label');
    const promptLabel = inspectorQueries.getByLabelText('提示词').closest('label');
    const systemPromptLabel = inspectorQueries.getByLabelText('故事内置提示词').closest('label');

    expect(videoConcurrencyLabel).toBeTruthy();
    expect(providerLabel).toBeTruthy();
    expect(providerModelLabel).toBeTruthy();
    expect(promptLabel).toBeTruthy();
    expect(systemPromptLabel).toBeTruthy();
    expect(videoConcurrencyLabel!.compareDocumentPosition(providerLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(providerLabel!.compareDocumentPosition(providerModelLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(providerModelLabel!.compareDocumentPosition(promptLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(promptLabel!.compareDocumentPosition(systemPromptLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps the story built-in prompt out of widened node cards', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_system_prompt_width',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_system_prompt_width_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              width: 920,
              prompt: '生成故事',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();

    expect(within(storyNodeCard!).queryByLabelText('故事内置提示词')).toBeNull();
    expect(within(storyNodeCard!).getByLabelText('节点提示词')).toBeTruthy();
    expect(container.querySelector('.canvas-node-story')?.getAttribute('style')).toContain('width: 920px');
  });

  it('updates story auto-run concurrency from the inspector controls only', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_inline_concurrency',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_inline_concurrency_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'fully_automatic',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '并发配置测试',
                globalAssets: {
                  scenePrompts: [],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    const storyNodeCardQueries = within(storyNodeCard!);

    expect(storyNodeCardQueries.queryByRole('button', { name: '图片并发' })).toBeNull();
    expect(storyNodeCardQueries.queryByRole('button', { name: '视频并发' })).toBeNull();

    await userEvent.click(storyNodeCardQueries.getByRole('button', { name: '打开节点配置' }));
    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    const inspectorQueries = within(inspector as HTMLElement);

    await chooseInlineOption('故事图片并发', '2', inspectorQueries);
    await chooseInlineOption('故事视频并发', '4', inspectorQueries);

    expect(inspectorQueries.getByRole('button', { name: '故事图片并发' }).textContent).toContain('2');
    expect(inspectorQueries.getByRole('button', { name: '故事视频并发' }).textContent).toContain('4');
  });

  it('updates story provider and provider model from the node card controls', async () => {
    window.localStorage.setItem(
      providerStorageKey,
      JSON.stringify([
        {
          id: 'provider_story_openai_a',
          name: 'OpenAI A',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-a',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-5.4-mini',
              canonicalModelId: 'gpt-5.4-mini',
              enabled: true,
            },
          ],
        },
        {
          id: 'provider_story_openai_b',
          name: 'OpenAI B',
          protocol: 'openai-compatible',
          baseURL: 'https://api.openai.com/v1',
          apiTokenRef: 'sk-test-b',
          enabled: true,
          models: [
            {
              providerModelId: 'gpt-4.1-mini',
              canonicalModelId: 'gpt-4.1-mini',
              enabled: true,
            },
          ],
        },
      ]),
    );

    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: '新建画布' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '添加节点' }));
    await userEvent.click(await screen.findByRole('button', { name: '故事拆解节点' }));

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();

    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '供应商' }));
    await userEvent.click(screen.getByRole('option', { name: 'OpenAI B' }));

    expect(within(storyNodeCard!).getByRole('button', { name: '供应商' }).textContent).toContain('OpenAI B');
    expect(within(storyNodeCard!).getByRole('button', { name: '供应商模型' }).textContent).toContain('gpt-4.1-mini');
  });

  it('rebuilds story nodes directly from the node card inline action', async () => {
    const streamSpy = vi.spyOn(generationClient, 'streamChatGenerationNode');
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_inline_rebuild_action',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_inline_rebuild_action_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '节点外重建动作测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 5,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
                    continuityNotes: [],
                  },
                ],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();

    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '重建节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '场景图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(streamSpy).not.toHaveBeenCalled();
    expect(screen.getByText('已从故事节点生成 7 个下游节点。')).toBeTruthy();
  });

  it('clears downstream story outputs first, then allows rebuilding again', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_regenerate_cleanup',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_cleanup_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '重建前清理测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '新场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 5,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '新第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '新首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '新尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '新运镜提示词' },
                    continuityNotes: [],
                  },
                ],
              },
            },
            {
              id: 'story_old_scene_node',
              title: '旧场景图',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 480,
              y: 0,
              prompt: '旧场景提示词',
              storySourceNodeId: 'story_cleanup_node',
              storyGenerationBatchId: 'story_batch_old',
              storyAssetRole: 'scene',
            },
            {
              id: 'story_old_video_node',
              title: '旧第一段视频',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 840,
              y: 0,
              prompt: '旧视频提示词',
              storySourceNodeId: 'story_cleanup_node',
              storyGenerationBatchId: 'story_batch_old',
              storySegmentId: 'segment_old',
              storyAssetRole: 'segment_video',
            },
            {
              id: 'story_old_video_asset',
              title: '旧输出视频',
              modelId: 'asset-video',
              kind: 'videoAsset',
              x: 1200,
              y: 0,
              assetName: 'old-video.mp4',
              assetDataUrl: 'data:video/mp4;base64,b2xk',
            },
          ],
          edges: [
            createCanvasEdge('story_cleanup_node', 'story_old_scene_node'),
            createCanvasEdge('story_cleanup_node', 'story_old_video_node'),
            createCanvasEdge('story_old_video_node', 'story_old_video_asset'),
          ],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();
    expect(within(storyNodeCard!).getByRole('button', { name: '清除节点' })).toBeTruthy();

    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '清除节点' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '旧场景图' })).toBeNull();
      expect(screen.queryByRole('heading', { name: '旧第一段视频' })).toBeNull();
      expect(screen.queryByRole('heading', { name: '旧输出视频' })).toBeNull();
      expect(within(storyNodeCard!).getByRole('button', { name: '重建节点' })).toBeTruthy();
    });

    expect(screen.getByText('已清除故事节点的下游输出。')).toBeTruthy();

    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '重建节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '场景图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(screen.getByText('已从故事节点生成 7 个下游节点。')).toBeTruthy();
  });

  it('removes all downstream nodes before generating story nodes again', async () => {
    const storyOutput = JSON.stringify({
      version: 1,
      storySummary: '重新生成故事',
      globalAssets: {
        scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '新场景提示词' }],
        characterSheetPrompts: [],
        propSheetPrompts: [],
      },
      narrativeSegments: [
        {
          id: 'segment_1',
          title: '第一段',
          durationSeconds: 5,
          openingTransition: {
            type: 'hard_cut',
            description: '直接切入',
            durationSeconds: 0.2,
          },
          prompt: '新第一段视频提示词',
          shots: [
            {
              id: 'shot_1',
              title: '镜头一',
              durationSeconds: 2,
              characters: ['主角'],
              cameraMotion: '推进',
              action: '举杯',
            },
          ],
          firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '新首帧提示词' },
          lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '新尾帧提示词' },
          motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '新运镜提示词' },
          continuityNotes: [],
        },
      ],
    });

    vi.spyOn(generationClient, 'streamChatGenerationNode').mockImplementation(async (input) => {
      input.onDelta(storyOutput, storyOutput);
      return {
        ok: true,
        output: {
          kind: 'text',
          text: storyOutput,
          rawResponse: {},
        },
      };
    });

    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_generate_cleanup',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_generate_cleanup_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              prompt: '重新生成一个故事并拆解',
              storyExecutionMode: 'structure_and_nodes',
              storyExpansionMode: 'full',
            },
            {
              id: 'story_old_scene_node',
              title: '旧场景图',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 480,
              y: 0,
              prompt: '旧场景提示词',
              storySourceNodeId: 'story_generate_cleanup_node',
              storyGenerationBatchId: 'story_batch_old',
              storyAssetRole: 'scene',
            },
            {
              id: 'story_old_video_node',
              title: '旧第一段视频',
              modelId: 'seedance2.0',
              kind: 'video',
              x: 840,
              y: 0,
              prompt: '旧视频提示词',
              storySourceNodeId: 'story_generate_cleanup_node',
              storyGenerationBatchId: 'story_batch_old',
              storySegmentId: 'segment_old',
              storyAssetRole: 'segment_video',
            },
            {
              id: 'story_old_video_asset',
              title: '旧输出视频',
              modelId: 'asset-video',
              kind: 'videoAsset',
              x: 1200,
              y: 0,
              assetName: 'old-video.mp4',
              assetDataUrl: 'data:video/mp4;base64,b2xk',
            },
          ],
          edges: [
            createCanvasEdge('story_generate_cleanup_node', 'story_old_scene_node'),
            createCanvasEdge('story_generate_cleanup_node', 'story_old_video_node'),
            createCanvasEdge('story_old_video_node', 'story_old_video_asset'),
          ],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const storyHeadings = await screen.findAllByRole('heading', { name: '故事拆解' });
    const storyNodeCard = storyHeadings.find((heading) => heading.closest('article'))?.closest('article');
    expect(storyNodeCard).toBeTruthy();

    await userEvent.click(within(storyNodeCard!).getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '旧场景图' })).toBeNull();
      expect(screen.queryByRole('heading', { name: '旧第一段视频' })).toBeNull();
      expect(screen.queryByRole('heading', { name: '旧输出视频' })).toBeNull();
      expect(screen.getByRole('heading', { name: '场景图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(screen.getByText('已从故事节点生成 7 个下游节点。')).toBeTruthy();
  });

  it('creates only the selected narrative segment nodes from structured output', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_segment_regenerate',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_segment_regenerate_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_and_nodes',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '分段生成测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 5,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '第一段首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '第一段尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '第一段运镜提示词' },
                    continuityNotes: [],
                  },
                  {
                    id: 'segment_2',
                    title: '第二段',
                    durationSeconds: 6,
                    openingTransition: {
                      type: 'fade',
                      description: '淡入',
                      durationSeconds: 0.4,
                    },
                    prompt: '第二段视频提示词',
                    shots: [
                      {
                        id: 'shot_2',
                        title: '镜头二',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '横摇',
                        action: '转身',
                      },
                    ],
                    firstFramePrompt: { id: 'first_2', title: '首帧', prompt: '第二段首帧提示词' },
                    lastFramePrompt: { id: 'last_2', title: '尾帧', prompt: '第二段尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_2', title: '运镜合集', prompt: '第二段运镜提示词' },
                    continuityNotes: [],
                  },
                ],
              },
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    await openNodeInspectorByTitle('故事拆解');
    await userEvent.click(screen.getByRole('button', { name: '生成“第二段”节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '第二段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第二段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第二段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第二段 尾帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第二段 运镜简笔画' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第二段 视频' })).toBeTruthy();
    });

    expect(screen.queryByRole('heading', { name: '第一段 首帧图' })).toBeNull();
    expect(screen.getByText('已从故事节点生成 6 个下游节点。')).toBeTruthy();
  });

  it('shows story node rebuild actions inside the output modal and rebuilds from there', async () => {
    const streamSpy = vi.spyOn(generationClient, 'streamChatGenerationNode');
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_story_output_modal',
          name: '故事画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_output_modal_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              storyExecutionMode: 'structure_only',
              storyExpansionMode: 'full',
              storyStructuredOutput: {
                version: 1,
                storySummary: '弹窗重建测试',
                globalAssets: {
                  scenePrompts: [{ id: 'scene_1', title: '场景图', prompt: '场景提示词' }],
                  characterSheetPrompts: [],
                  propSheetPrompts: [],
                },
                narrativeSegments: [
                  {
                    id: 'segment_1',
                    title: '第一段',
                    durationSeconds: 5,
                    openingTransition: {
                      type: 'hard_cut',
                      description: '直接切入',
                      durationSeconds: 0.2,
                    },
                    prompt: '第一段视频提示词',
                    shots: [
                      {
                        id: 'shot_1',
                        title: '镜头一',
                        durationSeconds: 2,
                        characters: ['主角'],
                        cameraMotion: '推进',
                        action: '举杯',
                      },
                    ],
                    firstFramePrompt: { id: 'first_1', title: '首帧', prompt: '首帧提示词' },
                    lastFramePrompt: { id: 'last_1', title: '尾帧', prompt: '尾帧提示词' },
                    motionSketchPrompt: { id: 'motion_1', title: '运镜合集', prompt: '运镜提示词' },
                    continuityNotes: [],
                  },
                ],
              },
              modelOutputText:
                (
                  '{"version":1,"storySummary":"弹窗重建测试","globalAssets":{"scenePrompts":[{"id":"scene_1","title":"场景图","prompt":"场景提示词"}],"characterSheetPrompts":[],"propSheetPrompts":[]},"narrativeSegments":[{"id":"segment_1","title":"第一段","durationSeconds":5,"openingTransition":{"type":"hard_cut","description":"直接切入","durationSeconds":0.2},"prompt":"第一段视频提示词","shots":[{"id":"shot_1","title":"镜头一","durationSeconds":2,"characters":["主角"],"cameraMotion":"推进","action":"举杯"}],"firstFramePrompt":{"id":"first_1","title":"首帧","prompt":"首帧提示词"},"lastFramePrompt":{"id":"last_1","title":"尾帧","prompt":"尾帧提示词"},"motionSketchPrompt":{"id":"motion_1","title":"运镜合集","prompt":"运镜提示词"},"continuityNotes":[]}]}' 
                ).repeat(12),
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    await openOutputEditorByTitle('故事拆解');

    expect(screen.getByRole('button', { name: '从当前 JSON 重新生成节点' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成“第一段”节点' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '生成“第一段”节点' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '第一段 叙事段落提示词' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 分镜详情' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 首帧图' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '第一段 视频' })).toBeTruthy();
    });

    expect(streamSpy).not.toHaveBeenCalled();
  });

  it('grows model node width with prompt length and caps it at three times the base width', () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_node_width',
          name: '节点宽度',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_short',
              title: '短提示图片节点',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 0,
              y: 0,
              prompt: '短提示',
            },
            {
              id: 'image_long',
              title: '长提示图片节点',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 360,
              y: 0,
              prompt: '这是一个很长的提示词 '.repeat(40),
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);

    const shortNode = screen.getByRole('heading', { name: '短提示图片节点' }).closest('article');
    const longNode = screen.getByRole('heading', { name: '长提示图片节点' }).closest('article');

    expect(shortNode).toBeTruthy();
    expect(longNode).toBeTruthy();

    const shortWidth = Number.parseFloat(shortNode!.style.width);
    const longWidth = Number.parseFloat(longNode!.style.width);

    expect(shortWidth).toBe(440);
    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeLessThanOrEqual(960);
  });

  it('supports wheel and keyboard selection in the @ reference menu', async () => {
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_reference_menu',
          name: '引用菜单',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'text_1',
              title: '文本素材',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 0,
              y: 0,
              textContent: '这是一段可引用文本',
            },
            {
              id: 'image_asset_1',
              title: '图片素材',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 0,
              y: 180,
              assetName: 'reference.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'chat_1',
              title: '提示词整理',
              modelId: 'gpt-5.4-mini',
              kind: 'chat',
              x: 360,
              y: 60,
              prompt: '',
            },
          ],
          edges: [
            createCanvasEdge('text_1', 'chat_1'),
            createCanvasEdge('image_asset_1', 'chat_1'),
          ],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    await openNodeInspectorByTitle('提示词整理');

    const editor = document.querySelector(
      '.node-inspector .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(editor).toBeTruthy();

    setPromptEditorValue(editor!, '@');

    const menu = document.querySelector('.prompt-reference-menu') as HTMLDivElement | null;
    expect(menu).toBeTruthy();

    const buttons = within(menu!).getAllByRole('button');
    expect(buttons[0].className).toContain('is-active');
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.wheel(menu!, { deltaY: 48 });
    expect(buttons[1].className).toContain('is-active');
    expect(screen.getByText('100%')).toBeTruthy();
    expect(scrollIntoViewMock).toHaveBeenCalled();

    fireEvent.keyDown(editor!, { key: 'ArrowUp' });
    fireEvent.keyUp(editor!, { key: 'ArrowUp' });
    expect(buttons[0].className).toContain('is-active');

    fireEvent.keyDown(editor!, { key: 'ArrowDown' });
    fireEvent.keyUp(editor!, { key: 'ArrowDown' });
    expect(buttons[1].className).toContain('is-active');

    fireEvent.mouseEnter(buttons[0]);
    expect(buttons[1].className).toContain('is-active');

    fireEvent.pointerMove(menu!);
    fireEvent.mouseEnter(buttons[0]);
    expect(buttons[0].className).toContain('is-active');

    fireEvent.keyDown(editor!, { key: 'Enter' });
    expect(document.querySelector('.prompt-reference-menu')).toBeNull();
    expect(editor!.querySelector('.prompt-reference-token')).toBeTruthy();
  });

  it('keeps native undo and redo shortcuts inside the prompt editor', async () => {
    render(<App />);
    await openNodeInspectorByTitle('视频生成');

    const editor = document.querySelector(
      '.node-inspector .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(editor).toBeTruthy();

    editor!.focus();

    const undoEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'z',
      metaKey: true,
    });
    editor!.dispatchEvent(undoEvent);
    expect(undoEvent.defaultPrevented).toBe(false);

    const redoEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'z',
      metaKey: true,
      shiftKey: true,
    });
    editor!.dispatchEvent(redoEvent);
    expect(redoEvent.defaultPrevented).toBe(false);
  });

  it('uses text cursor styles inside editable fields', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_editor_cursor',
          name: '编辑光标画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_cursor_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              prompt: '请输入故事',
            },
            {
              id: 'text_cursor_node',
              title: '文本',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 420,
              y: 0,
              textContent: '文本内容',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    await openNodeInspectorByTitle('故事拆解');

    const promptEditor = container.querySelector('.prompt-reference-editor') as HTMLDivElement | null;
    const textArea = container.querySelector('.canvas-node-textAsset textarea') as HTMLTextAreaElement | null;

    expect(promptEditor).toBeTruthy();
    expect(textArea).toBeTruthy();
    expect(window.getComputedStyle(promptEditor!).cursor).toBe('text');
    expect(window.getComputedStyle(textArea!).cursor).toBe('text');
  });

  it('brings the clicked node to the top layer', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_layering',
          name: '图层画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_image_back',
              title: '底层图片',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 120,
              y: 120,
              prompt: '底层',
            },
            {
              id: 'node_text_front',
              title: '顶层文本',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 180,
              y: 180,
              textContent: '顶层文本内容',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);

    const getCanvasNodeTitlesInOrder = () =>
      Array.from(container.querySelectorAll('.canvas-plane > article.canvas-node')).map((node) => {
        const heading = node.querySelector('h2');
        return heading?.textContent?.trim() ?? '';
      });

    expect(getCanvasNodeTitlesInOrder()).toEqual(['底层图片', '顶层文本']);

    const bottomNodeHeading = await screen.findByRole('heading', { name: '底层图片' });
    const bottomNodeCard = bottomNodeHeading.closest('article');
    expect(bottomNodeCard).toBeTruthy();

    await userEvent.click(bottomNodeCard!);

    expect(getCanvasNodeTitlesInOrder()).toEqual(['顶层文本', '底层图片']);
  });

  it('brings the node to the top layer when clicking inside its editor', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_layering_editor',
          name: '编辑图层画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_text_back',
              title: '底层文本',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 120,
              y: 120,
              textContent: '底层文本内容',
            },
            {
              id: 'node_image_front',
              title: '顶层图片',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 180,
              y: 180,
              prompt: '顶层',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);

    const getCanvasNodeTitlesInOrder = () =>
      Array.from(container.querySelectorAll('.canvas-plane > article.canvas-node')).map((node) => {
        const heading = node.querySelector('h2');
        return heading?.textContent?.trim() ?? '';
      });

    expect(getCanvasNodeTitlesInOrder()).toEqual(['底层文本', '顶层图片']);

    const editor = await screen.findByPlaceholderText('输入文本');
    fireEvent.pointerDown(editor, { bubbles: true });

    expect(getCanvasNodeTitlesInOrder()).toEqual(['顶层图片', '底层文本']);
  });

  it('pastes plain text into the prompt editor without carrying html markup', async () => {
    render(<App />);
    await openNodeInspectorByTitle('视频生成');

    const editor = document.querySelector(
      '.node-inspector .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(editor).toBeTruthy();

    editor!.focus();
    fireEvent.paste(editor!, {
      clipboardData: {
        files: [],
        getData: (type: string) =>
          type === 'text/plain' ? '纯文本内容' : type === 'text/html' ? '<b>富文本内容</b>' : '',
        types: ['text/plain', 'text/html'],
      },
    });

    expect(editor!.textContent).toContain('纯文本内容');
    expect(editor!.querySelector('b')).toBeNull();
  });

  it('does not create image nodes when pasting files inside the prompt editor', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_prompt_paste',
          name: '提示词粘贴',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'chat_1',
              title: '提示词整理',
              modelId: 'gpt-5.4-mini',
              kind: 'chat',
              x: 320,
              y: 80,
              prompt: '',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    await openNodeInspectorByTitle('提示词整理');

    const editor = document.querySelector(
      '.node-inspector .prompt-reference-editor',
    ) as HTMLDivElement | null;
    expect(editor).toBeTruthy();

    const file = new File(['image'], 'clipboard.png', { type: 'image/png' });
    fireEvent.paste(editor!, {
      clipboardData: {
        files: [file],
        getData: () => '',
        types: ['Files'],
      },
    });

    expect(screen.queryByAltText('clipboard.png')).toBeNull();
    expect(screen.queryAllByRole('img', { name: /clipboard\.png/i })).toHaveLength(0);
  });

  it('closes inline dropdown menus after focus leaves the select', async () => {
    render(<App />);
    await openNodeInspectorByTitle('视频生成');
    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    const inspectorQueries = within(inspector as HTMLElement);

    await userEvent.click(inspectorQueries.getByRole('button', { name: '类型' }));
    expect(screen.getByRole('listbox', { name: '类型' })).toBeTruthy();

    const trigger = inspectorQueries.getByRole('button', { name: '类型' });
    const closeButton = inspectorQueries.getByRole('button', { name: '关闭节点详情' });
    fireEvent.blur(trigger, { relatedTarget: closeButton });

    expect(screen.queryByRole('listbox', { name: '类型' })).toBeNull();
  });

  it('keeps wheel events inside inline dropdown menus', async () => {
    render(<App />);
    await openNodeInspectorByTitle('视频生成');
    const inspector = document.querySelector('.node-inspector');
    expect(inspector).toBeTruthy();
    const inspectorQueries = within(inspector as HTMLElement);

    await userEvent.click(inspectorQueries.getByRole('button', { name: '类型' }));
    const listbox = screen.getByRole('listbox', { name: '类型' });
    const scaleIndicator = screen.getByText('100%');

    fireEvent.wheel(listbox, { deltaY: 48, bubbles: true, cancelable: true });

    expect(scaleIndicator.textContent).toBe('100%');
    expect(screen.getByRole('listbox', { name: '类型' })).toBeTruthy();
  });

  it('keeps wheel events inside text asset editors and shows an outer resize handle', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_text_asset_editor',
          name: '文本编辑画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'text_asset_editor_1',
              title: '文本素材',
              modelId: 'asset-text',
              kind: 'textAsset',
              x: 120,
              y: 80,
              width: 360,
              height: 260,
              textContent: Array.from({ length: 24 }, (_, index) => `第 ${index + 1} 行`).join('\n'),
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const scaleIndicator = screen.getByText('100%');
    const textArea = await screen.findByPlaceholderText('输入文本');
    const resizeHandle = container.querySelector('.text-asset-resize-handle');

    expect(resizeHandle).toBeTruthy();

    fireEvent.wheel(textArea, { deltaY: 64, bubbles: true, cancelable: true });

    expect(scaleIndicator.textContent).toBe('100%');
  });

  it('supports resizing every node and does not shrink below the size at drag start', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_node_resize',
          name: '节点缩放画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'story_resize_node',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 120,
              y: 80,
              prompt: '这是一个用于测试节点缩放的故事提示词。',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const nodeCard = (await screen.findByRole('heading', { name: '故事拆解' })).closest('article');
    const resizeHandle = container.querySelector('.node-resize-handle') as HTMLButtonElement | null;

    expect(nodeCard).toBeTruthy();
    expect(resizeHandle).toBeTruthy();
    expect(nodeCard!.style.width).toBe('560px');
    expect(nodeCard!.style.minHeight).toBe('220px');

    act(() => {
      fireEvent.pointerDown(resizeHandle!, {
        button: 0,
        pointerId: 9,
        clientX: 100,
        clientY: 100,
      });
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 9,
          clientX: 220,
          clientY: 180,
        }),
      );
    });

    expect(nodeCard!.style.width).toBe('680px');
    expect(nodeCard!.style.minHeight).toBe('300px');

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 9,
          clientX: -200,
          clientY: -200,
        }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 9,
        }),
      );
    });

    expect(nodeCard!.style.width).toBe('560px');
    expect(nodeCard!.style.minHeight).toBe('220px');
  });

  it('wraps media previews in scalable stages so resized nodes can reflow content cleanly', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_media_layout',
          name: '媒体布局画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'image_asset_layout_1',
              title: '图片',
              modelId: 'asset-image',
              kind: 'imageAsset',
              x: 120,
              y: 80,
              assetName: 'test.png',
              assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
            {
              id: 'image_node_layout_1',
              title: '场景图',
              modelId: 'gpt-image-2',
              kind: 'image',
              x: 520,
              y: 80,
              prompt: '一张测试图片',
              outputDataUrl: 'data:image/png;base64,aW1hZ2U=',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);

    const assetCard = (await screen.findByRole('heading', { name: '图片' })).closest('article');
    const imageCard = (await screen.findByRole('heading', { name: '场景图' })).closest('article');

    expect(assetCard?.querySelector('.node-preview-stage')).toBeTruthy();
    expect(assetCard?.querySelector('.node-asset-actions')).toBeTruthy();
    expect(imageCard?.querySelector('.node-output-preview-stage')).toBeTruthy();
    expect(container.querySelector('.node-body-imageAsset')).toBeTruthy();
    expect(container.querySelector('.node-body-image')).toBeTruthy();
  });

  it('shows a copy button near selected preview text in the output modal', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_output_modal',
          name: '输出画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'chat_output_1',
              title: '对话输出',
              modelId: 'gpt-5.4-mini',
              kind: 'chat',
              x: 320,
              y: 120,
              modelOutputText:
                '第一段内容用于预览展示，并且会保留一小段正文用于测试选区行为。\n\n'
                + '第二段内容更长一些，用来触发完整输出查看按钮并测试选区复制。'.repeat(24),
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    render(<App />);
    await openOutputEditorByTitle('对话输出');

    const preview = document.querySelector('.output-modal-preview') as HTMLDivElement | null;
    expect(preview).toBeTruthy();

    const firstParagraph = preview!.querySelector('p');
    expect(firstParagraph?.firstChild).toBeTruthy();

    const range = document.createRange();
    range.setStart(firstParagraph!.firstChild!, 0);
    range.setEnd(firstParagraph!.firstChild!, 6);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent(document, new Event('selectionchange'));
    fireEvent.pointerUp(preview!, {
      clientX: 180,
      clientY: 120,
    });

    const copyButton = await screen.findByRole('button', { name: '复制' });
    expect(copyButton).toBeTruthy();
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

  it('allows dragging from the node body and applies the latest pointer delta inside a single batch', async () => {
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
    const node = container.querySelector('.canvas-node') as HTMLElement | null;

    expect(canvas).toBeTruthy();
    expect(node).toBeTruthy();

    act(() => {
      fireEvent.pointerDown(node!, {
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

    expect(node!.style.transform).toContain('translate3d(20px, 0px, 0)');
  });

  it('allows dragging from non-interactive header areas while keeping header actions clickable', async () => {
    const state: CanvasWorkspaceState = {
      ...createWorkspaceState([
        {
          id: 'canvas_drag_header',
          name: '标题拖拽画布',
          updatedAt: '刚刚',
          nodes: [
            {
              id: 'node_story_header_drag',
              title: '故事拆解',
              modelId: 'gpt-5.4-mini',
              kind: 'story',
              x: 0,
              y: 0,
              prompt: '标题区域拖动测试',
            },
          ],
          edges: [],
        },
      ]),
    };

    window.localStorage.setItem(workspaceStorageKey, serializeWorkspaceState(state));

    const { container } = render(<App />);
    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    const titleRow = container.querySelector('.node-title-row') as HTMLElement | null;
    const node = container.querySelector('.canvas-node') as HTMLElement | null;

    expect(canvas).toBeTruthy();
    expect(titleRow).toBeTruthy();
    expect(node).toBeTruthy();

    act(() => {
      fireEvent.pointerDown(titleRow!, {
        button: 0,
        pointerId: 2,
        clientX: 120,
        clientY: 120,
      });
      canvas!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 2,
          clientX: 145,
          clientY: 120,
        }),
      );
      canvas!.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 2,
          clientX: 145,
          clientY: 120,
        }),
      );
    });

    expect(node!.style.transform).toContain('translate3d(25px, 0px, 0)');
  });
});
