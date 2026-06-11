import { FATIGUE_TIRED_THRESHOLD, FATIGUE_EXHAUSTED_THRESHOLD } from '../data/config';

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
  if (status === 'exhausted') return '过劳';
  if (status === 'tired') return '疲惫';
  return '精力充沛';
}

export function getFatigueEffect(fatigue: number): string | null {
  if (fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) return '次日上午强制休息';
  if (fatigue >= FATIGUE_TIRED_THRESHOLD) return '所有行动效率 -1';
  return null;
}
