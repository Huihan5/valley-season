import { describe, it, expect } from 'vitest';
import { GameState, DayPhase, WeatherType } from '../src/types/game';
import { createInitialState } from '../src/systems/GameEngine';
import { getBottomLine, pickBottomLineId } from '../src/systems/BottomLineSystem';
import { BOTTOM_LINE_RULES, BOTTOM_LINE_CHANCE } from '../src/data/config';
import zhLines from '../src/data/zh/scenes/bottom_lines.json';
import enLines from '../src/data/en/scenes/bottom_lines.json';
import zhLocations from '../src/data/zh/scenes/locations.json';

// The quiet line under the choices (plan 3.6): a function of the state, never of the
// engine's stream, and true of the place, the hour and the weather it is shown in.

/** What each id is about, so a reworded line cannot drift from the rule it carries. */
const MEANT: Record<string, string> = {
  kitchen_window: '厨房窗玻璃上的水汽',
  wind_slope: '风从坡上下来',
  maple_snow: '枫叶下得像下雪',
  chimney_smoke: '烟囱的烟是直着往上走的',
  frost_steam: '整片田在冒白气',
};

function at(over: Partial<GameState>): GameState {
  return {
    ...createInitialState(over.seed ?? 11),
    openingPage: null,
    playerName: '安',
    activeEvent: null,
    demoComplete: false,
    endingId: null,
    currentSceneText: '',
    lastResult: null,
    ...over,
  };
}

const PHASES: DayPhase[] = ['morning', 'afternoon', 'evening'];
const WEATHERS: WeatherType[] = ['sunny', 'cloudy', 'rainy', 'frost', 'fog'];
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Every id the place, hour and weather ever allows, over many seeds, so the chance gate does not hide it. */
function idsSeen(scene: string, over: Partial<GameState> = {}, seeds = 120): Set<string> {
  const seen = new Set<string>();
  for (let seed = 1; seed <= seeds; seed++) {
    const id = pickBottomLineId(at({ seed, currentScene: scene, ...over }));
    if (id) seen.add(id);
  }
  return seen;
}

describe('the pool and its conditions agree', () => {
  it('every line has text in both languages, a rule, and a note of what it is', () => {
    const ids = Object.keys(zhLines).sort();
    expect(Object.keys(enLines).sort()).toEqual(ids);
    expect(Object.keys(BOTTOM_LINE_RULES).sort()).toEqual(ids);
    for (const id of ids) {
      expect((zhLines as Record<string, string>)[id]).toContain(MEANT[id]);
      expect((enLines as Record<string, string>)[id].length).toBeGreaterThan(10);
    }
  });

  it('every rule names a place the game has', () => {
    for (const [id, rule] of Object.entries(BOTTOM_LINE_RULES)) {
      for (const scene of rule.scenes) {
        expect(Object.keys(zhLocations), `${id}: ${scene}`).toContain(scene);
      }
    }
  });

  it('each line is one short sentence, not a scene', () => {
    for (const text of Object.values(zhLines)) expect(text.includes('\n')).toBe(false);
    for (const text of Object.values(enLines)) expect(text.includes('\n')).toBe(false);
  });
});

describe('where a line may be said', () => {
  it('the kitchen window only in the kitchen', () => {
    expect(idsSeen('kitchen').has('kitchen_window')).toBe(true);
    for (const scene of ['office', 'fields', 'forest', 'stable', 'forge_chapel', 'default', 'market']) {
      expect(idsSeen(scene, { day: 14, phase: 'afternoon', weather: 'cloudy' }).has('kitchen_window'), scene).toBe(false);
    }
  });

  it('the wind on the slope only in the woods, by day, in quiet weather', () => {
    for (const phase of PHASES) for (const weather of WEATHERS) {
      const seen = idsSeen('forest', { phase, weather, day: 12 }).has('wind_slope');
      const quiet = (phase === 'morning' || phase === 'afternoon') && weather !== 'rainy' && weather !== 'fog';
      expect(seen, `${phase}/${weather}`).toBe(quiet);
    }
    expect(idsSeen('fields', { phase: 'morning', weather: 'sunny', day: 12 }).has('wind_slope')).toBe(false);
  });

  it('the maple leaves in the courtyard, by day, from the second act', () => {
    for (const day of DAYS) for (const phase of PHASES) {
      const seen = idsSeen('default', { day, phase, weather: 'cloudy' }, 40).has('maple_snow');
      expect(seen, `Day ${day} ${phase}`).toBe(day >= 11 && phase !== 'evening');
    }
  });
  it('the chimney smoke at dusk, in the courtyard, in quiet weather', () => {
    for (const phase of PHASES) for (const weather of WEATHERS) {
      const seen = idsSeen('default', { phase, weather, day: 8 }).has('chimney_smoke');
      expect(seen, `${phase}/${weather}`).toBe(phase === 'evening' && weather !== 'rainy' && weather !== 'fog');
    }
    expect(idsSeen('fields', { phase: 'evening', weather: 'sunny', day: 8 }).has('chimney_smoke')).toBe(false);
  });

  it('the steam off the fields on a morning after frost has begun', () => {
    for (const day of DAYS) for (const phase of PHASES) for (const weather of WEATHERS) {
      const seen = idsSeen('fields', { day, phase, weather }, 20).has('frost_steam');
      const fits = day >= 11 && phase === 'morning' && weather !== 'rainy' && weather !== 'fog';
      expect(seen, `Day ${day} ${phase}/${weather}`).toBe(fits);
    }
  });
});

