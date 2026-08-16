import { describe, it, expect } from 'vitest';
import { GameState, NpcId, FlagMap, LogEntry } from '../src/types/game';
import {
  CLUE_REGISTRY, CLUE_GROUPS, getJournal, hasAnyClue, scanClueFlags,
} from '../src/systems/JournalSystem';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(flags: FlagMap = {}, log: LogEntry[] = []): GameState {
  return {
    day: 22,
    phase: 'evening',
    weather: 'cloudy',
    playerName: '安',
    openingPage: null,
    resources: { grain: 40, guldmark: 20, timber: 4, renown: 1 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: 0,
    flags,
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log,
    demoComplete: false,
    endingId: null,
  };
}

const entriesOf = (state: GameState) => getJournal(state).flatMap(group => group.entries);

describe('the clue registry', () => {
  /**
   * The one that earns its keep. A clue added to the data later without a line in
   * CLUE_ORDER would not break anything — it would simply never appear in the
   * journal, and only a playthrough that happened to earn that clue would show it.
   */
  it('covers every clue flag the data writes', () => {
    const registered = new Set(CLUE_REGISTRY.map(source => source.flag));
    const missing = scanClueFlags().filter(flag => !registered.has(flag));
    expect(missing).toEqual([]);
  });

  it('has a line to show for every clue it registers', () => {
    const silent = CLUE_REGISTRY.filter(source => !source.candidates.some(Boolean));
    expect(silent.map(source => source.flag)).toEqual([]);
  });

  it('sorts every clue into one of the three groups', () => {
    const stray = CLUE_REGISTRY.filter(source => !CLUE_GROUPS.includes(source.group));
    expect(stray).toEqual([]);
  });
});

describe('the journal', () => {
  it('is empty at the start of a season, but still has its three groups', () => {
    const journal = getJournal(makeState());
    expect(journal.map(group => group.id)).toEqual([...CLUE_GROUPS]);
    expect(journal.every(group => group.entries.length === 0)).toBe(true);
    expect(hasAnyClue(makeState())).toBe(false);
  });

  it('shows only what the player holds', () => {
    const state = makeState({ clue_mot_martha_summer: true });
    expect(entriesOf(state).map(entry => entry.flag)).toEqual(['clue_mot_martha_summer']);
    expect(hasAnyClue(state)).toBe(true);
  });

  it('files a clue under its own group', () => {
    const journal = getJournal(makeState({
      clue_pos_horses_intact: true,
      clue_ofc_timothy_person: true,
      clue_nob_marguerite: true,
    }));
    const byGroup = Object.fromEntries(
      journal.map(group => [group.id, group.entries.map(entry => entry.flag)])
    );
    expect(byGroup).toEqual({
      estate: ['clue_pos_horses_intact'],
      officer: ['clue_ofc_timothy_person'],
      noble: ['clue_nob_marguerite'],
    });
  });

  it('gives 玛格丽特 her own words rather than the title of 洛伦茨的事件', () => {
    const [entry] = entriesOf(makeState({ clue_nob_marguerite: true }));
    expect(entry.text).not.toContain('洛伦茨');
    expect(entry.text.length).toBeGreaterThan(0);
  });
});

describe('a clue with two possible sources', () => {
  /**
   * 蒂埃里's range is offered both at the Day 13 market and on the Day 19 ride, and
   * the two log different sentences. The journal should quote the one this run
   * actually produced.
   */
  const range = CLUE_REGISTRY.find(source => source.flag === 'clue_ofc_thierry_range');

  it('really does have more than one candidate line', () => {
    expect(range?.candidates.length).toBeGreaterThan(1);
  });

  it('quotes whichever line is in this run’s record', () => {
    const [first, second] = range?.candidates ?? [];
    const ranAt = (line: string) => makeState(
      { clue_ofc_thierry_range: true },
      [{ day: 13, phase: 'afternoon', text: line }]
    );
    expect(entriesOf(ranAt(second))[0].text).toBe(second);
    expect(entriesOf(ranAt(first))[0].text).toBe(first);
  });

  it('falls back to the first candidate when the record says nothing', () => {
    const state = makeState({ clue_ofc_thierry_range: true });
    expect(entriesOf(state)[0].text).toBe(range?.candidates[0]);
  });
});
