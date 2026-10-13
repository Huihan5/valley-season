import { GameState, Notice } from '../types/game';

/**
 * A notice stops the screen until the player has read it. It is for the things the season does
 * to the steward that no choice of theirs caused and that matter at once: the estate selling
 * part of its stores to settle the books is the first. Any rule may raise one; it carries its own
 * words, resolved in the language the season is being played in like every other line in the state,
 * so a replay under the other language rebuilds it.
 *
 * It lives in the state until the player's next action, which clears it (GameEngine.gameReducer).
 * Whether it has been read is the shell's business, not the season's: closing it is not an action
 * and is not recorded, so a reload puts the same notice back in front of the same morning.
 */
export function makeNotice(title: string, text: string): Notice {
  return { title, text };
}

/**
 * What identifies the notice on screen, so the shell can remember it has been closed: the season,
 * the moment and the words. Null when there is none.
 */
export function noticeKey(state: GameState): string | null {
  if (!state.notice) return null;
  return [state.seed ?? 0, state.day, state.phase, state.notice.title].join('|');
}
