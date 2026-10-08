import { GameState } from '../types/game';
import { BOTTOM_LINE_CHANCE, BOTTOM_LINE_RULES } from '../data/config';
import { fits, lineContextOf } from './SceneSystem';
import { seededRng } from '../utils/rng';
import DATA from '../data';

/**
 * The quiet line under the choices (DEVELOPMENT_PLAN 3.6): an observation of the place,
 * the hour and the weather that carries no clue, rule or hint. It is a function of the
 * state alone: the season's seed, the day and the hour decide whether there is one and
 * which, so opening a menu, switching language or replaying the season shows the same line,
 * and nothing is drawn from the engine's own stream.
 */

const LINES = DATA.scenes.bottomLines as Record<string, string>;

/** Ids, in a fixed order, so the same draw picks the same line in every language. */
const IDS = Object.keys(BOTTOM_LINE_RULES).sort();

/** Only an ordinary stretch of a day has one: not an event, not an ending, not the market. */
function isOrdinary(state: GameState): boolean {
  return state.activeEvent === null && !state.demoComplete && state.openingPage === null;
}

/** The id of the line this hour has, or null. Independent of the language. */
export function pickBottomLineId(state: GameState): string | null {
  if (!isOrdinary(state)) return null;

  const at = lineContextOf(state);
  const said = `${state.currentSceneText}\n${state.lastResult ?? ''}`;
  const open = IDS.filter((id) => {
    const rule = BOTTOM_LINE_RULES[id];
    if (!rule.scenes.includes(state.currentScene) || !fits(rule, at)) return false;
    // The scene may have just told the same thing at length (the 闲笔); once is enough.
    return !said.includes(LINES[id]);
  });
  if (open.length === 0) return null;

  const rng = seededRng(state.seed ?? 0, 'bottom', state.day, state.phase);
  if (rng() >= BOTTOM_LINE_CHANCE) return null;
  return open[Math.floor(rng() * open.length)];
}

export function getBottomLine(state: GameState): string | null {
  const id = pickBottomLineId(state);
  return id ? LINES[id] ?? null : null;
}
