import { describe, expect, it, vi } from 'vitest';
import { createSeedanceTaskTracker } from '../../src/models/seedanceTaskTracker';

describe('seedance task tracker', () => {
  it('polls every 5 seconds and stops on succeeded', async () => {
    vi.useFakeTimers();
    const getTask = vi
      .fn()
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'succeeded', videoUrl: 'https://example.com/video.mp4' });
    const onFinished = vi.fn();

    const tracker = createSeedanceTaskTracker({ getTask });
    tracker.start({ taskId: 'task_1', onUpdate: vi.fn(), onFinished, onFailed: vi.fn() });

    await vi.advanceTimersByTimeAsync(15000);

    expect(getTask).toHaveBeenCalledTimes(3);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
    tracker.stop();
    vi.useRealTimers();
  });

  it('stops on completed for Sora compatible task responses', async () => {
    vi.useFakeTimers();
    const getTask = vi.fn().mockResolvedValueOnce({
      status: 'completed',
      videoUrl: 'https://example.com/video.mp4',
    });
    const onFinished = vi.fn();

    const tracker = createSeedanceTaskTracker({ getTask });
    tracker.start({ taskId: 'task_1', onUpdate: vi.fn(), onFinished, onFailed: vi.fn() });

    await vi.advanceTimersByTimeAsync(5000);

    expect(getTask).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    tracker.stop();
    vi.useRealTimers();
  });
});
