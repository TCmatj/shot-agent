import { describe, expect, it, vi } from 'vitest';
import {
  createObjectStorageConfig,
  isRemoteAssetUrl,
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
});
