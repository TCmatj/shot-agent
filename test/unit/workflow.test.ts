import { describe, expect, it } from 'vitest';
import {
  addWorkflowNode,
  connectWorkflowNodes,
  createCanvasWorkflow,
  removeWorkflowNode,
  updateWorkflowNodeModel,
} from '../../src/domain/workflow';
import type { CanvasNode } from '../../src/domain/types';

const imageNode: CanvasNode = {
  id: 'node_image',
  kind: 'image',
  label: '图片节点',
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  outputAssetIds: [],
};

const videoNode: CanvasNode = {
  id: 'node_video',
  kind: 'video',
  label: '视频节点',
  x: 420,
  y: 0,
  width: 320,
  height: 180,
  outputAssetIds: [],
};

describe('canvas workflow', () => {
  it('creates an empty workflow by default', () => {
    expect(createCanvasWorkflow({ id: 'workflow_1' })).toEqual({
      id: 'workflow_1',
      nodes: [],
      edges: [],
      currentGenerationIds: [],
    });
  });

  it('adds nodes without duplicating ids', () => {
    const workflow = createCanvasWorkflow({ id: 'workflow_1' });
    const withNode = addWorkflowNode(workflow, imageNode);

    expect(withNode.nodes).toEqual([imageNode]);
    expect(addWorkflowNode(withNode, imageNode)).toBe(withNode);
  });

  it('connects existing nodes and rejects invalid edges', () => {
    const workflow = createCanvasWorkflow({
      id: 'workflow_1',
      nodes: [imageNode, videoNode],
    });
    const edge = {
      id: 'edge_image_video',
      fromNodeId: 'node_image',
      toNodeId: 'node_video',
    };
    const connected = connectWorkflowNodes(workflow, edge);

    expect(connected.edges).toEqual([edge]);
    expect(connectWorkflowNodes(connected, edge)).toBe(connected);
    expect(connectWorkflowNodes(connected, { ...edge, toNodeId: 'missing' })).toBe(connected);
    expect(connectWorkflowNodes(connected, { ...edge, toNodeId: 'node_image' })).toBe(connected);
  });

  it('removes a node with connected edges', () => {
    const workflow = createCanvasWorkflow({
      id: 'workflow_1',
      nodes: [imageNode, videoNode],
      edges: [{ id: 'edge_image_video', fromNodeId: 'node_image', toNodeId: 'node_video' }],
      currentGenerationIds: ['node_image', 'gen_other'],
    });

    expect(removeWorkflowNode(workflow, 'node_image')).toEqual({
      id: 'workflow_1',
      nodes: [videoNode],
      edges: [],
      currentGenerationIds: ['gen_other'],
    });
  });

  it('updates model config for a node', () => {
    const workflow = createCanvasWorkflow({ id: 'workflow_1', nodes: [imageNode] });
    const model = {
      canonicalModelId: 'gpt-image-2',
      providerId: 'provider_openai',
      prompt: '生成一张图',
      promptReferences: [],
      retry: {
        enabled: true,
        maxAttempts: 3,
      },
    };

    expect(updateWorkflowNodeModel(workflow, 'node_image', model).nodes[0].model).toEqual(model);
  });
});
