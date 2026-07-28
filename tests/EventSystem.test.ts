import { describe, it, expect } from 'vitest';
import { getFixedEvent, getFreeChoices, getEventById } from '../src/systems/EventSystem';
import { determineEnding } from '../src/systems/EndingSystem';
import { GameState } from '../src/types/game';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 50, guldmark: 30, timber: 10, renown: 3 },
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

// ── getFixedEvent: basic lookup ────────────────────────────────────────────

describe('getFixedEvent — basic lookup', () => {
  it('returns Day 1 morning event', () => {
    const event = getFixedEvent(1, 'morning', makeState());
    expect(event).not.toBeNull();
    expect(event?.id).toBe('day1_arrival');
  });

  it('returns Day 3 morning event', () => {
    const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 }));
    expect(event?.id).toBe('day3_ledger');
    expect(event?.forced).toBe(true);
  });

  it('returns null for a day with no fixed event', () => {
    const event = getFixedEvent(5, 'morning', makeState({ day: 5 }));
    expect(event).toBeNull();
  });

  it('returns null for wrong phase', () => {
    // The ledger surfaces between the morning action and the afternoon one,
    // so it is not there when the day opens, nor once it is over.
    expect(getFixedEvent(3, 'morning', makeState({ day: 3 }))).toBeNull();
    expect(getFixedEvent(3, 'evening', makeState({ day: 3 }))).toBeNull();
  });

  it('returns Day 18 forced morning event', () => {
    const event = getFixedEvent(18, 'morning', makeState({ day: 18 }));
    expect(event?.id).toBe('day18_hunt_open');
  });

  it('returns Day 23 letter event', () => {
    const event = getFixedEvent(23, 'morning', makeState({ day: 23 }));
    expect(event?.id).toBe('day23_lords_letter');
  });

  it('returns Day 30 morning and evening events', () => {
    expect(getFixedEvent(30, 'morning', makeState({ day: 30 }))?.id).toBe('day30_morning');
    expect(getFixedEvent(30, 'evening', makeState({ day: 30 }))?.id).toBe('day30_evening');
  });
});

// ── getFixedEvent: activationFlag ──────────────────────────────────────────

describe('getFixedEvent — activationFlag', () => {
  it('Day 18 hunt arrival returns null without flag', () => {
    const event = getFixedEvent(18, 'afternoon', makeState({ day: 18, flags: {} }));
    expect(event).toBeNull();
  });

  it('Day 18 hunt arrival fires when huntAttendedDay18 is set', () => {
    const event = getFixedEvent(
      18, 'afternoon',
      makeState({ day: 18, flags: { huntAttendedDay18: true } })
    );
    expect(event?.id).toBe('day18_hunt_arrival');
  });

  it('Day 20 overnight returns null without huntAttendedDay20', () => {
    const event = getFixedEvent(20, 'evening', makeState({ day: 20 }));
    expect(event).toBeNull();
  });

  it('Day 20 overnight fires when huntAttendedDay20 is set', () => {
    const event = getFixedEvent(
      20, 'evening',
      makeState({ day: 20, flags: { huntAttendedDay20: true } })
    );
    expect(event?.id).toBe('day20_hunt_overnight');
  });

  it('Day 21 morning starts at the camp only for whoever slept there', () => {
    expect(getFixedEvent(21, 'morning', makeState({ day: 21 }))).toBeNull();
    const withFlag = getFixedEvent(
      21, 'morning',
      makeState({ day: 21, flags: { campOvernight: true } })
    );
    expect(withFlag?.id).toBe('day21_hunt_morning');
  });

  it('Day 21 lorenz fires for anyone at the hunt that day, camped or not', () => {
    expect(getFixedEvent(21, 'afternoon', makeState({ day: 21 }))).toBeNull();
    const withFlag = getFixedEvent(
      21, 'afternoon',
      makeState({ day: 21, flags: { huntAttendedDay21: true } })
    );
    expect(withFlag?.id).toBe('day21_hunt_lorenz');
  });

  it('no longer puts 维特 at the hunt — he only ever comes to the manor', () => {
    expect(getFixedEvent(22, 'afternoon', makeState({ day: 22 }))).toBeNull();
    expect(getFixedEvent(
      22, 'afternoon',
      makeState({ day: 22, flags: { huntAttendedDay22: true } })
    )).toBeNull();
  });

  it('Day 22 brings him to the gate at dusk, for everyone', () => {
    const event = getFixedEvent(22, 'evening', makeState({ day: 22 }));
    expect(event?.id).toBe('day22_wynter');
    expect(event?.advancesPhase).toBe(false);
  });
});

