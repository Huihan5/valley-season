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
import marketData from '../data/scenes/market.json';
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
const MARKET = marketData as unknown as {
  arrival: Record<'act1' | 'act2' | 'act3', string>;
} & Record<string, string>;
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
  // Walking the woods ends on what they look like now, which is not a number.
  if (kind.startsWith('survey_forest_')) {
    const tier = Number(kind.slice('survey_forest_'.length));
    return [pick(RESULTS.survey_forest, rng), RESULTS.forest_state?.[tier]]
      .filter(Boolean).join('\n\n');
  }
  // The third afternoon in the stable carries an extra beat on the end of it.
  if (kind === 'stable_help_third') {
    return [pick(RESULTS.stable_help, rng), RESULTS.stable_help_third?.[0]]
      .filter(Boolean).join('\n\n');
  }
  const template = pick(RESULTS[kind] ?? [], rng);
  if (!template) return '';
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

// ── 集市日 ──────────────────────────────────────────────────────────────────

/**
 * The city as it looks on the day the player rides in. The goods on the stalls
 * carry the season; by the third act the fresh produce is gone and the stalls
 * are selling what people mean to live on until spring.
 */
export function getMarketArrival(state: GameState): string {
  const act = getAct(state.day);
  const base = MARKET.arrival[`act${act}` as 'act1' | 'act2' | 'act3'];
  // By the last market of the month the grain merchant either knows your cart or does not.
  const recognition = act === 3
    ? (state.flags.marketFirstVisitDone ? MARKET.act3Known : MARKET.act3Unknown)
    : '';
  return [base, recognition, MARKET.arrivalTail].filter(Boolean).join('\n\n');
}

/** Queueing behind the grain stall, where the rumours come from. */
export function getMarketAfternoon(state: GameState): string {
  const lines = readRumours(decodeRumours(state.flags[rumoursFlagKey(state.day)]));
  return [RUMOURS.intro, ...lines].join('\n\n');
}

export function getMarketTradeResult(kind: string, state: GameState): string {
  if (kind === 'market_grain') return MARKET.sellGrain;
  if (kind === 'market_timber') {
    const price = state.flags.millridgeDealSigned ? MARKET.sellTimberMillridge : MARKET.sellTimberPlain;
    return [MARKET.sellTimber, price, MARKET.sellTimberTail].join('\n\n');
  }
  return '';
}

/** The ride home, which reads differently depending on how heavy the cart is. */
export function getMarketReturn(sold: boolean): string {
  return [
    MARKET.returnOpen,
    sold ? MARKET.returnSold : MARKET.returnUnsold,
    MARKET.returnTail,
  ].join('\n\n');
}

export function getMarketNoTrade(): string {
  return MARKET.nothing;
}

// ── 场景组装 ────────────────────────────────────────────────────────────────

/**
 * The layered scene: location base for the current act, then a weather line, then —
 * rarely, and only on a quiet day — one 闲笔 that leads nowhere on purpose.
 * The market afternoon is its own thing: you are not at the manor, you are in a queue.
 */
export function composeScene(state: GameState, sceneKey: string, rng: () => number): string {
  if (sceneKey === 'market' && state.flags.visitingMarketToday === state.day) {
    return state.phase === 'afternoon' ? getMarketAfternoon(state) : getMarketArrival(state);
  }

  const layers = [getLocationBase(state, sceneKey), getWeatherLine(state.weather, rng)];
  if (shouldPlayAmbient(state, rng)) {
    layers.push(getAmbient(sceneKey, rng));
  }
  return layers.filter(Boolean).join('\n\n');
}

// ── 流言 ────────────────────────────────────────────────────────────────────

const RUMOUR_LAYERS = ['local', 'duchy', 'kingdom', 'maplegate'];
const RUMOUR_POOL = RUMOUR_LAYERS.flatMap(layer => (RUMOURS[layer] as string[]) ?? []);

/** Two or three overheard while queueing, drawn across all four layers. */
export function getMarketRumours(rng: () => number): { intro: string; lines: string[] } {
  return { intro: RUMOURS.intro, lines: readRumours(drawRumours(rng)) };
}

/**
 * The draw happens once, when the cart pulls into the square. The player stands
 * in one queue and hears what that queue is saying; selling four sacks of grain
 * does not put a different town around them.
 */
export function drawRumours(rng: () => number): number[] {
  const count = MARKET_RUMOURS_MIN
    + Math.floor(rng() * (MARKET_RUMOURS_MAX - MARKET_RUMOURS_MIN + 1));
  const indices = RUMOUR_POOL.map((_, i) => i);
  return pickMany(indices, count, rng);
}

export function readRumours(indices: number[]): string[] {
  return indices.map(i => RUMOUR_POOL[i]).filter(Boolean);
}

/** Rumour indices are stored on the day's flag as "3,17,25". */
export function rumoursFlagKey(day: number): string {
  return `marketRumours_day${day}`;
}

export function encodeRumours(indices: number[]): string {
  return indices.join(',');
}

export function decodeRumours(value: unknown): number[] {
  return String(value ?? '').split(',').filter(Boolean).map(Number);
}
