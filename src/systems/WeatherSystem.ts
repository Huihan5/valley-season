import { WeatherType } from '../types/game';
import { WEATHER_POOLS, FORCED_WEATHER } from '../data/config';
import DATA from '../data';

const ui = DATA.ui;

function getPool(day: number): Record<string, number> {
  if (day <= 10) return WEATHER_POOLS.early;
  if (day <= 20) return WEATHER_POOLS.mid;
  return WEATHER_POOLS.late;
}

/**
 * `roll` is a number to pin the result (tests), or a generator to draw from. The game
 * passes the season's generator so a replayed season gets the weather it had before.
 */
export function generateWeather(day: number, roll?: number | (() => number)): WeatherType {
  // One day is not left to the dice: the wind turns on Day 22, everyone at the
  // manor starts putting things away without being told, and the frost follows
  // that night (drafts 4.11).
  if (FORCED_WEATHER[day]) return FORCED_WEATHER[day];

  const pool = getPool(day);
  const dice = typeof roll === 'function' ? Math.floor(roll() * 100)
    : roll !== undefined ? roll % 100
    : Math.floor(Math.random() * 100);

  let cumulative = 0;
  for (const [weather, weight] of Object.entries(pool)) {
    cumulative += weight;
    if (dice < cumulative) return weather as WeatherType;
  }
  return 'cloudy';
}

export const WEATHER_LABELS: Record<WeatherType, string> = ui.weather;

export const WEATHER_ICONS: Record<WeatherType, string> = {
  sunny: '☀',
  cloudy: '☁',
  rainy: '🌧',
  frost: '❄',
  fog: '🌫',
};

/**
 * Whether the weather leaves the harvest untouched. Rain does not forbid reaping —
 * it only thins it (WEATHER_HARVEST_MOD) — so this drives the button wording, not a gate.
 */
export function canHarvest(weather: WeatherType): boolean {
  return weather !== 'rainy';
}

export function canFellTimber(weather: WeatherType): boolean {
  return weather !== 'rainy';
}

export function isOutdoorDelayed(weather: WeatherType): boolean {
  return weather === 'rainy' || weather === 'fog';
}
