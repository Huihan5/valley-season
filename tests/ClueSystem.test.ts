import { describe, it, expect } from 'vitest';
import { GameState, DayPhase, NpcId, FlagMap } from '../src/types/game';
import {
  getAvailableFragments, getFragmentChoices, getLorenzChapelExtra,
  getClueGroups, hasAllClueGroups, isPositionLineComplete,
} from '../src/systems/ClueSystem';
import { getFreeChoices } from '../src/systems/EventSystem';
import { TIMBER_OVERRUN_RENOWN, TIMBER_BROKEN_PROMISE_TRUST } from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    day: 14,
    phase: 'evening',
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

const keysFor = (trust: Partial<Record<NpcId, number>>, flags: FlagMap = {}, phase: DayPhase = 'evening') =>
  getAvailableFragments(makeState({
    phase, flags, relationships: { ...ZERO, ...trust },
  })).map(f => f.key);

// ── 格雷格 · 位置线 ─────────────────────────────────────────────────────────

describe('格雷格 gives fact, correction, material — in that order', () => {
  it('says nothing about that morning until he trusts you at all', () => {
    expect(keysFor({ gregor: 1 })).toEqual([]);
    expect(keysFor({ gregor: 2 })).toEqual(['gregor_intact']);
  });

  it('will not correct himself before he has said the thing he is correcting', () => {
    // Trust is high enough for all three; only the first one is on offer.
    expect(keysFor({ gregor: 4 })).toEqual(['gregor_intact']);
    expect(keysFor({ gregor: 4 }, { clue_pos_horses_intact: true })).toEqual(['gregor_returned']);
    expect(keysFor({ gregor: 4 }, {
      clue_pos_horses_intact: true, clue_pos_horse_returned: true,
    })).toEqual(['gregor_condition']);
  });

  it('holds the cloth bundle back until trust 4, whatever else is done', () => {
    const held = { clue_pos_horses_intact: true, clue_pos_horse_returned: true };
    expect(keysFor({ gregor: 3 }, held)).toEqual([]);
    expect(keysFor({ gregor: 4 }, held)).toEqual(['gregor_condition']);
  });

  it('counts talk trust as well as action trust', () => {
    const talked = makeState({
      relationships: { ...ZERO, gregor: 0 },
      conversations: { ...ZERO, gregor: 6 }, // 3 talks per point, capped at +2
    });
    expect(getAvailableFragments(talked).map(f => f.key)).toEqual(['gregor_intact']);
  });

  it('can be asked in the afternoon as well as at night', () => {
    expect(keysFor({ gregor: 2 }, {}, 'afternoon')).toEqual(['gregor_intact']);
    expect(keysFor({ gregor: 2 }, {}, 'morning')).toEqual([]);
  });
});

// ── 玛莎与埃莱娜 ────────────────────────────────────────────────────────────

describe('the two who each hold one thing back', () => {
  it('opens 玛莎 at trust 2 and keeps the last words for trust 4', () => {
    expect(keysFor({ marta: 2 })).toEqual(['marta_summer']);
    expect(keysFor({ marta: 3 }, { clue_mot_martha_summer: true })).toEqual([]);
    expect(keysFor({ marta: 4 }, { clue_mot_martha_summer: true })).toEqual(['marta_lastwords']);
  });

  it('keeps both second pieces to the evening — neither is said over work', () => {
    expect(keysFor({ marta: 4 }, { clue_mot_martha_summer: true }, 'afternoon')).toEqual([]);
    expect(keysFor({ elena: 4 }, { clue_mot_elena_papers: true }, 'afternoon')).toEqual([]);
    expect(keysFor({ elena: 4 }, { clue_mot_elena_papers: true }, 'evening')).toEqual(['elena_burned']);
  });

  it('needs 埃莱娜 at 3 before she says anything at all', () => {
    expect(keysFor({ elena: 2 })).toEqual([]);
    expect(keysFor({ elena: 3 })).toEqual(['elena_papers']);
  });

  it('has her come to the office rather than be sought out', () => {
    const [choice] = getFragmentChoices(makeState({
      relationships: { ...ZERO, elena: 4 },
      flags: { clue_mot_elena_papers: true },
    }));
    expect(choice.text).toBe('在办公室待到很晚');
    expect(choice.effects?.nextScene).toBe('office');
    expect(choice.resultText).toContain('她是主动来找你的');
  });
});