// ── processDay12: 凯斯勒 audit branching ──────────────────────────────────

describe('getFixedEvent — Day 12 processDay12', () => {
  const audit = (flags: Record<string, boolean>) =>
    getFixedEvent(12, 'afternoon', makeState({ day: 12, flags }));

  it('tells the player they noticed, when they did', () => {
    for (const flag of ['investigatedLedger', 'reportedLedger']) {
      const event = audit({ [flag]: true });
      expect(event?.sceneText, flag).toContain('你注意到了');
      expect(event?.onEnterEffects?.renown, flag).toBeUndefined();
      expect(event?.onEnterEffects?.flags?.auditResult, flag).toBe('clean');
    }
  });

  it('costs a point of standing when the two months went unread', () => {
    const event = audit({ deferredLedger: true });
    expect(event?.sceneText).toContain('你没有注意到');
    expect(event?.sceneText).toContain('我不是在指责你');
    expect(event?.onEnterEffects?.renown).toBe(-1);
    expect(event?.onEnterEffects?.flags?.auditResult).toBe('flagged');
  });

  it('treats never having opened the ledger the same as having deferred it', () => {
    expect(audit({})?.onEnterEffects?.flags?.auditResult).toBe('flagged');
  });

  it('greets him as a stranger unless the market already introduced them', () => {
    expect(audit({})?.sceneText).toContain('没有寒暄');
    expect(audit({})?.sceneText).not.toContain('我们见过');
    expect(audit({ met_timothy: true })?.sceneText).toContain('集市那次');
  });

  it('pays the fragment only for the technical question', () => {
    const choices = audit({})?.choices ?? [];
    const withClue = choices.filter(c => c.effects?.flags?.clue_ofc_timothy_nature);
    expect(withClue.map(c => c.id)).toEqual(['audit_nature']);
  });

  it('gives the officer judgment no microcopy at all (GDD 11.6)', () => {
    for (const choice of audit({})?.choices ?? []) {
      expect(choice.description, choice.id).toBeUndefined();
    }
  });
});

// ── processWynter: the same scene at four depths ──────────────────────────

describe('getFixedEvent — Day 22 维特', () => {
  it('is the same encounter for everyone, and asks nothing of the player', () => {
    const event = getFixedEvent(22, 'evening', makeState({ day: 22, flags: {} }));
    expect(event?.title).toBe('维特');
    expect(event?.choices).toBeNull();
    expect(event?.onEnterEffects?.flags?.metWynter).toBe(true);
  });
});

// ── processDay23: letter assembly ─────────────────────────────────────────

describe('getFixedEvent — Day 23 letter assembly', () => {
  it('includes grain_low paragraph when grain < 40', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 20, guldmark: 30, timber: 10, renown: 3 } })
    );
    expect(event?.sceneText).toContain('情况堪忧');
  });

  it('includes grain_mid paragraph when grain 40-70', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 55, guldmark: 30, timber: 10, renown: 3 } })
    );
    expect(event?.sceneText).toContain('进展合理');
  });

  it('includes grain_high paragraph when grain > 70', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 90, guldmark: 30, timber: 10, renown: 3 } })
    );
    expect(event?.sceneText).toContain('情况良好');
  });

  it('includes guldmark_low paragraph when guldmark < 10', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 50, guldmark: 5, timber: 10, renown: 3 } })
    );
    expect(event?.sceneText).toContain('账面已偏紧');
  });

  it('includes timber_low paragraph when timber < 5', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 50, guldmark: 30, timber: 3, renown: 3 } })
    );
    expect(event?.sceneText).toContain('不足以保障');
  });

  it('includes renown_high paragraph when renown >= 6', () => {
    const event = getFixedEvent(
      23, 'morning',
      makeState({ day: 23, resources: { grain: 50, guldmark: 30, timber: 10, renown: 7 } })
    );
    expect(event?.sceneText).toContain('难得的成就');
  });

  it('contains opening and closing text', () => {
    const event = getFixedEvent(23, 'morning', makeState({ day: 23 }));
    expect(event?.sceneText).toContain('枫径庄园 管事亲启');
    expect(event?.sceneText).toContain('瓦妮莎·德·瓦莱恩');
  });

  it('sceneText is not the placeholder [GENERATED]', () => {
    const event = getFixedEvent(23, 'morning', makeState({ day: 23 }));
    expect(event?.sceneText).not.toBe('[GENERATED]');
  });
});

