import { describe, expect, it, vi } from 'vitest';
import {
  createObjectStorageConfig,
  createObjectStorageConfigFromEnv,
  createAssetContentHash,
  getAssetUploadEndpointFromEnv,
  isRemoteAssetUrl,
  isObjectStorageConfigured,
  uploadBlobToAssetEndpoint,
  uploadBlobToR2,
} from '../../src/storage/objectStorage';

describe('objectStorage', () => {
  it('detects remote asset urls for upload skipping', () => {
    expect(isRemoteAssetUrl('https://example.com/video.mp4')).toBe(true);
    expect(isRemoteAssetUrl('http://example.com/video.mp4')).toBe(true);
    expect(isRemoteAssetUrl('asset://video/123')).toBe(true);
    expect(isRemoteAssetUrl('blob:http://localhost/video')).toBe(false);
    expect(isRemoteAssetUrl('data:video/mp4;base64,AAAA')).toBe(false);
  });

  it('uploads a blob to R2 and returns a public url', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      ({
        ok: true,
        status: 200,
        text: async () => '',
      }) as Response,
    );
    const config = createObjectStorageConfig({
      endpoint: 'https://example-account.r2.cloudflarestorage.com',
      bucket: 'shot-agent',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      publicBaseURL: 'https://assets.example.com',
    });

    const url = await uploadBlobToR2({
      config,
      key: 'canvases/canvas_1/references/input.mp4',
      blob: new Blob(['video-bytes'], { type: 'video/mp4' }),
      fetcher,
      now: new Date('2026-05-26T00:00:00.000Z'),
    });

    expect(url).toBe('https://assets.example.com/canvases/canvas_1/references/input.mp4');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const firstCall = fetcher.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      'https://example-account.r2.cloudflarestorage.com/shot-agent/canvases/canvas_1/references/input.mp4',
    );

    const requestInit = firstCall?.[1];
    expect(requestInit?.method).toBe('PUT');
    expect(requestInit?.headers).toMatchObject({
      'Content-Type': 'video/mp4',
      Host: 'example-account.r2.cloudflarestorage.com',
      'x-amz-content-sha256': expect.any(String),
      'x-amz-date': '20260526T000000Z',
      Authorization: expect.stringContaining('AWS4-HMAC-SHA256'),
    });
  });

  it('creates R2 config from Vite environment variables', () => {
    const config = createObjectStorageConfigFromEnv({
      VITE_R2_ACCOUNT_ID: 'account-id',
      VITE_R2_BUCKET_NAME: 'shot-agent',
      VITE_R2_ACCESS_KEY_ID: 'access-key',
      VITE_R2_SECRET_ACCESS_KEY: 'secret-key',
      VITE_R2_ENDPOINT: 'https://example-account.r2.cloudflarestorage.com',
      VITE_R2_PUBLIC_BASE_URL: 'https://assets.example.com',
    });

    expect(config).toEqual({
      endpoint: 'https://example-account.r2.cloudflarestorage.com',
      bucket: 'shot-agent',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      publicBaseURL: 'https://assets.example.com',
    });
    expect(isObjectStorageConfigured(config)).toBe(true);
  });

  it('uploads a blob through the configured asset endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://assets.example.com/input.png' }),
      }) as Response,
    );

    const url = await uploadBlobToAssetEndpoint({
      endpoint: 'http://localhost:8787/api/assets/reference-upload',
      blob: new Blob(['image-bytes'], { type: 'image/png' }),
      canvasId: 'canvas_1',
      nodeId: 'image_1',
      filename: 'input.png',
      fetcher,
    });

    expect(url).toBe('https://assets.example.com/input.png');
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8787/api/assets/reference-upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const body = fetcher.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('canvasId')).toBe('canvas_1');
    expect(body.get('nodeId')).toBe('image_1');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('reads the asset upload endpoint from Vite environment variables', () => {
    expect(
      getAssetUploadEndpointFromEnv({
        VITE_ASSET_UPLOAD_ENDPOINT: ' http://localhost:8787/api/assets/reference-upload ',
      }),
    ).toBe('http://localhost:8787/api/assets/reference-upload');
  });

  it('creates a stable content hash for asset blobs', async () => {
    await expect(createAssetContentHash(new Blob(['same-image'], { type: 'image/png' }))).resolves.toBe(
      'sha256:fcc6824d4f99b1b5b6011e00c9b3db91555e6d2d8aab66693bc3a324c437bc6c',
    );
  });
});
