export function getCanvasDirectories(): string[] {
  return [
    'history',
    'history/workflow-snapshots',
    'prompts',
    'assets/images',
    'assets/videos',
    'assets/files',
    'assets/covers',
    'exports',
  ];
}

export function makeUniqueAssetName(fileName: string, existingNames: Set<string>): string {
  if (!existingNames.has(fileName)) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);

  let index = 1;
  let candidate = `${baseName}-${index}${extension}`;

  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${baseName}-${index}${extension}`;
  }

  return candidate;
}
