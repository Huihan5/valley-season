import { describe, it, expect } from 'vitest';
import { generateWeather } from '../src/systems/WeatherSystem';

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
