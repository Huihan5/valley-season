import { describe, it, expect } from 'vitest';
import { GameState, NpcId, WeatherType } from '../src/types/game';
import {
  getAct,
  getLocationBase,
  isGregorAtStable,
  getWeatherLine,
  shouldPlayAmbient,
  getAmbient,
  getGreeting,
  getActionResult,
  getMarketRumours,
} from '../src/systems/SceneSystem';
import { ACT_TWO_START, ACT_THREE_START } from '../src/data/config';
import locations from '../src/data/scenes/locations.json';
import greetings from '../src/data/dialogue/greetings.json';
import weatherLines from '../src/data/scenes/weather_lines.json';
import actionResults from '../src/data/scenes/action_results.json';
import ambient from '../src/data/scenes/ambient.json';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    resources: { grain: 0, guldmark: 50, timber: 8, renown: 0 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
    flags: {},
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
    ...overrides,
  };
}

/** Deterministic rng: always the first entry of any pool. */
const first = () => 0;
/** Deterministic rng: always the last entry of any pool. */
const last = () => 0.999999;

describe('act boundaries', () => {
  it('splits the season at Day 11 and Day 23', () => {
    expect(getAct(1)).toBe(1);
    expect(getAct(ACT_TWO_START - 1)).toBe(1);
    expect(getAct(ACT_TWO_START)).toBe(2);
    expect(getAct(ACT_THREE_START - 1)).toBe(2);
    expect(getAct(ACT_THREE_START)).toBe(3);
    expect(getAct(30)).toBe(3);
  });
});

describe('location bases', () => {
  it('every location has all three phases in all three acts', () => {
    for (const [key, entry] of Object.entries(locations as Record<string, Record<string, unknown>>)) {
      for (const act of ['act1', 'act2', 'act3']) {
        const byPhase = entry[act] as Record<string, string>;
        expect(byPhase, `${key}.${act}`).toBeDefined();
        for (const phase of ['morning', 'afternoon', 'evening']) {
          expect(byPhase[phase], `${key}.${act}.${phase}`).toBeTruthy();
        }
      }
    }
  });

  it('swaps the base by act for the same place and phase', () => {
    const act1 = getLocationBase(makeState({ day: 5 }), 'fields');
    const act2 = getLocationBase(makeState({ day: 15 }), 'fields');
    const act3 = getLocationBase(makeState({ day: 25 }), 'fields');
    expect(new Set([act1, act2, act3]).size).toBe(3);
  });

  it('prefixes the place name', () => {
    expect(getLocationBase(makeState(), 'kitchen').startsWith('厨房。')).toBe(true);
  });

  it('does not announce a place whose line already names it', () => {
    const evening = getLocationBase(makeState({ phase: 'evening' }), 'fields');
    expect(evening.startsWith('农田已经安静了')).toBe(true);
    expect(evening).not.toContain('农田。农田');
  });

  it('falls back to the default scene for an unknown key', () => {
    expect(getLocationBase(makeState(), 'nowhere').startsWith('枫径庄园。')).toBe(true);
  });

  it('no longer welds Marta dialogue into the kitchen morning', () => {
    expect(getLocationBase(makeState(), 'kitchen')).not.toContain('我有话要说');
  });
});

describe('格雷格 as a detachable line', () => {
  it('appears at the stable on an ordinary day', () => {
    expect(isGregorAtStable(makeState())).toBe(true);
    expect(getLocationBase(makeState(), 'stable')).toContain('梳理鬃毛');
  });

  it('is absent while he is riding with the hunt', () => {
    const state = makeState({ day: 19, flags: { huntAttendedDay19: true } });
    expect(isGregorAtStable(state)).toBe(false);
    expect(getLocationBase(state, 'stable')).not.toContain('梳理鬃毛');
  });

  it('leaves a stable description that still reads on its own', () => {
    const away = getLocationBase(makeState({ flags: { gregorAway: true } }), 'stable');
    expect(away).toContain('马的气味和干草的气味');
  });
});

describe('forge-hall evening', () => {
  it('still asks about 霍特曼 while the player knows little', () => {
    const text = getLocationBase(makeState({ phase: 'evening' }), 'forge_chapel');
    expect(text).toContain('霍特曼');
  });

  it('drops the question once two clues are in hand', () => {
    const state = makeState({
      phase: 'evening',
      flags: { clue_pos_horse_returned: true, clue_mot_martha_summer: true },
    });
    expect(getLocationBase(state, 'forge_chapel')).not.toContain('霍特曼');
  });
});

describe('weather lines', () => {
  it('has five for each of the five weathers', () => {
    const pools = weatherLines as Record<string, string[]>;
    expect(Object.keys(pools).sort()).toEqual(['cloudy', 'fog', 'frost', 'rainy', 'sunny']);
    for (const [weather, lines] of Object.entries(pools)) {
      expect(lines.length, weather).toBe(5);
    }
  });

  it('draws a line for every weather type', () => {
    const weathers: WeatherType[] = ['sunny', 'cloudy', 'rainy', 'frost', 'fog'];
    for (const w of weathers) expect(getWeatherLine(w, first)).toBeTruthy();
  });

  it('never names a specific place, so it can hang off any base', () => {
    const places = ['马厩', '厨房', '炉堂', '办公室', '林地', '农田'];
    for (const lines of Object.values(weatherLines as Record<string, string[]>)) {
      for (const line of lines) {
        for (const place of places) expect(line, line).not.toContain(place);
      }
    }
  });
});

