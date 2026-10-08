import { GameState } from '../types/game';
import { getTrust, countTrustAtLeast } from './RelationSystem';
import { hasAllClueGroups, isPositionLineComplete } from './ClueSystem';
import {
  GRAIN_DISMISS_THRESHOLD, GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD,
  LORD_IMPRESSION_MARGIN_MIN, RETAIN_MARGIN, ENDING2_GULDMARK, ENDING2_TIMBER,
  ENDING3_GULDMARK, ENDING3_TIMBER, ENDING_TRUTH_GULDMARK, ENDING_TRUTH_TIMBER,
  ENDING_TRUTH_MIN_RENOWN, ENDING3_RENOWN,
  ENDING3_DEEP_TRUST, ENDING3_DEEP_TRUST_COUNT,
  NOBLE_TRUST_ENDING3_MIN, ELENA_RITES_TRUST,
} from '../data/config';
import DATA from '../data';

const endingsData = DATA.endings.endings;

export type EndingId = 'ending1' | 'ending2' | 'ending3' | 'ending4a' | 'ending4b';

/** All five, in the order the game numbers them. The gallery lists them in this order. */
export const ENDING_IDS: readonly EndingId[] = [
  'ending1', 'ending2', 'ending3', 'ending4a', 'ending4b',
];

export interface EndingData {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  variants?: Record<string, string>;
}

const ENDINGS = endingsData as unknown as Record<string, EndingData>;

/**
 * 留任线 is 75, which is winter rations plus the tax with two units to spare. It is the
 * grain line of 称职的外来者 and of nothing else; the hard line below which the season
 * ends badly whatever else is true is GRAIN_DISMISS_THRESHOLD.
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

/** Coin in the purse and wood in the pile, at or over the given lines. */
function hasStock(state: GameState, guldmark: number, timber: number): boolean {
  return state.resources.guldmark >= guldmark && state.resources.timber >= timber;
}

/**
 * 称职的外来者: the books carry the estate through the winter and there is the most
 * behind them of any ending — coin in the purse, wood in the pile. Taken on its own,
 * like 河谷的人.
 */
export function meetsEnding2(state: GameState): boolean {
  return state.resources.grain >= getRetainFloor(state)
    && hasStock(state, ENDING2_GULDMARK, ENDING2_TIMBER);
}

/**
 * Priority per GDD ch.10.1, first match wins. Below the hard grain line nothing else
 * is looked at. The truth endings come next and ask the least of the estate's books —
 * only that it was not left bare — and a middling standing; what separates 4A from 4B is
 * the position line and nothing else: no dice, no time, no extra phase. 河谷的人 comes
 * after them and asks the most standing of all. A season that earns none of the three
 * and is not competent either is a dismissal, not a lesser kind of success.
 */
export function determineEnding(state: GameState): EndingId {
  const { grain, renown } = state.resources;

  if (grain < GRAIN_DISMISS_THRESHOLD) return 'ending1';

  if (
    hasAllClueGroups(state)
    && renown >= ENDING_TRUTH_MIN_RENOWN
    && hasStock(state, ENDING_TRUTH_GULDMARK, ENDING_TRUTH_TIMBER)
  ) {
    return isPositionLineComplete(state) ? 'ending4b' : 'ending4a';
  }

  if (
    grain >= GRAIN_EXCELLENT_THRESHOLD
    && hasStock(state, ENDING3_GULDMARK, ENDING3_TIMBER)
    && meetsEnding3(state)
  ) return 'ending3';

  return meetsEnding2(state) ? 'ending2' : 'ending1';
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

  // Dismissed before the term ran out: no chancery letter, because the chancery
  // only handles expiry dates and this did not get that far. Same ending, a
  // different exit — the maples have not even turned yet.
  const opening = id === 'ending1' && state.flags.dismissedEarly ? v.early : ending.text;
  const parts: (string | undefined)[] = [opening];

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
  }

  // A player who found him and was also taken in by the valley gets that feast
  // too, mirrored: the same table, with one place at it that no one sits in.
  if ((id === 'ending4a' || id === 'ending4b') && meetsEnding3(state)) {
    parts.push(v.festival_mirror);
  }

  // The 磨岭 storeroom follows the player into every ending, saying something
  // different in each. It is never commented on.
  if (state.flags.tookHenkDeal) parts.push(v.henk);

  parts.push(...epilogue(id));
  return parts.filter(Boolean).join('\n\n');
}
