import { describe, expect, it } from 'vitest';
import { createWorkspaceState } from '../../src/app/canvasWorkspace';
import { shouldApplyPersistedWorkspaceState } from '../../src/app/workspacePersistence';

describe('workspace persistence', () => {
  it('does not apply a persisted snapshot after newer workspace state exists', () => {
    const snapshot = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_1',
            title: '图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
          },
        ],
        edges: [],
      },
    ]);
    const current = {
      ...snapshot,
      canvases: [
        {
          ...snapshot.canvases[0],
          nodes: [
            {
              ...snapshot.canvases[0].nodes[0],
              x: 120,
            },
          ],
        },
      ],
    };
    const stalePersisted = {
      ...snapshot,
      canvases: [
        {
          ...snapshot.canvases[0],
          nodes: [
            {
              ...snapshot.canvases[0].nodes[0],
              assetPath: 'assets/images/node_1.png',
            },
          ],
        },
      ],
    };

    expect(shouldApplyPersistedWorkspaceState(snapshot, current, stalePersisted)).toBe(false);
  });

  it('applies a persisted snapshot when it belongs to the current workspace state', () => {
    const snapshot = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'node_1',
            title: '图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'data:image/png;base64,aW1hZ2U=',
          },
        ],
        edges: [],
      },
    ]);
    const persisted = {
      ...snapshot,
      canvases: [
        {
          ...snapshot.canvases[0],
          nodes: [
            {
              ...snapshot.canvases[0].nodes[0],
              assetDataUrl: undefined,
              assetPath: 'assets/images/node_1.png',
            },
          ],
        },
      ],
    };

    expect(shouldApplyPersistedWorkspaceState(snapshot, snapshot, persisted)).toBe(true);
  });
});
