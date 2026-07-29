import { GameState, EventData, FlagMap } from '../types/game';
import { eventPhase, eventAdvancesPhase, hasFixedEventToday } from './EventSystem';
import { drawKingdomRumour, readKingdomRumour } from './SceneSystem';
import {
  RANDOM_EVENT_CHANCE, RANDOM_EVENT_CHANCE_WITH_FIXED, RANDOM_EVENT_CHANCE_QUIET,
  RANDOM_EVENT_QUIET_DAYS, RANDOM_EVENT_WINDOWS,
} from '../data/config';
import DATA from '../data';

/**
 * The random pool (GDD ch.8.2). Five events, not twenty-five: every one of them
 * settles on the spot, and none of them carries a clue or a trust point the player
 * could not have earned by going and getting it. A season that hands you evidence
 * for showing up is a season where investigating was never the point.
 *
 * One roll a day, at the end of the morning. The day's window is the only thing
 * this file decides; what happens inside the event is in src/data/events/random/.
 */

const R = DATA.randomEvents;

const RANDOM_EVENTS = [
  R.lostOx, R.toolPedlar, R.forgeCityMerchant, R.well, R.quietDay,
] as unknown as EventData[];

/** Reasons an event would make no sense today, beyond the calendar. */
const PRECONDITIONS: Record<string, (state: GameState) => boolean> = {
  // Nobody sells you tools you already own. Once the smith has been paid the
  // cart simply passes the gate without stopping.
  random_tool_pedlar: state => !state.flags.toolsRepaired,
};

function inWindow(id: string, day: number): boolean {
  const window = RANDOM_EVENT_WINDOWS[id];
  if (!window) return false;
  return 'days' in window
    ? window.days.includes(day)
    : day >= window.from && day <= window.to;
}

/** Each of the five happens at most once a season — the pool is too small to repeat. */
export function getEligibleRandomEvents(state: GameState): EventData[] {
  return RANDOM_EVENTS.filter(event =>
    !state.flags[`event_done_${event.id}`]
    && inWindow(event.id, state.day)
    && (PRECONDITIONS[event.id]?.(state) ?? true)
  );
}

/** Two quiet days in a row, counting back from yesterday. */
function isQuietStreak(state: GameState): boolean {
  const last = Number(state.flags.lastEventDay ?? 0);
  return state.day - last - 1 >= RANDOM_EVENT_QUIET_DAYS;
}

export function getRandomEventChance(state: GameState): number {
  if (hasFixedEventToday(state)) return RANDOM_EVENT_CHANCE_WITH_FIXED;
  return isQuietStreak(state) ? RANDOM_EVENT_CHANCE_QUIET : RANDOM_EVENT_CHANCE;
}

/**
 * The day's single roll. Returns the flags to merge, or null if today has already
 * been rolled — the reducer rebuilds the phase more than once, and the season is
 * not allowed to reconsider.
 *
 * Everything the event needs decided is decided here, while there is an rng to
 * hand: which variant, which piece of news. Rendering must stay reproducible.
 */
export function rollRandomEvent(state: GameState, rng: () => number): FlagMap | null {
  if (Number(state.flags.randomRolledDay ?? 0) >= state.day) return null;

  const flags: FlagMap = { randomRolledDay: state.day, randomEventPending: '' };
  const pool = getEligibleRandomEvents(state);
  if (!pool.length || rng() >= getRandomEventChance(state)) return flags;

  const drawn = pool[Math.floor(rng() * pool.length)];
  flags.randomEventPending = drawn.id;

  // An event with nothing to decide says one of several things instead.
  if (!drawn.choices && drawn.variants) {
    const keys = Object.keys(drawn.variants);
    flags.randomEventVariant = keys[Math.floor(rng() * keys.length)];
  }
  if (drawn.id === 'random_forge_city_merchant') {
    flags.randomEventRumour = drawKingdomRumour(rng);
  }

  return flags;
}

/**
 * The rolled event, once the clock reaches the time of day it belongs to. 日中
 * opens the afternoon, 入夜前 opens the evening; neither costs the phase it opens.
 */
export function getPendingRandomEvent(state: GameState): EventData | null {
  const id = String(state.flags.randomEventPending ?? '');
  if (!id) return null;

  const raw = RANDOM_EVENTS.find(e => e.id === id);
  if (!raw) return null;

  const event: EventData = {
    ...raw,
    day: state.day,
    phase: eventPhase(raw),
    advancesPhase: eventAdvancesPhase(raw),
  };
  if (event.phase !== state.phase) return null;

  return process(event, state);
}

function process(event: EventData, state: GameState): EventData {
  if (event.id === 'random_quiet_day') {
    const key = String(state.flags.randomEventVariant ?? '');
    return { ...event, sceneText: event.variants?.[key] ?? '' };
  }
  if (event.id === 'random_forge_city_merchant') return processMerchant(event, state);
  return event;
}

/**
 * 让他住下: what he brings is one line off the kingdom layer of the rumour pool.
 * The same talk the market carries, except this time it is first-hand, and it is
 * being told in a kitchen to the two people who fed him.
 */
function processMerchant(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const news = readKingdomRumour(Number(state.flags.randomEventRumour ?? 0));
  return {
    ...event,
    choices: (event.choices ?? []).map(choice => choice.id === 'merchant_stay'
      ? { ...choice, resultText: [v.stay_head, news, v.stay_tail].filter(Boolean).join('\n\n') }
      : choice),
  };
}

/**
 * Every event that reaches the screen notes its date, because the pool's window
 * widens after two days in which nothing came to the door.
 */
export function markEventDay(flags: FlagMap, day: number): FlagMap {
  return { ...flags, lastEventDay: day };
}
