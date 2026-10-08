import { describe, it, expect } from 'vitest';
import { generateWeather } from '../src/systems/WeatherSystem';
import { FORCED_WEATHER } from '../src/data/config';
import day21Morning from '../src/data/zh/events/day21_hunt_morning.json';
import day27Corner from '../src/data/zh/events/day27_street_corner.json';
import day30Morning from '../src/data/zh/events/day30_morning.json';
import day30Evening from '../src/data/zh/events/day30_evening.json';

describe('WeatherSystem', () => {
  it('returns a valid weather type for early days', () => {
    const validTypes = ['sunny', 'cloudy', 'rainy', 'frost', 'fog'];
    for (let day = 1; day <= 10; day++) {
      const w = generateWeather(day, day * 13);
      expect(validTypes).toContain(w);
    }
  });

  it('never returns frost on day 1-10', () => {
    for (let seed = 0; seed < 100; seed++) {
      const w = generateWeather(5, seed);
      expect(w).not.toBe('frost');
    }
  });

  it('can return frost on day 11-20', () => {
    const results = Array.from({ length: 100 }, (_, i) => generateWeather(15, i));
    expect(results.some((w) => w === 'frost')).toBe(true);
  });
});

// Some scenes write the weather into the text, so on those days it is written, not rolled
// (config.FORCED_WEATHER). Day 22 is pinned in Wynter.test.ts.

describe('the days whose weather the text already states', () => {
  const rolls = Array.from({ length: 100 }, (_, i) => i);
  const always = (day: number) => new Set(rolls.map((r) => generateWeather(day, r)));

  it('Day 21: frost on the ride home from the hunt', () => {
    expect(JSON.stringify(day21Morning)).toContain('回程的路上有霜');
    expect([...always(21)]).toEqual(['frost']);
  });

  it('Day 27: sun still low at the street corner after the market', () => {
    expect(JSON.stringify(day27Corner)).toContain('太阳已经很低了');
    expect([...always(27)]).toEqual(['sunny']);
  });

  it('Days 28–30: frost every day, so "这几天每天都有霜" is true on the last morning', () => {
    expect(JSON.stringify(day30Morning)).toContain('这几天每天都有霜');
    expect(JSON.stringify(day30Evening)).toContain('霜已经开始落在院子里');
    for (const day of [28, 29, 30]) expect([...always(day)], `Day ${day}`).toEqual(['frost']);
  });

  it('writes no other days', () => {
    expect(Object.keys(FORCED_WEATHER).map(Number)).toEqual([21, 22, 27, 28, 29, 30]);
    for (const day of [20, 23, 26]) expect(always(day).size, `Day ${day}`).toBeGreaterThan(1);
  });
});
