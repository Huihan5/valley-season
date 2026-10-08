import { describe, it, expect } from 'vitest';
import { DayPhase, WeatherType } from '../src/types/game';
import {
  getAmbient, getActionResult, getWeatherLine, fits, LineContext,
} from '../src/systems/SceneSystem';
import {
  AMBIENT_RULES, RESULT_RULES, WEATHER_LINE_RULES, LineRules,
} from '../src/data/config';
import zhAmbient from '../src/data/zh/scenes/ambient.json';
import enAmbient from '../src/data/en/scenes/ambient.json';
import zhResults from '../src/data/zh/scenes/action_results.json';
import enResults from '../src/data/en/scenes/action_results.json';
import zhWeather from '../src/data/zh/scenes/weather_lines.json';
import enWeather from '../src/data/en/scenes/weather_lines.json';

// Lines that are only true at some hours, in some weather or from some day are drawn only
// when they fit the moment (config.LineRules). The text itself is untouched.

type Pools = Record<string, string[]>;

/** What each rule is about, so a reordered pool cannot leave a rule on the wrong line. */
const MEANT: Record<string, Record<string, Record<number, string>>> = {
  ambient: {
    fields: { 0: '割麦的时候有人在唱', 2: '早上霜化' },
    forest: { 0: '一排蘑菇', 1: '一只鹿' },
    stable: { 1: '夜里进马厩' },
    kitchen: { 0: '玛莎在教一个佃户家的女孩切东西' },
    default: { 0: '枫叶下得像下雪', 1: '埃莱娜在院子里晒被子', 2: '傍晚没有风' },
  },
  results: {
    harvest: { 0: '到中午的时候', 1: '到傍晚清点', 2: '毛毛雨' },
    fell_timber: { 2: '天已经暗了' },
    forage: { 1: '采了一上午', 2: '这个季节快过去了' },
    orchard: { 0: '摘了一整个上午' },
    survey_forest: { 1: '今天有雾' },
  },
  weather: {
    sunny: { 1: '到了下午' },
    rainy: { 0: '雨下了一整天' },
    frost: { 0: '早上出门', 2: '中午才化' },
    fog: { 4: '中午才散' },
  },
};

const SETS: [string, LineRules, Pools, Pools][] = [
  ['ambient', AMBIENT_RULES, zhAmbient as Pools, enAmbient as Pools],
  ['results', RESULT_RULES, zhResults as Pools, enResults as Pools],
  ['weather', WEATHER_LINE_RULES, zhWeather as Pools, enWeather as Pools],
];

const PHASES: DayPhase[] = ['morning', 'afternoon', 'evening'];
const WEATHERS: WeatherType[] = ['sunny', 'cloudy', 'rainy', 'frost', 'fog'];
const DAYS = [1, 5, 10, 11, 14, 15, 22, 23, 30];
const DRAWS = Array.from({ length: 100 }, (_, i) => i / 100);

describe('the line rules point at the lines they are about', () => {
  for (const [name, rules, zh, en] of SETS) {
    it(`${name}: every position exists in both languages, on the meant line`, () => {
      for (const [pool, byIndex] of Object.entries(rules)) {
        for (const index of Object.keys(byIndex).map(Number)) {
          expect(zh[pool]?.[index], `${name}.${pool}[${index}]`).toBeTruthy();
          expect(en[pool]?.[index], `${name}.${pool}[${index}] (en)`).toBeTruthy();
          const meant = MEANT[name][pool]?.[index];
          expect(meant, `${name}.${pool}[${index}] has a note of what it is`).toBeTruthy();
          expect(zh[pool][index], `${name}.${pool}[${index}]`).toContain(meant);
        }
      }
    });
  }
});

