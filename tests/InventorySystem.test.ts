import { describe, it, expect } from 'vitest';
import { GameState, FlagMap, SeasonAction } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import {
  getPapers, getThings, PAPER_IDS, THING_IDS,
} from '../src/systems/InventorySystem';
import { HORSE_CARE_TRUST_AT } from '../src/data/config';
import { seededRng } from '../src/utils/rng';
import zhInventory from '../src/data/zh/inventory.json';
import enInventory from '../src/data/en/inventory.json';

/** A real opening state, with the flags and the clock the case needs. */
function at(flags: FlagMap = {}, over: Partial<GameState> = {}): GameState {
  const s = createInitialState(1);
  return { ...s, openingPage: null, flags: { ...s.flags, ...flags }, ...over };
}

const papers = (s: GameState) => getPapers(s).map(p => p.id);
const things = (s: GameState) => getThings(s).map(t => t.id);

describe('the satchel at the start of the season', () => {
  it('holds the two papers the steward arrived with, and no things', () => {
    expect(papers(at())).toEqual(['guarantee', 'ticket']);
    expect(things(at())).toEqual([]);
  });

  it('names the guarantee by its number, which the later letter repeats', () => {
    const [guarantee] = getPapers(at());
    expect(guarantee.line).toContain('VS-18-0947');
  });
});

describe('papers come when the season brings them', () => {
  it('has the hunt invitation once the hunt season has been announced', () => {
    expect(papers(at())).not.toContain('hunt');
    expect(papers(at({ huntingSeasonStarted: true }))).toContain('hunt');
  });

  it('has the chancery letter once it has been read', () => {
    expect(papers(at())).not.toContain('letter');
    expect(papers(at({ lordsLetterRead: true }))).toContain('letter');
  });

  it('has the broker’s note from the afternoon of the day the letter comes, not the dawn', () => {
    const unlocked = { lordsLetterRead: true, brokerUnlocked: true };
    expect(papers(at(unlocked, { day: 23, phase: 'morning' }))).not.toContain('broker');
    expect(papers(at(unlocked, { day: 23, phase: 'afternoon' }))).toContain('broker');
    expect(papers(at(unlocked, { day: 24, phase: 'morning' }))).toContain('broker');
  });

  it('keeps them in the order the season delivers them', () => {
    const s = at(
      { huntingSeasonStarted: true, lordsLetterRead: true, brokerUnlocked: true },
      { day: 25, phase: 'morning' },
    );
    expect(papers(s)).toEqual(['guarantee', 'ticket', 'hunt', 'letter', 'broker']);
  });
});

describe('things are what people handed over, and only once they have', () => {
  it('has the second brush on the third afternoon in the stable and not before', () => {
    expect(things(at({ horseCareCount: HORSE_CARE_TRUST_AT - 1 }))).not.toContain('brush');
    expect(things(at({ horseCareCount: HORSE_CARE_TRUST_AT }))).toContain('brush');
  });

  it('has the dried fruit only for the steward who mended all five houses, after the morning it came', () => {
    expect(things(at({ petitionFairness: 'full' }))).not.toContain('fruit');
    expect(things(at({ petitionFairness: 'full', event_done_day11_echo: true }))).toContain('fruit');
    expect(things(at({ petitionFairness: 'fair', event_done_day11_echo: true }))).not.toContain('fruit');
    expect(things(at({ petitionFairness: 'none', event_done_day11_echo: true }))).not.toContain('fruit');
  });

  it('has the pencil only for the steward who protected Elena, after the morning it appeared', () => {
    expect(things(at({ protectedElena: true }))).not.toContain('pencil');
    expect(things(at({ protectedElena: true, event_done_day13_echo: true }))).toContain('pencil');
    expect(things(at({ event_done_day13_echo: true }))).not.toContain('pencil');
  });

  it('has the sheet copied from Hartmann’s ledger however the player answered it', () => {
    expect(things(at())).not.toContain('ledger');
    expect(things(at({ event_done_day3_ledger: true }))).toContain('ledger');
  });

  it('has the bark drawing only if the stumps were recorded', () => {
    expect(things(at({ documentedStumps: true }))).toContain('bark');
    expect(things(at())).not.toContain('bark');
  });

  it('has the bottle only if the steward admitted wanting to stay', () => {
    expect(things(at({ admittedWantToStay: true }))).toContain('bottle');
    expect(things(at())).not.toContain('bottle');
  });

  it('has the tin once the last steward’s reprieve has been found', () => {
    expect(things(at({ stewardRescueUsed: true }))).toContain('tin');
  });

  it('has the coin and the bag only when 亨克 gave them', () => {
    expect(things(at())).not.toContain('coin');
    expect(things(at({ henkCoin: true }))).toContain('coin');
    expect(things(at({ henkPurse: true }))).toContain('purse');
  });

  it('has the sprig either way, with the line for what the player did about it', () => {
    const asked = getThings(at({ folioAnswered: true })).find(t => t.id === 'sprig');
    const replaced = getThings(at({ folioAnswered: true, respectedElena: true })).find(t => t.id === 'sprig');
    expect(asked?.line).toContain('埃莱娜');
    expect(replaced?.line).toContain('放回');
    expect(asked?.line).not.toBe(replaced?.line);
    expect(things(at())).not.toContain('sprig');
  });
});

