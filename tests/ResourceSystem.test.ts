import { describe, it, expect } from 'vitest';
import { getGrainTier, getInsolvencyEffects } from '../src/systems/ResourceSystem';
import { Resources } from '../src/types/game';
import {
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD, RENOWN_MIN, TENANT_TRUST_MIN,
  INSOLVENCY_RENOWN_PER_DAY, INSOLVENCY_TENANT_PER_DAY,
} from '../src/data/config';

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

// ── 账上空了之后 (作者裁定 2026-07-29) ──────────────────────────────────────

describe('getInsolvencyEffects', () => {
  const purse = (guldmark: number, renown = 0): Resources =>
    ({ grain: 40, guldmark, timber: 5, renown });

  it('says nothing while there is money left', () => {
    expect(getInsolvencyEffects(purse(1), 0)).toBeNull();
  });

  it('costs renown first, one a day', () => {
    const out = getInsolvencyEffects(purse(0, -3), 0);
    expect(out?.renown).toBe(INSOLVENCY_RENOWN_PER_DAY);
    expect(out?.tenantTrust).toBe(0);
    expect(out?.dismissed).toBe(false);
  });

  it('moves onto the tenants only once renown has bottomed out', () => {
    const out = getInsolvencyEffects(purse(0, RENOWN_MIN), -3);
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(INSOLVENCY_TENANT_PER_DAY);
    expect(out?.dismissed).toBe(false);
  });

  it('ends the season when both have bottomed out and the account is still empty', () => {
    const out = getInsolvencyEffects(purse(0, RENOWN_MIN), TENANT_TRUST_MIN);
    expect(out?.dismissed).toBe(true);
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(0);
  });

  it('does not dismiss anyone who found money again', () => {
    expect(getInsolvencyEffects(purse(2, RENOWN_MIN), TENANT_TRUST_MIN)).toBeNull();
  });
});
