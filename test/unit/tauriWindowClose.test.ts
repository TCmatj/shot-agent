import { describe, expect, it, vi } from 'vitest';
import { forceCloseTauriWindow } from '../../src/app/App';

describe('forceCloseTauriWindow', () => {
  it('uses the backend exit command before window APIs', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const invokeCommand = vi.fn<(command: string) => Promise<unknown>>().mockResolvedValue(undefined);

    await forceCloseTauriWindow({ close, destroy }, invokeCommand);

    expect(invokeCommand).toHaveBeenCalledWith('force_close_application');
    expect(destroy).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('uses destroy directly so confirmation does not emit another close request', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const invokeCommand = vi.fn<(command: string) => Promise<unknown>>().mockRejectedValue(new Error('unavailable'));

    await forceCloseTauriWindow({ close, destroy }, invokeCommand);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('falls back to close when destroy is rejected', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const destroy = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('destroy failed'));
    const invokeCommand = vi.fn<(command: string) => Promise<unknown>>().mockRejectedValue(new Error('unavailable'));

    await forceCloseTauriWindow({ close, destroy }, invokeCommand);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