describe('the four lines run in parallel but one answer at a time each', () => {
  it('offers everyone who is ready, and only their next piece', () => {
    expect(keysFor({ gregor: 4, marta: 4, elena: 4 }, {
      clue_pos_horses_intact: true, clue_mot_martha_summer: true,
    })).toEqual(['gregor_returned', 'marta_lastwords', 'elena_papers']);
  });

  it('costs a phase and counts as a conversation, but no fatigue', () => {
    const [choice] = getFragmentChoices(makeState({ relationships: { ...ZERO, gregor: 2 } }));
    expect(choice.description).toBe('1 时段');
    expect(choice.effects?.fatigue).toBeUndefined();
    expect(choice.effects?.conversationWith).toBe('gregor');
    expect(choice.effects?.flags?.clue_pos_horses_intact).toBe(true);
    expect(choice.resultText).toContain('那天早上马厩不缺马');
  });

  it('reaches the day through the free-choice list', () => {
    const ids = getFreeChoices(makeState({
      relationships: { ...ZERO, marta: 2 },
    })).map(c => c.id);
    expect(ids).toContain('fragment_marta_summer');
  });
});

// ── 洛伦茨 ──────────────────────────────────────────────────────────────────

describe('洛伦茨 says his piece because the player came, not because they asked', () => {
  it('gives the question at trust 3', () => {
    const extra = getLorenzChapelExtra(makeState({ relationships: { ...ZERO, lorenz: 3 } }));
    expect(extra?.flags.clue_mot_lorenz_question).toBe(true);
    expect(extra?.resultText).toContain('他把这个活儿做得越好，是不是错得越多');
  });

  it('stays quiet below it', () => {
    expect(getLorenzChapelExtra(makeState({ relationships: { ...ZERO, lorenz: 2 } }))).toBeNull();
  });

  it('does not repeat the question if the hunt-season version fired first', () => {
    const told = makeState({
      relationships: { ...ZERO, lorenz: 3 },
      flags: { clue_mot_lorenz_question: true },
    });
    const extra = getLorenzChapelExtra(told);
    expect(extra?.resultText).not.toContain('他把这个活儿做得越好');
    expect(extra?.flags.clue_mot_lorenz_question).toBeUndefined();
  });

  it('explains why he broke his own rule at trust 4, once, and gives no clue for it', () => {
    const state = makeState({
      relationships: { ...ZERO, lorenz: 4 },
      flags: { clue_mot_lorenz_question: true },
    });
    const extra = getLorenzChapelExtra(state);
    expect(extra?.resultText).toContain('我这一行不该靠猜');
    expect(Object.keys(extra?.flags ?? {})).toEqual(['lorenzExplainedWhy']);

    const after = makeState({
      relationships: { ...ZERO, lorenz: 5 },
      flags: { clue_mot_lorenz_question: true, lorenzExplainedWhy: true },
    });
    expect(getLorenzChapelExtra(after)?.resultText).not.toContain('我这一行不该靠猜');
  });

  it('rides the forge-hall visit rather than an action of its own', () => {
    const afternoon = getFreeChoices(makeState({
      phase: 'afternoon',
      relationships: { ...ZERO, lorenz: 3 },
      flags: { unlockForgeChapel: true },
    })).find(c => c.id === 'visit_lorenz');
    expect(afternoon?.effects?.flags?.clue_mot_lorenz_question).toBe(true);
    expect(afternoon?.resultText).toContain('霍特曼也是');

    // Day 11 is a Thursday: he keeps the vigil, so the night visit works too.
    const vigil = getFreeChoices(makeState({
      day: 11,
      relationships: { ...ZERO, lorenz: 3 },
      flags: { unlockForgeChapel: true },
    })).find(c => c.id === 'visit_chapel');
    expect(vigil?.effects?.flags?.clue_mot_lorenz_question).toBe(true);
  });

  it('gives nothing on a night he is not there', () => {
    const empty = getFreeChoices(makeState({
      day: 14,
      relationships: { ...ZERO, lorenz: 4 },
      flags: { unlockForgeChapel: true },
    })).find(c => c.id === 'visit_chapel');
    expect(empty?.effects?.flags?.clue_mot_lorenz_question).toBeUndefined();
    expect(empty?.resultText).toBeUndefined();
  });
});

// ── 三组计数 ────────────────────────────────────────────────────────────────

