import type { AssetKind, PromptReference } from './types';

const supportedKinds = new Set<AssetKind>(['image', 'video', 'audio', 'file', 'text']);
const referencePattern =
  /@(image|video|audio|file|text):([a-zA-Z0-9_-]+)|@(图片|视频|音频|文件|文本)/g;
const naturalReferenceKindByLabel: Record<string, AssetKind> = {
  图片: 'image',
  视频: 'video',
  音频: 'audio',
  文件: 'file',
  文本: 'text',
};

export type PromptReferenceResolution = Partial<Record<AssetKind, string[]>>;

export function parsePromptReferences(
  prompt: string,
  resolution: PromptReferenceResolution = {},
): PromptReference[] {
  const references: PromptReference[] = [];
  const occurrenceIndexes: Record<AssetKind, number> = {
    image: 0,
    video: 0,
    audio: 0,
    file: 0,
    text: 0,
  };

  for (const match of prompt.matchAll(referencePattern)) {
    const kind = (match[1] as AssetKind | undefined) ?? naturalReferenceKindByLabel[match[3]];

    if (!kind || !supportedKinds.has(kind)) {
      continue;
    }

    const assetId = match[2] ?? resolution[kind]?.[occurrenceIndexes[kind]];
    occurrenceIndexes[kind] += 1;

    if (!assetId) {
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
