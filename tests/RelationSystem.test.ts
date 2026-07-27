import { describe, it, expect } from 'vitest';
import { GameState, NpcId } from '../src/types/game';
import {
  getActionTrust,
  getTalkTrust,
  getTrust,
  recordConversation,
  talksUntilNextPoint,
  adjustNobleTrust,
  adjustLordImpression,
  getTrustTier,
  countTrustAtLeast,
} from '../src/systems/RelationSystem';

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

describe('conversational trust layer', () => {
  it('grants nothing until the third conversation', () => {
    for (const talks of [0, 1, 2]) {
      const state = makeState({ conversations: { ...ZERO, marta: talks } });
      expect(getTalkTrust(state, 'marta')).toBe(0);
    }
  });

  it('grants +1 at three conversations and +2 at six', () => {
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, marta: 3 } }), 'marta')).toBe(1);
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, marta: 6 } }), 'marta')).toBe(2);
  });

  it('caps at +2 no matter how much the player talks', () => {
    const state = makeState({ conversations: { ...ZERO, marta: 40 } });
    expect(getTalkTrust(state, 'marta')).toBe(2);
  });

  it('a player who only ever talks cannot reach the clue threshold of 4', () => {
    const state = makeState({ conversations: { ...ZERO, gregor: 99 } });
    expect(getTrust(state, 'gregor')).toBeLessThan(4);
  });

  it('stacks on top of action trust to reach 4 and beyond', () => {
    const state = makeState({
      relationships: { ...ZERO, gregor: 3 },
      conversations: { ...ZERO, gregor: 6 },
    });
    expect(getActionTrust(state, 'gregor')).toBe(3);
    expect(getTrust(state, 'gregor')).toBe(5);
  });

  it('clamps the combined value to the -5..+5 range', () => {
    const state = makeState({
      relationships: { ...ZERO, lorenz: 5 },
      conversations: { ...ZERO, lorenz: 9 },
    });
    expect(getTrust(state, 'lorenz')).toBe(5);
  });

  it('counts conversations one at a time', () => {
    let counts = { ...ZERO };
    counts = recordConversation(counts, 'lena');
    counts = recordConversation(counts, 'lena');
    expect(counts.lena).toBe(2);
    expect(counts.marta).toBe(0);
  });

  it('reports how many conversations remain until the next point', () => {
    expect(talksUntilNextPoint(makeState(), 'marta')).toBe(3);
    expect(talksUntilNextPoint(makeState({ conversations: { ...ZERO, marta: 2 } }), 'marta')).toBe(1);
    expect(talksUntilNextPoint(makeState({ conversations: { ...ZERO, marta: 6 } }), 'marta')).toBeNull();
  });
});

describe('贵族信任 and 领主印象', () => {
  it('both run 0 to 3 and clamp at each end', () => {
    expect(adjustNobleTrust(0, -1)).toBe(0);
    expect(adjustNobleTrust(3, 1)).toBe(3);
    expect(adjustLordImpression(0, -1)).toBe(0);
    expect(adjustLordImpression(3, 1)).toBe(3);
  });

  it('reaches its ceiling in exactly three grants', () => {
    let noble = 0;
    for (let i = 0; i < 3; i++) noble = adjustNobleTrust(noble, 1);
    expect(noble).toBe(3);
  });
});

describe('trust tiers', () => {
  it('maps each band to its tier', () => {
    expect(getTrustTier(-5)).toBe('estranged');
    expect(getTrustTier(-3)).toBe('estranged');
    expect(getTrustTier(-2)).toBe('cold');
    expect(getTrustTier(-1)).toBe('cold');
    expect(getTrustTier(0)).toBe('neutral');
    expect(getTrustTier(2)).toBe('accepted');
    expect(getTrustTier(4)).toBe('trusted');
    expect(getTrustTier(5)).toBe('embraced');
  });
});

describe('countTrustAtLeast', () => {
  it('counts by effective trust, not action trust alone', () => {
    const state = makeState({
      relationships: { ...ZERO, gregor: 3, marta: 2, lena: 2 },
      conversations: { ...ZERO, marta: 3, lena: 3 },
    });
    // gregor 3, marta 2+1, lena 2+1 → three NPCs at ≥3
    expect(countTrustAtLeast(state, 3)).toBe(3);
  });
});
