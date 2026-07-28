import { describe, it, expect } from 'vitest';
import { GameState, EventData, FlagMap } from '../src/types/game';
import { getFixedEvent, getEventById, getFreeChoices, getDayEndEffects } from '../src/systems/EventSystem';
import {
  getDinnerPicksCorrect, getDinnerDecorum, getDinnerSettlement,
} from '../src/systems/NobleSystem';
import { DINNER_SETTLEMENT } from '../src/data/config';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 7,
    phase: 'afternoon',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 0, guldmark: 60, timber: 12, renown: 0 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 },
    conversations: { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 },
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

const DECOROUS: FlagMap = { dinnerPick1: 'C', dinnerPick2: 'C', dinnerPick3: 'B' };

describe('the dinner is one outing and three decisions', () => {
  it('is not forced on anyone — it is an afternoon choice', () => {
    const choices = getFreeChoices(makeState()).map(c => c.id);
    expect(choices).toContain('attend_dinner');
    const day6 = getFreeChoices(makeState({ day: 6 })).map(c => c.id);
    expect(day6).not.toContain('attend_dinner');
  });

  it('does not open unless the player went', () => {
    expect(getFixedEvent(7, 'evening', makeState({ phase: 'evening' }))).toBeNull();
    const attended = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    expect(getFixedEvent(7, 'evening', attended)?.id).toBe('day7_dinner_arrival');
  });

  it('runs arrival → 霍特曼 → departure → the ride home', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    const ids = ['day7_dinner_arrival', 'day7_dinner_hartmann', 'day7_dinner_departure'];
    const nexts = ids.map(id => getEventById(id, state)?.next);
    expect(nexts).toEqual(['day7_dinner_hartmann', 'day7_dinner_departure', 'day7_dinner_return']);
    expect(getEventById('day7_dinner_return', state)?.next).toBeUndefined();
  });

  it('charges the evening once, at the end of the chain', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    expect(getEventById('day7_dinner_return', state)?.advancesPhase).toBe(true);
  });

  it('leaves every judgment point without microcopy (GDD 11.6)', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    for (const id of ['day7_dinner_arrival', 'day7_dinner_hartmann', 'day7_dinner_departure']) {
      for (const choice of getEventById(id, state)?.choices ?? []) {
        expect(choice.description, `${id}/${choice.id}`).toBeUndefined();
      }
    }
  });

  it('gives 判定点二 and 判定点三 their own prose, and lets 判定点一 run straight on', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    const prose = (id: string) => (getEventById(id, state)?.choices ?? []).map(c => c.resultText);
    expect(prose('day7_dinner_arrival').every(t => t === undefined)).toBe(true);
    expect(prose('day7_dinner_hartmann').every(Boolean)).toBe(true);
    expect(prose('day7_dinner_departure').every(Boolean)).toBe(true);
  });

  it('leaves 玛格丽特 holding a sentence rather than a fragment', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true } });
    const askThem = getEventById('day7_dinner_hartmann', state)
      ?.choices?.find(c => c.id === 'dinner2_ask_them');
    expect(askThem?.resultText).toContain('他上一次到我这儿来，是在夏末');
    expect(JSON.stringify(askThem?.effects?.flags ?? {})).not.toContain('clue_');
  });
});

describe('what the evening settles', () => {
  it('counts only the answers the drafts mark 得体', () => {
    expect(getDinnerPicksCorrect(makeState({ flags: DECOROUS }))).toBe(3);
    expect(getDinnerPicksCorrect(makeState({ flags: { ...DECOROUS, dinnerPick3: 'C' } }))).toBe(2);
    expect(getDinnerPicksCorrect(makeState({ flags: {} }))).toBe(0);
  });

  it('forgives one misread — two 得体 still buys 贵族信任', () => {
    expect(getDinnerSettlement(2).nobleTrust).toBe(1);
    expect(getDinnerSettlement(3).nobleTrust).toBe(1);
    expect(getDinnerSettlement(1).nobleTrust).toBeUndefined();
  });

  it('only docks standing for reading the room wrong three times out of three', () => {
    expect(DINNER_SETTLEMENT.map(s => s.renown)).toEqual([-1, 0, 1, 2]);
  });

  it('lets the gift and the coat raise the floor by one, but never past three', () => {
    const dressed = { boughtGift: true, boughtAttire: true };
    expect(getDinnerDecorum(makeState({ flags: dressed }))).toBe(1);
    expect(getDinnerDecorum(makeState({ flags: { ...DECOROUS, ...dressed } }))).toBe(3);
  });

  it('settles on the ride home, not at the door', () => {
    const state = makeState({ phase: 'evening', flags: { attendedDinner: true, ...DECOROUS } });
    const ride = getEventById('day7_dinner_return', state) as EventData;
    expect(ride.onEnterEffects?.nobleTrust).toBe(1);
    expect(ride.onEnterEffects?.renown).toBe(2);
    expect(ride.onEnterEffects?.flags?.dinnerPerformance).toBe(3);
  });

  it('answers the invitation with silence when the player stays home', () => {
    const stayed = makeState({ day: 7, flags: {} });
    expect(getDayEndEffects(stayed)?.renown).toBe(-1);
    expect(getDayEndEffects(stayed)?.flags?.dinnerPerformance).toBe(0);
    expect(getDayEndEffects(makeState({ day: 7, flags: { attendedDinner: true } }))).toBeNull();
    expect(getDayEndEffects(makeState({ day: 8, flags: {} }))).toBeNull();
  });
});

