import { describe, it, expect } from 'vitest';
import {
  nextPhase, isMarketDay, getDayOfWeek, daysUntilSeasonEnd, daysUntilNextMarket,
} from '../src/systems/TimeSystem';

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

  it('counts the days left to the season end, 0 on the last day', () => {
    expect(daysUntilSeasonEnd(1)).toBe(29);
    expect(daysUntilSeasonEnd(30)).toBe(0);
    expect(daysUntilSeasonEnd(31)).toBe(0);
  });

  it('counts the days to the next market — 0 on a market day', () => {
    expect(daysUntilNextMarket(1)).toBe(5);   // Mon → the Day-6 Saturday
    expect(daysUntilNextMarket(6)).toBe(0);   // on the market day itself
    expect(daysUntilNextMarket(7)).toBe(6);   // → the Day-13 Saturday
    expect(daysUntilNextMarket(27)).toBe(0);  // the last market day
  });

  it('returns null once the season has no market left', () => {
    // Day 27 is the last Saturday; nothing after it falls inside the 30 days.
    expect(daysUntilNextMarket(28)).toBeNull();
    expect(daysUntilNextMarket(30)).toBeNull();
  });
});
