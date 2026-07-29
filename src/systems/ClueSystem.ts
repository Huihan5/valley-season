import { GameState, Choice, DayPhase, NpcId } from '../types/game';
import { getTrust } from './RelationSystem';
import { countFlagsWithPrefix, CLUE_PREFIXES } from './FlagRegistry';
import actions from '../data/actions.json';
import {
  FRAGMENT_TRUST, LORENZ_FRAGMENT_TRUST, LORENZ_WHY_TRUST,
  CLUE_ESTATE_REQUIRED, CLUE_OFFICER_REQUIRED, CLUE_NOBLE_REQUIRED,
  POSITION_LINE_COMPLETE,
} from '../data/config';
import fragmentsData from '../data/dialogue/fragments.json';

/**
 * The estate's own fragments (GDD ch.9.1). Nobody searches for these and there is
 * no investigation minigame — four people decide, one tier at a time, that the
 * steward is worth telling. The player's only move is to keep showing up.
 *
 * Text lives in src/data/dialogue/fragments.json; this file holds only who says
 * what, when, and what it is worth.
 */

interface FragmentText {
  /** Player-facing action label. Absent for the two 洛伦茨 pieces, which ride the chapel visit. */
  label?: string;
  log: string;
  text: string;
}

const FRAGMENTS = fragmentsData as Record<string, FragmentText>;

export interface FragmentSpec {
  key: string;
  npc: NpcId;
  /** The clue flag this writes. The 洛伦茨 trust-4 piece writes none — it is not evidence. */
  flag?: string;
  trust: number;
  /** The piece that has to come first: his second answer corrects his first. */
  after?: string;
  phases: DayPhase[];
  scene: string;
}

/**
 * 格雷格 gives fact, correction, material — in that order, never out of it.
 * 玛莎 and 埃莱娜 each open once and then, much later, say the thing they held back.
 */
export const ESTATE_FRAGMENTS: FragmentSpec[] = [
  {
    key: 'gregor_intact', npc: 'gregor', flag: 'clue_pos_horses_intact',
    trust: FRAGMENT_TRUST.gregor_intact, phases: ['afternoon', 'evening'], scene: 'stable',
  },
  {
    key: 'gregor_returned', npc: 'gregor', flag: 'clue_pos_horse_returned',
    trust: FRAGMENT_TRUST.gregor_returned, after: 'clue_pos_horses_intact',
    phases: ['afternoon', 'evening'], scene: 'stable',
  },
  {
    key: 'gregor_condition', npc: 'gregor', flag: 'clue_pos_horse_condition',
    trust: FRAGMENT_TRUST.gregor_condition, after: 'clue_pos_horse_returned',
    phases: ['afternoon', 'evening'], scene: 'stable',
  },
  {
    key: 'marta_summer', npc: 'marta', flag: 'clue_mot_martha_summer',
    trust: FRAGMENT_TRUST.marta_summer, phases: ['afternoon', 'evening'], scene: 'kitchen',
  },
  {
    key: 'marta_lastwords', npc: 'marta', flag: 'clue_mot_martha_lastwords',
    trust: FRAGMENT_TRUST.marta_lastwords, after: 'clue_mot_martha_summer',
    phases: ['evening'], scene: 'kitchen',
  },
  {
    key: 'elena_papers', npc: 'elena', flag: 'clue_mot_elena_papers',
    trust: FRAGMENT_TRUST.elena_papers, phases: ['afternoon', 'evening'], scene: 'default',
  },
  {
    // She comes to the office on her own. The player's action is staying up, not asking.
    key: 'elena_burned', npc: 'elena', flag: 'clue_mot_elena_burned',
    trust: FRAGMENT_TRUST.elena_burned, after: 'clue_mot_elena_papers',
    phases: ['evening'], scene: 'office',
  },
];

export function getFragmentText(key: string): string {
  return FRAGMENTS[key]?.text ?? '';
}

function isAvailable(spec: FragmentSpec, state: GameState): boolean {
  if (spec.flag && state.flags[spec.flag]) return false;
  if (spec.after && !state.flags[spec.after]) return false;
  if (!spec.phases.includes(state.phase)) return false;
  return getTrust(state, spec.npc) >= spec.trust;
}

