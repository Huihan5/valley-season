import { GameState } from '../types/game';
import { HORSE_CARE_TRUST_AT } from '../data/config';
import DATA from '../data';

/**
 * The satchel: what the steward is carrying, besides the evidence.
 *
 * Three kinds of thing, and the 卷宗 (the clues, JournalSystem) is the third of them. The
 * other two are 文书, the papers that arrive in the ordinary course of the season, and 物品,
 * the small things people hand over or leave behind. Nothing here is state of its own:
 * whether something is in the satchel is read off flags and counters the story already
 * writes, so a loaded save, a replay and a change of language all show the same satchel
 * without being told anything. Items belong to one season, not to the browser.
 *
 * As in the journal, only what the player has is drawn. There are no totals and no empty
 * slots; not knowing what else there is to be given is part of the estate.
 */

export type InventoryTab = 'dossier' | 'papers' | 'things';

export interface InventoryItem {
  id: string;
  name: string;
  line: string;
}

interface Spec {
  id: string;
  held: (state: GameState) => boolean;
  /** A line that reads differently depending on how the player handled it. */
  variant?: (state: GameState) => string;
}

interface Text {
  name: string;
  line: string;
  variants?: Record<string, string>;
}

const PAPER_TEXT = DATA.inventory.papers as Record<string, Text>;
const THING_TEXT = DATA.inventory.things as Record<string, Text>;

/** The event, read by the player, whose own flag says it has been played to the end. */
const played = (state: GameState, event: string) => !!state.flags[`event_done_${event}`];

/** In the order a season delivers them, as the journal does. */
const PAPERS: readonly Spec[] = [
  // Signed in the opening. Skipping the opening skips the page, not the paper.
  { id: 'guarantee', held: () => true },
  { id: 'ticket', held: () => true },
  { id: 'hunt', held: s => !!s.flags.huntingSeasonStarted },
  { id: 'letter', held: s => !!s.flags.lordsLetterRead },
  // The man comes in the afternoon of the day the letter does.
  {
    id: 'broker',
    held: s => !!s.flags.brokerUnlocked
      && (s.day > DATA.events.day23.day || s.phase !== 'morning'),
  },
];

const THINGS: readonly Spec[] = [
  { id: 'ledger', held: s => played(s, 'day3_ledger') },
  { id: 'brush', held: s => Number(s.flags.horseCareCount ?? 0) >= HORSE_CARE_TRUST_AT },
  { id: 'fruit', held: s => played(s, 'day11_echo') && s.flags.petitionFairness === 'full' },
  { id: 'pencil', held: s => played(s, 'day13_echo') && !!s.flags.protectedElena },
  // Back between the leaves in both versions; what differs is what the player did about it.
  {
    id: 'sprig',
    held: s => !!s.flags.folioAnswered,
    variant: s => (s.flags.respectedElena ? 'replaced' : 'asked'),
  },
  { id: 'bark', held: s => !!s.flags.documentedStumps },
  { id: 'bottle', held: s => !!s.flags.admittedWantToStay },
  { id: 'tin', held: s => !!s.flags.stewardRescueUsed },
  { id: 'coin', held: s => !!s.flags.henkCoin },
  { id: 'purse', held: s => !!s.flags.henkPurse },
];

function read(specs: readonly Spec[], text: Record<string, Text>, state: GameState): InventoryItem[] {
  return specs
    .filter(spec => spec.held(state))
    .map(spec => {
      const entry = text[spec.id];
      // A variant is the whole line, not a tail: how two sentences join is the language's business.
      const line = spec.variant ? entry.variants?.[spec.variant(state)] : undefined;
      return { id: spec.id, name: entry.name, line: line ?? entry.line };
    });
}

export function getPapers(state: GameState): InventoryItem[] {
  return read(PAPERS, PAPER_TEXT, state);
}

export function getThings(state: GameState): InventoryItem[] {
  return read(THINGS, THING_TEXT, state);
}

/** Every id the satchel can hold, so a test can see that each one has words in both languages. */
export const PAPER_IDS: readonly string[] = PAPERS.map(spec => spec.id);
export const THING_IDS: readonly string[] = THINGS.map(spec => spec.id);
