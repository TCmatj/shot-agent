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

  it('shows first and last frame fields for first-last-frame scenario', () => {
    expect(
      getVisibleSeedanceFields({
        model: 'seedance2.0',
        scenario: 'image_to_video_first_last_frame',
      }),
    ).toContain('lastFrame');
  });

  it('returns role-based input ports for multimodal scenario', () => {
    expect(
      getSeedanceInputPorts('multimodal_reference_video').map((port) => port.id),
    ).toEqual(['text', 'reference_image', 'reference_video', 'reference_audio']);
  });

  it('estimates more tokens for 720p than 480p at the same duration', () => {
    const low = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '480p',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });
    const high = estimateSeedanceTokens({
      model: 'seedance2.0',
      resolution: '720p',
      duration: 5,
      framespersecond: 24,
      scenario: 'text_to_video',
      generateAudio: true,
      multimodalCount: 0,
    });

    expect(high).toBeGreaterThan(low);
  });
});
