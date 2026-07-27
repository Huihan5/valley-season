import { describe, it, expect } from 'vitest';
import { getFixedEvent, getFreeChoices } from '../src/systems/EventSystem';
import { GameState } from '../src/types/game';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    resources: { grain: 50, guldmark: 30, timber: 10, renown: 3 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, lena: 0, elke: 0, henk: 0, lorenz: 0 },
    flags: {},
    currentSceneText: '',
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
    const event = getFixedEvent(3, 'morning', makeState({ day: 3 }));
    expect(event?.id).toBe('day3_ledger');
    expect(event?.forced).toBe(true);
  });

  it('returns null for a day with no fixed event', () => {
    const event = getFixedEvent(5, 'morning', makeState({ day: 5 }));
    expect(event).toBeNull();
  });

  it('returns null for wrong phase', () => {
    // Day 3 event is morning-only; afternoon should return null
    const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 }));
    expect(event).toBeNull();
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

  it('Day 21 morning forced event fires only with huntOvernightDay20', () => {
    expect(getFixedEvent(21, 'morning', makeState({ day: 21 }))).toBeNull();
    const withFlag = getFixedEvent(
      21, 'morning',
      makeState({ day: 21, flags: { huntOvernightDay20: true } })
    );
    expect(withFlag?.id).toBe('day21_hunt_morning');
  });

  it('Day 21 lorenz fires only with huntAttendedDay21Continued', () => {
    expect(getFixedEvent(21, 'afternoon', makeState({ day: 21 }))).toBeNull();
    const withFlag = getFixedEvent(
      21, 'afternoon',
      makeState({ day: 21, flags: { huntAttendedDay21Continued: true } })
    );
    expect(withFlag?.id).toBe('day21_hunt_lorenz');
  });

  it('Day 22 hunt traveler fires only with huntAttendedDay22', () => {
    expect(getFixedEvent(22, 'afternoon', makeState({ day: 22 }))).toBeNull();
    const withFlag = getFixedEvent(
      22, 'afternoon',
      makeState({ day: 22, flags: { huntAttendedDay22: true } })
    );
    expect(withFlag?.id).toBe('day22_hunt_traveler');
  });

  it('Day 22 estate traveler always fires (no activationFlag)', () => {
    const event = getFixedEvent(22, 'evening', makeState({ day: 22 }));
    expect(event?.id).toBe('day22_traveler_estate');
  });
});

// ── processDay12: 凯斯勒 audit branching ──────────────────────────────────

describe('getFixedEvent — Day 12 processDay12', () => {
  it('with investigatedLedger: first choice gets renown bonus', () => {
    const event = getFixedEvent(
      12, 'morning',
      makeState({ day: 12, flags: { investigatedLedger: true } })
    );
    expect(event?.choices?.[0].effects?.renown).toBe(2);
    expect(event?.choices?.[0].description).toContain('有备而来');
  });

  it('with reportedLedger: first choice description changes', () => {
    const event = getFixedEvent(
      12, 'morning',
      makeState({ day: 12, flags: { reportedLedger: true } })
    );
    expect(event?.choices?.[0].description).toContain('凯斯勒');
    expect(event?.choices?.[0].disabled).toBeFalsy();
  });

  it('with deferredLedger: first choice disabled, third choice gets renown penalty', () => {
    const event = getFixedEvent(
      12, 'morning',
      makeState({ day: 12, flags: { deferredLedger: true } })
    );
    expect(event?.choices?.[0].disabled).toBe(true);
    expect(event?.choices?.[2].effects?.renown).toBe(-2);
  });

  it('with no ledger flags: choices unchanged from base', () => {
    const event = getFixedEvent(12, 'morning', makeState({ day: 12 }));
    expect(event?.choices?.[0].disabled).toBeFalsy();
    expect(event?.choices?.[2].effects?.renown).not.toBe(-2);
  });
});

// ── processDay22Estate: traveler B-i path ─────────────────────────────────

