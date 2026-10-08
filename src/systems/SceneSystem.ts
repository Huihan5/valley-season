import { GameState, DayPhase, WeatherType, NpcId, KeyedPart } from '../types/game';
import { getTrust, getTrustTier } from './RelationSystem';
import { countFlagsWithPrefix, CLUE_PREFIXES } from './FlagRegistry';
import {
  ACT_TWO_START,
  ACT_THREE_START,
  CHAPEL_INFORMED_CLUE_COUNT,
  AMBIENT_CHANCE,
  MARKET_RUMOURS_MIN,
  MARKET_RUMOURS_MAX,
  AMBIENT_RULES,
  RESULT_RULES,
  WEATHER_LINE_RULES,
  LineRule,
} from '../data/config';

import DATA from '../data';
import { fill } from '../utils/text';

const locationsData = DATA.scenes.locations;
const weatherLines = DATA.scenes.weatherLines;
const actionResults = DATA.scenes.actionResults;
const ambientData = DATA.scenes.ambient;
const rumoursData = DATA.scenes.rumors;
const marketData = DATA.scenes.market;
const greetingsData = DATA.dialogue.greetings;

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
const RUMOURS = rumoursData as unknown as { intro: string; lead: string } & Record<string, string[] | string>;
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

const PARAGRAPH_BREAK = '\n\n';

function plain(parts: KeyedPart[]): string {
  return parts.map(p => p.text).join('');
}

/** Layers of text as paragraphs; a layer with nothing in it leaves no gap. */
function paragraphs(...layers: KeyedPart[][]): KeyedPart[] {
  return layers
    .filter(layer => layer.some(p => p.text))
    .flatMap((layer, i) => (i === 0 ? layer : [{ text: PARAGRAPH_BREAK }, ...layer]));
}

/** A line with no state behind it: a random draw, never compared. */
function drawn(text: string | undefined): KeyedPart[] {
  return text ? [{ text }] : [];
}

/** The moment a line is drawn for: the hour, the weather, the day. */
export interface LineContext {
  phase: DayPhase;
  weather: WeatherType;
  day: number;
}

export function lineContextOf(state: Pick<GameState, 'phase' | 'weather' | 'day'>): LineContext {
  return { phase: state.phase, weather: state.weather, day: state.day };
}

export function fits(rule: LineRule | undefined, at: LineContext | undefined): boolean {
  if (!rule || !at) return true;
  if (rule.phases && !rule.phases.includes(at.phase)) return false;
  if (rule.weathers && !rule.weathers.includes(at.weather)) return false;
  if (rule.from !== undefined && at.day < rule.from) return false;
  if (rule.to !== undefined && at.day > rule.to) return false;
  return true;
}

/**
 * One line of a pool that is true at this moment (config.LineRules). It still takes exactly
 * one draw, so the rest of a season's draws do not move. Should nothing fit, the lines that
 * are true anywhere are used, and failing those, none.
 */
