import { FATIGUE_TIRED_THRESHOLD, FATIGUE_EXHAUSTED_THRESHOLD } from '../data/config';
import DATA from '../data';

const ui = DATA.ui;

export type FatigueStatus = 'normal' | 'tired' | 'exhausted';

export function getFatigueStatus(fatigue: number): FatigueStatus {
  if (fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) return 'exhausted';
  if (fatigue >= FATIGUE_TIRED_THRESHOLD) return 'tired';
  return 'normal';
}

export function incrementFatigue(current: number): number {
  return Math.min(current + 1, FATIGUE_EXHAUSTED_THRESHOLD);
}

export function resetFatigue(): number {
  return 0;
}

export function getFatigueLabel(fatigue: number): string {
  const status = getFatigueStatus(fatigue);
  if (status === 'exhausted') return ui.fatigue.overworked;
  if (status === 'tired') return ui.fatigue.tired;
  return ui.fatigue.fresh;
}

export function getFatigueEffect(fatigue: number): string | null {
  if (fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) return ui.fatigue.forcedRest;
  if (fatigue >= FATIGUE_TIRED_THRESHOLD) return ui.fatigue.penalty;
  return null;
}

/**
 * A short in-voice line for when the body is telling on the player — shown in the
 * scene itself, not only as a bar in the panel (PlaytestFeedback 2026-09 / D7). The
 * "spent" line is where 嘴唇发紫 landed.
 */
export function getFatigueNote(fatigue: number): string | null {
  const status = getFatigueStatus(fatigue);
  if (status === 'exhausted') return ui.fatigue.spentNote;
  if (status === 'tired') return ui.fatigue.tiredNote;
  return null;
}
