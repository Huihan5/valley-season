import { DayPhase } from '../types/game';
import { DEMO_MAX_DAYS } from '../data/config';
import DATA from '../data';
import { fill } from '../utils/text';

const ui = DATA.ui;

export const PHASE_ORDER: DayPhase[] = ['morning', 'afternoon', 'evening'];

export const PHASE_LABELS: Record<DayPhase, string> = ui.phase;

/** 1-indexed; slot 0 is a blank so a day number indexes straight in. */
export const DAY_NAMES = ui.dayNames;

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? fill(ui.dayNameFallback, { day });
}

/** 第五日 · 下午 — the one way a moment in the season is written. */
export function formatMoment(day: number, phase: DayPhase): string {
  return fill(ui.moment, { day: dayName(day), phase: PHASE_LABELS[phase] });
}

export function nextPhase(day: number, phase: DayPhase): { day: number; phase: DayPhase; newDay: boolean } {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < PHASE_ORDER.length - 1) {
    return { day, phase: PHASE_ORDER[idx + 1], newDay: false };
  }
  return { day: day + 1, phase: 'morning', newDay: true };
}

/** 1=Mon … 7=Sun. Day 1 is 2018-10-01, a Monday (GDD ch.5.2). */
export function getWeekdayNumber(day: number): number {
  return ((day - 1) % 7) + 1;
}

/** v3: the market runs Saturdays only — Day 6, 13, 20, 27. */
export function isMarketDay(day: number): boolean {
  return getWeekdayNumber(day) === 6;
}

/** 洛伦茨 keeps vigil at the manor forge-hall on Thursdays — Day 4, 11, 18, 25. */
export function isVigilNight(day: number): boolean {
  return getWeekdayNumber(day) === 4;
}

export function getDayOfWeek(day: number): string {
  return ui.weekdays[getWeekdayNumber(day)];
}

export function isDemoComplete(day: number): boolean {
  return day > DEMO_MAX_DAYS;
}
