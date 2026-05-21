import { describe, expect, it } from 'vitest';
import {
  appendOutputVersion,
  getEffectiveOutputText,
  getLatestOutputVersion,
  getOutputVersionsForDisplay,
  paginateOutputVersions,
} from '../../src/domain/outputVersions';

describe('output versions', () => {
  it('appends output versions and uses the latest as effective output', () => {
    const first = appendOutputVersion([], '模型输出', 'model', '2026-05-20T00:00:00.000Z');
    const second = appendOutputVersion(first, '修改输出', 'edit', '2026-05-20T00:01:00.000Z');

    expect(second).toHaveLength(2);
    expect(getLatestOutputVersion(second)?.content).toBe('修改输出');
    expect(getEffectiveOutputText({ outputVersions: second })).toBe('修改输出');
  });

  it('paginates versions with newest labels first', () => {
    const versions = Array.from({ length: 12 }, (_, index) => ({
      id: `version_${index + 1}`,
      content: `内容 ${index + 1}`,
      source: 'model' as const,
      createdAt: `2026-05-20T00:${String(index).padStart(2, '0')}:00.000Z`,
    }));

    expect(paginateOutputVersions(versions, 1, 10).items.map((item) => item.label)).toEqual([
      '12',
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
    ]);
    expect(paginateOutputVersions(versions, 2, 10).items.map((item) => item.label)).toEqual([
      '2',
      '1',
    ]);
  });

  it('uses legacy model output as a display version when version history is missing', () => {
    const versions = getOutputVersionsForDisplay({
      modelOutputText: '旧模型输出',
    });

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: 'legacy_output',
      content: '旧模型输出',
      source: 'model',
    });
  });

  it('keeps legacy output as version 1 when appending a new output', () => {
    const displayVersions = getOutputVersionsForDisplay({
      modelOutputText: '旧模型输出',
    });
    const nextVersions = appendOutputVersion(
      displayVersions,
      '新模型输出',
      'model',
      '2026-05-21T00:00:00.000Z',
    );

    expect(nextVersions.map((version) => version.content)).toEqual([
      '旧模型输出',
      '新模型输出',
    ]);
    expect(paginateOutputVersions(nextVersions, 1, 10).items.map((item) => item.label)).toEqual([
      '2',
      '1',
    ]);
  });

  it('uses streaming model output while generation is running', () => {
    const versions = appendOutputVersion(
      [],
      '旧版本输出',
      'model',
      '2026-05-21T00:00:00.000Z',
    );

    expect(
      getEffectiveOutputText({
        outputVersions: versions,
        modelOutputText: '正在流式输出',
        generationStatus: 'running',
      }),
    ).toBe('正在流式输出');
  });
});
