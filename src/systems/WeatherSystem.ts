import { WeatherType } from '../types/game';
import { WEATHER_POOLS, FORCED_WEATHER } from '../data/config';

function getPool(day: number): Record<string, number> {
  if (day <= 10) return WEATHER_POOLS.early;
  if (day <= 20) return WEATHER_POOLS.mid;
  return WEATHER_POOLS.late;
}

export function generateWeather(day: number, seed?: number): WeatherType {
  // One day is not left to the dice: the wind turns on Day 22, everyone at the
  // manor starts putting things away without being told, and the frost follows
  // that night (drafts 4.11).
  if (FORCED_WEATHER[day]) return FORCED_WEATHER[day];

  const pool = getPool(day);
  const roll = seed !== undefined ? seed % 100 : Math.floor(Math.random() * 100);

  let cumulative = 0;
  for (const [weather, weight] of Object.entries(pool)) {
    cumulative += weight;
    if (roll < cumulative) return weather as WeatherType;
  }
  return 'cloudy';
}

export const WEATHER_LABELS: Record<WeatherType, string> = {
  sunny: '晴天',
  cloudy: '多云',
  rainy: '阴雨',
  frost: '霜冻',
  fog: '大雾',
};

export const WEATHER_ICONS: Record<WeatherType, string> = {
  sunny: '☀',
  cloudy: '☁',
  rainy: '🌧',
  frost: '❄',
  fog: '🌫',
};

export function canHarvest(weather: WeatherType): boolean {
  return weather !== 'rainy';
}

export function canFellTimber(weather: WeatherType): boolean {
  return weather !== 'rainy';
}

export function isOutdoorDelayed(weather: WeatherType): boolean {
  return weather === 'rainy' || weather === 'fog';
}
