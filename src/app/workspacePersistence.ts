import { serializeWorkspaceState, type CanvasWorkspaceState } from './canvasWorkspace';

export function shouldApplyPersistedWorkspaceState(
  snapshot: CanvasWorkspaceState,
  current: CanvasWorkspaceState,
  persisted: CanvasWorkspaceState,
): boolean {
  return (
    current === snapshot &&
    serializeWorkspaceState(persisted) !== serializeWorkspaceState(current)
  );
}
