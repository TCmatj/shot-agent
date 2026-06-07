type StoryAutoRunTaskKind = 'image' | 'video';

export type StoryAutoRunTask<T = string> = {
  id: T;
  kind: StoryAutoRunTaskKind;
};

export const defaultStoryAutoRunConcurrencyLimits: Record<StoryAutoRunTaskKind, number> = {
  image: 5,
  video: 3,
};

export async function runStoryAutoRunQueue<T>(
  tasks: StoryAutoRunTask<T>[],
  runner: (task: StoryAutoRunTask<T>) => Promise<void>,
  limits: Partial<Record<StoryAutoRunTaskKind, number>> = {},
): Promise<void> {
  await Promise.all(
    (Object.keys(defaultStoryAutoRunConcurrencyLimits) as StoryAutoRunTaskKind[]).map((kind) =>
      runLimitedTasks(
        tasks.filter((task) => task.kind === kind),
        normalizeStoryAutoRunConcurrencyLimit(limits[kind] ?? defaultStoryAutoRunConcurrencyLimits[kind]),
        runner,
      ),
    ),
  );
}

export function normalizeStoryAutoRunConcurrencyLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

async function runLimitedTasks<T>(
  tasks: StoryAutoRunTask<T>[],
  limit: number,
  runner: (task: StoryAutoRunTask<T>) => Promise<void>,
) {
  if (tasks.length === 0) {
    return;
  }

  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex];
      nextIndex += 1;

      if (!task) {
        return;
      }

      await runner(task);
    }
  });

  await Promise.all(workers);
}
