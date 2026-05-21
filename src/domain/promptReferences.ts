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

export function removePromptReferenceAtCaret(
  prompt: string,
  caret: number,
  direction: 'backward' | 'forward',
): { prompt: string; caret: number } | null {
  for (const match of prompt.matchAll(referencePattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    const end = start + token.length;

    if (direction === 'backward') {
      const isAfterToken = caret === end;
      const isAfterTokenSpace = caret > end && prompt.slice(end, caret).trim() === '';

      if (isAfterToken || isAfterTokenSpace) {
        const removeEnd = isAfterTokenSpace ? caret : prompt[end] === ' ' ? end + 1 : end;
        return {
          prompt: `${prompt.slice(0, start)}${prompt.slice(removeEnd)}`,
          caret: start,
        };
      }
    }

    if (direction === 'forward' && caret === start) {
      const hasTrailingSpace = prompt[end] === ' ';
      return {
        prompt: `${prompt.slice(0, start)}${prompt.slice(hasTrailingSpace ? end + 1 : end)}`,
        caret: start,
      };
    }
  }

  return null;
}