describe('a draw takes only lines that fit the moment', () => {
  const at = (phase: DayPhase, weather: WeatherType, day: number): LineContext => ({ phase, weather, day });

  function sweep(draw: (ctx: LineContext, roll: number) => string, pool: string[], rules: Record<number, import('../src/data/config').LineRule>) {
    for (const phase of PHASES) for (const weather of WEATHERS) for (const day of DAYS) {
      const ctx = at(phase, weather, day);
      for (const roll of DRAWS) {
        const text = draw(ctx, roll);
        if (!text) continue;
        const index = pool.indexOf(text);
        expect(index, text).toBeGreaterThanOrEqual(0);
        expect(fits(rules[index], ctx), `${text} at ${phase}/${weather}/day ${day}`).toBe(true);
      }
    }
  }

  it('in the ambient pools', () => {
    for (const [scene, rules] of Object.entries(AMBIENT_RULES)) {
      sweep((ctx, roll) => getAmbient(scene, () => roll, ctx), (zhAmbient as Pools)[scene], rules);
    }
  });

  it('in the action results', () => {
    for (const [kind, rules] of Object.entries(RESULT_RULES)) {
      sweep((ctx, roll) => getActionResult(kind, () => roll, { n: 3, r: 5 }, ctx).replace(/\n\n.*$/s, ''), (zhResults as Pools)[kind].map(t => t.replace(/\n\n.*$/s, '')), rules);
    }
  });

  it('in the weather lines', () => {
    for (const [weather, rules] of Object.entries(WEATHER_LINE_RULES)) {
      for (const phase of PHASES) for (const day of DAYS) {
        const ctx = at(phase, weather as WeatherType, day);
        for (const roll of DRAWS) {
          const text = getWeatherLine(weather as WeatherType, () => roll, ctx);
          const index = (zhWeather as Pools)[weather].indexOf(text);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(fits(rules[index], ctx), `${text} at ${phase}`).toBe(true);
        }
      }
    }
  });

  it('never reads a rain in the reaping on a dry day, or the dusk count in a morning', () => {
    for (const roll of DRAWS) {
      expect(getActionResult('harvest', () => roll, { n: 9 }, at('morning', 'sunny', 5))).not.toContain('毛毛雨');
      expect(getActionResult('harvest', () => roll, { n: 9 }, at('morning', 'sunny', 5))).not.toContain('傍晚');
      expect(getActionResult('harvest', () => roll, { n: 9 }, at('afternoon', 'cloudy', 5))).not.toContain('到中午');
    }
    const rained = DRAWS.map(roll => getActionResult('harvest', () => roll, { n: 9 }, at('morning', 'rainy', 5)));
    expect(rained.some(t => t.includes('毛毛雨'))).toBe(true);
  });

  it('keeps the night lines for the evening and the afternoon lines for the afternoon', () => {
    const lines = (phase: DayPhase) => DRAWS.map(roll => getAmbient('stable', () => roll, at(phase, 'sunny', 5)));
    expect(lines('morning').some(t => t.includes('夜里进马厩'))).toBe(false);
    expect(lines('evening').some(t => t.includes('夜里进马厩'))).toBe(true);
    const yard = (phase: DayPhase) => DRAWS.map(roll => getAmbient('default', () => roll, at(phase, 'cloudy', 15)));
    expect(yard('evening').some(t => t.includes('晒被子'))).toBe(false);
    expect(yard('afternoon').some(t => t.includes('晒被子'))).toBe(true);
  });

  it('says nothing, rather than something untrue, when no line fits', () => {
    // The courtyard has nothing to say on an early morning before the leaves come down.
    expect(DRAWS.map(roll => getAmbient('default', () => roll, at('morning', 'sunny', 3))).every(t => t === '')).toBe(true);
  });

  it('draws exactly once, so the rest of a season does not move', () => {
    let draws = 0;
    const counting = () => { draws++; return 0.5; };
    getActionResult('harvest', counting, { n: 9 }, at('morning', 'rainy', 5));
    getAmbient('fields', counting, at('evening', 'sunny', 3));
    getWeatherLine('rainy', counting, at('morning', 'rainy', 5));
    expect(draws).toBe(3);
  });

  it('leaves a draw with no moment as it always was', () => {
    expect(getActionResult('harvest', () => 0, { n: 12 })).toContain('到中午的时候');
    expect(getAmbient('office', () => 0)).toBeTruthy();
  });
});