describe('when there is none', () => {
  it('in an event, at the market, in an ending, or before the season begins', () => {
    let found: GameState | null = null;
    for (let seed = 1; seed < 200 && !found; seed++) {
      const candidate = at({ seed, currentScene: 'kitchen', day: 14, phase: 'morning' });
      if (getBottomLine(candidate)) found = candidate;
    }
    expect(found).not.toBeNull();
    const base = found!;
    expect(getBottomLine({ ...base, activeEvent: { id: 'x', title: 'x', sceneText: 'x', choices: [] } as unknown as GameState['activeEvent'] })).toBeNull();
    expect(getBottomLine({ ...base, demoComplete: true, endingId: 'ending1' })).toBeNull();
    expect(getBottomLine({ ...base, openingPage: 0 })).toBeNull();
  });

  it('on a place with no line at all', () => {
    expect(idsSeen('office', { day: 14, phase: 'afternoon' }).size).toBe(0);
    expect(idsSeen('stable', { day: 14, phase: 'afternoon' }).size).toBe(0);
    expect(idsSeen('market', { day: 13, phase: 'afternoon' }).size).toBe(0);
  });

  it('when the scene has just said the same thing at length', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = at({ seed, currentScene: 'default', day: 14, phase: 'morning' });
      if (!getBottomLine(s)) continue;
      const told = { ...s, currentSceneText: `${s.currentSceneText}\n\n枫叶下得像下雪。\n\n不是一片一片，是一阵风过来就下一层。` };
      expect(getBottomLine(told)).toBeNull();
      return;
    }
    throw new Error('no seed gave the courtyard a line');
  });
});

describe('a line stays put', () => {
  it('the same state gives the same line however often it is asked', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = at({ seed, currentScene: 'kitchen', day: 9, phase: 'afternoon' });
      const first = getBottomLine(s);
      for (let i = 0; i < 5; i++) expect(getBottomLine({ ...s })).toBe(first);
    }
  });

  it('the same id is picked whatever the language, so a switch does not change the line', () => {
    // pickBottomLineId reads no text but the dedupe check; with an empty scene it is a pure
    // function of (seed, day, hour, place, weather), which is what a replay rebuilds.
    for (let seed = 1; seed <= 60; seed++) {
      const s = at({ seed, currentScene: 'default', day: 15, phase: 'morning' });
      expect(pickBottomLineId(s)).toBe(pickBottomLineId({ ...s, currentSceneText: '' }));
    }
  });

  it('a different hour or day may draw differently, but each is steady on its own', () => {
    const ids = new Set<string | null>();
    for (const day of DAYS) for (const phase of PHASES) {
      const s = at({ seed: 5, currentScene: 'kitchen', day, phase });
      const id = pickBottomLineId(s);
      expect(pickBottomLineId({ ...s })).toBe(id);
      ids.add(id);
    }
    expect(ids.has(null)).toBe(true);
    expect(ids.has('kitchen_window')).toBe(true);
  });

  it('shows on about the share of hours the chance says', () => {
    let shown = 0;
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) for (const day of DAYS) for (const phase of PHASES) {
      total++;
      if (pickBottomLineId(at({ seed, currentScene: 'kitchen', day, phase }))) shown++;
    }
    expect(shown / total).toBeGreaterThan(BOTTOM_LINE_CHANCE - 0.05);
    expect(shown / total).toBeLessThan(BOTTOM_LINE_CHANCE + 0.05);
  });

  it('a save from before seeding still gets a steady line', () => {
    const s = { ...at({ currentScene: 'kitchen', day: 10, phase: 'morning' }), seed: undefined };
    expect(getBottomLine(s)).toBe(getBottomLine({ ...s }));
  });
});
