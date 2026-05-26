import type { CanvasNodeView, CanvasView } from '../app/canvasWorkspace';
import { isRemoteAssetUrl } from '../storage/objectStorage';

export type SeedanceUploadCandidate = {
  nodeId: string;
  kind: 'image' | 'video' | 'audio';
  content: string;
  mimeType?: string;
};

export function collectSeedanceUploadCandidates(
  canvas: CanvasView,
  nodeIds: string[],
): SeedanceUploadCandidate[] {
  const uniqueIds = [...new Set(nodeIds)];

  return uniqueIds.flatMap<SeedanceUploadCandidate>((nodeId) => {
    const node = canvas.nodes.find((current) => current.id === nodeId);
    if (!node) {
      return [];
    }

    const candidate = getSeedanceUploadCandidate(node);
    if (!candidate || isRemoteAssetUrl(candidate.content)) {
      return [];
    }

    return [candidate];
  });
}

export function applyUploadedSeedanceAssetUrls(
  canvas: CanvasView,
  uploadedUrls: Map<string, string>,
): CanvasView {
  if (uploadedUrls.size === 0) {
    return canvas;
  }

  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => {
      const uploadedUrl = uploadedUrls.get(node.id);

      if (!uploadedUrl) {
        return node;
      }

      if (
        node.kind === 'imageAsset' ||
        node.kind === 'videoAsset' ||
        node.kind === 'audioAsset'
      ) {
        return {
          ...node,
          assetDataUrl: uploadedUrl,
        };
      }

      if (node.kind === 'image' || node.kind === 'video') {
        return {
          ...node,
          outputDataUrl: uploadedUrl,
          outputUrl: uploadedUrl,
        };
      }

      return node;
    }),
  };
}

export function getSeedanceUploadCandidate(
  node: CanvasNodeView,
): SeedanceUploadCandidate | null {
  if (node.kind === 'imageAsset' && node.assetDataUrl) {
    return {
      nodeId: node.id,
      kind: 'image',
      content: node.assetDataUrl,
      mimeType: node.assetMimeType,
    };
  }

  if (node.kind === 'image') {
    const content = node.outputUrl ?? node.outputDataUrl;
    return content
      ? {
          nodeId: node.id,
          kind: 'image',
          content,
          mimeType: node.assetMimeType,
        }
      : null;
  }

  if (node.kind === 'videoAsset' && node.assetDataUrl) {
    return {
      nodeId: node.id,
      kind: 'video',
      content: node.assetDataUrl,
      mimeType: node.assetMimeType,
    };
  }

  if (node.kind === 'video') {
    const content = node.outputUrl ?? node.outputDataUrl;
    return content
      ? {
          nodeId: node.id,
          kind: 'video',
          content,
          mimeType: node.assetMimeType,
        }
      : null;
  }

  if (node.kind === 'audioAsset' && node.assetDataUrl) {
    return {
      nodeId: node.id,
      kind: 'audio',
      content: node.assetDataUrl,
      mimeType: node.assetMimeType,
    };
  }

  return null;
}
