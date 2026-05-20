import { describe, expect, it } from 'vitest';
import { parsePromptReferences } from '../../src/domain/promptReferences';

describe('parsePromptReferences', () => {
  it('extracts @ references from prompt text', () => {
    const refs = parsePromptReferences('请参考 @image:asset_1 和 @video:asset_2 生成新视频');

    expect(refs).toEqual([
      { token: '@image:asset_1', assetId: 'asset_1', kind: 'image' },
      { token: '@video:asset_2', assetId: 'asset_2', kind: 'video' },
    ]);
  });

  it('ignores unsupported reference kinds', () => {
    const refs = parsePromptReferences('忽略 @unknown:asset_1');

    expect(refs).toEqual([]);
  });
});
