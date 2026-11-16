import { GameState } from '../types/game';
import { replaySeason, replayUntil } from './GameEngine';
import { isMarketDay } from './TimeSystem';
import { HUNT_FIRST_DAY, TOTAL_DAYS } from '../data/config';

/**
 * After an ending, back to a morning of the same season. The manual slots only help a player
 * who thought to save beforehand; this needs no foresight and no slot. A season is a function
 * of its seed and its history, so any earlier morning is a prefix of that history replayed.
 *
 * The mornings are not new numbers: they are read off the calendar — the first, second and last
 * market days, and the first day of the hunt.
 */

export type ReturnPointId = 'market1' | 'market2' | 'hunt' | 'marketLast';

export interface ReturnPoint {
  id: ReturnPointId;
  day: number;
}

export interface ReturnMorning extends ReturnPoint {
  state: GameState;
}

/** The points, in calendar order. */
export function calendarPoints(): ReturnPoint[] {
  const markets: number[] = [];
  for (let d = 1; d <= TOTAL_DAYS; d++) if (isMarketDay(d)) markets.push(d);
  const points: ReturnPoint[] = [];
  if (markets.length > 0) points.push({ id: 'market1', day: markets[0] });
  if (markets.length > 1) points.push({ id: 'market2', day: markets[1] });
  if (markets.length > 2) points.push({ id: 'marketLast', day: markets[markets.length - 1] });
  points.push({ id: 'hunt', day: HUNT_FIRST_DAY });
  return points.sort((a, b) => a.day - b.day);
}

/** The morning of a point: the first state of the season proper on that day or after, before its end. */
function isMorningOf(point: ReturnPoint) {
  return (s: GameState) => s.openingPage === null && !s.demoComplete && s.day >= point.day;
}

/** Only a finished season whose whole history replays to the same end is walked back. */
function canWalkBack(finished: GameState): boolean {
  return finished.demoComplete && replaySeason(finished) !== null;
}

/**
 * Every point the season actually reached, with the state of its morning. One trust check and
 * one walk through the history: compute it once and keep it.
 */
export function getReturnMornings(finished: GameState): ReturnMorning[] {
  if (!canWalkBack(finished)) return [];
  const points = calendarPoints();
  const found = new Map<ReturnPointId, GameState>();
  replayUntil(finished, (s) => {
    for (const point of points) {
      if (!found.has(point.id) && isMorningOf(point)(s)) found.set(point.id, s);
    }
    return found.size === points.length;
  });
  return points.filter(p => found.has(p.id)).map(p => ({ ...p, state: found.get(p.id) as GameState }));
}

export function getReturnPoints(finished: GameState): ReturnPoint[] {
  return getReturnMornings(finished).map(({ id, day }) => ({ id, day }));
}

/**
 * The morning of that point, its history a strict prefix of the finished season's, its text in
 * the language the game is in now (as any replay). Null when the season cannot be walked back or
 * never reached that morning.
 */
export function returnTo(finished: GameState, pointId: ReturnPointId): GameState | null {
  const point = calendarPoints().find(p => p.id === pointId);
  if (!point || !canWalkBack(finished)) return null;
  return replayUntil(finished, isMorningOf(point));
}
