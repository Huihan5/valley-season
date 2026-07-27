import { describe, it, expect } from 'vitest';
import { nextPhase, isMarketDay, getDayOfWeek } from '../src/systems/TimeSystem';

describe('TimeSystem', () => {
  it('advances morning → afternoon within same day', () => {
    const result = nextPhase(1, 'morning');
    expect(result).toEqual({ day: 1, phase: 'afternoon', newDay: false });
  });

  it('advances afternoon → evening within same day', () => {
    const result = nextPhase(1, 'afternoon');
    expect(result).toEqual({ day: 1, phase: 'evening', newDay: false });
  });

  it('advances evening → morning of next day', () => {
    const result = nextPhase(1, 'evening');
    expect(result).toEqual({ day: 2, phase: 'morning', newDay: true });
  });

  it('marks every Saturday as a market day — and only those four', () => {
    const marketDays = Array.from({ length: 30 }, (_, i) => i + 1).filter(isMarketDay);
    expect(marketDays).toEqual([6, 13, 20, 27]);
  });

  it('no longer treats Wednesday as a market day', () => {
    expect(isMarketDay(3)).toBe(false);
    expect(isMarketDay(10)).toBe(false);
  });

  it('getDayOfWeek cycles correctly', () => {
    expect(getDayOfWeek(1)).toBe('周一');
    expect(getDayOfWeek(7)).toBe('周日');
    expect(getDayOfWeek(8)).toBe('周一');
  });
});
