import { describe, expect, it } from 'vitest';
import {
  createWorkspaceHistory,
  pushWorkspaceHistory,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
} from '../../src/app/workspaceHistory';

describe('workspace history', () => {
  it('restores the previous workspace state and keeps redo available', () => {
    const first = { activeCanvasId: 'one' };
    const second = { activeCanvasId: 'two' };
    const third = { activeCanvasId: 'three' };
    let history = createWorkspaceHistory<typeof first>();

    history = pushWorkspaceHistory(history, first);
    history = pushWorkspaceHistory(history, second);
    const undoResult = undoWorkspaceHistory(history, third);

    expect(undoResult.state).toBe(second);
    expect(undoResult.history.past).toEqual([first]);
    expect(undoResult.history.future).toEqual([third]);

    const redoResult = redoWorkspaceHistory(undoResult.history, undoResult.state);
    expect(redoResult.state).toBe(third);
    expect(redoResult.history.past).toEqual([first, second]);
    expect(redoResult.history.future).toEqual([]);
  });

  it('clears redo snapshots after a new edit', () => {
    let history = createWorkspaceHistory<string>();

    history = pushWorkspaceHistory(history, 'one');
    const undone = undoWorkspaceHistory(history, 'two');
    const nextHistory = pushWorkspaceHistory(undone.history, undone.state);

    expect(nextHistory.past).toEqual(['one']);
    expect(nextHistory.future).toEqual([]);
  });

  it('limits snapshots to avoid unbounded memory growth', () => {
    let history = createWorkspaceHistory<number>();

    for (let index = 0; index < 90; index += 1) {
      history = pushWorkspaceHistory(history, index, 3);
    }

    expect(history.past).toEqual([87, 88, 89]);
  });
});
