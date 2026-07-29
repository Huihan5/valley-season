import { Resources, WeatherType, GameState, FlagMap } from '../types/game';
import {
  WEATHER_HARVEST_MOD,
  TIMBER_YIELD,
  DAILY_GULDMARK_COST,
  GRAIN_STORAGE_CAP_UNCLEARED,
  RENOWN_MIN,
  RENOWN_MAX,
  INSOLVENCY_RENOWN_PER_DAY,
  INSOLVENCY_TENANT_PER_DAY,
  INSOLVENCY_DISMISS_RENOWN,
  INSOLVENCY_DISMISS_TENANT,
  FATIGUE_TIRED_THRESHOLD,
  GRAIN_RETAIN_THRESHOLD,
  GRAIN_EXCELLENT_THRESHOLD,
  YIELD_TIER_MEAGRE_MAX,
  YIELD_TIER_FAIR_MAX,
  TIMBER_SEASON_QUOTA,
  FOREST_STATE_TIERS,
  FORAGE_YIELD_RANGE,
  ORCHARD_YIELD_RANGE,
  ORCHARD_FULL_YIELD_LAST_DAY,
  ORCHARD_TENANT_TRUST_CAP,
} from '../data/config';

/**
 * Action buttons show a band, not a number (PlaytestFeedback 4.b) — the exact figure
 * is revealed in the result text once the work is done.
 */
export function getYieldTierLabel(amount: number): string {
  if (amount <= YIELD_TIER_MEAGRE_MAX) return '微薄';
  if (amount <= YIELD_TIER_FAIR_MAX) return '尚可';
  return '丰厚';
}

/**
 * Foraging and the orchard pay a small, varying sum. The variation is derived from
 * the day and phase rather than drawn at random, so the figure cannot be rerolled
 * by anything the player does short of spending the phase.
 */
function spread(state: GameState, salt: number, min: number, max: number): number {
  const phaseIndex = ['morning', 'afternoon', 'evening'].indexOf(state.phase);
  const span = max - min + 1;
  return min + ((state.day * salt + phaseIndex) % span);
}

export function getForageYield(state: GameState): number {
  const [min, max] = FORAGE_YIELD_RANGE;
  return spread(state, 7, min, max);
}

/** After Day 15 the good fruit is on the ground; what is left is worth half. */
export function getOrchardYield(state: GameState): number {
  const [min, max] = ORCHARD_YIELD_RANGE;
  const full = spread(state, 3, min, max);
  return state.day > ORCHARD_FULL_YIELD_LAST_DAY ? full / 2 : full;
}

/** How much tenant trust the orchard has already contributed, against its own ceiling. */
export function getOrchardTenantTotal(state: GameState): number {
  return Number(state.flags.orchardTenantGained ?? 0);
}

export function getOrchardTenantGain(state: GameState): number {
  return getOrchardTenantTotal(state) < ORCHARD_TENANT_TRUST_CAP ? 1 : 0;
}

export function getTimberFelled(state: GameState): number {
  return Number(state.flags.timberFelled ?? 0);
}

/**
 * The season's allowance is 25 by the decree, which is written for the whole
 * north district rather than for this slope. It is not a wall: the player can
 * cut past it, and the valley notices (GDD 5.4).
 */
export function getTimberQuotaLeft(state: GameState): number {
  return Math.max(0, TIMBER_SEASON_QUOTA - getTimberFelled(state));
}

/** What the woods look like now, as a band rather than a number. */
export function getForestTier(state: GameState): number {
  const felled = getTimberFelled(state);
  return FOREST_STATE_TIERS.filter(edge => felled >= edge).length;
}

/** 未达留任线 / 留任线 / 优秀线 — the two numbers a player can work out for themselves (GDD ch.5.4). */
export type GrainTier = 'short' | 'retain' | 'excellent';

export function getGrainTier(grain: number): GrainTier {
  if (grain < GRAIN_RETAIN_THRESHOLD) return 'short';
  if (grain < GRAIN_EXCELLENT_THRESHOLD) return 'retain';
  return 'excellent';
}

