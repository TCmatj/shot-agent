import type { CanvasProject, CanvasWorkflow } from '../domain/types';

export type LocalCanvasStore = {
  createProject(project: CanvasProject, workflow: CanvasWorkflow): Promise<void>;
  readProject(rootDir: string): Promise<CanvasProject>;
  writeWorkflow(project: CanvasProject, workflow: CanvasWorkflow): Promise<void>;
};
