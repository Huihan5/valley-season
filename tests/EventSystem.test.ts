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

// ── processDay23: the chancery writes about two deadlines at once ─────────

describe('getFixedEvent — Day 23 letter assembly', () => {
  const letter = (grain: number, guldmark: number) =>
    getFixedEvent(23, 'morning', makeState({
      day: 23, resources: { grain, guldmark, timber: 10, renown: 3 },
    }))?.sceneText ?? '';

  it('calls the season 如常 only when the grain and the cash are both there', () => {
    expect(letter(95, 20)).toContain('列为如常');
  });

  it('warns without copying anyone in when the harvest is merely behind', () => {
    const text = letter(80, 5);
    expect(text).toContain('低于本区平均');
    expect(text).not.toContain('抄送');
  });

  it('copies the lord in only at the worst tier, and explains nothing', () => {
    const text = letter(40, 5);
    expect(text).toContain('显著落后');
    expect(text).toContain('本室已将此情况抄送庄园领主');
  });

  it('always carries the renewal clause, whatever the harvest looks like', () => {
    for (const text of [letter(95, 20), letter(80, 5), letter(40, 5)]) {
      expect(text).toContain('十月三十日届满');
      expect(text).toContain('届满前七日内提交');
    }
  });

  it('lets the player notice the date is now two deadlines', () => {
    const text = letter(80, 20);
    expect(text).toContain('它同时是另一个东西的期限');
    expect(text).toContain('还有八天');
  });

  it('opens the broker channel in the same breath', () => {
    const event = getFixedEvent(23, 'morning', makeState({ day: 23 }));
    expect(event?.sceneText).toContain('愿以物易物');
    expect(event?.onEnterEffects?.flags?.brokerUnlocked).toBe(true);
    expect(event?.onEnterEffects?.flags?.renewalWindowOpen).toBe(true);
  });

  it('costs nothing — it is a letter', () => {
    const event = getFixedEvent(23, 'morning', makeState({ day: 23 }));
    expect(event?.advancesPhase).toBe(false);
    expect(event?.choices).toBeNull();
  });
});

// ── processDay30: the last day, and the one person left to ask ────────────

describe('getFixedEvent — Day 30', () => {
  const evening = (grain: number, flags: GameState["flags"] = {}) =>
    getFixedEvent(30, 'evening', makeState({
      day: 30, resources: { grain, guldmark: 20, timber: 8, renown: 4 }, flags,
    }));

  it('leaves the last day a working day', () => {
    const morning = getFixedEvent(30, 'morning', makeState({ day: 30 }));
    expect(morning?.advancesPhase).toBe(false);
    expect(morning?.choices).toBeNull();
  });

  it('has 埃莱娜 air the winter quilts only if she expects you to be here', () => {
    const distant = getFixedEvent(30, 'morning', makeState({ day: 30 }));
    expect(distant?.sceneText).toContain('侧过身让你过去');

    const close = getFixedEvent(30, 'morning', makeState({
      day: 30,
      relationships: { gregor: 0, marta: 0, elena: 4, marguerite: 0, henk: 0, lorenz: 0 },
    }));
    expect(close?.sceneText).toContain('要到十一月中旬才用得上');
  });

  it('closes the books when the season came in', () => {
    const text = evening(95)?.sceneText ?? '';
    expect(text).toContain('但今晚这本账是平的');
    expect(text).not.toContain('你把数字算了三遍');
  });

  it('offers the ride to 磨岭 only to a steward who is short', () => {
    expect(evening(95)?.onEnterEffects?.flags?.day30Short).toBeUndefined();
    expect(evening(60)?.onEnterEffects?.flags?.day30Short).toBe(true);
    for (const choice of evening(60)?.choices ?? []) {
      expect(choice.requiresFlag).toBe('day30Short');
    }
  });

  it('remembers what the player admitted on a street in 河谷城', () => {
    expect(evening(95)?.sceneText).not.toContain('还没有对第二个人说过');
    expect(evening(95, { admittedWantToStay: true })?.sceneText)
      .toContain('你到现在还没有对第二个人说过');
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

  it('broker choices are gated on the letter, not on the date', () => {
    // The man with the note comes the same afternoon the letter arrives (drafts 4.12).
    const beforeLetter = getFreeChoices(makeState({ day: 23, phase: 'afternoon' }));
    expect(beforeLetter.find(c => c.id === 'broker_grain_to_gold')).toBeUndefined();

    const afterLetter = getFreeChoices(makeState({
      day: 23, phase: 'afternoon', flags: { brokerUnlocked: true },
    }));
    expect(afterLetter.find(c => c.id === 'broker_grain_to_gold')).toBeDefined();
  });

  it('broker choices open the same day the letter arrives', () => {
    const choices = getFreeChoices(makeState({
      day: 24,
      phase: 'afternoon',
      flags: { lordsLetterRead: true, brokerUnlocked: true },
    }));
    expect(choices.find(c => c.id === 'broker_grain_to_gold')).toBeDefined();
    expect(choices.find(c => c.id === 'broker_timber_to_grain')).toBeDefined();
  });

  it('broker choices absent until the letter opens the channel', () => {
    const choices = getFreeChoices(makeState({ day: 25, phase: 'afternoon' }));
    expect(choices.find(c => c.id === 'broker_grain_to_gold')).toBeUndefined();
  });

  it('grain→gold broker disabled when grain < 6', () => {
    const choices = getFreeChoices(makeState({
      day: 25,
      phase: 'afternoon',
      flags: { lordsLetterRead: true, brokerUnlocked: true },
      resources: { grain: 4, guldmark: 20, timber: 5, renown: 0 },
    }));
    const broker = choices.find(c => c.id === 'broker_grain_to_gold');
    expect(broker?.disabled).toBe(true);
  });

  it('timber→grain broker disabled when timber < 2', () => {
    const choices = getFreeChoices(makeState({
      day: 25,
      phase: 'afternoon',
      flags: { lordsLetterRead: true, brokerUnlocked: true },
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

  it('no longer routes the ending through a chain of investigation flags', () => {
    // Stage 5 retired the 账本 → 树桩 → 维特 chain as a determination input. Doing
    // all three and reaching the 留任线 gets the player kept on, nothing more —
    // the truth endings are counted off the clue groups (see EndingSystem.test).
    const reached = determineEnding(makeState({
      day: 30,
      resources: { grain: 80, guldmark: 20, timber: 5, renown: 3 },
      flags: {
        investigatedLedger: true,
        documentedStumps: true,
        wynterRestated: true,
      },
    }));
    expect(reached).toBe('ending2');
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
