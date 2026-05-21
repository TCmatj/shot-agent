export type WorkspaceHistory<T> = {
  past: T[];
  future: T[];
};

export function createWorkspaceHistory<T>(): WorkspaceHistory<T> {
  return {
    past: [],
    future: [],
  };
}

export function pushWorkspaceHistory<T>(
  history: WorkspaceHistory<T>,
  snapshot: T,
  limit = 80,
): WorkspaceHistory<T> {
  return {
    past: [...history.past, snapshot].slice(-limit),
    future: [],
  };
}

export function undoWorkspaceHistory<T>(
  history: WorkspaceHistory<T>,
  current: T,
): { state: T; history: WorkspaceHistory<T> } {
  const previous = history.past.at(-1);

  if (previous === undefined) {
    return { state: current, history };
  }

  return {
    state: previous,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
  };
}

export function redoWorkspaceHistory<T>(
  history: WorkspaceHistory<T>,
  current: T,
): { state: T; history: WorkspaceHistory<T> } {
  const next = history.future[0];

  if (next === undefined) {
    return { state: current, history };
  }

  return {
    state: next,
    history: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
  };
}
