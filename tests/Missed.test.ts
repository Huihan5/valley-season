import { describe, it, expect } from 'vitest';
import { GameState, FlagMap } from '../src/types/game';
import { createInitialState } from '../src/systems/GameEngine';
import { getFreeChoices } from '../src/systems/EventSystem';
import { MISSED_RULES, missedIds, getMissed } from '../src/systems/MissedSystem';
import { MISSED_LINES_MAX } from '../src/data/config';
import zh from '../src/data/zh/endings/missed.json';
import en from '../src/data/en/endings/missed.json';

// After the ending: up to three directions, each true of the run and none saying what was
// there (plan 3.7). Every rule reads what the season already left behind.

function run(flags: FlagMap = {}, over: Partial<GameState> = {}): GameState {
  const base = createInitialState(over.seed ?? 5);
  return { ...base, openingPage: null, activeEvent: null, day: 30, flags: { ...base.flags, ...flags }, ...over };
}

/** A run that did everything the rules ask about. */
const COMPLETE: FlagMap = {
  attendedDinner: true, huntingSeasonStarted: true, huntAttendedDay18: true, rodeToMillridge: true,
  met_thierry: true, met_timothy: true, horseCareCount: 3, clue_mot_martha_lastwords: true,
  clue_mot_elena_burned: true, unlockForgeChapel: true, visitedChapelNight: true, satVigilWithLorenz: true,
  clue_nob_marguerite: true, nightLedgerCount: 3, forestReportReceived: true, visitedBoundary: true,
  documentedStumps: true, visitedMarket_day6: true, visitedMarket_day13: true, visitedMarket_day20: true,
  visitedMarket_day27: true,
};