/**
 * At most one open fragment per person: their line is a sequence, and the next
 * thing they will say is the only thing they will say.
 */
export function getAvailableFragments(state: GameState): FragmentSpec[] {
  const spoken = new Set<NpcId>();
  return ESTATE_FRAGMENTS.filter(spec => {
    if (spoken.has(spec.npc) || !isAvailable(spec, state)) return false;
    spoken.add(spec.npc);
    return true;
  });
}

export function getFragmentChoices(state: GameState): Choice[] {
  return getAvailableFragments(state).map(spec => {
    const entry = FRAGMENTS[spec.key];
    return {
      id: `fragment_${spec.key}`,
      text: entry.label ?? '',
      description: actions.common.onePhase,
      effects: {
        conversationWith: spec.npc,
        flags: spec.flag ? { [spec.flag]: true } : undefined,
        nextScene: spec.scene,
        logEntry: entry.log,
      },
      resultText: entry.text,
    };
  });
}

// ── 洛伦茨 ──────────────────────────────────────────────────────────────────

/**
 * His two pieces have no action of their own: they happen because the player came
 * to the forge-hall and he was there. The question he was asked is mutually
 * exclusive with the hunt-season version — whichever fires first is the one that
 * counts (drafts 2.4). The trust-4 piece is not evidence; it is the ethics of the
 * whole clue system, and it plays once.
 */
export interface ChapelExtra {
  flags: Record<string, boolean>;
  resultText: string;
  logEntry: string;
}

export function getLorenzChapelExtra(state: GameState): ChapelExtra | null {
  const trust = getTrust(state, 'lorenz');

  if (trust >= LORENZ_FRAGMENT_TRUST && !state.flags.clue_mot_lorenz_question) {
    return {
      flags: { clue_mot_lorenz_question: true },
      resultText: FRAGMENTS.lorenz_question.text,
      logEntry: FRAGMENTS.lorenz_question.log,
    };
  }

  if (
    trust >= LORENZ_WHY_TRUST
    && state.flags.clue_mot_lorenz_question
    && !state.flags.lorenzExplainedWhy
  ) {
    return {
      flags: { lorenzExplainedWhy: true },
      resultText: FRAGMENTS.lorenz_why.text,
      logEntry: FRAGMENTS.lorenz_why.log,
    };
  }

  // He has already said it, wherever he said it. Once, and then the room goes
  // back to being a room. The line is deliberately placeless so it reads the
  // same whether the hunt or the forge-hall got there first.
  if (state.flags.clue_mot_lorenz_question && !state.flags.lorenzAcknowledgedTold) {
    return {
      flags: { lorenzAcknowledgedTold: true },
      resultText: FRAGMENTS.lorenz_already_told.text,
      logEntry: FRAGMENTS.lorenz_already_told.log,
    };
  }

  return null;
}

// ── 三组计数 (GDD ch.9.1) ───────────────────────────────────────────────────

export interface ClueGroups {
  estate: number;
  officer: number;
  noble: number;
  /** 格雷格 three plus 蒂埃里's cross-fix. The only thing 4A and 4B differ on. */
  position: number;
}

export function getClueGroups(state: GameState): ClueGroups {
  const count = (prefix: string) => countFlagsWithPrefix(state.flags, prefix);
  return {
    estate: count(CLUE_PREFIXES.position) + count(CLUE_PREFIXES.motive),
    officer: count(CLUE_PREFIXES.officer),
    noble: count(CLUE_PREFIXES.noble),
    position: count(CLUE_PREFIXES.position),
  };
}

/** All three groups at once, or none of it counts (GDD 9.1: 三组同时达标). */
export function hasAllClueGroups(state: GameState): boolean {
  const groups = getClueGroups(state);
  return groups.estate >= CLUE_ESTATE_REQUIRED
    && groups.officer >= CLUE_OFFICER_REQUIRED
    && groups.noble >= CLUE_NOBLE_REQUIRED;
}

export function isPositionLineComplete(state: GameState): boolean {
  return getClueGroups(state).position >= POSITION_LINE_COMPLETE;
}
