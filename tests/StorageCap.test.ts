import { describe, it, expect } from 'vitest';
import { clampResources } from '../src/systems/ResourceSystem';
import { GRAIN_STORAGE_CAP_UNCLEARED, GRAIN_EXCELLENT_THRESHOLD } from '../src/data/config';

const RES = { grain: 0, guldmark: 50, timber: 8, renown: 0 };

describe('grain storage cap', () => {
  it('spills anything over 80 while the barn is uncleared', () => {
    expect(clampResources({ ...RES, grain: 95 }).grain).toBe(GRAIN_STORAGE_CAP_UNCLEARED);
  });

  it('lets grain through once storage has been cleared', () => {
    expect(clampResources({ ...RES, grain: 95 }, { storageCleared: true }).grain).toBe(95);
  });

  it('is what stands between the player and the 优秀线', () => {
    // The whole point of the fix: 90 is unreachable until the barn is cleared.
    const uncleared = clampResources({ ...RES, grain: 100 }).grain;
    const cleared = clampResources({ ...RES, grain: 100 }, { storageCleared: true }).grain;
    expect(uncleared).toBeLessThan(GRAIN_EXCELLENT_THRESHOLD);
    expect(cleared).toBeGreaterThanOrEqual(GRAIN_EXCELLENT_THRESHOLD);
  });

  it('leaves grain below the cap untouched either way', () => {
    expect(clampResources({ ...RES, grain: 42 }).grain).toBe(42);
    expect(clampResources({ ...RES, grain: 42 }, { storageCleared: true }).grain).toBe(42);
  });
});

describe('guldmark settles in halves', () => {
  it('keeps a half but never a quarter', () => {
    expect(clampResources({ ...RES, guldmark: 7.5 }).guldmark).toBe(7.5);
    expect(clampResources({ ...RES, guldmark: 7.25 }).guldmark).toBe(7.5);
    expect(clampResources({ ...RES, guldmark: 7.1 }).guldmark).toBe(7);
  });

  it('still floors at zero', () => {
    expect(clampResources({ ...RES, guldmark: -4 }).guldmark).toBe(0);
  });
});