export function getHarvestYield(state: GameState): number {
  const flags = state.flags;
  let base = 3; // unprepared
  if (flags.fullyPrepared) base = 7;
  else if (flags.toolsAndStorage) base = 6;
  else if (flags.toolsRepaired) base = 5;

  const weatherMod = WEATHER_HARVEST_MOD[state.weather] ?? 0;

  const fatiguePenalty = state.fatigue >= FATIGUE_TIRED_THRESHOLD ? 1 : 0;

  // Renown penalty: ≤-3 means unhappy tenants
  const renownPenalty = state.resources.renown <= -3 ? 1 : 0;

  return Math.max(0, base + weatherMod - fatiguePenalty - renownPenalty);
}

export function getTimberYield(state: GameState): number {
  const fatiguePenalty = state.fatigue >= FATIGUE_TIRED_THRESHOLD ? 1 : 0;
  return Math.max(0, TIMBER_YIELD - fatiguePenalty);
}

export function applyDailyOperatingCost(resources: Resources): Resources {
  return { ...resources, guldmark: resources.guldmark - DAILY_GULDMARK_COST };
}

export interface InsolvencyEffects {
  renown: number;
  tenantTrust: number;
  /** 男爵 does not wait for the term to run out. */
  dismissed: boolean;
  logEntry: string;
}

/**
 * What an empty account costs, settled each morning after the day's operating
 * cost is taken (作者裁定 2026-07-29).
 *
 * The order is deliberate. The valley finds out first — an estate that cannot
 * settle with the smith and the flour cart is talked about within the week — and
 * only once there is no standing left do the people who live here start to go.
 *
 * Both lines are 0 rather than the axes' own floors (作者 2026-07-30): standing
 * earned earlier in the season is what buys the days, and when there is none the
 * season ends the same morning. 佃户整体信任 starts at -2, so that half of the
 * test is already true on Day 1 — an empty account is only survivable for a
 * steward the valley thinks well of.
 */
export function getInsolvencyEffects(
  resources: Resources,
  tenantTrust: number,
): InsolvencyEffects | null {
  if (resources.guldmark > 0) return null;

  const renownSpent = resources.renown <= INSOLVENCY_DISMISS_RENOWN;
  const tenantsSpent = tenantTrust <= INSOLVENCY_DISMISS_TENANT;

  if (renownSpent && tenantsSpent) {
    return {
      renown: 0,
      tenantTrust: 0,
      dismissed: true,
      logEntry: '男爵的人上午到了，带来半张纸：即日起停止支付，三日内交接。',
    };
  }

  if (renownSpent) {
    return {
      renown: 0,
      tenantTrust: INSOLVENCY_TENANT_PER_DAY,
      dismissed: false,
      logEntry: '又是一天没有结出去一笔钱。田里的人比昨天少。',
    };
  }

  return {
    renown: INSOLVENCY_RENOWN_PER_DAY,
    tenantTrust: 0,
    dismissed: false,
    logEntry: '又是一天没有结出去一笔钱。这种事在河谷传得很快。',
  };
}

/**
 * Grain spills over 80 until the barn is cleared out; anything above the cap is lost.
 * Clearing storage removes the ceiling, which is what puts the 90 优秀线 within reach.
 */
export function clampResources(resources: Resources, flags: FlagMap = {}): Resources {
  const capped = flags.storageCleared ? resources.grain : Math.min(resources.grain, GRAIN_STORAGE_CAP_UNCLEARED);
  return {
    ...resources,
    grain: capped,
    renown: Math.max(RENOWN_MIN, Math.min(RENOWN_MAX, resources.renown)),
    // Guldmark settles in halves: grain at 1.5/unit cannot come out whole (GDD ch.5.4).
    guldmark: Math.max(0, Math.round(resources.guldmark * 2) / 2),
    timber: Math.max(0, resources.timber),
  };
}

export function applyHarvestWeather(resources: Resources, weather: WeatherType): Resources {
  if (weather !== 'frost') return resources;
  // Frost: remaining unharvested grain concept — we'll represent this as a flag effect
  return resources;
}

export function formatGuldmark(value: number): string {
  return `${value} 金卢`;
}