describe('the three groups are counted straight off the flag prefixes', () => {
  const full: FlagMap = {
    clue_pos_horses_intact: true, clue_pos_horse_returned: true,
    clue_pos_horse_condition: true, clue_pos_locate: true,
    clue_mot_martha_summer: true,
    clue_ofc_timothy_person: true, clue_ofc_timothy_nature: true,
    clue_ofc_thierry_range: true,
    clue_nob_marguerite: true,
  };

  it('folds position and motive into one estate group', () => {
    expect(getClueGroups(makeState({ flags: full }))).toEqual({
      estate: 5, officer: 3, noble: 1, position: 4,
    });
  });

  it('needs all three at once', () => {
    expect(hasAllClueGroups(makeState({ flags: full }))).toBe(true);
    const { clue_nob_marguerite: _dropped, ...noNoble } = full;
    expect(hasAllClueGroups(makeState({ flags: noNoble }))).toBe(false);
    const { clue_ofc_thierry_range: _alsoDropped, ...thinOfficer } = full;
    expect(hasAllClueGroups(makeState({ flags: thinOfficer }))).toBe(false);
  });

  it('reads the position line as 格雷格 three plus the cross-fix', () => {
    expect(isPositionLineComplete(makeState({ flags: full }))).toBe(true);
    const { clue_pos_locate: _noFix, ...noLocate } = full;
    expect(isPositionLineComplete(makeState({ flags: noLocate }))).toBe(false);
  });

  it('ignores flags that only look like clues', () => {
    expect(getClueGroups(makeState({
      flags: { clue_pos_horses_intact: false, investigatedLedger: true },
    })).estate).toBe(0);
  });
});

// ── 行动性信任 ──────────────────────────────────────────────────────────────

describe('去马厩搭把手 is the route that carries 格雷格 to 4', () => {
  const stableHelp = (over: Partial<GameState> = {}) =>
    getFreeChoices(makeState({ phase: 'afternoon', ...over })).find(c => c.id === 'help_horses');

  it('costs a phase, gives nothing back but the point', () => {
    const choice = stableHelp();
    expect(choice?.description).toBe('1 时段 · 计一次与格雷格的交谈');
    expect(choice?.effects?.conversationWith).toBe('gregor');
    expect(choice?.effects?.fatigue).toBeUndefined();
    expect(choice?.effects?.guldmark).toBeUndefined();
  });

  it('is offered in the afternoon and the evening, never in the morning', () => {
    expect(stableHelp({ phase: 'evening' })).toBeDefined();
    expect(stableHelp({ phase: 'morning' })).toBeUndefined();
  });

  it('pays the trust point on the third visit, not the first', () => {
    expect(stableHelp()?.effects?.relationships).toBeUndefined();
    expect(stableHelp({ flags: { horseCareCount: 1 } })?.effects?.relationships).toBeUndefined();
    const third = stableHelp({ flags: { horseCareCount: 2 } });
    expect(third?.effects?.relationships).toEqual({ gregor: 1 });
    expect(third?.resultKind).toBe('stable_help_third');
    // A fourth afternoon still counts as a visit, but he has said his piece.
    expect(stableHelp({ flags: { horseCareCount: 3 } })?.effects?.relationships).toBeUndefined();
  });

  it('does not expire — the third act is not too late to start showing up', () => {
    expect(stableHelp({ day: 28 })).toBeDefined();
  });

  it('disappears on the days he is not at the stable', () => {
    expect(stableHelp({ day: 19, flags: { huntAttendedDay19: true } })).toBeUndefined();
    expect(stableHelp({ flags: { gregorAway: true } })).toBeUndefined();
  });

  it('closes the gap: talk + roof + stable is exactly the 4 the bundle needs', () => {
    const worked = makeState({
      relationships: { ...ZERO, gregor: 2 },   // 修缮马厩屋顶 +1, 照顾马匹三次 +1
      conversations: { ...ZERO, gregor: 6 },   // talk trust caps at +2
      flags: { clue_pos_horses_intact: true, clue_pos_horse_returned: true },
    });
    expect(getAvailableFragments(worked).map(f => f.key)).toEqual(['gregor_condition']);
  });
});

