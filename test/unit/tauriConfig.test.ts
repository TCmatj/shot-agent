import { describe, expect, it } from 'vitest';
import defaultCapability from '../../src-tauri/capabilities/default.json';
import tauriConfig from '../../src-tauri/tauri.conf.json';

describe('Tauri desktop window configuration', () => {
  it('lets the web frontend receive HTML5 file drops on Windows', () => {
    expect(tauriConfig.app.windows[0].dragDropEnabled).toBe(false);
  });

  it('allows desktop workspace files to be read and written after folder selection', () => {
    expect(defaultCapability.permissions).toContain('fs:read-all');
    expect(defaultCapability.permissions).toContain('fs:write-all');
    expect(defaultCapability.permissions).toContain('allow-authorize-workspace-directory');
    expect(defaultCapability.permissions).not.toContainEqual({
      identifier: 'fs:scope',
      allow: ['**'],
    });
  });
});
