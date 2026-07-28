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
  SURVEY_FOREST_LAST_DAY,
  ORCHARD_FULL_YIELD_LAST_DAY,
  NIGHT_LEDGER_CLUE_AT,
} from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 2,
    phase: 'morning',
    weather: 'cloudy',
    playerName: '',
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
    expect(rate({ toolsRepaired: true, toolsAndStorage: true })).toBe(HARVEST_YIELD.toolsAndStorage);
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
  it('offers the gift once per recipient but retires both after either is bought', () => {
    const fresh = makeState();
    const ids = getEstateTaskChoices(fresh).map(c => c.id);
    expect(ids).toContain('task_gift_marguerite');
    expect(ids).toContain('task_gift_henk');

    const bought = makeState({ flags: { boughtGift: true } });
    const after = getEstateTaskChoices(bought).map(c => c.id);
    expect(after).not.toContain('task_gift_marguerite');
    expect(after).not.toContain('task_gift_henk');
  });

  it('sends the trust to whoever was named at purchase', () => {
    const choices = getEstateTaskChoices(makeState());
    expect(choices.find(c => c.id === 'task_gift_marguerite')?.effects?.relationships).toEqual({ elke: 1 });
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

describe('microcopy is mechanical, never narrated (GDD 11.6)', () => {
  it('states the phase, the cost and the effect, and nothing else', () => {
    expect(task(makeState(), 'task_repair_tools').summary).toBe('1 时段 · 15 金卢 · 收割 3→5');
    expect(task(makeState(), 'task_repair_stable').summary).toBe('1 时段 · 12 金卢 · 3 木材 · 格雷格信任 +1');
  });

  it('omits a cost the task does not have', () => {
    expect(task(makeState(), 'task_tenant_meeting').summary).toBe('1 时段 · 收割 6→7');
  });
});

describe('the two surveys', () => {
  it('are offered early and expire on their own schedules', () => {
    const inWindow = getFreeChoices(makeState({ day: SURVEY_FIELDS_LAST_DAY })).map(c => c.id);
    expect(inWindow).toContain('survey_fields');

    const fieldsGone = getFreeChoices(makeState({ day: SURVEY_FIELDS_LAST_DAY + 1 })).map(c => c.id);
    expect(fieldsGone).not.toContain('survey_fields');
    expect(fieldsGone).toContain('survey_forest');

    const bothGone = getFreeChoices(makeState({ day: SURVEY_FOREST_LAST_DAY + 1 })).map(c => c.id);
    expect(bothGone).not.toContain('survey_forest');
  });

  it('are one-shot — doing one retires it', () => {
    const done = getFreeChoices(makeState({ flags: { surveyedFields: true } })).map(c => c.id);
    expect(done).not.toContain('survey_fields');
  });

  it('produce no resources at all', () => {
    const survey = getFreeChoices(makeState()).find(c => c.id === 'survey_fields');
    expect(survey?.effects?.guldmark).toBeUndefined();
    expect(survey?.effects?.grain).toBeUndefined();
    expect(survey?.effects?.timber).toBeUndefined();
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
    expect(office?.effects?.conversationWith).toBe('lena');
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