describe('words in both languages', () => {
  const zhPapers = zhInventory.papers as Record<string, { name: string; line: string }>;
  const enPapers = enInventory.papers as Record<string, { name: string; line: string }>;
  const zhThings = zhInventory.things as Record<string, { name: string; line: string; variants?: Record<string, string> }>;
  const enThings = enInventory.things as Record<string, { name: string; line: string; variants?: Record<string, string> }>;

  it('has a name and a line for every paper, in zh and en', () => {
    for (const id of PAPER_IDS) {
      for (const bundle of [zhPapers, enPapers]) {
        expect(bundle[id]?.name, id).toBeTruthy();
        expect(bundle[id]?.line, id).toBeTruthy();
      }
    }
    expect(Object.keys(zhPapers).sort()).toEqual([...PAPER_IDS].sort());
  });

  it('has a name and a line for every thing, in zh and en', () => {
    for (const id of THING_IDS) {
      for (const bundle of [zhThings, enThings]) {
        expect(bundle[id]?.name, id).toBeTruthy();
        expect(bundle[id]?.line, id).toBeTruthy();
      }
    }
    expect(Object.keys(zhThings).sort()).toEqual([...THING_IDS].sort());
  });

  it('gives the sprig a whole line for each way it can have gone', () => {
    for (const bundle of [zhThings, enThings]) {
      expect(Object.keys(bundle.sprig.variants ?? {}).sort()).toEqual(['asked', 'replaced']);
    }
  });
});

// ── In a played season ──────────────────────────────────────────────────────

function nextAction(s: GameState, pick: () => number): SeasonAction {
  if (s.openingPage !== null) {
    return s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
  }
  if (s.pendingAdvance) return { type: 'COMMIT_ADVANCE' };
  if (s.activeEvent && s.currentChoices.length === 0) return { type: 'ADVANCE_DAY_EVENT' };
  const open = s.currentChoices.filter(c => !c.disabled);
  return { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
}

function season(seed: number, bot: number): GameState[] {
  const pick = seededRng('bot', bot);
  let s = createInitialState(seed);
  const states = [s];
  while (!s.demoComplete && states.length < 4000) {
    s = gameReducer(s, nextAction(s, pick));
    states.push(s);
  }
  return states;
}

describe('across a played season', () => {
  const SEASONS: [number, number][] = [[1, 1], [20181030, 7], [987654321, 42]];

  it('only ever gains things: nothing handed over is taken back', () => {
    for (const [seed, bot] of SEASONS) {
      let held = new Set<string>();
      for (const s of season(seed, bot)) {
        const now = new Set([...papers(s), ...things(s)]);
        for (const id of held) expect(now.has(id), `${id} (seed ${seed})`).toBe(true);
        held = now;
      }
    }
  });

  it('shows the same satchel from a save and from a replay', () => {
    for (const [seed, bot] of SEASONS) {
      const states = season(seed, bot);
      const mid = states[Math.floor(states.length * 0.7)];
      const replayed = replaySeason(JSON.parse(JSON.stringify(mid)) as GameState);
      expect(replayed).not.toBeNull();
      expect(replayed ? [...papers(replayed), ...things(replayed)] : []).toEqual([...papers(mid), ...things(mid)]);
    }
  });

  it('picks something up in a season of ordinary play', () => {
    const everything = new Set<string>();
    for (const [seed, bot] of SEASONS) {
      for (const s of season(seed, bot)) things(s).forEach(id => everything.add(id));
    }
    expect(everything.size).toBeGreaterThan(0);
  });
});