function pickFitting(pool: string[], rules: Record<number, LineRule> | undefined, at: LineContext | undefined, rng: () => number): string | undefined {
  if (!rules || !at) return pick(pool, rng);
  const open = pool.filter((_, i) => fits(rules[i], at));
  return pick(open.length > 0 ? open : pool.filter((_, i) => !rules[i]), rng);
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

/**
 * The base text of the place, in the parts the difference hints compare: the text for
 * this act and hour (changed by what the player has pieced together, and by nothing
 * else), and 格雷格 on the end of it when he is there. They are separate slots because
 * they change for separate reasons.
 */
export function getLocationParts(state: GameState, sceneKey: string): KeyedPart[] {
  const place = LOCATIONS[sceneKey] ? sceneKey : 'default';
  const entry = LOCATIONS[place];
  const act = getAct(state.day);
  const byAct = act === 3 ? entry.act3 : act === 2 ? entry.act2 : entry.act1;
  let body = byAct[state.phase];
  let informed = false;

  // The forge-hall's evening line asks why 霍特曼 kept coming here. Once the player
  // has pieced enough together, the question is answered and the line has to change.
  if (entry.eveningInformed && state.phase === 'evening' && act === 1) {
    const clues = countClues(state);
    if (clues >= CHAPEL_INFORMED_CLUE_COUNT) {
      body = entry.eveningInformed;
      informed = true;
    }
  }

  // A few lines open with the place name themselves ("农田已经安静了。"). Those keep
  // their own opening rather than being announced twice. The join is punctuation,
  // and punctuation is a property of the language, so it lives in the data.
  const lead = body.startsWith(entry.label)
    ? body
    : fill(DATA.ui.sceneLabel, { label: entry.label, body });
  const parts: KeyedPart[] = [{ text: lead, slot: `base:${place}:${state.phase}`, key: `${act}${informed ? 'i' : ''}` }];

  if (entry.gregorPresent && isGregorAtStable(state)) {
    parts.push({ text: entry.gregorPresent[state.phase], slot: `gregor:${place}:${state.phase}`, key: 'here' });
  }
  return parts;
}

export function getLocationBase(state: GameState, sceneKey: string): string {
  return plain(getLocationParts(state, sceneKey));
}

export function countClues(state: GameState): number {
  return Object.values(CLUE_PREFIXES)
    .reduce((total, prefix) => total + countFlagsWithPrefix(state.flags, prefix), 0);
}

// ── 天气插入句 ──────────────────────────────────────────────────────────────

export function getWeatherLine(weather: WeatherType, rng: () => number, at?: LineContext): string {
  return pickFitting(WEATHER[weather] ?? [], WEATHER_LINE_RULES[weather], at, rng) ?? '';
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

export function getAmbient(sceneKey: string, rng: () => number, at?: LineContext): string {
  const key = AMBIENT[sceneKey] ? sceneKey : 'default';
  return pickFitting(AMBIENT[key], AMBIENT_RULES[key], at, rng) ?? '';
}

// ── 招呼语 ──────────────────────────────────────────────────────────────────

/**
 * A greeting rests on how far the trust has come, not on which line of the tier was
 * drawn: the same tier twice is the same greeting for the hints, whatever was said.
 */
export function getGreetingParts(state: GameState, npc: NpcId, rng: () => number): KeyedPart[] {
  const tiers = GREETINGS[npc];
  if (!tiers) return [];
  const tier = getTrustTier(getTrust(state, npc));
  const text = pick(tiers[tier] ?? [], rng);
  return text ? [{ text, slot: `greeting:${npc}`, key: tier }] : [];
}

export function getGreeting(state: GameState, npc: NpcId, rng: () => number): string {
  return plain(getGreetingParts(state, npc, rng));
}

// ── 行动结果文本 ────────────────────────────────────────────────────────────

/** What the woods look like now, in the band the total felled has reached. */
function forestStateParts(tier: number): KeyedPart[] {
  const text = RESULTS.forest_state?.[tier];
  return text ? [{ text, slot: 'forest', key: String(tier) }] : [];
}

export function getActionResultParts(
  kind: string,
  rng: () => number,
  vars: Record<string, string | number> = {},
  at?: LineContext,
): KeyedPart[] {
  const poolLine = (pool: string): string | undefined =>
    pickFitting(RESULTS[pool] ?? [], RESULT_RULES[pool], at, rng);
  if (kind === 'market_rumours') {
    const { intro, lines } = getMarketRumours(rng);
    return paragraphs(drawn(intro), drawn(RUMOURS.lead as string), ...lines.map(drawn));
  }
  // Every felling ends on what the woods look like now, so the cutting shows: the same
  // four bands the walk reads, chosen by the total *after* this day's work.
  if (kind.startsWith('fell_timber_')) {
    const tier = Number(kind.slice('fell_timber_'.length));
    const felled = poolLine('fell_timber');
    return paragraphs(drawn(felled ? fillVars(felled, vars) : ''), forestStateParts(tier));
  }
  // Walking the woods ends on what they look like now, which is not a number.
  if (kind.startsWith('survey_forest_')) {
    const tier = Number(kind.slice('survey_forest_'.length));
    return paragraphs(drawn(poolLine('survey_forest')), forestStateParts(tier));
  }
  // The third afternoon in the stable carries an extra beat on the end of it.
  if (kind === 'stable_help_third') {
    return paragraphs(drawn(poolLine('stable_help')), drawn(RESULTS.stable_help_third?.[0]));
  }
  const template = poolLine(kind);
  if (!template) return [];
  return drawn(fillVars(template, vars));
}

export function getActionResult(
  kind: string,
  rng: () => number,
  vars: Record<string, string | number> = {},
  at?: LineContext,
): string {
  return plain(getActionResultParts(kind, rng, vars, at));
}

function fillVars(template: string, vars: Record<string, string | number>): string {
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
export function getMarketArrivalParts(state: GameState, slotPrefix = 'market:arrival'): KeyedPart[] {
  const act = getAct(state.day);
  const base = MARKET.arrival[`act${act}` as 'act1' | 'act2' | 'act3'];
  // By the last market of the month the grain merchant either knows your cart or does not.
  const known = !!state.flags.marketFirstVisitDone;
  const recognition = act === 3 ? (known ? MARKET.act3Known : MARKET.act3Unknown) : '';
  return paragraphs(
    [{ text: base, slot: slotPrefix, key: `act${act}` }],
    recognition ? [{ text: recognition, slot: `${slotPrefix}:recognition`, key: known ? 'known' : 'unknown' }] : [],
    [{ text: MARKET.arrivalTail, slot: `${slotPrefix}:tail`, key: '-' }],
  );
}

export function getMarketArrival(state: GameState): string {
  return plain(getMarketArrivalParts(state));
}

/**
 * Queueing behind the grain stall, where the rumours come from. The queue is the same
 * every month and what is said in it is not, so only the framing is compared.
 */
export function getMarketAfternoonParts(state: GameState): KeyedPart[] {
  const lines = readRumours(decodeRumours(state.flags[rumoursFlagKey(state.day)]));
  return paragraphs(
    [{ text: RUMOURS.intro, slot: 'market:intro', key: '-' }],
    [{ text: RUMOURS.lead as string, slot: 'market:lead', key: '-' }],
    ...lines.map(drawn),
  );
}

export function getMarketAfternoon(state: GameState): string {
  return plain(getMarketAfternoonParts(state));
}

/**
 * What a sale reads like. The merchant and the cart are the same every month, so every
 * line of it is a state-less repeat and is set back from the second sale on; only the
 * price (the Millridge agreement or not) is a state that can change.
 */
export function getMarketTradeResultParts(kind: string, state: GameState): KeyedPart[] {
  if (kind === 'market_grain') return [{ text: MARKET.sellGrain, slot: 'market:sellGrain', key: '-' }];
  if (kind === 'market_timber') {
    const deal = !!state.flags.millridgeDealSigned;
    return paragraphs(
      [{ text: MARKET.sellTimber, slot: 'market:sellTimber', key: '-' }],
      [{ text: deal ? MARKET.sellTimberMillridge : MARKET.sellTimberPlain, slot: 'market:timberPrice', key: deal ? 'deal' : 'plain' }],
      [{ text: MARKET.sellTimberTail, slot: 'market:sellTimberTail', key: '-' }],
    );
  }
  return [];
}

export function getMarketTradeResult(kind: string, state: GameState): string {
  return plain(getMarketTradeResultParts(kind, state));
}

/** The ride home, which reads differently depending on how heavy the cart is. */
export function getMarketReturnParts(sold: boolean): KeyedPart[] {
  return paragraphs(
    [{ text: MARKET.returnOpen, slot: 'market:returnOpen', key: '-' }],
    [{ text: sold ? MARKET.returnSold : MARKET.returnUnsold, slot: 'market:return', key: sold ? 'sold' : 'unsold' }],
    [{ text: MARKET.returnTail, slot: 'market:returnTail', key: '-' }],
  );
}

export function getMarketReturn(sold: boolean): string {
  return plain(getMarketReturnParts(sold));
}

export function getMarketNoTradeParts(): KeyedPart[] {
  return [{ text: MARKET.nothing, slot: 'market:nothing', key: '-' }];
}

export function getMarketNoTrade(): string {
  return plain(getMarketNoTradeParts());
}

/** Several stretches of keyed text as one result: the words, and the parts they came in. */
export function resultOf(...stretches: KeyedPart[][]): { resultText: string; resultParts: KeyedPart[] } {
  const resultParts = paragraphs(...stretches);
  return { resultText: plain(resultParts), resultParts };
}

// ── 场景组装 ────────────────────────────────────────────────────────────────

/**
 * The layered scene: location base for the current act, then a weather line, then —
 * rarely, and only on a quiet day — one 闲笔 that leads nowhere on purpose.
 * The market afternoon is its own thing: you are not at the manor, you are in a queue.
 */
export function composeSceneParts(state: GameState, sceneKey: string, rng: () => number): KeyedPart[] {
  if (sceneKey === 'market' && state.flags.visitingMarketToday === state.day) {
    return state.phase === 'afternoon'
      ? getMarketAfternoonParts(state)
      // The same words the arrival result carries, but a scene is compared by the hour and a
      // result by the action, so the two do not share slots.
      : getMarketArrivalParts(state, 'market:arrivalScene');
  }

  const at = lineContextOf(state);
  const layers = [getLocationParts(state, sceneKey), drawn(getWeatherLine(state.weather, rng, at))];
  if (shouldPlayAmbient(state, rng)) {
    layers.push(drawn(getAmbient(sceneKey, rng, at)));
  }
  return paragraphs(...layers);
}

export function composeScene(state: GameState, sceneKey: string, rng: () => number): string {
  return plain(composeSceneParts(state, sceneKey, rng));
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

// The kingdom layer on its own, for the traveller who actually came from there.
const KINGDOM_RUMOURS = (RUMOURS.kingdom as string[]) ?? [];

export function drawKingdomRumour(rng: () => number): number {
  return Math.floor(rng() * KINGDOM_RUMOURS.length);
}

export function readKingdomRumour(index: number): string {
  return KINGDOM_RUMOURS[index] ?? '';
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
