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

/**
 * Fills the `{name}` slots in a UI or action string from the data layer. Separate
 * from `interpolate` on purpose: that one runs over narrative text at render time
 * and must leave unknown placeholders alone, whereas every slot here has a value
 * supplied at the call site.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole
  );
}
