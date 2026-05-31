import type { CanvasProject, CanvasWorkflow } from '../../src/domain/types';

export const sampleCanvasProject: CanvasProject = {
  id: 'canvas_sample',
  name: '样例画布',
  rootDir: '/tmp/shot-agent-sample',
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
  paths: {
    canvas: 'canvas.json',
    workflow: 'workflow.json',
    generations: 'history/generations.jsonl',
    prompts: 'prompts/prompts.jsonl',
    workflowSnapshots: 'history/workflow-snapshots',
    assets: {
      images: 'assets/images',
      videos: 'assets/videos',
      files: 'assets/files',
    },
    exports: 'exports',
  },
};

export const sampleWorkflow: CanvasWorkflow = {
  id: 'workflow_sample',
  nodes: [],
  edges: [],
  currentGenerationIds: [],
};