describe('the lines and the rules agree', () => {
  it('every rule has its line in both languages, and no line is left without a rule', () => {
    const ids = MISSED_RULES.map(r => r.id).sort();
    expect(Object.keys(zh.lines).sort()).toEqual(ids);
    expect(Object.keys(en.lines).sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each line is one sentence, and none says what there was', () => {
    for (const text of [...Object.values(zh.lines), ...Object.values(en.lines)]) {
      expect(text.includes('\n')).toBe(false);
      expect(text.length).toBeGreaterThan(8);
    }
    // the author's own sentence, kept as written
    expect(zh.lines.lorenz_never).toBe('你未曾造访夜晚的炉堂。');
  });
});

describe('a line is offered only when it is true', () => {
  const cases: [string, FlagMap, FlagMap][] = [
    // id, flags that make it true (on top of COMPLETE), … and the flags that make it false again
    ['dinner', { attendedDinner: false }, { attendedDinner: true }],
    ['hunt', { huntAttendedDay18: false }, { huntAttendedDay18: true }],
    ['millridge', { rodeToMillridge: false }, { rodeToMillridge: true }],
    ['thierry', { met_thierry: false }, { met_thierry: true }],
    ['timothy', { met_timothy: false }, { met_timothy: true }],
    ['gregor_none', { horseCareCount: 0 }, { horseCareCount: 1 }],
    ['gregor_some', { horseCareCount: 2 }, { horseCareCount: 3 }],
    ['marta_word', { clue_mot_martha_lastwords: false }, { clue_mot_martha_lastwords: true }],
    ['elena_late', { clue_mot_elena_burned: false }, { clue_mot_elena_burned: true }],
    ['lorenz_closed', { unlockForgeChapel: false, visitedChapelNight: false }, { unlockForgeChapel: true }],
    ['lorenz_never', { visitedChapelNight: false, satVigilWithLorenz: false }, { visitedChapelNight: true }],
    ['lorenz_vigil', { satVigilWithLorenz: false }, { satVigilWithLorenz: true }],
    ['marguerite_word', { clue_nob_marguerite: false }, { clue_nob_marguerite: true }],
    ['ledger_none', { nightLedgerCount: 0 }, { nightLedgerCount: 1 }],
    ['ledger_some', { nightLedgerCount: 2 }, { nightLedgerCount: 3 }],
    ['boundary', { visitedBoundary: false }, { visitedBoundary: true }],
    ['stumps', { documentedStumps: false }, { documentedStumps: true }],
    ['market', { visitedMarket_day13: false, visitedMarket_day20: false, visitedMarket_day27: false }, { visitedMarket_day13: true, visitedMarket_day20: true }],
    // the forks: true only for the way the player went
    ['ledger_followed', { investigatedLedger: true }, { investigatedLedger: false }],
    ['ledger_reported', { reportedLedger: true }, { reportedLedger: false }],
    ['ledger_deferred', { deferredLedger: true }, { deferredLedger: false }],
    ['elena_exposed', { exposedElena: true }, { exposedElena: false }],
    ['elena_shielded', { protectedElena: true }, { protectedElena: false }],
    ['hunt_night_left', { huntAttendedDay20: true, campOvernight: false }, { campOvernight: true }],
    ['hunt_fire_other', { campOvernight: true, banquetAnswer: 'B' }, { banquetAnswer: '' }],
  ];

  for (const [id, makes, undoes] of cases) {
    it(id, () => {
      expect(missedIds(run(COMPLETE))).not.toContain(id);
      expect(missedIds(run({ ...COMPLETE, ...makes }))).toContain(id);
      expect(missedIds(run({ ...COMPLETE, ...makes, ...undoes }))).not.toContain(id);
    });
  }

  it('the two nobles unmet: nothing to say of a word they never gave', () => {
    const stranger = run({ ...COMPLETE, attendedDinner: false, huntAttendedDay18: false });
    expect(missedIds(stranger)).toEqual(expect.arrayContaining(['marguerite_unmet', 'henk_unmet']));
    expect(missedIds(stranger)).not.toContain('marguerite_word');
    const met = run({ ...COMPLETE, clue_nob_marguerite: false });
    expect(missedIds(met)).toContain('marguerite_word');
    expect(missedIds(met)).not.toContain('marguerite_unmet');
  });

  it('a steward let go in the second week is not told about the hunt or the last market', () => {
    const early = run({}, { day: 12 });
    const ids = missedIds(early);
    expect(ids).toContain('dinner');
    for (const later of ['hunt', 'millridge', 'market', 'boundary', 'marguerite_word']) expect(ids).not.toContain(later);
  });

  it('a season that reached everywhere has nothing to open', () => {
    expect(missedIds(run(COMPLETE))).toEqual([]);
    expect(getMissed(run(COMPLETE))).toEqual([]);
  });
});

describe('what is offered', () => {
  const sparse = () => run({ unlockForgeChapel: true, forestReportReceived: true, horseCareCount: 1 });

  const kindsOf = (state: GameState) => getMissed(state).map(l => MISSED_RULES.find(r => r.id === l.id)!.kind);

  it(`at most ${MISSED_LINES_MAX}, one of each kind in turn`, () => {
    const lines = getMissed(sparse());
    expect(lines).toHaveLength(MISSED_LINES_MAX);
    // no fork was taken in this run, so the three kinds left are all there is
    expect([...kindsOf(sparse())].sort()).toEqual(['event', 'person', 'place']);
  });

  it('three different kinds out of four when the run has all four, and each kind gets its turn across seasons', () => {
    const forked = (seed: number) => run({
      unlockForgeChapel: true, forestReportReceived: true, horseCareCount: 1, investigatedLedger: true,
    }, { seed });
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const kinds = kindsOf(forked(seed));
      expect(kinds).toHaveLength(MISSED_LINES_MAX);
      expect(new Set(kinds).size).toBe(MISSED_LINES_MAX);
      kinds.forEach(k => seen.add(k));
    }
    expect([...seen].sort()).toEqual(['choice', 'event', 'person', 'place']);
  });

  it('a fork line names the way not taken, and only one of the three ledger lines can ever be true', () => {
    for (const flags of [{ investigatedLedger: true }, { reportedLedger: true }, { deferredLedger: true }] as FlagMap[]) {
      const ids = missedIds(run({ ...COMPLETE, ...flags })).filter(id => id.startsWith('ledger_'));
      expect(ids).toHaveLength(1);
    }
    // Elena: the answer that was not given is the other one
    const exposed = missedIds(run({ ...COMPLETE, exposedElena: true, protectedElena: false }));
    const shielded = missedIds(run({ ...COMPLETE, exposedElena: false, protectedElena: true }));
    expect(exposed).toContain('elena_exposed');
    expect(exposed).not.toContain('elena_shielded');
    expect(shielded).toContain('elena_shielded');
    expect(shielded).not.toContain('elena_exposed');
  });

  it('fills up from what is left when a kind has run out', () => {
    // only people and one place are missed
    const flags = { ...COMPLETE, attendedDinner: true, clue_mot_martha_lastwords: false, clue_mot_elena_burned: false, nightLedgerCount: 0 };
    const kinds = getMissed(run(flags)).map(l => MISSED_RULES.find(r => r.id === l.id)!.kind);
    expect([...kinds].sort()).toEqual(['person', 'person', 'place']);
  });

  it('is the same every time the ending is opened, whatever the language', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = { ...sparse(), seed };
      const first = getMissed(state).map(l => l.id);
      expect(getMissed({ ...state }).map(l => l.id)).toEqual(first);
    }
  });

  it('can differ between seasons, so a second run reads something else', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) getMissed({ ...sparse(), seed }).forEach(l => seen.add(l.id));
    expect(seen.size).toBeGreaterThan(MISSED_LINES_MAX);
  });

  it('a line about someone you know opens their page; one about someone you never met does not', () => {
    // only Martha's line can be told here: everything else was reached
    const known = run({ ...COMPLETE, clue_mot_martha_lastwords: false });
    expect(getMissed(known)).toEqual([expect.objectContaining({ id: 'marta_word', codexEntry: 'marta' })]);

    // the two nobles never met: their lines name no page
    const strangers = run({ ...COMPLETE, attendedDinner: false, huntingSeasonStarted: false, huntAttendedDay18: false });
    const unmet = getMissed(strangers).filter(l => l.id.endsWith('_unmet'));
    expect(unmet.length).toBeGreaterThan(0);
    expect(unmet.every(l => l.codexEntry === null)).toBe(true);

    // the forge-chapel that was never opened has no page to point at either
    const closed = run({ ...COMPLETE, unlockForgeChapel: false, visitedChapelNight: false });
    expect(getMissed(closed).find(l => l.id === 'lorenz_closed')?.codexEntry ?? null).toBeNull();
  });
});

describe('the evening visit to the forge-chapel is remembered', () => {
  const evening = (day: number) => {
    const state = run({ unlockForgeChapel: true }, { day, phase: 'evening' });
    return getFreeChoices(state).find(c => c.id === 'visit_chapel');
  };

  it('on an ordinary night', () => {
    expect(evening(12)?.effects?.flags?.visitedChapelNight).toBe(true);
  });

  it('on the Thursday of the vigil', () => {
    const vigil = evening(11);
    expect(vigil?.effects?.flags?.visitedChapelNight).toBe(true);
    expect(vigil?.effects?.flags?.satVigilWithLorenz).toBe(true);
  });
});
