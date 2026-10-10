import { GameState, NpcId } from '../types/game';
import {
  MISSED_LINES_MAX, MISSED_MARKET_VISITS_FEW, HORSE_CARE_TRUST_AT, NIGHT_LEDGER_CLUE_AT,
} from '../data/config';
import { isNpcKnown } from './RelationSystem';
import { codexEntryOf } from './CodexSystem';
import { isMarketDay } from './TimeSystem';
import { seededRng } from '../utils/rng';
import DATA from '../data';

/**
 * After the ending: a few directions, each naming a person, a place or an hour this season did
 * not reach (DEVELOPMENT_PLAN 3.7). It says where to look and never what is there. Nothing is
 * stored: every rule reads the flags and counters the season already left, so a save, a replay
 * or a switch of language shows the same lines.
 *
 * A line is only offered when it is true of this run and the thing could already have been
 * reached by the day the season ended (`from`), so a steward let go in the second week is not
 * told about a hunt that had not begun.
 */

export type MissedKind = 'event' | 'person' | 'place' | 'choice';

interface MissedRule {
  id: string;
  kind: MissedKind;
  /** The first day the thing could be met. */
  from: number;
  /** Who it is about; the line opens their codex page when the player knows them. */
  npc?: NpcId;
  missed: (state: GameState) => boolean;
}

const flag = (s: GameState, key: string): boolean => !!s.flags[key];
const count = (s: GameState, key: string): number => Number(s.flags[key] ?? 0);

/** How many of the market Saturdays the steward went down to. */
function marketsVisited(s: GameState): number {
  let n = 0;
  for (let day = 1; day <= s.day; day++) if (isMarketDay(day) && flag(s, `visitedMarket_day${day}`)) n++;
  return n;
}

/**
 * Order inside a kind does not matter (the pick is seeded), and neither does the order of the
 * kinds: which three of the four are read out, and in what turn, is the season's seed too.
 * Ids are the keys of `endings/missed.json`. A 'choice' is a fork the player did take: the
 * line says the way they did not.
 */
