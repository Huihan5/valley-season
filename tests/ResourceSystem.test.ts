import { describe, it, expect } from 'vitest';
import { getGrainTier } from '../src/systems/ResourceSystem';
import { GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD } from '../src/data/config';

describe('two-tier grain thresholds', () => {
  it('falls short below the 留任线', () => {
    expect(getGrainTier(0)).toBe('short');
    expect(getGrainTier(GRAIN_RETAIN_THRESHOLD - 1)).toBe('short');
  });

  it('holds the post between 留任线 and 优秀线', () => {
    expect(getGrainTier(GRAIN_RETAIN_THRESHOLD)).toBe('retain');
    expect(getGrainTier(GRAIN_EXCELLENT_THRESHOLD - 1)).toBe('retain');
  });

  it('clears the 优秀线 at 90 and above', () => {
    expect(getGrainTier(GRAIN_EXCELLENT_THRESHOLD)).toBe('excellent');
    expect(getGrainTier(140)).toBe('excellent');
  });

  it('keeps the two thresholds where the GDD puts them', () => {
    expect(GRAIN_RETAIN_THRESHOLD).toBe(75);
    expect(GRAIN_EXCELLENT_THRESHOLD).toBe(90);
  });
});
