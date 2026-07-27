import { GameState } from '../types/game';

/**
 * Substitutes the handful of runtime values narrative text is allowed to reference.
 * Placeholders that have no value yet are left standing rather than blanked, so a
 * missing substitution shows up as `{playerName}` on screen instead of a silent hole.
 */
export function interpolate(text: string, state: Pick<GameState, 'playerName'>): string {
  if (!text.includes('{')) return text;
  return state.playerName ? text.replace(/\{playerName\}/g, state.playerName) : text;
}
