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
  isNpcKnown,
  getKnownNpcs,
} from '../src/systems/RelationSystem';
import { RENOWN_HARVEST_PENALTY_AT, ENDING_TRUTH_MIN_RENOWN, ENDING3_RENOWN } from '../src/data/config';
import zhUi from '../src/data/zh/ui.json';
import enUi from '../src/data/en/ui.json';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
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

  // PlaytestFeedback 2026-09 (P28): 埃莱娜 earns a talk point every 2 conversations,
  // not 3 — but the +2 conversational cap still holds.
  it('grants 埃莱娜 a point every two talks, faster than the default three', () => {
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, elena: 2 } }), 'elena')).toBe(1);
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, elena: 4 } }), 'elena')).toBe(2);
    // still capped at +2
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, elena: 40 } }), 'elena')).toBe(2);
    // the faster rate is hers alone
    expect(getTalkTrust(makeState({ conversations: { ...ZERO, marta: 2 } }), 'marta')).toBe(0);
  });

  it('reports 埃莱娜 two talks from her first point, and marta three', () => {
    expect(talksUntilNextPoint(makeState(), 'elena')).toBe(2);
    expect(talksUntilNextPoint(makeState(), 'marta')).toBe(3);
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
    counts = recordConversation(counts, 'elena');
    counts = recordConversation(counts, 'elena');
    expect(counts.elena).toBe(2);
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

// The status panel shows renown as a word and borrows the trust tiers' steps to do it. That
// only works while the steps fall where the game draws its lines: the harvest penalty, the
// truth endings' floor and the valley ending's line.
describe('renown reads in the trust tiers', () => {
  it('changes word exactly at the numbers that matter', () => {
    expect(getTrustTier(RENOWN_HARVEST_PENALTY_AT)).toBe('estranged');
    expect(getTrustTier(RENOWN_HARVEST_PENALTY_AT + 1)).toBe('cold');
    expect(getTrustTier(ENDING_TRUTH_MIN_RENOWN - 1)).toBe('accepted');
    expect(getTrustTier(ENDING_TRUTH_MIN_RENOWN)).toBe('trusted');
    expect(getTrustTier(ENDING3_RENOWN - 1)).toBe('trusted');
    expect(getTrustTier(ENDING3_RENOWN)).toBe('embraced');
  });

  it('has a word for every tier in both languages, none repeated', () => {
    for (const ui of [zhUi, enUi]) {
      const tiers = Object.keys(ui.statusPanel.trustTiers).sort();
      expect(Object.keys(ui.statusPanel.renownTiers).sort()).toEqual(tiers);
      const words = Object.values(ui.statusPanel.renownTiers);
      expect(words.every(w => w.length > 0)).toBe(true);
      expect(new Set(words).size).toBe(words.length);
    }
  });
});

describe('countTrustAtLeast', () => {
  it('counts by effective trust, not action trust alone', () => {
    const state = makeState({
      relationships: { ...ZERO, gregor: 3, marta: 2, elena: 2 },
      conversations: { ...ZERO, marta: 3, elena: 3 },
    });
    // gregor 3, marta 2+1, elena 2+1 → three NPCs at ≥3
    expect(countTrustAtLeast(state, 3)).toBe(3);
  });
});

// ── 右栏的人是一个个来的 (PlaytestFeedback 2.h) ─────────────────────────────

describe('isNpcKnown', () => {
  const ORDER: NpcId[] = ['gregor', 'marta', 'elena', 'marguerite', 'henk', 'lorenz'];

  it('starts the season with the three who live here', () => {
    expect(getKnownNpcs(makeState(), ORDER)).toEqual(['gregor', 'marta', 'elena']);
  });

  it('adds 洛伦茨 when the forge-hall opens', () => {
    const state = makeState({ flags: { unlockForgeChapel: true } });
    expect(isNpcKnown(state, 'lorenz')).toBe(true);
    expect(isNpcKnown(state, 'henk')).toBe(false);
  });

  it('adds both nobles at the dinner', () => {
    const state = makeState({ flags: { attendedDinner: true } });
    expect(isNpcKnown(state, 'henk')).toBe(true);
    expect(isNpcKnown(state, 'marguerite')).toBe(true);
  });

  it('adds them in hunt season for a player who skipped the dinner', () => {
    const state = makeState({ flags: { dinnerMissed: true, huntAttendedDay18: true } });
    expect(isNpcKnown(state, 'henk')).toBe(true);
  });

  it('falls back on any trust or conversation already on the books', () => {
    expect(isNpcKnown(makeState({ relationships: { ...ZERO, marguerite: 1 } }), 'marguerite')).toBe(true);
    expect(isNpcKnown(makeState({ conversations: { ...ZERO, henk: 1 } }), 'henk')).toBe(true);
  });

  it('keeps the order it was given', () => {
    const state = makeState({ flags: { unlockForgeChapel: true, attendedDinner: true } });
    expect(getKnownNpcs(state, ORDER)).toEqual(ORDER);
  });
});
