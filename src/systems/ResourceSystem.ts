import { Resources, WeatherType, GameState } from '../types/game';
import {
  WEATHER_HARVEST_MOD,
  TIMBER_YIELD,
  DAILY_GULDMARK_COST,
  GRAIN_STORAGE_CAP_UNCLEARED,
  RENOWN_MIN,
  RENOWN_MAX,
} from '../data/config';

export function getHarvestYield(state: GameState): number {
  const flags = state.flags;
  let base = 3; // unprepared
  if (flags.fullyPrepared) base = 7;
  else if (flags.toolsAndStorage) base = 6;
  else if (flags.toolsRepaired) base = 5;

  const weatherMod = WEATHER_HARVEST_MOD[state.weather] ?? 0;

  // Fatigue penalty: exhausted loses 1 from all actions
  const fatiguePenalty = state.fatigue >= 5 ? 1 : 0;

  // Renown penalty: ≤-3 means unhappy tenants
  const renownPenalty = state.resources.renown <= -3 ? 1 : 0;

  return Math.max(0, base + weatherMod - fatiguePenalty - renownPenalty);
}

export function getTimberYield(state: GameState): number {
  const fatiguePenalty = state.fatigue >= 5 ? 1 : 0;
  return Math.max(0, TIMBER_YIELD - fatiguePenalty);
}

export function applyDailyOperatingCost(resources: Resources): Resources {
  return { ...resources, guldmark: resources.guldmark - DAILY_GULDMARK_COST };
}

export function clampResources(resources: Resources): Resources {
  const storageCap = resources.grain > GRAIN_STORAGE_CAP_UNCLEARED ? GRAIN_STORAGE_CAP_UNCLEARED : undefined;
  return {
    ...resources,
    grain: storageCap !== undefined ? Math.min(resources.grain, storageCap) : resources.grain,
    renown: Math.max(RENOWN_MIN, Math.min(RENOWN_MAX, resources.renown)),
    guldmark: Math.max(0, resources.guldmark),
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
