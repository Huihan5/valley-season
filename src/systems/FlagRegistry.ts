import { FlagMap } from '../types/game';

/**
 * Narrative flags that gate UI or branch text, declared up front so a typo in one
 * of the seventeen event files fails loudly rather than silently reading undefined.
 *
 * Flag keys stay English throughout — the player never sees them, and renaming
 * them buys nothing while risking every `requiresFlag` reference in src/data.
 */
export const INITIAL_FLAGS: FlagMap = {
  /** 炉堂 opens only after the Day 4 hearth-feeding event. Written by: Day 4 (阶段四). */
  unlockForgeChapel: false,

  /** Day 30 night visit to 磨岭 — the player accepted 亨克's gift. Written by: Day 30 evening (阶段四). */
  tookHenkDeal: false,

  /** Day 27 street corner — the player admitted they want to stay. Written by: Day 27 (阶段四). */
  admittedWantToStay: false,

  /**
   * Officer encounters are scheduled (Day 6 提莫西, Day 13 蒂埃里, Day 27 both), but the
   * player may skip the market, so these cannot be inferred from the date.
   * Written by: market day officer encounters (阶段四).
   */
  met_timothy: false,
  met_thierry: false,

  /**
   * The 磨岭 timber agreement is closed, lifting the market rate to 4 金卢/unit (GDD ch.5.4).
   * Day 7 only sets `consideringMillridgeDeal`; nothing closes the deal yet.
   * Written by: 亨克 arc (阶段四).
   */
  millridgeDealSigned: false,
};

/**
 * Investigation clue prefixes (GDD ch.9). Group totals are counted straight off the
 * prefix, so adding a fragment later needs no change to the counting logic.
 */
export const CLUE_PREFIXES = {
  position: 'clue_pos_',
  motive: 'clue_mot_',
  officer: 'clue_ofc_',
  noble: 'clue_nob_',
} as const;

export function countFlagsWithPrefix(flags: FlagMap, prefix: string): number {
  return Object.entries(flags).filter(([key, value]) => key.startsWith(prefix) && value).length;
}

/** Every fragment the player holds, across all three groups. */
export function countClues(flags: FlagMap): number {
  return Object.values(CLUE_PREFIXES)
    .reduce((total, prefix) => total + countFlagsWithPrefix(flags, prefix), 0);
}