describe('闲笔', () => {
  it('holds fifteen pieces across all pools', () => {
    const total = Object.values(ambient as Record<string, string[]>)
      .reduce((n, pool) => n + pool.length, 0);
    expect(total).toBe(15);
  });

  it('stays quiet in bad weather, when tired, or during an event', () => {
    const always = () => 0;
    expect(shouldPlayAmbient(makeState({ weather: 'rainy' }), always)).toBe(false);
    expect(shouldPlayAmbient(makeState({ fatigue: 4 }), always)).toBe(false);
    expect(shouldPlayAmbient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeState({ activeEvent: { id: 'x' } as any }),
      always,
    )).toBe(false);
  });

  it('plays on a calm, rested, uneventful day', () => {
    expect(shouldPlayAmbient(makeState(), () => 0)).toBe(true);
  });

  it('stays rare — a coin flip is not enough to trigger it', () => {
    expect(shouldPlayAmbient(makeState(), () => 0.5)).toBe(false);
  });

  it('falls back to the courtyard pool for a place with no pieces of its own', () => {
    expect(getAmbient('office', first)).toBeTruthy();
  });
});

describe('招呼语', () => {
  const TIERS = ['estranged', 'cold', 'neutral', 'accepted', 'trusted', 'embraced'];

  it('covers four residents across six tiers with two variants each', () => {
    const data = greetings as Record<string, Record<string, string[]>>;
    expect(Object.keys(data).sort()).toEqual(['gregor', 'lena', 'lorenz', 'marta']);
    for (const [npc, tiers] of Object.entries(data)) {
      expect(Object.keys(tiers).sort(), npc).toEqual([...TIERS].sort());
      for (const [tier, lines] of Object.entries(tiers)) {
        expect(lines.length, `${npc}.${tier}`).toBe(2);
      }
    }
  });

  it('picks the tier from effective trust, conversational layer included', () => {
    const neutral = getGreeting(makeState(), 'marta', first);
    const afterTalks = getGreeting(
      makeState({ conversations: { ...ZERO, marta: 3 } }),
      'marta',
      first,
    );
    expect(neutral).not.toBe(afterTalks);
  });

  it('reads the embraced tier at full trust', () => {
    const state = makeState({ relationships: { ...ZERO, gregor: 5 } });
    expect(getGreeting(state, 'gregor', last)).toContain('这个字他一天说不了两次');
  });

  it('returns nothing for an NPC with no greeting set', () => {
    expect(getGreeting(makeState(), 'henk', first)).toBe('');
  });
});

describe('行动结果文本', () => {
  const DRAFT_35_KINDS = [
    'harvest', 'fell_timber', 'survey_fields', 'survey_forest',
    'repair', 'forage', 'orchard', 'rest',
  ];

  it('holds three variants for each of the eight action kinds in draft 3.5', () => {
    const data = actionResults as Record<string, string[]>;
    expect(Object.keys(data)).toEqual(expect.arrayContaining(DRAFT_35_KINDS));
    for (const kind of DRAFT_35_KINDS) {
      expect(data[kind].length, kind).toBe(3);
    }
  });

  it('holds the paperwork variants and the three sequential ledger nights (draft 3.5b)', () => {
    const data = actionResults as Record<string, string[]>;
    expect(data.office_paperwork.length).toBe(3);
    for (const n of [1, 2, 3]) {
      expect(data[`night_ledger_${n}`].length, `night ${n}`).toBe(1);
    }
    // The third night is the one that lands the fragment.
    expect(data.night_ledger_3[0]).toContain('把自己占的地方越写越少');
  });

  it('has no text past the third ledger night, so the revelation is not replayed', () => {
    expect(getActionResult('night_ledger_4', first)).toBe('');
  });

  it('substitutes the yield into the text', () => {
    const text = getActionResult('harvest', first, { n: 12 });
    expect(text).toContain('12');
    expect(text).not.toContain('{n}');
  });

  it('substitutes both the cut and the quota that is left', () => {
    const text = getActionResult('fell_timber', first, { n: 3, r: 22 });
    expect(text).toContain('3');
    expect(text).toContain('22');
    expect(text).not.toContain('{');
  });

  it('returns nothing for an unknown kind rather than a broken template', () => {
    expect(getActionResult('no_such_action', first)).toBe('');
  });
});

describe('流言', () => {
  it('draws two or three, with the queueing paragraph in front', () => {
    for (const rng of [first, last, Math.random]) {
      const { intro, lines } = getMarketRumours(rng);
      expect(intro).toContain('排队');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(3);
    }
  });

  it('never repeats a rumour within one visit', () => {
    for (let i = 0; i < 50; i++) {
      const { lines } = getMarketRumours(Math.random);
      expect(new Set(lines).size).toBe(lines.length);
    }
  });

  it('can surface the Maplegate layer, false entries included', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      for (const line of getMarketRumours(Math.random).lines) seen.add(line);
    }
    expect([...seen].some(l => l.includes('枫径'))).toBe(true);
  });
});