export const MISSED_RULES: MissedRule[] = [
  // 事 — whole occasions the season could have gone to
  { id: 'dinner', kind: 'event', from: 8, missed: s => !flag(s, 'attendedDinner') },
  { id: 'hunt', kind: 'event', from: 18, missed: s => flag(s, 'huntingSeasonStarted') && !flag(s, 'huntAttendedDay18') && !flag(s, 'huntAttendedDay21') },
  { id: 'millridge', kind: 'event', from: 30, missed: s => !flag(s, 'rodeToMillridge') },
  { id: 'thierry', kind: 'event', from: 13, missed: s => !flag(s, 'met_thierry') },
  { id: 'timothy', kind: 'event', from: 12, missed: s => !flag(s, 'met_timothy') },

  // 人 — what a person was holding for someone who stayed longer or came at another hour
  { id: 'gregor_none', kind: 'person', from: 4, npc: 'gregor', missed: s => count(s, 'horseCareCount') === 0 },
  { id: 'gregor_some', kind: 'person', from: 4, npc: 'gregor', missed: s => count(s, 'horseCareCount') > 0 && count(s, 'horseCareCount') < HORSE_CARE_TRUST_AT },
  { id: 'marta_word', kind: 'person', from: 10, npc: 'marta', missed: s => !flag(s, 'clue_mot_martha_lastwords') },
  { id: 'elena_late', kind: 'person', from: 10, npc: 'elena', missed: s => !flag(s, 'clue_mot_elena_burned') },
  { id: 'lorenz_closed', kind: 'person', from: 5, missed: s => !flag(s, 'unlockForgeChapel') },
  { id: 'lorenz_never', kind: 'person', from: 5, npc: 'lorenz', missed: s => flag(s, 'unlockForgeChapel') && !flag(s, 'visitedChapelNight') },
  { id: 'lorenz_vigil', kind: 'person', from: 5, npc: 'lorenz', missed: s => flag(s, 'visitedChapelNight') && !flag(s, 'satVigilWithLorenz') },
  { id: 'marguerite_word', kind: 'person', from: 21, npc: 'marguerite', missed: s => isNpcKnown(s, 'marguerite') && !flag(s, 'clue_nob_marguerite') },
  { id: 'marguerite_unmet', kind: 'person', from: 8, missed: s => !isNpcKnown(s, 'marguerite') },
  { id: 'henk_unmet', kind: 'person', from: 8, missed: s => !isNpcKnown(s, 'henk') },

  // 地 — a room or a road at an hour the player did not go
  { id: 'ledger_none', kind: 'place', from: 3, missed: s => count(s, 'nightLedgerCount') === 0 },
  { id: 'ledger_some', kind: 'place', from: 3, missed: s => count(s, 'nightLedgerCount') > 0 && count(s, 'nightLedgerCount') < NIGHT_LEDGER_CLUE_AT },
  { id: 'boundary', kind: 'place', from: 16, missed: s => flag(s, 'forestReportReceived') && !flag(s, 'visitedBoundary') },
  { id: 'stumps', kind: 'place', from: 16, missed: s => flag(s, 'visitedBoundary') && !flag(s, 'documentedStumps') },
  { id: 'market', kind: 'place', from: 27, missed: s => marketsVisited(s) <= MISSED_MARKET_VISITS_FEW },

  // 岔 — a fork the player came to and took one way
  { id: 'ledger_followed', kind: 'choice', from: 4, missed: s => flag(s, 'investigatedLedger') },
  { id: 'ledger_reported', kind: 'choice', from: 4, missed: s => flag(s, 'reportedLedger') },
  { id: 'ledger_deferred', kind: 'choice', from: 4, missed: s => flag(s, 'deferredLedger') },
  { id: 'elena_exposed', kind: 'choice', from: 13, npc: 'elena', missed: s => flag(s, 'exposedElena') },
  { id: 'elena_shielded', kind: 'choice', from: 13, npc: 'elena', missed: s => flag(s, 'protectedElena') },
  { id: 'hunt_night_left', kind: 'choice', from: 21, npc: 'henk', missed: s => flag(s, 'huntAttendedDay20') && !flag(s, 'campOvernight') },
  { id: 'hunt_fire_other', kind: 'choice', from: 21, npc: 'henk', missed: s => flag(s, 'campOvernight') && !!s.flags.banquetAnswer },
  // the stag in the clearing (Day 20, afternoon): each of the three ways of standing, as the way the others were not
  { id: 'stag_forward', kind: 'choice', from: 20, npc: 'henk', missed: s => s.flags.stagPick === 'A' },
  { id: 'stag_asked', kind: 'choice', from: 20, npc: 'marguerite', missed: s => s.flags.stagPick === 'B' },
  { id: 'stag_still', kind: 'choice', from: 20, npc: 'henk', missed: s => s.flags.stagPick === 'C' },
];

const KINDS: MissedKind[] = ['event', 'person', 'place', 'choice'];
const TEXT = (DATA.endings.missed as unknown as { lines: Record<string, string> }).lines;

export interface MissedLine {
  id: string;
  text: string;
  /** The codex entry to open, when the line is about someone the player has met. */
  codexEntry: string | null;
}

/** Every rule that is true of this run, in no particular order. */
export function missedIds(state: GameState): string[] {
  return MISSED_RULES.filter(r => state.day >= r.from && r.missed(state)).map(r => r.id);
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Up to MISSED_LINES_MAX lines, one kind after another so the three are not all the same sort
 * of thing. The turn of the kinds and which line of each is decided by the season's seed, so
 * the same ending reads the same every time it is opened, in either language.
 */
export function getMissed(state: GameState): MissedLine[] {
  const holds = new Set(missedIds(state));
  const byKind = shuffled(KINDS, seededRng(state.seed ?? 0, 'missed', 'kinds')).map(kind => shuffled(
    MISSED_RULES.filter(r => r.kind === kind && holds.has(r.id)),
    seededRng(state.seed ?? 0, 'missed', kind),
  ));

  const picked: MissedRule[] = [];
  for (let round = 0; picked.length < MISSED_LINES_MAX; round++) {
    let any = false;
    for (const list of byKind) {
      if (round < list.length && picked.length < MISSED_LINES_MAX) { picked.push(list[round]); any = true; }
    }
    if (!any) break;
  }

  return picked.map(r => ({
    id: r.id,
    text: TEXT[r.id] ?? '',
    codexEntry: r.npc && isNpcKnown(state, r.npc) ? codexEntryOf(r.npc) : null,
  })).filter(l => l.text);
}
