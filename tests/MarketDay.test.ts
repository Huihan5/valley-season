import { describe, it, expect } from 'vitest';
import { GameState, EventData, FlagMap } from '../src/types/game';
import { getFixedEvent, getFreeChoices, getEventById } from '../src/systems/EventSystem';
import {
  composeScene, getMarketArrival, getMarketReturn, drawRumours,
  encodeRumours, decodeRumours, rumoursFlagKey,
} from '../src/systems/SceneSystem';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 6,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 40, guldmark: 30, timber: 10, renown: 0 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    conversations: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
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

const atMarket = (day: number, extra: FlagMap = {}) => ({
  visitingMarketToday: day, [`visitedMarket_day${day}`]: true, ...extra,
});

describe('the ride in', () => {
  it('carries the season on the stalls, act by act', () => {
    expect(getMarketArrival(makeState({ day: 6 }))).toContain('最后一批李子');
    expect(getMarketArrival(makeState({ day: 13 }))).toContain('集市今天比上次满');
    expect(getMarketArrival(makeState({ day: 27 }))).toContain('圣火节要用的东西');
  });

  it('has nobody know you in act one and somebody recognise you in act two', () => {
    expect(getMarketArrival(makeState({ day: 6 }))).toContain('没有人认识你');
    expect(getMarketArrival(makeState({ day: 13 }))).toContain('这一次有人认出了你');
  });

  it('lets the grain merchant remember the cart only if it has been there', () => {
    const known = makeState({ day: 27, flags: { marketFirstVisitDone: true } });
    const stranger = makeState({ day: 27 });
    expect(getMarketArrival(known)).toContain('他朝你点了点头');
    expect(getMarketArrival(stranger)).toContain('这个月他没见过你');
  });

  it('always ends with 格雷格 turning back at the square', () => {
    for (const day of [6, 13, 27]) {
      expect(getMarketArrival(makeState({ day })), String(day)).toContain('他不喜欢城里');
    }
  });

  it('is what the player reads on arriving, not a log line', () => {
    const go = getFreeChoices(makeState()).find(c => c.id === 'go_to_market');
    expect(go?.resultText).toContain('河谷城比你想的小');
  });
});

describe('the queue and what it says', () => {
  it('draws two or three, once, on the way in', () => {
    const go = getFreeChoices(makeState()).find(c => c.id === 'go_to_market');
    const drawn = decodeRumours(go?.effects?.flags?.[rumoursFlagKey(6)]);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(drawn.length).toBeLessThanOrEqual(3);
  });

  it('says the same thing all afternoon, however many sacks get sold', () => {
    const drawn = encodeRumours(drawRumours(Math.random));
    const state = makeState({
      phase: 'afternoon', currentScene: 'market',
      flags: atMarket(6, { [rumoursFlagKey(6)]: drawn }),
    });
    const first = composeScene(state, 'market', Math.random);
    const afterASale = composeScene(state, 'market', Math.random);
    expect(afterASale).toBe(first);
  });

  it('opens with the queueing paragraph', () => {
    const state = makeState({
      phase: 'afternoon', currentScene: 'market',
      flags: atMarket(6, { [rumoursFlagKey(6)]: encodeRumours([0, 1]) }),
    });
    expect(composeScene(state, 'market', Math.random)).toContain('你什么也不做，但你什么都听得见');
  });

  it('is the afternoon scene, not the manor with weather over it', () => {
    const state = makeState({
      phase: 'afternoon', currentScene: 'market',
      flags: atMarket(6, { [rumoursFlagKey(6)]: encodeRumours([0]) }),
    });
    expect(composeScene(state, 'market', Math.random)).not.toContain('枫径庄园。');
  });
});

describe('trading and the ride home', () => {
  const afternoon = (flags: FlagMap = {}) =>
    getFreeChoices(makeState({ phase: 'afternoon', flags: atMarket(6, flags) }));

  it('gives the grain sale the merchant who searches the wheat in his palm', () => {
    const sale = afternoon().find(c => c.id.startsWith('market_sell_grain'));
    expect(sale?.resultText).toContain('北坡那边有几家的麦子发过芽');
  });

  it('lets 磨岭 tell the timber yard you were coming', () => {
    const plain = afternoon().find(c => c.id.startsWith('market_sell_timber'));
    expect(plain?.resultText).toContain('他报了市价，一分不多');

    const dealt = afternoon({ millridgeDealSigned: true })
      .find(c => c.id.startsWith('market_sell_timber'));
    expect(dealt?.resultText).toContain('价钱给您按四算');
  });

  it('treats coming home empty as a trip that still taught you something', () => {
    const finish = afternoon().find(c => c.id === 'market_finish');
    expect(finish?.text).toBe('什么都不做');
    expect(finish?.resultText).toContain('下一次你会知道什么时候该出手');
    expect(finish?.resultText).toContain('车上和来的时候一样重');
  });

  it('makes the cart lighter on the way back once something sold', () => {
    const finish = afternoon({ marketUnitsSold_day6: 4 }).find(c => c.id === 'market_finish');
    expect(finish?.text).toBe('装车返程');
    expect(finish?.resultText).not.toContain('下一次你会知道');
    expect(finish?.resultText).toContain('每过一个坑就响一下');
  });

  it('ends every market day with 格雷格 looking at the horse first', () => {
    expect(getMarketReturn(true)).toContain('他不问你卖了多少。他先看马');
    expect(getMarketReturn(false)).toContain('他不问你卖了多少。他先看马');
  });
});

