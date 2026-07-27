import { GameState, DayPhase, WeatherType, NpcId } from '../types/game';
import { getTrust, getTrustTier } from './RelationSystem';
import { countFlagsWithPrefix, CLUE_PREFIXES } from './FlagRegistry';
import {
  ACT_TWO_START,
  ACT_THREE_START,
  CHAPEL_INFORMED_CLUE_COUNT,
  AMBIENT_CHANCE,
  MARKET_RUMOURS_MIN,
  MARKET_RUMOURS_MAX,
} from '../data/config';

import locationsData from '../data/scenes/locations.json';
import weatherLines from '../data/scenes/weather_lines.json';
import actionResults from '../data/scenes/action_results.json';
import ambientData from '../data/scenes/ambient.json';
import rumoursData from '../data/scenes/rumors.json';
import greetingsData from '../data/dialogue/greetings.json';

/**
 * Scene text is assembled in layers (GDD ch.13.1): a location base that shifts by act,
 * an optional weather line, and — sparingly — one 闲笔 that carries no reward at all.
 */

export type Act = 1 | 2 | 3;

interface LocationEntry {
  label: string;
  act1: Record<DayPhase, string>;
  act2: Record<DayPhase, string>;
  act3: Record<DayPhase, string>;
  gregorPresent?: Record<DayPhase, string>;
  eveningInformed?: string;
}

const LOCATIONS = locationsData as unknown as Record<string, LocationEntry>;
const WEATHER = weatherLines as Record<string, string[]>;
const RESULTS = actionResults as Record<string, string[]>;
const AMBIENT = ambientData as Record<string, string[]>;
const RUMOURS = rumoursData as unknown as { intro: string } & Record<string, string[] | string>;
const GREETINGS = greetingsData as Record<string, Record<string, string[]>>;

export function getAct(day: number): Act {
  if (day >= ACT_THREE_START) return 3;
  if (day >= ACT_TWO_START) return 2;
  return 1;
}

function pick<T>(pool: T[], rng: () => number): T | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(rng() * pool.length)];
}

/** Draws `count` distinct entries without reordering the source pool. */
function pickMany<T>(pool: T[], count: number, rng: () => number): T[] {
  const remaining = [...pool];
  const drawn: T[] = [];
  while (drawn.length < count && remaining.length > 0) {
    drawn.push(...remaining.splice(Math.floor(rng() * remaining.length), 1));
  }
  return drawn;
}

// ── 地点基底 ────────────────────────────────────────────────────────────────

/**
 * 格雷格 is written as a detachable line so the stable still reads correctly on the
 * days he is away — hunt season, deliveries, the Day 30 ride to the station.
 */
export function isGregorAtStable(state: GameState): boolean {
  const { day, flags } = state;
  const onHunt = !!flags[`huntAttendedDay${day}`];
  const away = !!flags.gregorAway;
  return !onHunt && !away;
}

export function getLocationBase(state: GameState, sceneKey: string): string {
  const entry = LOCATIONS[sceneKey] ?? LOCATIONS.default;
  const act = getAct(state.day);
  const byAct = act === 3 ? entry.act3 : act === 2 ? entry.act2 : entry.act1;
  let body = byAct[state.phase];

  // The forge-hall's evening line asks why 霍特曼 kept coming here. Once the player
  // has pieced enough together, the question is answered and the line has to change.
  if (entry.eveningInformed && state.phase === 'evening' && act === 1) {
    const clues = countClues(state);
    if (clues >= CHAPEL_INFORMED_CLUE_COUNT) body = entry.eveningInformed;
  }

  if (entry.gregorPresent && isGregorAtStable(state)) {
    body = `${body}${entry.gregorPresent[state.phase]}`;
  }

  // A few lines open with the place name themselves ("农田已经安静了。"). Those keep
  // their own opening rather than being announced twice.
  return body.startsWith(entry.label) ? body : `${entry.label}。${body}`;
}

export function countClues(state: GameState): number {
  return Object.values(CLUE_PREFIXES)
    .reduce((total, prefix) => total + countFlagsWithPrefix(state.flags, prefix), 0);
}

// ── 天气插入句 ──────────────────────────────────────────────────────────────

export function getWeatherLine(weather: WeatherType, rng: () => number): string {
  return pick(WEATHER[weather] ?? [], rng) ?? '';
}

// ── 闲笔 ────────────────────────────────────────────────────────────────────

/**
 * Deliberately rare. These pieces give nothing — no clue, no trust, no number — and
 * showing them too often turns the estate into a mood piece rather than a place.
 */
export function shouldPlayAmbient(state: GameState, rng: () => number): boolean {
  const calmWeather = state.weather === 'sunny' || state.weather === 'cloudy';
  const rested = state.fatigue < 3;
  const quietDay = state.activeEvent === null;
  return calmWeather && rested && quietDay && rng() < AMBIENT_CHANCE;
}

export function getAmbient(sceneKey: string, rng: () => number): string {
  const pool = AMBIENT[sceneKey] ?? AMBIENT.default;
  return pick(pool, rng) ?? '';
}

// ── 招呼语 ──────────────────────────────────────────────────────────────────

export function getGreeting(state: GameState, npc: NpcId, rng: () => number): string {
  const tiers = GREETINGS[npc];
  if (!tiers) return '';
  return pick(tiers[getTrustTier(getTrust(state, npc))] ?? [], rng) ?? '';
}

// ── 行动结果文本 ────────────────────────────────────────────────────────────

export function getActionResult(
  kind: string,
  rng: () => number,
  vars: Record<string, string | number> = {},
): string {
  if (kind === 'market_rumours') {
    const { intro, lines } = getMarketRumours(rng);
    return [intro, ...lines].join('\n\n');
  }
  const template = pick(RESULTS[kind] ?? [], rng);
  if (!template) return '';
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

// ── 流言 ────────────────────────────────────────────────────────────────────

const RUMOUR_LAYERS = ['local', 'duchy', 'kingdom', 'maplegate'];

/** Two or three overheard while queueing, drawn across all four layers. */
export function getMarketRumours(rng: () => number): { intro: string; lines: string[] } {
  const pool = RUMOUR_LAYERS.flatMap(layer => (RUMOURS[layer] as string[]) ?? []);
  const count = MARKET_RUMOURS_MIN
    + Math.floor(rng() * (MARKET_RUMOURS_MAX - MARKET_RUMOURS_MIN + 1));
  return { intro: RUMOURS.intro, lines: pickMany(pool, count, rng) };
}
