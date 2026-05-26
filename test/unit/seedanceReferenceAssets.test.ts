import { describe, expect, it } from 'vitest';
import { createWorkspaceState } from '../../src/app/canvasWorkspace';
import {
  applyUploadedSeedanceAssetUrls,
  collectSeedanceUploadCandidates,
} from '../../src/models/seedanceReferenceAssets';

describe('seedanceReferenceAssets', () => {
  it('collects local upload candidates and skips remote assets', () => {
    const canvas = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'image_asset_local',
            title: '本地图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'data:image/png;base64,AAAA',
            assetMimeType: 'image/png',
          },
          {
            id: 'video_asset_remote',
            title: '远程视频',
            modelId: 'asset-video',
            kind: 'videoAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'https://example.com/remote.mp4',
            assetMimeType: 'video/mp4',
          },
          {
            id: 'audio_asset_local',
            title: '本地音频',
            modelId: 'asset-audio',
            kind: 'audioAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'blob:http://localhost/audio',
            assetMimeType: 'audio/mpeg',
          },
        ],
        edges: [],
      },
    ]).canvases[0];

    const candidates = collectSeedanceUploadCandidates(canvas, [
      'image_asset_local',
      'video_asset_remote',
      'audio_asset_local',
    ]);

    expect(candidates).toEqual([
      {
        nodeId: 'image_asset_local',
        kind: 'image',
        content: 'data:image/png;base64,AAAA',
        mimeType: 'image/png',
      },
      {
        nodeId: 'audio_asset_local',
        kind: 'audio',
        content: 'blob:http://localhost/audio',
        mimeType: 'audio/mpeg',
      },
    ]);
  });

  it('applies uploaded urls back onto asset and generation nodes', () => {
    const canvas = createWorkspaceState([
      {
        id: 'canvas_1',
        name: '画布',
        updatedAt: '刚刚',
        nodes: [
          {
            id: 'image_asset_local',
            title: '本地图片',
            modelId: 'asset-image',
            kind: 'imageAsset',
            x: 0,
            y: 0,
            assetDataUrl: 'data:image/png;base64,AAAA',
          },
          {
            id: 'image_generated_local',
            title: '本地图片输出',
            modelId: 'gpt-image-2',
            kind: 'image',
            x: 0,
            y: 0,
            outputDataUrl: 'data:image/png;base64,BBBB',
          },
          {
            id: 'video_generated_local',
            title: '本地视频输出',
            modelId: 'seedance2.0',
            kind: 'video',
            x: 0,
            y: 0,
            outputDataUrl: 'blob:http://localhost/video',
          },
        ],
        edges: [],
      },
    ]).canvases[0];

    const updated = applyUploadedSeedanceAssetUrls(canvas, new Map([
      ['image_asset_local', 'https://assets.example.com/image.png'],
      ['image_generated_local', 'https://assets.example.com/image-output.png'],
      ['video_generated_local', 'https://assets.example.com/video-output.mp4'],
    ]));

    expect(updated.nodes.find((node) => node.id === 'image_asset_local')?.assetDataUrl).toBe(
      'https://assets.example.com/image.png',
    );
    expect(updated.nodes.find((node) => node.id === 'image_generated_local')).toMatchObject({
      outputDataUrl: 'https://assets.example.com/image-output.png',
      outputUrl: 'https://assets.example.com/image-output.png',
    });
    expect(updated.nodes.find((node) => node.id === 'video_generated_local')).toMatchObject({
      outputDataUrl: 'https://assets.example.com/video-output.mp4',
      outputUrl: 'https://assets.example.com/video-output.mp4',
    });
  });
});
