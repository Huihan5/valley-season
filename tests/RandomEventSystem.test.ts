import { describe, it, expect } from 'vitest';
import { GameState, NpcId, FlagMap } from '../src/types/game';
import {
  getEligibleRandomEvents, getRandomEventChance, rollRandomEvent,
  getPendingRandomEvent, markEventDay,
} from '../src/systems/RandomEventSystem';
import { readKingdomRumour } from '../src/systems/SceneSystem';
import {
  RANDOM_EVENT_CHANCE, RANDOM_EVENT_CHANCE_WITH_FIXED, RANDOM_EVENT_CHANCE_QUIET,
} from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    day: 9,
    phase: 'afternoon',
    weather: 'cloudy',
    playerName: '安',
    openingPage: null,
    resources: { grain: 40, guldmark: 10, timber: 3, renown: 0 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: 0,
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
    ...over,
  };
}

/** An rng that returns the given numbers in order, then repeats the last one. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const idsOn = (day: number, flags: FlagMap = {}) =>
  getEligibleRandomEvents(makeState({ day, flags })).map(e => e.id);

// ── 窗口 ────────────────────────────────────────────────────────────────────

describe('random event windows', () => {
  it('opens nothing in the first four days', () => {
    expect(idsOn(4)).toEqual([]);
  });

  it('opens the ox and the pedlar on Day 5', () => {
    expect(idsOn(5).sort()).toEqual(['random_lost_ox', 'random_tool_pedlar']);
  });

  it('adds the well from Day 8 and the merchant from Day 11', () => {
    expect(idsOn(8)).toContain('random_well');
    expect(idsOn(10)).not.toContain('random_forge_city_merchant');
    expect(idsOn(11)).toContain('random_forge_city_merchant');
  });

  it('closes the ox after Day 17 and the rest after Day 20', () => {
    expect(idsOn(18)).not.toContain('random_lost_ox');
    expect(idsOn(21)).toEqual(['random_well']);
  });

  it('holds the third-act day to its four dates', () => {
    for (const day of [24, 25, 28, 29]) expect(idsOn(day)).toContain('random_quiet_day');
    for (const day of [23, 26, 27, 30]) expect(idsOn(day)).not.toContain('random_quiet_day');
  });

  it('drops an event that has already happened', () => {
    expect(idsOn(9, { event_done_random_well: true })).not.toContain('random_well');
  });

  it('keeps the pedlar away once the tools are paid for', () => {
    expect(idsOn(9, { toolsRepaired: true })).not.toContain('random_tool_pedlar');
  });
});

// ── 概率窗口 ────────────────────────────────────────────────────────────────

describe('the daily window', () => {
  it('is the base chance on an ordinary day', () => {
    expect(getRandomEventChance(makeState({ day: 9, flags: { lastEventDay: 8 } })))
      .toBe(RANDOM_EVENT_CHANCE);
  });

  it('narrows on a day that already has a fixed event', () => {
    expect(getRandomEventChance(makeState({ day: 10, flags: { lastEventDay: 9 } })))
      .toBe(RANDOM_EVENT_CHANCE_WITH_FIXED);
  });

  it('widens after two days in which nothing happened', () => {
    // Day 9, last event on Day 6: Day 7 and Day 8 both came and went.
    expect(getRandomEventChance(makeState({ day: 9, flags: { lastEventDay: 6 } })))
      .toBe(RANDOM_EVENT_CHANCE_QUIET);
  });

  it('does not widen after only one quiet day', () => {
    expect(getRandomEventChance(makeState({ day: 9, flags: { lastEventDay: 7 } })))
      .toBe(RANDOM_EVENT_CHANCE);
  });

  it('lets the fixed event win over the quiet streak', () => {
    expect(getRandomEventChance(makeState({ day: 10, flags: { lastEventDay: 1 } })))
      .toBe(RANDOM_EVENT_CHANCE_WITH_FIXED);
  });
});

// ── 判定 ────────────────────────────────────────────────────────────────────

describe('the daily roll', () => {
  it('happens once a day and no more', () => {
    const state = makeState({ day: 9, flags: { randomRolledDay: 9 } });
    expect(rollRandomEvent(state, scripted(0))).toBeNull();
  });

  it('records the day even when nothing comes of it', () => {
    const flags = rollRandomEvent(makeState({ day: 9 }), scripted(0.99));
    expect(flags).toEqual({ randomRolledDay: 9, randomEventPending: '' });
  });

  it('clears yesterday’s event when today draws nothing', () => {
    const state = makeState({ day: 9, flags: { randomRolledDay: 8, randomEventPending: 'random_well' } });
    expect(rollRandomEvent(state, scripted(0.99))?.randomEventPending).toBe('');
  });

  it('puts one event on the day when the roll lands', () => {
    const flags = rollRandomEvent(makeState({ day: 9, flags: { lastEventDay: 8 } }), scripted(0.1, 0));
    expect(flags?.randomEventPending).toBe('random_lost_ox');
  });

  it('draws nothing on a day with an empty pool, whatever the roll', () => {
    const flags = rollRandomEvent(makeState({ day: 4 }), scripted(0));
    expect(flags?.randomEventPending).toBe('');
  });

  it('settles the third-act variant at roll time', () => {
    const flags = rollRandomEvent(makeState({ day: 24, flags: { lastEventDay: 23 } }), scripted(0.1, 0.99));
    expect(flags?.randomEventPending).toBe('random_quiet_day');
    expect(['one', 'two', 'three']).toContain(String(flags?.randomEventVariant));
  });

  it('settles the traveller’s piece of news at roll time', () => {
    // Day 11: ox, pedlar, merchant, well — the third of four.
    const flags = rollRandomEvent(makeState({ day: 11, flags: { lastEventDay: 10 } }), scripted(0.1, 0.5));
    expect(flags?.randomEventPending).toBe('random_forge_city_merchant');
    expect(readKingdomRumour(Number(flags?.randomEventRumour))).toBeTruthy();
  });
});

// ── 时点 ────────────────────────────────────────────────────────────────────

describe('when the event reaches the screen', () => {
  const pending = (id: string, over: Partial<GameState> = {}) =>
    getPendingRandomEvent(makeState({ flags: { randomEventPending: id }, ...over }));

  it('shows nothing when nothing is pending', () => {
    expect(getPendingRandomEvent(makeState())).toBeNull();
  });

  it('opens a 日中 event at the head of the afternoon', () => {
    expect(pending('random_well', { phase: 'afternoon' })?.id).toBe('random_well');
    expect(pending('random_well', { phase: 'evening' })).toBeNull();
  });

  it('opens a 入夜前 event at the head of the evening', () => {
    expect(pending('random_forge_city_merchant', { phase: 'afternoon' })).toBeNull();
    expect(pending('random_forge_city_merchant', { phase: 'evening' })?.id)
      .toBe('random_forge_city_merchant');
  });

  it('costs no phase by arriving', () => {
    expect(pending('random_well', { phase: 'afternoon' })?.advancesPhase).toBe(false);
  });

  it('charges the phase to the choice that spends it', () => {
    const event = pending('random_well', { phase: 'afternoon' });
    const dig = event?.choices?.find(c => c.id === 'well_self');
    const hire = event?.choices?.find(c => c.id === 'well_hire');
    expect(dig?.advancesPhase).toBe(true);
    expect(hire?.advancesPhase).toBeUndefined();
  });
});

// ── 事件内容 ────────────────────────────────────────────────────────────────

describe('what the five events do', () => {
  const pendingAt = (id: string, phase: GameState['phase'], flags: FlagMap = {}) =>
    getPendingRandomEvent(makeState({ phase, flags: { randomEventPending: id, ...flags } }));

  it('gives the third-act day the variant that was drawn', () => {
    const event = pendingAt('random_quiet_day', 'afternoon', { randomEventVariant: 'three' });
    expect(event?.sceneText).toContain('今天没有出任何事。');
    expect(event?.choices).toBeNull();
  });

  it('weaves the traveller’s news into the night he stays', () => {
    const event = pendingAt('random_forge_city_merchant', 'evening', { randomEventRumour: 7 });
    const stay = event?.choices?.find(c => c.id === 'merchant_stay');
    expect(stay?.resultText).toContain('玛莎多做了一个人的饭');
    expect(stay?.resultText).toContain(readKingdomRumour(7));
    expect(stay?.resultText).toContain('铸都那边的细盐');
  });

  it('costs standing to turn him away', () => {
    const event = pendingAt('random_forge_city_merchant', 'evening');
    expect(event?.choices?.find(c => c.id === 'merchant_refuse')?.effects?.renown).toBe(-1);
  });

  it('lets the cheap tools stand in for the repair', () => {
    const event = pendingAt('random_tool_pedlar', 'afternoon');
    const buy = event?.choices?.find(c => c.id === 'pedlar_buy');
    expect(buy?.effects?.flags?.toolsRepaired).toBe(true);
    expect(buy?.effects?.guldmark).toBe(-8);
  });

  it('pays 格雷格’s trust for not buying them', () => {
    const event = pendingAt('random_tool_pedlar', 'afternoon');
    expect(event?.choices?.find(c => c.id === 'pedlar_refuse')?.effects?.relationships?.gregor).toBe(1);
  });

  it('leaves the player nothing worse for letting the ox be found by itself', () => {
    const event = pendingAt('random_lost_ox', 'afternoon');
    const decline = event?.choices?.find(c => c.id === 'ox_decline');
    expect(decline?.effects?.renown).toBeUndefined();
    expect(decline?.effects?.relationships).toBeUndefined();
    expect(decline?.resultText).toContain('什么也没有发生。');
  });

  it('carries no clue and no noble trust anywhere in the pool', () => {
    const all = [
      'random_lost_ox', 'random_tool_pedlar', 'random_forge_city_merchant',
      'random_well', 'random_quiet_day',
    ].map(id => pendingAt(id, 'afternoon') ?? pendingAt(id, 'evening'));

    for (const event of all) {
      for (const choice of event?.choices ?? []) {
        const flags = Object.keys(choice.effects?.flags ?? {});
        expect(flags.filter(k => k.startsWith('clue_'))).toEqual([]);
        expect(choice.effects?.nobleTrust).toBeUndefined();
        expect(choice.effects?.lordImpression).toBeUndefined();
      }
    }
  });
});

// ── 记账 ────────────────────────────────────────────────────────────────────

describe('markEventDay', () => {
  it('notes the day an event reached the screen', () => {
    expect(markEventDay({ lastEventDay: 3 }, 9).lastEventDay).toBe(9);
  });

  it('leaves everything else alone', () => {
    expect(markEventDay({ toolsRepaired: true }, 9).toolsRepaired).toBe(true);
  });
});
