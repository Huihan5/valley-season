import { describe, it, expect } from 'vitest';
import {
  getGrainTier, getInsolvencyEffects, getForcedSale, getTimberYield, getFieldGrain, getFrostDayEndLoss,
} from '../src/systems/ResourceSystem';
import { Resources, GameState, FlagMap, WeatherType } from '../src/types/game';
import {
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD, RENOWN_MIN, TENANT_TRUST_MIN,
  TENANT_TRUST_INITIAL,
  INSOLVENCY_RENOWN_PER_DAY, INSOLVENCY_TENANT_PER_DAY,
  INSOLVENCY_DISMISS_RENOWN, INSOLVENCY_DISMISS_TENANT, STEWARD_RESCUE_GULDMARK,
  TIMBER_YIELD, TIMBER_SURVEY_BONUS, TIMBER_TOOLS_BONUS, FATIGUE_TIRED_THRESHOLD,
  HARVESTABLE_TOTAL, FROST_LOSS_RATE,
  FORCED_SALE_GRAIN_PRICE, FORCED_SALE_TIMBER_PRICE, FORCED_SALE_TARGET, ENDING2_TIMBER,
  MARKET_GRAIN_PRICE, MARKET_TIMBER_PRICE,
} from '../src/data/config';

// getTimberYield only reads fatigue and flags off the state.
const timberState = (fatigue: number, flags: FlagMap): GameState =>
  ({ fatigue, flags } as unknown as GameState);

