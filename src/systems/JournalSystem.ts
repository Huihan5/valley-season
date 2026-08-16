import { GameState, LogEntry } from '../types/game';
import { CLUE_PREFIXES } from './FlagRegistry';
import { ESTATE_FRAGMENTS } from './ClueSystem';
import DATA from '../data';

/**
 * The 卷宗 — the evidence the player is holding, handed back to them.
 *
 * Nothing in here is newly written. Every line the journal shows is the line the
 * player already read in the record when the clue arrived, harvested out of the
 * same data the event played from. A second copy of those lines would have drifted
 * the first time the author rewrote one, and nothing in the suite could have seen
 * it: `Localization.test.ts` compares zh against en, not a transcript against its
 * source.
 *
 * The journal shows what the player has and never what they lack. No totals, no
 * empty slots. Not knowing how much is left to find is the investigation (GDD ch.9).
 */

export type ClueGroupId = 'estate' | 'officer' | 'noble';

/** GDD 9.1 counts three groups, and the estate's own two lines are read as one. */
export const CLUE_GROUPS: readonly ClueGroupId[] = ['estate', 'officer', 'noble'];

const GROUP_OF_PREFIX: Record<string, ClueGroupId> = {
  [CLUE_PREFIXES.position]: 'estate',
  [CLUE_PREFIXES.motive]: 'estate',
  [CLUE_PREFIXES.officer]: 'officer',
  [CLUE_PREFIXES.noble]: 'noble',
};

function groupOf(flag: string): ClueGroupId | null {
  for (const [prefix, group] of Object.entries(GROUP_OF_PREFIX)) {
    if (flag.startsWith(prefix)) return group;
  }
  return null;
}

/**
 * Display order inside a group — roughly the order a season delivers them.
 * Neither the bundle's key order (alphabetical, so day10 sorts before day3) nor
 * the flag names would give that, so it is stated here.
 */
const CLUE_ORDER: readonly string[] = [
  // 位置线 — 格雷格 three, in the order he gives them, then 蒂埃里's cross-fix.
  'clue_pos_horses_intact',
  'clue_pos_horse_returned',
  'clue_pos_horse_condition',
  'clue_pos_locate',
  // 动机线
  'clue_mot_martha_summer',
  'clue_mot_martha_lastwords',
  'clue_mot_elena_papers',
  'clue_mot_elena_burned',
  'clue_mot_lorenz_question',
  'clue_mot_handwriting',
  // 公务员组
  'clue_ofc_timothy_person',
  'clue_ofc_timothy_nature',
  'clue_ofc_timothy_declaration',
  'clue_ofc_thierry_range',
  'clue_ofc_thierry_declaration',
  // 贵族组
  'clue_nob_marguerite',
];

// ── 采集 ────────────────────────────────────────────────────────────────────

interface LooseEffects {
  flags?: Record<string, unknown>;
  logEntry?: string;
}

interface LooseEvent {
  title?: string;
  variants?: Record<string, string>;
  onEnterEffects?: LooseEffects;
  choices?: ({ effects?: LooseEffects } | null)[] | null;
}

/**
 * Every clue flag any choice in the data writes, with the log line that choice
 * leaves behind. A flag can appear more than once: 蒂埃里's range is offered both
 * at the Day 13 market and on the Day 19 ride, and the two log different sentences.
 */
function harvestFromEvents(): Map<string, string[]> {
  const found = new Map<string, string[]>();

  const add = (flag: string, line: string | undefined) => {
    const list = found.get(flag) ?? [];
    if (line && !list.includes(line)) list.push(line);
    found.set(flag, list);
  };

  const events = [
    ...Object.values(DATA.events),
    ...Object.values(DATA.randomEvents),
  ] as unknown as LooseEvent[];

  for (const event of events) {
    const sources: (LooseEffects | undefined)[] = [
      event.onEnterEffects,
      ...(event.choices ?? []).map(choice => choice?.effects),
    ];
    for (const effects of sources) {
      for (const flag of Object.keys(effects?.flags ?? {})) {
        if (groupOf(flag)) add(flag, effects?.logEntry);
      }
    }
  }

  return found;
}

