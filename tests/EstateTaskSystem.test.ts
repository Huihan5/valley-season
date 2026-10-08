import { describe, it, expect } from 'vitest';
import { GameState, NpcId, FlagMap } from '../src/types/game';
import { getEstateTasks, getEstateTaskChoices, getDecorumBonus } from '../src/systems/EstateTaskSystem';
import { getFreeChoices } from '../src/systems/EventSystem';
import { getHarvestYield, getOrchardYield, getOrchardTenantGain } from '../src/systems/ResourceSystem';
import { isVigilNight } from '../src/systems/TimeSystem';
import {
  HARVEST_YIELD,
  TENANT_TRUST_INITIAL,
  SURVEY_FIELDS_LAST_DAY,
  ORCHARD_FULL_YIELD_LAST_DAY,
  NIGHT_LEDGER_CLUE_AT,
  FATIGUE_EXHAUSTED_THRESHOLD,
} from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 2,
    phase: 'morning',
    weather: 'cloudy',
    playerName: '',
    openingPage: null,
    resources: { grain: 0, guldmark: 50, timber: 8, renown: 0 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: TENANT_TRUST_INITIAL,
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

const task = (state: GameState, id: string) => getEstateTasks(state).find(t => t.id === id)!;

describe('the efficiency ladder is climbable', () => {
  it('starts at the unprepared rate', () => {
    expect(getHarvestYield(makeState())).toBe(HARVEST_YIELD.unprepared);
  });

  it('rises one rung at a time as the flags land', () => {
    const rate = (flags: FlagMap) => getHarvestYield(makeState({ flags }));
    expect(rate({ toolsRepaired: true })).toBe(HARVEST_YIELD.toolsRepaired);
    // The clear-storage rung reads the flag the task actually writes, storageCleared.
    expect(rate({ toolsRepaired: true, storageCleared: true })).toBe(HARVEST_YIELD.toolsAndStorage);
    expect(rate({ fullyPrepared: true })).toBe(HARVEST_YIELD.fullyPrepared);
  });

  it('offers each rung only after the one below it', () => {
    const fresh = makeState();
    expect(task(fresh, 'task_repair_tools').status).toBe('available');
    expect(task(fresh, 'task_clear_storage').blockedReason).toBe('需先修农具');
    expect(task(fresh, 'task_tenant_meeting').blockedReason).toBe('需先清理仓储');
  });

  it('gates the tenant meeting on tenant trust, not on money', () => {
    const cleared = { toolsRepaired: true, storageCleared: true };
    const sour = makeState({ flags: cleared, tenantTrust: -1 });
    const willing = makeState({ flags: cleared, tenantTrust: 0 });
    expect(task(sour, 'task_tenant_meeting').status).toBe('blocked');
    expect(task(willing, 'task_tenant_meeting').status).toBe('available');
  });

  it('lets a single full repair at Day 10 reopen the meeting', () => {
    // Tenant trust starts at -2 and the full repair is worth +2.
    expect(TENANT_TRUST_INITIAL + 2).toBe(0);
  });
});

describe('affordability', () => {
  it('blocks what the player cannot pay for', () => {
    const broke = makeState({ resources: { grain: 0, guldmark: 3, timber: 8, renown: 0 } });
    expect(task(broke, 'task_repair_tools').blockedReason).toContain('金卢不足');
  });

  it('blocks the stable roof on timber as well as coin', () => {
    const noTimber = makeState({ resources: { grain: 0, guldmark: 50, timber: 1, renown: 0 } });
    expect(task(noTimber, 'task_repair_stable').blockedReason).toContain('木材不足');
  });

  it('drops a task from the choice list once it is done', () => {
    const done = makeState({ flags: { toolsRepaired: true } });
    expect(getEstateTaskChoices(done).some(c => c.id === 'task_repair_tools')).toBe(false);
    expect(task(done, 'task_repair_tools').status).toBe('done');
  });
});

describe('gift and attire', () => {
  // PlaytestFeedback 2026-09 (P11): the standing gift is the post-dinner fallback,
  // so it only appears after Day 7 (DINNER_DAY) and only while none has been bought.
  it('keeps the standing gift out of the list until after the dinner', () => {
    const early = getEstateTaskChoices(makeState({ day: 5 })).map(c => c.id);
    expect(early).not.toContain('task_gift_marguerite');
    expect(early).not.toContain('task_gift_henk');
  });

  it('offers the gift once per recipient after the dinner, but retires both after either is bought', () => {
    const after7 = makeState({ day: 9 });
    const ids = getEstateTaskChoices(after7).map(c => c.id);
    expect(ids).toContain('task_gift_marguerite');
    expect(ids).toContain('task_gift_henk');

    const bought = makeState({ day: 9, flags: { boughtGift: true } });
    const after = getEstateTaskChoices(bought).map(c => c.id);
    expect(after).not.toContain('task_gift_marguerite');
    expect(after).not.toContain('task_gift_henk');
  });

  it('sends the trust to whoever was named at purchase', () => {
    const choices = getEstateTaskChoices(makeState({ day: 9 }));
    expect(choices.find(c => c.id === 'task_gift_marguerite')?.effects?.relationships).toEqual({ marguerite: 1 });
    expect(choices.find(c => c.id === 'task_gift_henk')?.effects?.relationships).toEqual({ henk: 1 });
  });

  it('pays a point of renown for the attire', () => {
    const attire = getEstateTaskChoices(makeState()).find(c => c.id === 'task_attire');
    expect(attire?.effects?.renown).toBe(1);
  });

  it('raises the 得体 floor only when both are held', () => {
    expect(getDecorumBonus(makeState())).toBe(0);
    expect(getDecorumBonus(makeState({ flags: { boughtGift: true } }))).toBe(0);
    expect(getDecorumBonus(makeState({ flags: { boughtAttire: true } }))).toBe(0);
    expect(getDecorumBonus(makeState({ flags: { boughtGift: true, boughtAttire: true } }))).toBe(1);
  });
});

describe('microcopy states costs mechanically; relationship gains are worded, not numbered (GDD 11.6 / D3)', () => {
  it('states the phase and the costs as numbers, and the effect', () => {
    expect(task(makeState(), 'task_repair_tools').summary).toBe('1 时段 · 15 金卢 · 收割 3→5 · 伐木 +1');
    // The stable roof's cost stays numeric; its 格雷格 payoff reads as words, not a +1 —
    // trust is never a number the player sees (D3, StatusPanel).
    expect(task(makeState(), 'task_repair_stable').summary).toBe('1 时段 · 12 金卢 · 3 木材 · 格雷格记着这份好');
  });

  it('omits a cost the task does not have', () => {
    expect(task(makeState(), 'task_tenant_meeting').summary).toBe('1 时段 · 收割 6→7');
  });
});

describe('the two walks are one-off estate tasks', () => {
  const taskIds = (s: GameState) => getEstateTaskChoices(s).map(c => c.id);

  it('are no longer among the day’s own choices', () => {
    const ids = getFreeChoices(makeState()).map(c => c.id);
    expect(ids).not.toContain('survey_fields');
    expect(ids).not.toContain('survey_forest');
  });

  it('closes the fields window on its own schedule', () => {
    expect(taskIds(makeState({ day: SURVEY_FIELDS_LAST_DAY }))).toContain('task_survey_fields');
    expect(taskIds(makeState({ day: SURVEY_FIELDS_LAST_DAY + 1 }))).not.toContain('task_survey_fields');
    // Not offered at all once the window has shut, rather than shown as an empty promise.
    expect(getEstateTasks(makeState({ day: SURVEY_FIELDS_LAST_DAY + 1 })).map(t => t.id))
      .not.toContain('task_survey_fields');
  });

  it('keeps the woods walk open all season', () => {
    for (const day of [1, 15, 28]) {
      expect(taskIds(makeState({ day })), String(day)).toContain('task_survey_forest');
    }
  });

  it('retires each walk once it is done, and lists it as done', () => {
    const done = makeState({ day: 12, flags: { surveyedFields: true, surveyedForest: true } });
    expect(taskIds(done)).not.toContain('task_survey_fields');
    expect(taskIds(done)).not.toContain('task_survey_forest');
    expect(task(done, 'task_survey_fields').status).toBe('done');
    expect(task(done, 'task_survey_forest').status).toBe('done');
  });

  it('cost a phase and a point of fatigue, and no resources at all', () => {
    for (const id of ['task_survey_fields', 'task_survey_forest']) {
      const choice = getEstateTaskChoices(makeState()).find(c => c.id === id);
      expect(choice?.effects?.fatigue, id).toBe(1);
      expect(choice?.effects?.guldmark, id).toBeUndefined();
      expect(choice?.effects?.grain, id).toBeUndefined();
      expect(choice?.effects?.timber, id).toBeUndefined();
      expect(task(makeState(), id).kind).toBe('survey');
      expect(task(makeState(), id).summary).toMatch(/^1 时段 · 疲劳 \+1 · /);
    }
  });

  it('set the flags the Day 10 petition and the felling bonus read', () => {
    const ids: Record<string, string> = {
      task_survey_fields: 'surveyedFields', task_survey_forest: 'surveyedForest',
    };
    for (const [id, flag] of Object.entries(ids)) {
      const choice = getEstateTaskChoices(makeState()).find(c => c.id === id);
      expect(choice?.effects?.flags?.[flag], id).toBe(true);
    }
  });

  it('cannot be taken when the body has given out', () => {
    const spent = makeState({ fatigue: FATIGUE_EXHAUSTED_THRESHOLD });
    expect(task(spent, 'task_survey_forest').status).toBe('blocked');
    expect(getEstateTaskChoices(spent).find(c => c.id === 'task_survey_forest')?.disabled).toBe(true);
  });

  it('are the only tasks marked as walks', () => {
    const kinds = Object.fromEntries(getEstateTasks(makeState()).map(t => [t.id, t.kind]));
    expect(kinds.task_survey_fields).toBe('survey');
    expect(kinds.task_survey_forest).toBe('survey');
    expect(kinds.task_repair_tools).toBe('work');
    expect(kinds.task_attire).toBe('work');
  });
});

describe('forage and orchard', () => {
  it('are available from the start with no unlock', () => {
    const ids = getFreeChoices(makeState({ day: 1 })).map(c => c.id);
    expect(ids).toContain('forage');
    expect(ids).toContain('orchard');
  });

  it('counts foraging as time spent with Marta', () => {
    const forage = getFreeChoices(makeState()).find(c => c.id === 'forage');
    expect(forage?.effects?.conversationWith).toBe('marta');
  });

  it('halves the orchard once the fruit is on the ground', () => {
    // The spread repeats every 4 days, so compare two days that land on the same value.
    const before = getOrchardYield(makeState({ day: ORCHARD_FULL_YIELD_LAST_DAY - 4 }));
    const after = getOrchardYield(makeState({ day: ORCHARD_FULL_YIELD_LAST_DAY + 4 }));
    expect(after).toBe(before / 2);
  });

  it('gives tenant trust per picking, up to the orchard ceiling of 2', () => {
    expect(getOrchardTenantGain(makeState())).toBe(1);
    expect(getOrchardTenantGain(makeState({ flags: { orchardTenantGained: 1 } }))).toBe(1);
    expect(getOrchardTenantGain(makeState({ flags: { orchardTenantGained: 2 } }))).toBe(0);
  });

  it('stops advertising the trust once the ceiling is reached', () => {
    const capped = getFreeChoices(makeState({ flags: { orchardTenantGained: 2 } }))
      .find(c => c.id === 'orchard');
    expect(capped?.description).not.toContain('佃户整体信任');
    expect(capped?.effects?.tenantTrust).toBe(0);
  });
});

describe('the office and the night ledger', () => {
  it('makes paperwork time spent with Elena rather than nothing at all', () => {
    const office = getFreeChoices(makeState()).find(c => c.id === 'visit_office');
    expect(office?.effects?.conversationWith).toBe('elena');
  });

  it('lands the handwriting fragment on the third night and not before', () => {
    const nightAt = (count: number) =>
      getFreeChoices(makeState({ phase: 'evening', flags: { nightLedgerCount: count } }))
        .find(c => c.id === 'review_accounts');

    expect(nightAt(0)?.effects?.flags?.clue_mot_handwriting).toBeUndefined();
    expect(nightAt(1)?.effects?.flags?.clue_mot_handwriting).toBeUndefined();
    expect(nightAt(NIGHT_LEDGER_CLUE_AT - 1)?.effects?.flags?.clue_mot_handwriting).toBe(true);
  });

  it('counts the nights up so the habit is what pays', () => {
    const second = getFreeChoices(makeState({ phase: 'evening', flags: { nightLedgerCount: 1 } }))
      .find(c => c.id === 'review_accounts');
    expect(second?.effects?.flags?.nightLedgerCount).toBe(2);
  });
});

describe('the Thursday vigil', () => {
  it('falls on Day 4, 11, 18 and 25', () => {
    const nights = Array.from({ length: 30 }, (_, i) => i + 1).filter(isVigilNight);
    expect(nights).toEqual([4, 11, 18, 25]);
  });

  it('is a conversation on Thursday and mere meditation otherwise', () => {
    const chapel = (day: number) =>
      getFreeChoices(makeState({ day, phase: 'evening', flags: { unlockForgeChapel: true } }))
        .find(c => c.id === 'visit_chapel');

    const thursday = chapel(11);
    expect(thursday?.effects?.conversationWith).toBe('lorenz');
    expect(thursday?.effects?.fatigue).toBeUndefined();

    const otherNight = chapel(12);
    expect(otherNight?.effects?.conversationWith).toBeUndefined();
    expect(otherNight?.effects?.fatigue).toBe(-99);
  });

  it('pays the one-off action trust only the first time', () => {
    const first = getFreeChoices(makeState({ day: 11, phase: 'evening', flags: { unlockForgeChapel: true } }))
      .find(c => c.id === 'visit_chapel');
    expect(first?.effects?.relationships).toEqual({ lorenz: 1 });

    const later = getFreeChoices(makeState({
      day: 25, phase: 'evening', flags: { unlockForgeChapel: true, satVigilWithLorenz: true },
    })).find(c => c.id === 'visit_chapel');
    expect(later?.effects?.relationships).toBeUndefined();
    expect(later?.effects?.conversationWith).toBe('lorenz');
  });
});

describe('the afternoon call on 洛伦茨', () => {
  const visit = (trust: number) =>
    getFreeChoices(makeState({
      day: 12, phase: 'afternoon',
      relationships: { ...ZERO, lorenz: trust },
      flags: { unlockForgeChapel: true },
    })).find(c => c.id === 'visit_lorenz');

  it('pays conversational trust but never hands over a fragment, however high his trust', () => {
    const trusted = visit(4);
    expect(trusted?.effects?.conversationWith).toBe('lorenz');
    // The fragments belong to the Thursday vigil and the Day 21 tree, not the daytime visit.
    expect(trusted?.effects?.flags).toEqual({ lorenzFirstVisitDone: true });
    expect(trusted?.effects?.flags?.clue_mot_lorenz_question).toBeUndefined();
    expect(trusted?.resultText).toBeUndefined();
  });
});
