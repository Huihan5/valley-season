import { GameState } from '../types/game';
import { getTrust, countTrustAtLeast } from './RelationSystem';
import { hasAllClueGroups, isPositionLineComplete } from './ClueSystem';
import {
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD,
  LORD_IMPRESSION_MARGIN_MIN, RETAIN_MARGIN,
  ENDING_TRUTH_MIN_RENOWN, ENDING3_RENOWN,
  ENDING3_DEEP_TRUST, ENDING3_DEEP_TRUST_COUNT,
  NOBLE_TRUST_ENDING3_MIN, ELENA_RITES_TRUST,
} from '../data/config';
import endingsData from '../data/endings/endings.json';

export type EndingId = 'ending1' | 'ending2' | 'ending3' | 'ending4a' | 'ending4b';

export interface EndingData {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  variants?: Record<string, string>;
}

const ENDINGS = endingsData as unknown as Record<string, EndingData>;

/**
 * 留任线 is 75, which is winter rations plus the tax with two units to spare.
 * A lord who already thinks well of the steward covers those two and no more
 * (GDD 5.6) — below 73 the estate genuinely cannot feed itself to spring.
 */
export function getRetainFloor(state: GameState): number {
  return state.lordImpression >= LORD_IMPRESSION_MARGIN_MIN
    ? GRAIN_RETAIN_THRESHOLD - RETAIN_MARGIN
    : GRAIN_RETAIN_THRESHOLD;
}

/**
 * 河谷的人: the whole valley has to have decided about the player, which is a
 * different test from having pieced 霍特曼 together. The two can both be true.
 */
export function meetsEnding3(state: GameState): boolean {
  return state.resources.renown >= ENDING3_RENOWN
    && state.nobleTrust >= NOBLE_TRUST_ENDING3_MIN
    && countTrustAtLeast(state, ENDING3_DEEP_TRUST) >= ENDING3_DEEP_TRUST_COUNT;
}

/**
 * Priority per GDD ch.10.1. The truth endings outrank 河谷的人 and ask far less
 * of the player's standing — only that it is not negative. What separates 4A from
 * 4B is the position line and nothing else: no dice, no time, no extra phase.
 */
export function determineEnding(state: GameState): EndingId {
  const { grain, renown } = state.resources;

  if (grain < getRetainFloor(state)) return 'ending1';

  const excellent = grain >= GRAIN_EXCELLENT_THRESHOLD;

  if (excellent && hasAllClueGroups(state) && renown >= ENDING_TRUTH_MIN_RENOWN) {
    return isPositionLineComplete(state) ? 'ending4b' : 'ending4a';
  }

  if (excellent && meetsEnding3(state)) return 'ending3';

  return 'ending2';
}

export function getEndingData(id: EndingId): EndingData {
  return ENDINGS[id];
}

/** 路德维希's three days. Only the endings where the player is still here get it. */
const EPILOGUE_ENDINGS: EndingId[] = ['ending3', 'ending4a', 'ending4b'];

function epilogue(id: EndingId): string[] {
  if (!EPILOGUE_ENDINGS.includes(id)) return [];
  const v = ENDINGS.epilogue.variants ?? {};
  return [ENDINGS.epilogue.text, v[id], v.close];
}

/**
 * The ending as it is actually read, assembled from the blocks the playthrough
 * earned. Nothing here decides anything — determineEnding did that — this only
 * picks which paragraphs the player has a right to see.
 */
export function composeEnding(state: GameState, id: EndingId): string {
  const ending = ENDINGS[id];
  const v = ending.variants ?? {};
  const parts: (string | undefined)[] = [ending.text];

  if (id === 'ending1') {
    // 格雷格 drives you to the station either way. Only one of you has a reason
    // to say something, and only if the roof over his horses stopped leaking.
    parts.push(state.flags.repairedStableRoof ? v.stable_repaired : v.plain);
  }

  if (id === 'ending2') {
    parts.push(state.lordImpression >= 1 ? v.lord_warm : v.lord_plain, v.tail);
  }

  if (id === 'ending3') {
    parts.push(v.letter, v.marguerite_line, v.feast);
    parts.push(state.flags.admittedWantToStay ? v.admitted : v.unadmitted);
    if (state.flags.tookHenkDeal) parts.push(v.henk);
  }

  if (id === 'ending4a') {
    parts.push(v.rites_open);
    parts.push(getTrust(state, 'elena') >= ELENA_RITES_TRUST ? v.elena_present : v.elena_absent);
    parts.push(v.rites_close, v.ludwig);
  }

  if (id === 'ending4b') {
    parts.push(v.awake);
    parts.push(state.flags.admittedWantToStay ? v.admitted : v.unadmitted);
    parts.push(v.after, v.continued, v.ludwig);
    if (state.flags.tookHenkDeal) parts.push(v.henk);
  }

  // A player who found him and was taken in by the valley gets both. The mirrored
  // 圣火节 passage for that case is not written yet — see docs/V3_PROGRESS.md.
  if ((id === 'ending4a' || id === 'ending4b') && meetsEnding3(state)) {
    parts.push(v.festival_mirror);
  }

  parts.push(...epilogue(id));
  return parts.filter(Boolean).join('\n\n');
}
