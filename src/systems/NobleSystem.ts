import { GameState, ChoiceEffects } from '../types/game';
import { getDecorumBonus } from './EstateTaskSystem';
import {
  DINNER_DECORUM_ANSWERS, DINNER_SETTLEMENT, DINNER_ABSENT_RENOWN,
  HUNT_OPENING_DECOROUS,
} from '../data/config';

/**
 * 贵族信任 is decided at three occasions, of which the Thornwall dinner is the
 * first. Each occasion asks the player to read a room; the correct answer is
 * plain in the text, and missing one of the three is survivable by design.
 */

/** How many of the dinner's three judgment points were answered 得体. */
export function getDinnerPicksCorrect(state: GameState): number {
  return Object.entries(DINNER_DECORUM_ANSWERS)
    .filter(([flag, answer]) => state.flags[flag] === answer)
    .length;
}

/**
 * The count that settles the evening. Arriving in the right coat with the right
 * gift raises the floor by one — being dressed for it is itself a kind of answer.
 */
export function getDinnerDecorum(state: GameState): number {
  const raised = getDinnerPicksCorrect(state) + getDecorumBonus(state);
  return Math.min(raised, DINNER_SETTLEMENT.length - 1);
}

export function getDinnerSettlement(decorum: number): ChoiceEffects {
  const { nobleTrust, renown } = DINNER_SETTLEMENT[decorum];
  return {
    ...(nobleTrust ? { nobleTrust } : {}),
    ...(renown ? { renown } : {}),
    flags: { dinnerPerformance: decorum },
  };
}

/**
 * The hunt's opening is the third chance. Three of the four ways to enter the
 * camp are 得体; the only failure is attending and then standing at the edge of
 * it, which reads worse than not coming, because not coming was a decision.
 * The right coat still raises the floor, exactly as at the dinner.
 */
export function isHuntOpeningDecorous(pick: unknown, state: GameState): boolean {
  return HUNT_OPENING_DECOROUS.includes(String(pick)) || getDecorumBonus(state) > 0;
}

/** Not going is also an answer, and it uses up one of the three chances. */
export function getDinnerAbsenceEffects(): ChoiceEffects {
  return {
    renown: DINNER_ABSENT_RENOWN,
    flags: { dinnerMissed: true, dinnerPerformance: 0 },
    logEntry: '棘墙庄园的晚宴你没有去。第二天庄园里没有人提起这件事。',
  };
}