describe('getFixedEvent — Day 22 estate processDay22Estate', () => {
  it('shows full traveler encounter when player did NOT attend hunt', () => {
    const event = getFixedEvent(22, 'evening', makeState({ day: 22, flags: {} }));
    expect(event?.title).toBe('庄园门口的旅人');
    expect(event?.choices?.length).toBeGreaterThan(1);
  });

  it('shows follow-up scene when player attended hunt on Day 22', () => {
    const event = getFixedEvent(
      22, 'evening',
      makeState({ day: 22, flags: { huntAttendedDay22: true } })
    );
    expect(event?.title).toBe('猎场归来');
    expect(event?.choices?.length).toBe(2);
    expect(event?.choices?.[0].id).toBe('tell_marta_traveler');
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

  it('travelerDialogueCorrect flag produces investigation summary', () => {
    const event = getFixedEvent(
      30, 'evening',
      makeState({ day: 30, flags: { travelerDialogueCorrect: true } })
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

  it('shows lorenz choice only after meeting at dinner', () => {
    const without = getFreeChoices(makeState({ phase: 'afternoon' }));
    expect(without.find(c => c.id === 'visit_lorenz')).toBeUndefined();

    const with_ = getFreeChoices(makeState({
      phase: 'afternoon',
      flags: { metLorenzAtDinner: true },
    }));
    expect(with_.find(c => c.id === 'visit_lorenz')).toBeDefined();
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
    expect(ids).toContain('visit_chapel');
  });

  it('research_symbols absent without documentedSymbols flag', () => {
    const choices = getFreeChoices(makeState({ phase: 'evening' }));
    expect(choices.find(c => c.id === 'research_symbols')).toBeUndefined();
  });

  it('research_symbols appears after documentedSymbols set', () => {
    const choices = getFreeChoices(makeState({
      phase: 'evening',
      flags: { documentedSymbols: true },
    }));
    expect(choices.find(c => c.id === 'research_symbols')).toBeDefined();
  });
});

// ── Critical path: 霍特曼 investigation chain ────────────────────────────

describe('Critical path — 霍特曼 investigation (Ending 5)', () => {
  it('Day 3 event exists and has investigatedLedger choice', () => {
    const event = getFixedEvent(3, 'morning', makeState({ day: 3 }));
    const choice = event?.choices?.find(c => c.effects?.flags?.investigatedLedger);
    expect(choice).toBeDefined();
  });

  it('Day 15 event exists and has documentedSymbols choice', () => {
    const event = getFixedEvent(15, 'afternoon', makeState({ day: 15 }));
    const choice = event?.choices?.find(c => c.effects?.flags?.documentedSymbols);
    expect(choice).toBeDefined();
  });

  it('Day 22 estate traveler has travelerDialogueCorrect choice gated by documentedSymbols', () => {
    // Without documentedSymbols: this choice is filtered out by requiresFlag
    const event = getFixedEvent(22, 'evening', makeState({ day: 22 }));
    const correctChoice = event?.choices?.find(c => c.effects?.flags?.travelerDialogueCorrect);
    expect(correctChoice?.requiresFlag).toBe('documentedSymbols');
  });

  it('research_symbols evening choice sets researchedSymbols flag', () => {
    const choices = getFreeChoices(makeState({
      phase: 'evening',
      flags: { documentedSymbols: true },
    }));
    const research = choices.find(c => c.id === 'research_symbols');
    expect(research?.effects?.flags?.researchedSymbols).toBe(true);
  });
});

// ── Critical path: hunt overnight chain ───────────────────────────────────

describe('Critical path — hunt overnight chain', () => {
  it('overnight_stay choice sets both huntOvernightDay20 and huntAttendedDay21', () => {
    const event = getFixedEvent(
      20, 'evening',
      makeState({ day: 20, flags: { huntAttendedDay20: true } })
    );
    const stayChoice = event?.choices?.find(c => c.id === 'overnight_stay');
    expect(stayChoice?.effects?.flags?.huntOvernightDay20).toBe(true);
    expect(stayChoice?.effects?.flags?.huntAttendedDay21).toBe(true);
  });

  it('morning_stay_hunt sets huntAttendedDay21Continued', () => {
    const event = getFixedEvent(
      21, 'morning',
      makeState({ day: 21, flags: { huntOvernightDay20: true } })
    );
    const continueChoice = event?.choices?.find(c => c.id === 'morning_stay_hunt');
    expect(continueChoice?.effects?.flags?.huntAttendedDay21Continued).toBe(true);
  });
});