describe('the officers keep their own schedule', () => {
  const encounter = (day: number, flags: FlagMap = {}) =>
    getFixedEvent(day, 'afternoon', makeState({ day, phase: 'afternoon', flags }));

  it('puts 提莫西 at Day 6 and 蒂埃里 at Day 13, only if the player went', () => {
    expect(encounter(6)).toBeNull();
    expect(encounter(6, atMarket(6))?.id).toBe('day6_timothy');
    expect(encounter(13)).toBeNull();
    expect(encounter(13, atMarket(13))?.id).toBe('day13_thierry');
  });

  it('leaves Day 20 to the hunt', () => {
    expect(encounter(20, atMarket(20))).toBeNull();
  });

  it('records the meeting itself, since the date cannot be used to infer it', () => {
    expect(encounter(6, atMarket(6))?.onEnterEffects?.flags?.met_timothy).toBe(true);
    expect(encounter(13, atMarket(13))?.onEnterEffects?.flags?.met_thierry).toBe(true);
  });

  it('costs nothing — they are standing there when the player walks past', () => {
    expect(encounter(6, atMarket(6))?.advancesPhase).toBe(false);
    expect(encounter(13, atMarket(13))?.advancesPhase).toBe(false);
  });

  it('pays a fragment only for speaking their language', () => {
    const timothy = encounter(6, atMarket(6))?.choices ?? [];
    expect(timothy.filter(c => c.effects?.flags?.clue_ofc_timothy_person).map(c => c.id))
      .toEqual(['timothy6_document']);

    const thierry = encounter(13, atMarket(13))?.choices ?? [];
    expect(thierry.filter(c => c.effects?.flags?.clue_ofc_thierry_range).map(c => c.id))
      .toEqual(['thierry13_boundary']);
  });

  it('has 蒂埃里 draw the edge of his own patrol, which is where the line starts', () => {
    const boundary = encounter(13, atMarket(13))?.choices
      ?.find(c => c.id === 'thierry13_boundary');
    expect(boundary?.resultText).toContain('我巡林的范围到这儿为止');
    expect(boundary?.resultText).toContain('别一个人去');
  });
});

describe('Day 27 · the last market', () => {
  const state = (flags: FlagMap = {}) =>
    makeState({ day: 27, phase: 'afternoon', flags: atMarket(27, flags) });

  it('puts both of them outside the chancery, and runs on to the street corner', () => {
    const event = getFixedEvent(27, 'afternoon', state()) as EventData;
    expect(event.id).toBe('day27_officers');
    expect(event.next).toBe('day27_street_corner');
  });

  it('offers 蒂埃里 only to a player carrying 格雷格 third fragment', () => {
    const withoutBundle = getFixedEvent(27, 'afternoon', state())?.choices ?? [];
    const bundle = withoutBundle.find(c => c.id === 'day27_thierry');
    expect(bundle?.requiresFlag).toBe('clue_pos_horse_condition');
  });

  it('makes the two paths pay different lines: 磨岭 numbers, or the place itself', () => {
    const choices = getFixedEvent(27, 'afternoon', state())?.choices ?? [];
    const byId = (id: string) => choices.find(c => c.id === id);
    expect(byId('day27_timothy')?.effects?.flags?.clue_ofc_timothy_declaration).toBe(true);
    expect(byId('day27_thierry')?.effects?.flags?.clue_pos_locate).toBe(true);
  });

  it('has 提莫西 close on the sentence that only means something later', () => {
    const timothy = getFixedEvent(27, 'afternoon', state())?.choices
      ?.find(c => c.id === 'day27_timothy');
    expect(timothy?.resultText).toContain('三年前问过我同一个问题');
  });

  it('asks the question the whole game is about, and writes nothing for two of the answers', () => {
    const corner = getEventById('day27_street_corner', state()) as EventData;
    expect(corner.sceneText).toContain('所以您为什么要留在这里？');
    const byId = (id: string) => corner.choices?.find(c => c.id === id);
    expect(byId('corner_contract')?.effects?.flags).toBeUndefined();
    expect(byId('corner_need_work')?.effects?.flags).toBeUndefined();
    expect(byId('corner_want_to_stay')?.effects?.flags?.admittedWantToStay).toBe(true);
  });

  it('gives the admission no number at all — it only changes ending three', () => {
    const corner = getEventById('day27_street_corner', state()) as EventData;
    const admit = corner.choices?.find(c => c.id === 'corner_want_to_stay');
    expect(admit?.effects?.renown).toBeUndefined();
    expect(admit?.effects?.nobleTrust).toBeUndefined();
    expect(admit?.resultText).toContain('瓶子不用还');
  });

  it('keeps the street corner free — nobody is charged for standing there', () => {
    expect(getEventById('day27_street_corner', state())?.advancesPhase).toBe(false);
  });
});