// ── processDay30: placeholder replacement ─────────────────────────────────

describe('getFixedEvent — Day 30 evening processDay30', () => {
  it('replaces {grain} with actual grain value', () => {
    const event = getFixedEvent(
      30, 'evening',
      makeState({ day: 30, resources: { grain: 95, guldmark: 20, timber: 8, renown: 4 } })
    );
    expect(event?.sceneText).toContain('95');
    expect(event?.sceneText).not.toContain('{grain}');
  });

  it('replaces all resource placeholders', () => {
    const event = getFixedEvent(
      30, 'evening',
      makeState({ day: 30, resources: { grain: 80, guldmark: 15, timber: 6, renown: 2 } })
    );
    const text = event?.sceneText ?? '';
    expect(text).not.toContain('{guldmark}');
    expect(text).not.toContain('{timber}');
    expect(text).not.toContain('{renown}');
    expect(text).not.toContain('{summary}');
  });

  it('the retelling on Day 22 is what Day 30 reaches back for', () => {
    const event = getFixedEvent(
      30, 'evening',
      makeState({ day: 30, flags: { wynterRestated: true } })
    );
    expect(event?.sceneText).toContain('维特');
  });

  it('high renown produces community summary', () => {
    const event = getFixedEvent(
      30, 'evening',
      makeState({ day: 30, resources: { grain: 50, guldmark: 20, timber: 5, renown: 7 } })
    );
    expect(event?.sceneText).toContain('河谷一带');
  });
});

// ── getFreeChoices: morning ────────────────────────────────────────────────

describe('getFreeChoices — morning choices', () => {
  it('always includes harvest and timber choices', () => {
    const choices = getFreeChoices(makeState({ phase: 'morning' }));
    const ids = choices.map(c => c.id);
    expect(ids).toContain('harvest');
    expect(ids).toContain('fell_timber');
    expect(ids).toContain('visit_office');
  });

  it('disables harvest and timber when exhausted', () => {
    const choices = getFreeChoices(makeState({ phase: 'morning', fatigue: 5 }));
    const harvest = choices.find(c => c.id === 'harvest');
    expect(harvest?.disabled).toBe(true);
  });

  it('shows deep_investigate_ledger after Day 3 investigation (before Day 12)', () => {
    const choices = getFreeChoices(makeState({
      day: 5,
      phase: 'morning',
      flags: { investigatedLedger: true },
    }));
    expect(choices.find(c => c.id === 'deep_investigate_ledger')).toBeDefined();
  });

  it('does NOT show deep_investigate_ledger after Day 12', () => {
    const choices = getFreeChoices(makeState({
      day: 13,
      phase: 'morning',
      flags: { investigatedLedger: true },
    }));
    expect(choices.find(c => c.id === 'deep_investigate_ledger')).toBeUndefined();
  });
});

// ── getFreeChoices: hunt season morning ───────────────────────────────────

describe('getFreeChoices — hunt season attendance (Day 19-22)', () => {
  it('shows hunt attendance choice on Day 19 when season started and not yet attended', () => {
    const choices = getFreeChoices(makeState({
      day: 19,
      phase: 'morning',
      flags: { huntingSeasonStarted: true },
    }));
    expect(choices.find(c => c.id === 'attend_hunt_day19')).toBeDefined();
  });

  it('does NOT show hunt choice if already attended that day', () => {
    const choices = getFreeChoices(makeState({
      day: 19,
      phase: 'morning',
      flags: { huntingSeasonStarted: true, huntAttendedDay19: true },
    }));
    expect(choices.find(c => c.id === 'attend_hunt_day19')).toBeUndefined();
  });

  it('does NOT show hunt choice before Day 19', () => {
    const choices = getFreeChoices(makeState({
      day: 18,
      phase: 'morning',
      flags: { huntingSeasonStarted: true },
    }));
    expect(choices.find(c => c.id?.startsWith('attend_hunt'))).toBeUndefined();
  });

  it('does NOT show hunt choice after Day 22', () => {
    const choices = getFreeChoices(makeState({
      day: 23,
      phase: 'morning',
      flags: { huntingSeasonStarted: true },
    }));
    expect(choices.find(c => c.id?.startsWith('attend_hunt'))).toBeUndefined();
  });

  it('hunt choice disabled when exhausted', () => {
    const choices = getFreeChoices(makeState({
      day: 20,
      phase: 'morning',
      fatigue: 5,
      flags: { huntingSeasonStarted: true },
    }));
    const huntChoice = choices.find(c => c.id === 'attend_hunt_day20');
    expect(huntChoice?.disabled).toBe(true);
  });
});

