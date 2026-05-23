import { describe, expect, it } from 'vitest';
import {
  estimateSeedanceTokens,
  getSeedanceCapabilities,
  getSeedanceInputPorts,
  getVisibleSeedanceFields,
} from '../../src/domain/seedance';

describe('seedance capabilities', () => {
  it('hides 1080p for seedance2.0-fast', () => {
    expect(getSeedanceCapabilities('seedance2.0-fast').supportedResolutions).toEqual([
      '480p',
      '720p',
    ]);
  });

  it('uses the official Seedance 2.0 duration range and fixed frame rate', () => {
    expect(getSeedanceCapabilities('seedance2.0').durationRangeSeconds).toEqual({
      min: 4,
      max: 15,
      supportsAuto: true,
    });
    expect(getSeedanceCapabilities('seedance2.0-fast').durationRangeSeconds).toEqual({
      min: 4,
      max: 15,
      supportsAuto: true,
    });
    expect(getSeedanceCapabilities('seedance2.0').fixedFrameRate).toBe(24);
    expect(getSeedanceCapabilities('seedance2.0-fast').fixedFrameRate).toBe(24);
    expect(getSeedanceCapabilities('seedance2.0').supportedRatios).toEqual([
      '16:9',
      '4:3',
      '1:1',
      '3:4',
      '9:16',
      '21:9',
      'adaptive',
    ]);
  });

  it('shows first and last frame fields for first-last-frame scenario', () => {
    expect(
      getVisibleSeedanceFields({
        model: 'seedance2.0',
        scenario: 'image_to_video_first_last_frame',
      }),
    ).toContain('lastFrame');
    expect(
      getVisibleSeedanceFields({
        model: 'seedance2.0',
        scenario: 'image_to_video_first_last_frame',
      }),
    ).not.toContain('framespersecond');
  });

  it('returns role-based input ports for multimodal scenario', () => {
    expect(
      getSeedanceInputPorts('multimodal_reference_video').map((port) => port.id),
    ).toEqual(['text', 'reference_image', 'reference_video', 'reference_audio']);
  });

  it('estimates tokens with the pixel formula', () => {
    const low = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '480p',
      ratio: '16:9',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });
    const high = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '720p',
      ratio: '16:9',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });

    const fullHd = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '1080p',
      ratio: '16:9',
      duration: 10,
      framespersecond: 24,
      scenario: 'multimodal_reference_video',
      generateAudio: true,
      multimodalCount: 3,
    });

    const square720 = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '720p',
      ratio: '1:1',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: false,
      multimodalCount: 0,
    });

    expect(low).toBe(Math.round((864 * 496 * 24 * 5) / 1024));
    expect(high).toBe(Math.round((1280 * 720 * 24 * 5) / 1024));
    expect(fullHd).toBe(Math.round((1920 * 1080 * 24 * 10) / 1024));
    expect(square720).toBe(Math.round((960 * 960 * 24 * 5) / 1024));
  });
});
