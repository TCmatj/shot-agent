import type { CanvasEdge, CanvasNode, CanvasWorkflow, ID, ModelNodeConfig } from './types';

type CreateWorkflowInput = {
  id: ID;
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
  currentGenerationIds?: ID[];
};

export function createCanvasWorkflow(input: CreateWorkflowInput): CanvasWorkflow {
  return {
    id: input.id,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    currentGenerationIds: input.currentGenerationIds ?? [],
  };
}

export function addWorkflowNode(
  workflow: CanvasWorkflow,
  node: CanvasNode,
): CanvasWorkflow {
  if (workflow.nodes.some((currentNode) => currentNode.id === node.id)) {
    return workflow;
  }

  return {
    ...workflow,
    nodes: [...workflow.nodes, node],
  };
}

export function removeWorkflowNode(
  workflow: CanvasWorkflow,
  nodeId: ID,
): CanvasWorkflow {
  return {
    ...workflow,
    nodes: workflow.nodes.filter((node) => node.id !== nodeId),
    edges: workflow.edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
    ),
    currentGenerationIds: workflow.currentGenerationIds.filter((id) => id !== nodeId),
  };
}

export function connectWorkflowNodes(
  workflow: CanvasWorkflow,
  edge: CanvasEdge,
): CanvasWorkflow {
  if (edge.fromNodeId === edge.toNodeId) {
    return workflow;
  }

  const hasBothNodes =
    workflow.nodes.some((node) => node.id === edge.fromNodeId) &&
    workflow.nodes.some((node) => node.id === edge.toNodeId);

  if (!hasBothNodes) {
    return workflow;
  }

  const edgeExists = workflow.edges.some(
    (currentEdge) =>
      currentEdge.fromNodeId === edge.fromNodeId && currentEdge.toNodeId === edge.toNodeId,
  );

  if (edgeExists) {
    return workflow;
  }

  return {
    ...workflow,
    edges: [...workflow.edges, edge],
  };
}

export function updateWorkflowNodeModel(
  workflow: CanvasWorkflow,
  nodeId: ID,
  model: ModelNodeConfig,
): CanvasWorkflow {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => (node.id === nodeId ? { ...node, model } : node)),
  };
}