// ── 伐木提效 (PlaytestFeedback 2026-09 / D8) ──────────────────────────────────
describe('getTimberYield preparation path', () => {
  it('is the flat base with nothing prepared', () => {
    expect(getTimberYield(timberState(0, {}))).toBe(TIMBER_YIELD);
  });

  it('adds the survey bonus once the woods have been walked', () => {
    expect(getTimberYield(timberState(0, { surveyedForest: true })))
      .toBe(TIMBER_YIELD + TIMBER_SURVEY_BONUS);
  });

  it('adds the tools bonus once the tools are repaired', () => {
    expect(getTimberYield(timberState(0, { toolsRepaired: true })))
      .toBe(TIMBER_YIELD + TIMBER_TOOLS_BONUS);
  });

  it('stacks both bonuses', () => {
    expect(getTimberYield(timberState(0, { surveyedForest: true, toolsRepaired: true })))
      .toBe(TIMBER_YIELD + TIMBER_SURVEY_BONUS + TIMBER_TOOLS_BONUS);
  });

  it('still takes the fatigue penalty off the prepared total', () => {
    expect(getTimberYield(timberState(FATIGUE_TIRED_THRESHOLD, { surveyedForest: true, toolsRepaired: true })))
      .toBe(TIMBER_YIELD + TIMBER_SURVEY_BONUS + TIMBER_TOOLS_BONUS - 1);
  });
});

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

  // D4 (PlaytestFeedback 2026-09): standing at exactly 0 is no longer "spent" — the
  // line is < 0 now — so a steward who ran out of money before earning any renown
  // gets the renown-spending grace day first, instead of being dismissed on the spot.
  it('at zero standing, spends renown first rather than dismissing on the spot', () => {
    const out = getInsolvencyEffects(purse(0, 0), TENANT_TRUST_INITIAL);
    expect(out?.dismissed).toBe(false);
    expect(out?.rescued).toBeFalsy();
    expect(out?.renown).toBe(INSOLVENCY_RENOWN_PER_DAY);
  });

  it('moves onto the tenants once renown has actually gone negative but they are still with you', () => {
    const out = getInsolvencyEffects(purse(0, -1), 2);
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(INSOLVENCY_TENANT_PER_DAY);
    expect(out?.dismissed).toBe(false);
  });

  // The first time both axes are actually below zero, the reprieve fires instead of
  // dismissal: the last steward's tin, some coin, and a warning (D4).
  it('fires the one-time reprieve the first time both are spent', () => {
    const out = getInsolvencyEffects(purse(0, -1), -1, false);
    expect(out?.rescued).toBe(true);
    expect(out?.dismissed).toBe(false);
    expect(out?.guldmark).toBe(STEWARD_RESCUE_GULDMARK);
  });

  it('ends the season the next time both are spent, once the reprieve is used', () => {
    const out = getInsolvencyEffects(purse(0, -1), -1, true);
    expect(out?.dismissed).toBe(true);
    expect(out?.rescued).toBeFalsy();
    expect(out?.renown).toBe(0);
    expect(out?.tenantTrust).toBe(0);
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

// A second reprieve, for the steward who keeps the barn full and never goes to market: the first
// time dismissal would fire, part of the surplus is sold on the spot.
describe('the forced sale', () => {
  const books = (grain: number, timber: number, guldmark = 0): Resources => ({ grain, guldmark, timber, renown: -1 });

  it('sells grain above the retention line, enough to bring the purse to the target', () => {
    const sale = getForcedSale(books(103, 5));
    expect(sale).toEqual({ grain: FORCED_SALE_TARGET / FORCED_SALE_GRAIN_PRICE, timber: 0, guldmark: FORCED_SALE_TARGET });
  });

  it('never takes grain below the retention line, nor timber below the competent ending’s', () => {
    const grainLimited = getForcedSale(books(GRAIN_RETAIN_THRESHOLD + 5, 5))!;
    expect(grainLimited.grain).toBe(5);
    expect(grainLimited.timber).toBe(0);
    const timberLimited = getForcedSale(books(GRAIN_RETAIN_THRESHOLD, ENDING2_TIMBER + 3))!;
    expect(timberLimited).toEqual({ grain: 0, timber: 3, guldmark: 3 * FORCED_SALE_TIMBER_PRICE });
  });

  it('turns to the woodpile only for what the barn could not cover', () => {
    const sale = getForcedSale(books(GRAIN_RETAIN_THRESHOLD + 8, ENDING2_TIMBER + 10))!;
    expect(sale.grain).toBe(8);
    expect(sale.timber).toBe(Math.ceil((FORCED_SALE_TARGET - 8 * FORCED_SALE_GRAIN_PRICE) / FORCED_SALE_TIMBER_PRICE));
    expect(sale.guldmark).toBe(sale.grain * FORCED_SALE_GRAIN_PRICE + sale.timber * FORCED_SALE_TIMBER_PRICE);
  });

  it('pays less than the market does, which is the point of it', () => {
    expect(FORCED_SALE_GRAIN_PRICE).toBeLessThan(MARKET_GRAIN_PRICE);
    expect(FORCED_SALE_TIMBER_PRICE).toBeLessThan(MARKET_TIMBER_PRICE);
  });

  it('sells nothing when there is nothing to spare', () => {
    expect(getForcedSale(books(GRAIN_RETAIN_THRESHOLD, ENDING2_TIMBER))).toBeNull();
    expect(getForcedSale(books(40, 5))).toBeNull();
  });

  it('stands in for the first dismissal, after the tin, and only the first', () => {
    const spent = books(103, 5);
    const first = getInsolvencyEffects(spent, -1, true, false)!;
    expect(first.dismissed).toBe(false);
    expect(first.rescued).toBeFalsy();
    expect(first.sold?.grain).toBe(20);
    expect(first.guldmark).toBe(20);
    expect(first.renown).toBe(0);
    expect(first.tenantTrust).toBe(0);
    const second = getInsolvencyEffects(spent, -1, true, true)!;
    expect(second.dismissed).toBe(true);
    expect(second.sold).toBeUndefined();
  });

  it('does not come before the tin, which is still the first thing that happens', () => {
    const out = getInsolvencyEffects(books(103, 5), -1, false, false)!;
    expect(out.rescued).toBe(true);
    expect(out.sold).toBeUndefined();
  });

  it('leaves a steward with nothing to spare to be dismissed as before', () => {
    expect(getInsolvencyEffects(books(70, 5), -1, true, false)?.dismissed).toBe(true);
  });
});

// ── 田间待收 + 霜冻损耗 (GDD ch.5.4 / 设定里"影响收成的东西") ──────────────────
const frostState = (weather: WeatherType, flags: FlagMap): GameState =>
  ({ weather, flags } as unknown as GameState);

describe('getFieldGrain', () => {
  it('reads a full field when nothing has tracked it yet (fresh game / old save)', () => {
    expect(getFieldGrain(frostState('sunny', {}))).toBe(HARVESTABLE_TOTAL);
  });

  it('reads what is left standing off the flag', () => {
    expect(getFieldGrain(frostState('sunny', { fieldGrain: 62 }))).toBe(62);
  });
});

describe('getFrostDayEndLoss', () => {
  it('takes nothing on a day that is not frost', () => {
    expect(getFrostDayEndLoss(frostState('sunny', { fieldGrain: 100 }))).toBeNull();
    expect(getFrostDayEndLoss(frostState('rainy', { fieldGrain: 100 }))).toBeNull();
  });

  it('loses the frost share of the standing crop, floored, and writes it back', () => {
    const loss = getFrostDayEndLoss(frostState('frost', { fieldGrain: 100 }));
    // 100 → floor(100 × 0.9) = 90 remaining, 10 lost.
    expect(loss?.flags?.fieldGrain).toBe(90);
    expect(loss?.logEntry).toBeTruthy();
  });

  it('bites harder the more is still out there (compounding across nights)', () => {
    const remaining = (n: number) => getFrostDayEndLoss(frostState('frost', { fieldGrain: n }))?.flags?.fieldGrain as number;
    expect(remaining(HARVESTABLE_TOTAL)).toBe(Math.floor(HARVESTABLE_TOTAL * (1 - FROST_LOSS_RATE))); // 150 → 135
    expect(remaining(135)).toBe(121); // floor(135 × 0.9)
  });

  it('takes nothing once the harvest is in — the whole of the pressure', () => {
    expect(getFrostDayEndLoss(frostState('frost', { fieldGrain: 0 }))).toBeNull();
  });
});
