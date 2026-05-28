import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('asset upload control styles', () => {
  it('keeps file inputs activatable through their labels in desktop webviews', () => {
    const css = readFileSync('src/app/App.css', 'utf8');
    const assetUploadInputRule = css.match(/\.asset-upload input\s*\{[^}]*\}/)?.[0] ?? '';

    expect(assetUploadInputRule).not.toContain('display: none');
  });
});
