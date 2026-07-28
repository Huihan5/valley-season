import { describe, it, expect } from 'vitest';
import { GameState, NpcId } from '../src/types/game';
import {
  marketSoldKey,
  getUnitsSoldToday,
  getCapacityLeft,
  getGrainRevenue,
  getTimberUnitPrice,
  getTimberRevenue,
  getSellLots,
} from '../src/systems/MarketSystem';
import { getFreeChoices } from '../src/systems/EventSystem';
import { MARKET_TRANSPORT_CAP } from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 6,
    phase: 'afternoon',
    weather: 'sunny',
    playerName: '',
    resources: { grain: 40, guldmark: 30, timber: 25, renown: 0 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    flags: { visitingMarketToday: 6 },
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

describe('cart capacity', () => {
  it('starts at the full transport cap', () => {
    expect(getCapacityLeft(makeState())).toBe(MARKET_TRANSPORT_CAP);
  });

  it('counts grain and timber against the same cap', () => {
    const state = makeState({ flags: { visitingMarketToday: 6, [marketSoldKey(6)]: 14 } });
    expect(getUnitsSoldToday(state)).toBe(14);
    expect(getCapacityLeft(state)).toBe(MARKET_TRANSPORT_CAP - 14);
  });

  it('never goes negative', () => {
    const state = makeState({ flags: { visitingMarketToday: 6, [marketSoldKey(6)]: 25 } });
    expect(getCapacityLeft(state)).toBe(0);
  });

  it('is tracked per day, so a later market trip starts fresh', () => {
    const state = makeState({ day: 13, flags: { visitingMarketToday: 13, [marketSoldKey(6)]: 20 } });
    expect(getCapacityLeft(state)).toBe(MARKET_TRANSPORT_CAP);
  });
});

describe('pricing', () => {
  it('pays 1.5 per grain and settles odd lots in halves rather than rounding', () => {
    expect(getGrainRevenue(4)).toBe(6);
    expect(getGrainRevenue(10)).toBe(15);
    expect(getGrainRevenue(5)).toBe(7.5);
    expect(getGrainRevenue(7)).toBe(10.5);
  });

  it('pays 3 per timber, or 4 once the 磨岭 agreement is closed', () => {
    const plain = makeState();
    const deal = makeState({ flags: { visitingMarketToday: 6, millridgeDealSigned: true } });
    expect(getTimberUnitPrice(plain)).toBe(3);
    expect(getTimberUnitPrice(deal)).toBe(4);
    expect(getTimberRevenue(plain, 10)).toBe(30);
    expect(getTimberRevenue(deal, 10)).toBe(40);
  });
});

describe('sell lots', () => {
  it('offers the fixed lots plus a sell-max option', () => {
    expect(getSellLots(40, 20)).toEqual([4, 10, 20]);
  });

  it('never offers more than the player holds', () => {
    expect(getSellLots(7, 20)).toEqual([4, 7]);
  });

  it('never offers more than the cart can take', () => {
    expect(getSellLots(40, 6)).toEqual([4, 6]);
  });

  it('collapses to a single lot when stock equals a fixed lot', () => {
    expect(getSellLots(4, 20)).toEqual([4]);
  });

  it('offers nothing when the cart is full or the store is empty', () => {
    expect(getSellLots(40, 0)).toEqual([]);
    expect(getSellLots(0, 20)).toEqual([]);
  });
});

describe('market afternoon choices', () => {
  it('replaces the estate choices entirely', () => {
    const choices = getFreeChoices(makeState());
    expect(choices.every(c => c.id.startsWith('market_'))).toBe(true);
  });

  it('keeps the phase open for trades but not for leaving', () => {
    const choices = getFreeChoices(makeState());
    const trade = choices.find(c => c.id.startsWith('market_sell_'));
    const leave = choices.find(c => c.id === 'market_finish');
    expect(trade?.advancesPhase).toBe(false);
    expect(leave?.advancesPhase).toBeUndefined();
  });

  it('charges trade fatigue once per market day, not per transaction', () => {
    const first = getFreeChoices(makeState());
    const firstTrade = first.find(c => c.id.startsWith('market_sell_'));
    expect(firstTrade?.effects?.fatigue).toBe(1);

    const after = getFreeChoices(makeState({
      flags: { visitingMarketToday: 6, [marketSoldKey(6)]: 4 },
    }));
    const secondTrade = after.find(c => c.id.startsWith('market_sell_'));
    expect(secondTrade?.effects?.fatigue).toBe(0);
  });

  it('accumulates sold units into the day counter', () => {
    const choices = getFreeChoices(makeState({
      flags: { visitingMarketToday: 6, [marketSoldKey(6)]: 4 },
    }));
    const lot10 = choices.find(c => c.id === 'market_sell_grain_10');
    expect(lot10?.effects?.flags?.[marketSoldKey(6)]).toBe(14);
  });

  it('leaves nothing to sell once the cart is full', () => {
    const choices = getFreeChoices(makeState({
      flags: {
        visitingMarketToday: 6,
        marketRumours_day6: true,
        [marketSoldKey(6)]: MARKET_TRANSPORT_CAP,
      },
    }));
    expect(choices.map(c => c.id)).toEqual(['market_finish']);
  });

  it('offers the queue-side rumours once per market day', () => {
    const first = getFreeChoices(makeState());
    expect(first.some(c => c.id === 'market_listen')).toBe(true);

    const again = getFreeChoices(makeState({
      flags: { visitingMarketToday: 6, marketRumours_day6: true },
    }));
    expect(again.some(c => c.id === 'market_listen')).toBe(false);
  });

  it('grants the first-trade renown bonus only once across the season', () => {
    const first = getFreeChoices(makeState());
    expect(first.find(c => c.id.startsWith('market_sell_'))?.effects?.renown).toBe(1);

    const later = getFreeChoices(makeState({
      day: 13,
      flags: { visitingMarketToday: 13, marketFirstVisitDone: true },
    }));
    expect(later.find(c => c.id.startsWith('market_sell_'))?.effects?.renown).toBeUndefined();
  });
});

describe('market access', () => {
  it('is offered on Saturday mornings', () => {
    const choices = getFreeChoices(makeState({ day: 6, phase: 'morning', flags: {} }));
    expect(choices.some(c => c.id === 'go_to_market')).toBe(true);
  });

  it('is not offered on other days', () => {
    const choices = getFreeChoices(makeState({ day: 5, phase: 'morning', flags: {} }));
    expect(choices.some(c => c.id === 'go_to_market')).toBe(false);
  });

  it('is still offered during hunt season, so Day 20 is a real choice', () => {
    const choices = getFreeChoices(makeState({
      day: 20,
      phase: 'morning',
      flags: { huntingSeasonStarted: true },
    }));
    expect(choices.some(c => c.id === 'go_to_market')).toBe(true);
    expect(choices.some(c => c.id === 'attend_hunt_day20')).toBe(true);
  });

  it('costs one fatigue to travel', () => {
    const choices = getFreeChoices(makeState({ day: 6, phase: 'morning', flags: {} }));
    expect(choices.find(c => c.id === 'go_to_market')?.effects?.fatigue).toBe(1);
  });

  it('cannot be entered twice in a day', () => {
    const choices = getFreeChoices(makeState({
      day: 6,
      phase: 'morning',
      flags: { visitedMarket_day6: true },
    }));
    expect(choices.some(c => c.id === 'go_to_market')).toBe(false);
  });
});