// ── getFreeChoices: afternoon ──────────────────────────────────────────────

describe('getFreeChoices — afternoon choices', () => {
  it('shows marta and gregor choices', () => {
    const choices = getFreeChoices(makeState({ phase: 'afternoon' }));
    const ids = choices.map(c => c.id);
    expect(ids).toContain('talk_marta');
    expect(ids).toContain('talk_gregor');
  });

  it('talking counts a conversation instead of handing out action trust', () => {
    const choices = getFreeChoices(makeState({ phase: 'afternoon' }));
    for (const id of ['talk_marta', 'talk_gregor']) {
      const choice = choices.find(c => c.id === id);
      expect(choice?.effects?.conversationWith).toBeDefined();
      expect(choice?.effects?.relationships).toBeUndefined();
    }
  });

  it('shows the lorenz choice only once Day 4 has opened the forge-hall', () => {
    // 谷火神殿 is gone in v3, and the dinner is no longer where you meet him:
    // he walks you into the manor's own forge-hall on Day 4, and not before.
    const without = getFreeChoices(makeState({ phase: 'afternoon' }));
    expect(without.find(c => c.id === 'visit_lorenz')).toBeUndefined();

    const opened = getFreeChoices(makeState({
      phase: 'afternoon',
      flags: { unlockForgeChapel: true },
    }));
    expect(opened.find(c => c.id === 'visit_lorenz')).toBeDefined();
  });

  it('broker choices absent before Day 24', () => {
    const choices = getFreeChoices(makeState({
      day: 23,
      phase: 'afternoon',
      flags: { lordsLetterRead: true },
    }));
    expect(choices.find(c => c.id === 'broker_grain_to_gold')).toBeUndefined();
  });

  it('broker choices appear on Day 24 after lords letter', () => {
    const choices = getFreeChoices(makeState({
      day: 24,
      phase: 'afternoon',
      flags: { lordsLetterRead: true },
    }));
    expect(choices.find(c => c.id === 'broker_grain_to_gold')).toBeDefined();
    expect(choices.find(c => c.id === 'broker_timber_to_grain')).toBeDefined();
  });

  it('broker choices absent without lordsLetterRead', () => {
    const choices = getFreeChoices(makeState({ day: 25, phase: 'afternoon' }));
    expect(choices.find(c => c.id === 'broker_grain_to_gold')).toBeUndefined();
  });

  it('grain→gold broker disabled when grain < 6', () => {
    const choices = getFreeChoices(makeState({
      day: 25,
      phase: 'afternoon',
      flags: { lordsLetterRead: true },
      resources: { grain: 4, guldmark: 20, timber: 5, renown: 0 },
    }));
    const broker = choices.find(c => c.id === 'broker_grain_to_gold');
    expect(broker?.disabled).toBe(true);
  });

  it('timber→grain broker disabled when timber < 2', () => {
    const choices = getFreeChoices(makeState({
      day: 25,
      phase: 'afternoon',
      flags: { lordsLetterRead: true },
      resources: { grain: 50, guldmark: 5, timber: 1, renown: 0 },
    }));
    const broker = choices.find(c => c.id === 'broker_timber_to_grain');
    expect(broker?.disabled).toBe(true);
  });
});

// ── getFreeChoices: evening ────────────────────────────────────────────────

