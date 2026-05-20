import type { AssetReference, CanvasAsset } from '../domain/types';

export type SaveAssetInput = {
  name: string;
  kind: CanvasAsset['kind'];
  source: AssetReference;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
};

export type AssetStore = {
  saveAsset(input: SaveAssetInput): Promise<CanvasAsset>;
  markMissing(asset: CanvasAsset, missingPath: string): CanvasAsset;
};