describe('the woods keep a record of what was taken out of them', () => {
  const fell = (felled: number) =>
    getFreeChoices(makeState({ phase: 'morning', weather: 'sunny', flags: { timberFelled: felled } }))
      .find(c => c.id === 'fell_timber');
  const survey = (felled: number) =>
    getFreeChoices(makeState({ phase: 'morning', flags: { timberFelled: felled } }))
      .find(c => c.id === 'survey_forest');

  it('reads the four bands off what has been cut', () => {
    expect(survey(0)?.resultKind).toBe('survey_forest_0');
    expect(survey(9)?.resultKind).toBe('survey_forest_0');
    expect(survey(10)?.resultKind).toBe('survey_forest_1');
    expect(survey(15)?.resultKind).toBe('survey_forest_2');
    expect(survey(20)?.resultKind).toBe('survey_forest_3');
    expect(survey(30)?.resultKind).toBe('survey_forest_3');
  });

  it('lets the player cut past the allowance, and prices it up front', () => {
    // 25 is the decree's line. It is not a wall.
    const over = fell(24);
    expect(over?.disabled).toBe(false);
    expect(over?.effects?.renown).toBe(TIMBER_OVERRUN_RENOWN);
    expect(over?.description).toContain('超出本季额度');
    // Charged once, not per load.
    const again = getFreeChoices(makeState({
      phase: 'morning', weather: 'sunny',
      flags: { timberFelled: 30, timberOverrun: true },
    })).find(c => c.id === 'fell_timber');
    expect(again?.effects?.renown).toBeUndefined();
    // …but the button stops claiming there is allowance left, which would read as a wall.
    expect(again?.description).toContain('已超出本季额度');
    expect(again?.description).not.toContain('还剩');
  });

  it('does not charge the overrun before the line is actually crossed', () => {
    expect(fell(10)?.effects?.renown).toBeUndefined();
    expect(fell(10)?.description).toContain('本季额度还剩');
  });

  it('opens 格雷格 at twenty units, once', () => {
    expect(fell(17)?.nextEvent).toBe('timber_restraint');
    expect(fell(10)?.nextEvent).toBeUndefined();
    const answered = getFreeChoices(makeState({
      phase: 'morning', weather: 'sunny',
      flags: { timberFelled: 19, timberRestraintAnswered: true },
    })).find(c => c.id === 'fell_timber');
    expect(answered?.nextEvent).toBeUndefined();
  });

  it('takes the point back and one more for cutting after saying you would not', () => {
    const broken = getFreeChoices(makeState({
      phase: 'morning', weather: 'sunny',
      flags: { timberFelled: 20, timberRestraintAnswered: true, respectedLand: true },
    })).find(c => c.id === 'fell_timber');
    expect(broken?.effects?.relationships).toEqual({ gregor: TIMBER_BROKEN_PROMISE_TRUST });
    expect(broken?.effects?.flags?.respectedLand).toBe(false);
    expect(broken?.description).toContain('你说过就到二十单位');
    // He does not get to be disappointed twice.
    const after = getFreeChoices(makeState({
      phase: 'morning', weather: 'sunny',
      flags: { timberFelled: 23, timberRestraintAnswered: true, brokeLandPromise: true },
    })).find(c => c.id === 'fell_timber');
    expect(after?.effects?.relationships).toBeUndefined();
  });
});

describe('洛伦茨 will not say the same thing twice', () => {
  const chapel = (trust: number, flags: FlagMap) =>
    getLorenzChapelExtra(makeState({ relationships: { ...ZERO, lorenz: trust }, flags }));

  it('acknowledges having said it, once, from either direction', () => {
    const told = chapel(3, { clue_mot_lorenz_question: true });
    expect(told?.resultText).toContain('那件事我跟您说过了');
    expect(told?.flags.lorenzAcknowledgedTold).toBe(true);
    // Placeless on purpose: the hunt or the forge-hall may have got there first.
    expect(told?.resultText).not.toContain('猎场');
    expect(told?.resultText).not.toContain('炉堂');
  });

  it('goes back to an ordinary greeting after that', () => {
    expect(chapel(3, { clue_mot_lorenz_question: true, lorenzAcknowledgedTold: true })).toBeNull();
  });

  it('never gets in front of the trust-4 piece', () => {
    const why = chapel(4, { clue_mot_lorenz_question: true });
    expect(why?.resultText).toContain('我这一行不该靠猜');
    expect(why?.flags.lorenzAcknowledgedTold).toBeUndefined();
  });
});