describe('Day 10 · the petition rewards having walked the place', () => {
  const petition = (flags: FlagMap, marta = 0) =>
    getFixedEvent(10, 'afternoon', makeState({
      day: 10, phase: 'afternoon', flags,
      relationships: { gregor: 0, marta, lena: 0, elke: 0, henk: 0, lorenz: 0 },
    })) as EventData;

  it('shows only five names to a steward who never left the office', () => {
    expect(petition({}).sceneText).toContain('你不知道哪一家最急');
  });

  it('opens the information layer for either 玛莎 or the survey', () => {
    expect(petition({ surveyedFields: true }).sceneText).toContain('牛病了会传染');
    expect(petition({}, 2).sceneText).toContain('牛病了会传染');
  });

  it('makes the middle option fair only when the player could rank them', () => {
    const informed = petition({ surveyedFields: true }).choices?.find(c => c.id === 'repair_partial');
    expect(informed?.effects?.flags?.petitionFairness).toBe('fair');
    expect(informed?.effects?.renown).toBe(1);
    expect(informed?.resultText).toContain('牛棚那个确实最要紧');

    const blind = petition({}).choices?.find(c => c.id === 'repair_partial');
    expect(blind?.effects?.flags?.petitionFairness).toBe('unfair');
    expect(blind?.effects?.renown).toBeUndefined();
    expect(blind?.resultText).toContain('被风吹到了地上');
  });

  it('keeps the tenant-trust ladder from GDD 5.5', () => {
    const by = (id: string) => petition({}).choices?.find(c => c.id === id)?.effects?.tenantTrust;
    expect(by('repair_all')).toBe(2);
    expect(by('repair_none')).toBe(-1);
    expect(petition({ surveyedFields: true }).choices
      ?.find(c => c.id === 'repair_partial')?.effects?.tenantTrust).toBe(1);
  });

  it('states the price of each repair but not what it buys', () => {
    const choices = petition({}).choices ?? [];
    expect(choices.find(c => c.id === 'repair_all')?.description).toBe('40 金卢 · 10 木材');
    expect(choices.find(c => c.id === 'repair_partial')?.description).toBe('24 金卢 · 6 木材');
    expect(choices.find(c => c.id === 'repair_none')?.description).toBeUndefined();
  });
});

describe('the three echoes come back the next morning', () => {
  const echo = (day: number, flags: FlagMap) =>
    getFixedEvent(day, 'morning', makeState({ day, phase: 'morning', flags }));

  it('cost nothing and ask nothing', () => {
    const e = echo(8, { attendedDinner: true, dinnerPerformance: 2 }) as EventData;
    expect(e.advancesPhase).toBe(false);
    expect(e.choices).toBeNull();
  });

  it('are silent about a dinner the player never attended', () => {
    expect(echo(8, {})).toBeNull();
    expect(echo(11, {})).toBeNull();
    expect(echo(13, {})).toBeNull();
  });

  it('sends 格雷格 or the kitchen, by how the evening went', () => {
    expect(echo(8, { attendedDinner: true, dinnerPerformance: 2 })?.sceneText)
      .toContain('让男爵夫人送到门口');
    expect(echo(8, { attendedDinner: true, dinnerPerformance: 1 })?.sceneText)
      .toContain('先生有什么吩咐');
  });

  it('answers the petition in kind: dried fruit, a nod, or two men who did not come', () => {
    const text = (fairness: string) =>
      echo(11, { petitionResolved: true, petitionFairness: fairness })?.sceneText ?? '';
    expect(text('full')).toContain('我媳妇做的');
    expect(text('fair')).toContain('他们不闹');
    expect(text('unfair')).toContain('有两个人没有到');
    expect(text('none')).toContain('有两个人没有到');
  });

  it('only tidies the office when the audit found something', () => {
    expect(echo(13, { auditFlagged: true })?.sceneText).toContain('削好的铅笔');
    expect(echo(13, { auditResult: 'clean' })).toBeNull();
  });
});
