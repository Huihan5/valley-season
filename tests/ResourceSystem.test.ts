import { describe, it, expect } from 'vitest';
import { getGrainTier, getInsolvencyEffects } from '../src/systems/ResourceSystem';
import { Resources } from '../src/types/game';
import {
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD, RENOWN_MIN, TENANT_TRUST_MIN,
  TENANT_TRUST_INITIAL,
  INSOLVENCY_RENOWN_PER_DAY, INSOLVENCY_TENANT_PER_DAY,
  INSOLVENCY_DISMISS_RENOWN, INSOLVENCY_DISMISS_TENANT,
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

// ── 账上空了之后 (作者裁定 2026-07-29，解雇线 2026-07-30 收到 ≤ 0) ───────────

describe('getInsolvencyEffects', () => {
  const purse = (guldmark: number, renown = 0): Resources =>
    ({ grain: 40, guldmark, timber: 5, renown });

  it('says nothing while there is money left', () => {
    expect(getInsolvencyEffects(purse(1), 0)).toBeNull();
  });

  it('spends the standing the player earned, one point a day', () => {
    const out = getInsolvencyEffects(purse(0, 4), TENANT_TRUST_INITIAL);
    expect(out?.renown).toBe(INSOLVENCY_RENOWN_PER_DAY);
    expect(out?.tenantTrust).toBe(0);
    expect(out?.dismissed).toBe(false);
  });

  it('moves onto the tenants once standing is gone but they are still with you', () => {
    const out = getInsolvencyEffects(purse(0, 0), 2);
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(INSOLVENCY_TENANT_PER_DAY);
    expect(out?.dismissed).toBe(false);
  });

  it('ends the season the same morning when neither is above zero', () => {
    const out = getInsolvencyEffects(purse(0, 0), 0);
    expect(out?.dismissed).toBe(true);
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(0);
  });

  /**
   * 佃户整体信任 opens the season at -2, so a steward who never earned any
   * standing is dismissed on the first morning the account comes up empty.
   */
  it('dismisses a steward who earned nothing, on the first empty morning', () => {
    expect(getInsolvencyEffects(purse(0, 0), TENANT_TRUST_INITIAL)?.dismissed).toBe(true);
  });

  it('spares one who is owed something by either side', () => {
    expect(getInsolvencyEffects(purse(0, 1), TENANT_TRUST_INITIAL)?.dismissed).toBe(false);
    expect(getInsolvencyEffects(purse(0, 0), 1)?.dismissed).toBe(false);
  });

  it('does not dismiss anyone who found money again', () => {
    expect(getInsolvencyEffects(purse(2, RENOWN_MIN), TENANT_TRUST_MIN)).toBeNull();
  });

  it('keeps both dismissal lines at zero rather than at the axes own floors', () => {
    expect(INSOLVENCY_DISMISS_RENOWN).toBe(0);
    expect(INSOLVENCY_DISMISS_TENANT).toBe(0);
  });
});
