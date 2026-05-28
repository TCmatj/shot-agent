import { describe, expect, it, vi } from 'vitest';
import { forceCloseTauriWindow } from '../../src/app/App';

describe('forceCloseTauriWindow', () => {
  it('uses destroy directly so confirmation does not emit another close request', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await forceCloseTauriWindow({ close, destroy });

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('falls back to close when destroy is rejected', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const destroy = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('destroy failed'));

    await forceCloseTauriWindow({ close, destroy });

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
