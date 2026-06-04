export type OutputVersion = {
  id: string;
  content: string;
  source: 'model' | 'edit';
  createdAt: string;
};

export type OutputVersionLikeNode = {
  outputVersions?: OutputVersion[];
  outputText?: string;
  modelOutputText?: string;
  generationStatus?: string;
};

export type PaginatedOutputVersion = OutputVersion & {
  label: string;
};

export function appendOutputVersion(
  versions: OutputVersion[] | undefined,
  content: string,
  source: OutputVersion['source'],
  now = new Date().toISOString(),
): OutputVersion[] {
  const nextIndex = (versions?.length ?? 0) + 1;

  return [
    ...(versions ?? []),
    {
      id: `output_${Date.parse(now) || Date.now()}_${nextIndex}`,
      content,
      source,
      createdAt: now,
    },
  ];
}

export function getLatestOutputVersion(
  versions: OutputVersion[] | undefined,
): OutputVersion | undefined {
  return versions?.[versions.length - 1];
}

export function getEffectiveOutputText(node: OutputVersionLikeNode): string | undefined {
  if (node.generationStatus === 'running' && node.modelOutputText !== undefined) {
    return node.modelOutputText;
  }

  return getLatestOutputVersion(node.outputVersions)?.content ?? node.outputText ?? node.modelOutputText;
}

export function getOutputVersionsForDisplay(node: OutputVersionLikeNode): OutputVersion[] {
  if (node.outputVersions?.length) {
    return node.outputVersions;
  }

  const content = node.modelOutputText ?? node.outputText;

  return content
    ? [
        {
          id: 'legacy_output',
          content,
          source: 'model',
          createdAt: '',
        },
      ]
    : [];
}

export function getStoredOutputVersions(node: OutputVersionLikeNode): OutputVersion[] {
  return node.outputVersions ?? [];
}

export function paginateOutputVersions(
  versions: OutputVersion[] | undefined,
  page: number,
  pageSize = 10,
): {
  items: PaginatedOutputVersion[];
  page: number;
  pageCount: number;
} {
  const total = versions?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const newestFirst = [...(versions ?? [])].reverse();
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageCount,
    items: newestFirst.slice(start, start + pageSize).map((version, index) => ({
      ...version,
      label: String(total - start - index),
    })),
  };
}
