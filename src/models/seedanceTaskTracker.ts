export type SeedanceTrackedTask = {
  status?: string;
  [key: string]: unknown;
};

export function createSeedanceTaskTracker(input: {
  getTask(taskId: string): Promise<SeedanceTrackedTask>;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function tick(options: {
    taskId: string;
    onUpdate(task: SeedanceTrackedTask): void;
    onFinished(task: SeedanceTrackedTask): void;
    onFailed(task: SeedanceTrackedTask): void;
  }) {
    if (stopped) {
      return;
    }

    const task = await input.getTask(options.taskId);
    options.onUpdate(task);

    if (task.status === 'succeeded') {
      options.onFinished(task);
      return;
    }

    if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired') {
      options.onFailed(task);
      return;
    }

    timer = setTimeout(() => {
      void tick(options);
    }, 5000);
  }

  return {
    start(options: Parameters<typeof tick>[0]) {
      stopped = false;
      void tick(options);
    },
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
