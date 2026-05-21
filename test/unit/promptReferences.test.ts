import { describe, expect, it } from 'vitest';
import { parsePromptReferences, removePromptReferenceAtCaret } from '../../src/domain/promptReferences';

describe('parsePromptReferences', () => {
  it('extracts @ references from prompt text', () => {
    const refs = parsePromptReferences('请参考 @image:asset_1 和 @video:asset_2 生成新视频');

    expect(refs).toEqual([
      { token: '@image:asset_1', assetId: 'asset_1', kind: 'image' },
      { token: '@video:asset_2', assetId: 'asset_2', kind: 'video' },
    ]);
  });

  it('resolves Chinese image placeholders by occurrence order', () => {
    const refs = parsePromptReferences('@图片 是主体，@图片 是参考背景', {
      image: ['image_1', 'image_2'],
    });

    expect(refs).toEqual([
      { token: '@图片', assetId: 'image_1', kind: 'image' },
      { token: '@图片', assetId: 'image_2', kind: 'image' },
    ]);
  });

  it('shifts Chinese image placeholder resolution when inserted before existing placeholders', () => {
    const refs = parsePromptReferences('@图片 新增，@图片 是主体，@图片 是参考背景', {
      image: ['image_0', 'image_1', 'image_2'],
    });

    expect(refs.map((reference) => reference.assetId)).toEqual([
      'image_0',
      'image_1',
      'image_2',
    ]);
  });

  it('keeps explicit image references from consuming Chinese placeholder order', () => {
    const refs = parsePromptReferences('@image:selected 是主体，@图片 是参考背景', {
      image: ['image_1'],
    });

    expect(refs).toEqual([
      { token: '@image:selected', assetId: 'selected', kind: 'image' },
      { token: '@图片', assetId: 'image_1', kind: 'image' },
    ]);
  });

  it('ignores unsupported reference kinds', () => {
    const refs = parsePromptReferences('忽略 @unknown:asset_1');

    expect(refs).toEqual([]);
  });

  it('removes a reference token with one backward delete', () => {
    expect(removePromptReferenceAtCaret('参考 @text:asset_1 继续', 16, 'backward')).toEqual({
      prompt: '参考 继续',
      caret: 3,
    });
  });

  it('removes a Chinese reference token with one backward delete', () => {
    expect(removePromptReferenceAtCaret('参考 @图片 继续', 6, 'backward')).toEqual({
      prompt: '参考 继续',
      caret: 3,
    });
  });

  it('removes a reference token with one forward delete', () => {
    expect(removePromptReferenceAtCaret('参考 @image:asset_1 继续', 2, 'forward')).toEqual(null);
    expect(removePromptReferenceAtCaret('参考 @image:asset_1 继续', 3, 'forward')).toEqual({
      prompt: '参考 继续',
      caret: 3,
    });
  });
});