describe('getFreeChoices — evening choices', () => {
  it('always includes rest and review_accounts', () => {
    const choices = getFreeChoices(makeState({ phase: 'evening' }));
    const ids = choices.map(c => c.id);
    expect(ids).toContain('rest');
    expect(ids).toContain('review_accounts');
  });

  it('opens the forge-hall only once the Day 4 hearth-feeding has happened', () => {
    const before = getFreeChoices(makeState({ phase: 'evening' }));
    expect(before.map(c => c.id)).not.toContain('visit_chapel');

    const after = getFreeChoices(makeState({ phase: 'evening', flags: { unlockForgeChapel: true } }));
    expect(after.map(c => c.id)).toContain('visit_chapel');
  });

  it('no longer offers the night spent researching woodland symbols', () => {
    // v3 retired the symbols entirely: the evidence in the north woods is the
    // stumps, their diameters, and the direction the skid road runs.
    const cases: GameState['flags'][] = [{}, { documentedSymbols: true }, { documentedStumps: true }];
    for (const flags of cases) {
      const choices = getFreeChoices(makeState({ phase: 'evening', flags }));
      expect(choices.find(c => c.id === 'research_symbols')).toBeUndefined();
    }
  });
});

// ── Critical path: 霍特曼 investigation chain ────────────────────────────

describe('Critical path — 霍特曼 investigation (Ending 5)', () => {
  it('Day 3 event exists and has investigatedLedger choice', () => {
    const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 }));
    const choice = event?.choices?.find(c => c.effects?.flags?.investigatedLedger);
    expect(choice).toBeDefined();
  });

  it('Day 3 is an insert event, but investigating costs the phase it claims to', () => {
    const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 }));
    expect(event?.advancesPhase ?? false).toBe(false);
    expect(event?.choices?.find(c => c.id === 'investigate')?.advancesPhase).toBe(true);
    expect(event?.choices?.find(c => c.id === 'defer')?.advancesPhase).toBeUndefined();
  });

  it('Day 3 reporting upward trades renown for 领主印象', () => {
    const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 }));
    const report = event?.choices?.find(c => c.id === 'report');
    expect(report?.effects?.lordImpression).toBe(1);
    expect(report?.effects?.renown).toBe(-1);
  });

  it('Day 15 records stumps rather than symbols', () => {
    const record = getEventById('day15_record', makeState({ day: 15 }));
    const choice = record?.choices?.find(c => c.effects?.flags?.documentedStumps);
    expect(choice).toBeDefined();
  });

  it('Day 22 has no right answer to get wrong — the chain node is the retelling', () => {
    // v3 removed the traveler dialogue check entirely. What 维特 can say is a
    // function of how many fragments the player is carrying, not of one choice.
    const thin = getFixedEvent(22, 'evening', makeState({ day: 22 }));
    expect(thin?.choices).toBeNull();
    expect(thin?.onEnterEffects?.flags?.wynterRestated).toBeUndefined();

    const carrying = getFixedEvent(22, 'evening', makeState({
      day: 22,
      flags: {
        clue_pos_horses_intact: true, clue_pos_horse_returned: true,
        clue_pos_horse_condition: true, clue_mot_martha_summer: true,
        clue_mot_handwriting: true, clue_ofc_timothy_nature: true,
      },
    }));
    expect(carrying?.onEnterEffects?.flags?.wynterRestated).toBe(true);
  });

  it('no longer needs a night of archive research to complete the chain', () => {
    // The chain is 账本 → 树桩 → 维特. Stage 5 rewrites the determination entirely.
    const reached = determineEnding(makeState({
      day: 30,
      resources: { grain: 80, guldmark: 20, timber: 5, renown: 3 },
      flags: {
        investigatedLedger: true,
        documentedStumps: true,
        wynterRestated: true,
      },
    }));
    expect(reached).toBe('ending5');
  });
});

// ── Critical path: hunt overnight chain ───────────────────────────────────

describe('Critical path — hunt overnight chain', () => {
  it('staying the night takes over the evening and the morning after it', () => {
    const event = getFixedEvent(
      20, 'evening',
      makeState({ day: 20, flags: { huntAttendedDay20: true } })
    );
    const stayChoice = event?.choices?.find(c => c.id === 'overnight_stay');
    expect(stayChoice?.effects?.flags?.campOvernight).toBe(true);
    // The evening is spent at the banquet, which is where the phase is charged.
    expect(stayChoice?.nextEvent).toBe('day20_camp_banquet');
  });

  it('riding out from the camp continues the day at the hunt', () => {
    const event = getFixedEvent(
      21, 'morning',
      makeState({ day: 21, flags: { campOvernight: true } })
    );
    const continueChoice = event?.choices?.find(c => c.id === 'camp_stay');
    expect(continueChoice?.effects?.flags?.huntAttendedDay21).toBe(true);
    expect(continueChoice?.nextEvent).toBe('day21_camp_harvest');
  });
});
