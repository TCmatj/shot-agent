import type { CanvasProject, CanvasProjectPaths } from './types';

const defaultPaths: CanvasProjectPaths = {
  canvas: 'canvas.json',
  workflow: 'workflow.json',
  generations: 'history/generations.jsonl',
  prompts: 'prompts/prompts.jsonl',
  workflowSnapshots: 'history/workflow-snapshots',
  assets: {
    images: 'assets/images',
    videos: 'assets/videos',
    files: 'assets/files',
    covers: 'assets/covers',
  },
  exports: 'exports',
};

type CreateCanvasProjectInput = {
  name: string;
  rootDir: string;
  now?: string;
  id?: string;
};

export function createCanvasProject(input: CreateCanvasProjectInput): CanvasProject {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    rootDir: input.rootDir,
    createdAt: now,
    updatedAt: now,
    paths: defaultPaths,
  };
}
