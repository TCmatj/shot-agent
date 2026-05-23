import { describe, expect, it } from 'vitest';
import { resolveWorkspaceStoreKind } from '../../src/storage/runtime';

describe('workspace store runtime selection', () => {
  it('prefers tauri storage when running in tauri runtime', () => {
    expect(resolveWorkspaceStoreKind({ isTauri: true, hasBrowserDirectoryPicker: true })).toBe('desktop');
  });

  it('falls back to browser storage when directory picker is available', () => {
    expect(resolveWorkspaceStoreKind({ isTauri: false, hasBrowserDirectoryPicker: true })).toBe('browser');
  });

  it('returns unsupported when neither runtime capability is available', () => {
    expect(resolveWorkspaceStoreKind({ isTauri: false, hasBrowserDirectoryPicker: false })).toBe('unsupported');
  });
});
