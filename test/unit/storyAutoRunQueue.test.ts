import { describe, expect, it } from 'vitest';
import {
  normalizeStoryAutoRunConcurrencyLimit,
  runStoryAutoRunQueue,
} from '../../src/app/storyAutoRunQueue';

describe('story auto run queue', () => {
  it('limits image concurrency to 5 and video concurrency to 3', async () => {
    const tasks = [
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `image_${index + 1}`,
        kind: 'image' as const,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `video_${index + 1}`,
        kind: 'video' as const,
      })),
    ];

    let activeImages = 0;
    let activeVideos = 0;
    let maxActiveImages = 0;
    let maxActiveVideos = 0;

    await runStoryAutoRunQueue(tasks, async (task) => {
      if (task.kind === 'image') {
        activeImages += 1;
        maxActiveImages = Math.max(maxActiveImages, activeImages);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeImages -= 1;
        return;
      }

      activeVideos += 1;
      maxActiveVideos = Math.max(maxActiveVideos, activeVideos);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeVideos -= 1;
    });

    expect(maxActiveImages).toBe(5);
    expect(maxActiveVideos).toBe(3);
  });

  it('uses caller-provided concurrency limits', async () => {
    const tasks = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `image_${index + 1}`,
        kind: 'image' as const,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `video_${index + 1}`,
        kind: 'video' as const,
      })),
    ];

    let activeImages = 0;
    let activeVideos = 0;
    let maxActiveImages = 0;
    let maxActiveVideos = 0;

    await runStoryAutoRunQueue(
      tasks,
      async (task) => {
        if (task.kind === 'image') {
          activeImages += 1;
          maxActiveImages = Math.max(maxActiveImages, activeImages);
          await new Promise((resolve) => setTimeout(resolve, 5));
          activeImages -= 1;
          return;
        }

        activeVideos += 1;
        maxActiveVideos = Math.max(maxActiveVideos, activeVideos);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeVideos -= 1;
      },
      {
        image: 2,
        video: 1,
      },
    );

    expect(maxActiveImages).toBe(2);
    expect(maxActiveVideos).toBe(1);
  });

  it('normalizes invalid concurrency values into the supported range', () => {
    expect(normalizeStoryAutoRunConcurrencyLimit(-3)).toBe(1);
    expect(normalizeStoryAutoRunConcurrencyLimit(2.7)).toBe(3);
    expect(normalizeStoryAutoRunConcurrencyLimit(99)).toBe(10);
  });
});