/** The eight the four residents give, whose lines live in fragments.json. */
function harvestFromFragments(): Map<string, string> {
  const fragments = DATA.dialogue.fragments as Record<string, { log: string }>;
  const found = new Map<string, string>();

  for (const spec of ESTATE_FRAGMENTS) {
    if (spec.flag) found.set(spec.flag, fragments[spec.key].log);
  }
  // 洛伦茨's question has no action of its own — it happens because the player came
  // to the forge-hall and he was there — so it is not in ESTATE_FRAGMENTS.
  found.set('clue_mot_lorenz_question', fragments.lorenz_question.log);

  return found;
}

/**
 * Two clues are written by `EventSystem` rather than by a choice in the data, so
 * the scan cannot reach them.
 */
function harvestExplicit(): Record<string, string> {
  const actions = DATA.actions as unknown as { reviewAccounts: { log: string } };
  const carriage = (DATA.events.day21HuntLorenz as unknown as LooseEvent).variants?.marguerite ?? '';

  return {
    // Lands on the third night of the ledger. The line is the one that action always
    // logs rather than one specific to that night, but it is what the player read.
    clue_mot_handwriting: actions.reviewAccounts.log,
    // Given inside the Day 21 carriage as a block of the event's own prose, with no
    // log line anywhere. Falling back to the event title would print 洛伦茨在猎场
    // over something 玛格丽特 said, so the journal takes the first paragraph of the
    // block itself.
    clue_nob_marguerite: carriage.split('\n\n')[0] ?? '',
  };
}

// ── 注册表 ──────────────────────────────────────────────────────────────────

export interface ClueSource {
  flag: string;
  group: ClueGroupId;
  /** Every line that could have delivered this clue; which one did depends on the run. */
  candidates: string[];
}

function buildRegistry(): ClueSource[] {
  const fromEvents = harvestFromEvents();
  const fromFragments = harvestFromFragments();
  const explicit = harvestExplicit();

  return CLUE_ORDER.flatMap(flag => {
    const group = groupOf(flag);
    if (!group) return [];

    const candidates = [
      ...(fromEvents.get(flag) ?? []),
      ...(fromFragments.has(flag) ? [fromFragments.get(flag) as string] : []),
      ...(explicit[flag] ? [explicit[flag]] : []),
    ].filter(Boolean);

    return [{ flag, group, candidates }];
  });
}

export const CLUE_REGISTRY: ClueSource[] = buildRegistry();

/**
 * Every clue flag the data actually writes. Exported for the test that asserts
 * CLUE_ORDER still covers all of them — a clue added later without a journal entry
 * would otherwise be invisible rather than broken.
 */
export function scanClueFlags(): string[] {
  return [...harvestFromEvents().keys()].sort();
}

// ── 呈现 ────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  flag: string;
  text: string;
}

export interface JournalGroup {
  id: ClueGroupId;
  entries: JournalEntry[];
}

/** Which of a clue's possible lines this particular run produced. */
function resolve(source: ClueSource, log: LogEntry[]): string {
  const [first] = source.candidates;
  if (source.candidates.length < 2) return first ?? '';
  const seen = source.candidates.find(line => log.some(entry => entry.text === line));
  return seen ?? first;
}

export function getJournal(state: GameState): JournalGroup[] {
  return CLUE_GROUPS.map(id => ({
    id,
    entries: CLUE_REGISTRY
      .filter(source => source.group === id && state.flags[source.flag])
      .map(source => ({ flag: source.flag, text: resolve(source, state.log) })),
  }));
}

export function hasAnyClue(state: GameState): boolean {
  return CLUE_REGISTRY.some(source => state.flags[source.flag]);
}
