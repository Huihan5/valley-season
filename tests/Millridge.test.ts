import { describe, it, expect } from 'vitest';
import { GameState, EventData, NpcId } from '../src/types/game';
import { getEventById } from '../src/systems/EventSystem';
import { GRAIN_RETAIN_THRESHOLD, MILLRIDGE_CASH } from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(henk: number, grain = 60): GameState {
  return {
    day: 30,
    phase: 'evening',
    weather: 'frost',
    playerName: '',
    openingPage: null,
    resources: { grain, guldmark: 5, timber: 2, renown: 1 },
    fatigue: 0,
    relationships: { ...ZERO, henk },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
    flags: { day30Short: true, rodeToMillridge: true },
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

const night = (henk: number, grain = 60) =>
  getEventById('day30_millridge', makeState(henk, grain)) as EventData;
const choice = (henk: number, id: string, grain = 60) =>
  night(henk, grain).choices?.find(c => c.id === id);

describe('the ride itself is the cost', () => {
  it('is paid for going, not for what gets asked', () => {
    expect(night(0).sceneText).toContain('明天早上这一趟就会传遍整个河谷');
    expect(night(0).sceneText).toContain('而磨岭这个方向，尤其');
  });

  it('has 格雷格 ask nothing and look once', () => {
    expect(night(0).sceneText).toContain('就一眼，然后他低头去扣马肚带');
  });

  it('spends the evening — this is the last thing the player does', () => {
    expect(night(0).advancesPhase).toBe(true);
  });
});

describe('what he gives depends on where you actually stand with him', () => {
  it('covers the shortfall in cash at trust 2', () => {
    const cash = choice(2, 'millridge_cash');
    expect(cash?.effects?.guldmark).toBe(MILLRIDGE_CASH);
    expect(cash?.effects?.flags?.tookHenkDeal).toBe(true);
    expect(cash?.resultText).toContain('算我借您的');
  });

  it('fills the gap exactly, in goods, without being told the number', () => {
    const goods = choice(2, 'millridge_goods', 60);
    expect(goods?.effects?.grain).toBe(GRAIN_RETAIN_THRESHOLD - 60);
    expect(goods?.resultText).toContain('他也没有解释他的木头为什么多');
  });

  it('loads a whole cart at trust 4, and asks for nothing in return', () => {
    const all = choice(4, 'millridge_everything');
    expect(all?.effects?.grain).toBeGreaterThan(GRAIN_RETAIN_THRESHOLD - 60);
    expect(all?.effects?.timber).toBeGreaterThan(0);
    expect(all?.effects?.guldmark).toBeGreaterThan(0);
    expect(all?.resultText).toContain('以后总有用得上我的时候');
  });

  it('is the worst conversation in the game when the trust is not there', () => {
    for (const id of ['millridge_everything', 'millridge_cash', 'millridge_goods']) {
      const asked = choice(1, id);
      expect(asked?.effects?.flags?.tookHenkDeal, id).toBeUndefined();
      expect(asked?.effects?.guldmark, id).toBe(1);
      expect(asked?.resultText, id).toContain('我跟您还没到那个份上');
      expect(asked?.resultText, id).toContain('路上给马买点东西');
    }
  });

  it('lets the player leave with nothing, having paid to arrive', () => {
    const left = choice(4, 'millridge_nothing');
    expect(left?.effects?.grain).toBeUndefined();
    expect(left?.effects?.guldmark).toBeUndefined();
    expect(left?.effects?.flags).toBeUndefined();
    expect(left?.resultText).toContain('但那个笑今天晚上第一次显得不合身');
    expect(left?.resultText).toContain('整个河谷明天都会知道你去过');
  });
});
