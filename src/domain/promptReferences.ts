import type { AssetKind, PromptReference } from './types';

const supportedKinds = new Set<AssetKind>(['image', 'video', 'audio', 'file', 'text']);
const referencePattern = /@(image|video|audio|file|text):([a-zA-Z0-9_-]+)/g;

export function parsePromptReferences(prompt: string): PromptReference[] {
  const references: PromptReference[] = [];

  for (const match of prompt.matchAll(referencePattern)) {
    const kind = match[1] as AssetKind;
    const assetId = match[2];

    if (!supportedKinds.has(kind)) {
      continue;
    }

    references.push({
      token: match[0],
      assetId,
      kind,
    });
  }

  return references;
}
