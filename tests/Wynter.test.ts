import { describe, it, expect } from 'vitest';
import { GameState, EventData, FlagMap } from '../src/types/game';
import { getFixedEvent } from '../src/systems/EventSystem';
import { generateWeather } from '../src/systems/WeatherSystem';

function makeState(flags: FlagMap = {}): GameState {
  return {
    day: 22,
    phase: 'evening',
    weather: 'frost',
    playerName: '',
    openingPage: null,
    resources: { grain: 60, guldmark: 20, timber: 5, renown: 2 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 },
    conversations: { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
    flags,
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
  };
}

const POSITION_LINE: FlagMap = {
  clue_pos_horses_intact: true,
  clue_pos_horse_returned: true,
  clue_pos_horse_condition: true,
  clue_pos_locate: true,
};
const MOTIVE: FlagMap = {
  clue_mot_martha_summer: true,
  clue_mot_handwriting: true,
  clue_mot_lorenz_question: true,
};

const scene = (flags: FlagMap = {}) =>
  (getFixedEvent(22, 'evening', makeState(flags)) as EventData).sceneText;
const enters = (flags: FlagMap = {}) =>
  (getFixedEvent(22, 'evening', makeState(flags)) as EventData).onEnterEffects?.flags ?? {};

describe('the day the wind turns', () => {
  it('is written rather than rolled', () => {
    for (let i = 0; i < 20; i++) expect(generateWeather(22, i * 5)).toBe('frost');
  });

  it('leaves every other day to the dice', () => {
    const rolls = new Set(Array.from({ length: 40 }, (_, i) => generateWeather(21, i * 3)));
    expect(rolls.size).toBeGreaterThan(1);
  });

  it('has the manor putting things away before anyone explains why', () => {
    expect(scene()).toContain('没有人说为什么，他们只是做了');
  });
});

describe('what 维特 can say depends on what the player was told', () => {
  it('talks about the weather to a steward carrying nothing', () => {
    expect(scene()).toContain('北边已经下过一场了');
    expect(scene()).not.toContain('顺序好像不对');
    expect(scene()).not.toContain('我把它按顺序说一遍');
  });

  it('notices the order is wrong once there are three pieces', () => {
    const text = scene({ ...MOTIVE });
    expect(text).toContain('顺序好像不对');
    expect(text).toContain('缺的那几块，应该都在您认识的人手里');
  });

  it('lays the whole thing out at six, marking which parts are inference', () => {
    const text = scene({ ...MOTIVE, ...POSITION_LINE });
    expect(text).toContain('我会说清楚哪些是推的');
    expect(text).toContain('仓促离开的人不收拾房间');
    expect(text).toContain('这是路过的人的便宜');
  });

  it('adds nothing of his own, and says so', () => {
    const text = scene({ ...MOTIVE, ...POSITION_LINE });
    expect(text).toContain('这些都是您自己知道的。”他说，“我没有加任何东西');
    expect(text).toContain('因为我不认识他们');
  });
});

describe('the fourth tier is the position line, and nothing else', () => {
  it('stays silent about where he is unless all four pieces are held', () => {
    const sixWithoutPosition = { ...MOTIVE, clue_ofc_timothy_nature: true, clue_ofc_thierry_range: true, clue_nob_marguerite: true };
    const text = scene(sixWithoutPosition);
    expect(text).toContain('我把它按顺序说一遍');
    expect(text).not.toContain('您知道他在哪儿');
  });

  it('tells the player they already know, once the four are in hand', () => {
    const text = scene({ ...MOTIVE, ...POSITION_LINE });
    expect(text).toContain('您知道他在哪儿');
    expect(text).toContain('我不是在问您。”他说，“我是在告诉您您已经知道了');
  });

  it('closes on the instruction the whole game has been building to', () => {
    const text = scene({ ...MOTIVE, ...POSITION_LINE });
    expect(text).toContain('没有那样的人');
    expect(text).toContain('把它交给一个能用它的人就行');
    expect(text).toContain('那天夜里下了这个秋天的第一场重霜');
  });

  it('records the two states the endings later read', () => {
    expect(enters()).toEqual({ metWynter: true });
    expect(enters({ ...MOTIVE, ...POSITION_LINE })).toEqual({
      metWynter: true, wynterRestated: true, wynterKnowsYouKnow: true,
    });
  });
});

describe('what v3 removed from him', () => {
  it('never mentions symbols, a signed letter, or knowing 霍特曼', () => {
    for (const flags of [{}, MOTIVE, { ...MOTIVE, ...POSITION_LINE }]) {
      const text = scene(flags);
      for (const retired of ['符号', '刻痕', '签名信', '通信', '土地权属']) {
        expect(text, retired).not.toContain(retired);
      }
    }
  });

  it('gives the player nothing to get wrong', () => {
    expect((getFixedEvent(22, 'evening', makeState()) as EventData).choices).toBeNull();
  });
});
