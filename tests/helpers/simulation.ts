import { Choice, GameState, NpcId, SeasonAction } from '../../src/types/game';
import { createInitialState, gameReducer } from '../../src/systems/GameEngine';
import { determineEnding, meetsEnding3, EndingId } from '../../src/systems/EndingSystem';
import { getClueGroups, hasAllClueGroups, isPositionLineComplete } from '../../src/systems/ClueSystem';
import { getFieldGrain } from '../../src/systems/ResourceSystem';
import { getTrust } from '../../src/systems/RelationSystem';
import { seededRng } from '../../src/utils/rng';
import {
  DINNER_DECORUM_ANSWERS, HUNT_OPENING_DECOROUS, TALKS_PER_TRUST_POINT, TALKS_PER_TRUST_POINT_BY_NPC,
  TALK_TRUST_CAP,
} from '../../src/data/config';

/**
 * Simulated stewards. They play the real engine one click at a time, the way
 * `GameEngine.test.ts`'s random clicker does, but with a plan: each one wants
 * something and ranks what is on screen by how much it helps. Nothing here knows
 * the rules of the endings beyond what a player could read off the screen, with
 * one exception — `millridge: 'when-failing'` asks the engine what the ending
 * would be right now, which is what a player does by reading their status bar.
 *
 * Used by the `npm run sim` report and by tests/Simulation.test.ts. The point is to
 * calibrate the ending numbers against how seasons actually go, and to catch a
 * rule change that makes an ending unreachable.
 */

export interface Plan {
  name: string;
  about: string;
  /** Brings the crop in. */
  harvest: boolean;
  /** Repairs, clears the barn, walks the land. */
  prepare: boolean;
  /** Sells grain above this at the market. */
  grainKeep: number;
  /** Sells timber above this at the market. */
  timberKeep: number;
  /** Stops felling once this many units have come out of the woods. */
  fellTo: number;
  /** Spare phases earn coin: foraging, the orchard. */
  forage: boolean;
  /** Spends the days on people: fragments, talk, vigil, ledger, the stable. */
  social: boolean;
  /** ...on every day that is a multiple of this one; 1 is every day. */
  socialEvery: number;
  /** Prefers the answers that carry evidence (and good manners). */
  truth: boolean;
  /** Goes to the hunt and answers for good manners, without chasing the evidence. */
  courtly: boolean;
  /** Passes up every piece of evidence that is offered, to stay a friend of the valley and nothing more. */
  avoidClues: boolean;
  /** The purse it will not let fall below: below this the grain it meant to keep goes to market. */
  goldFloor: number;
  /** Pays for the petition repairs when it can. */
  generous: boolean;
  /** Rides to 磨岭 on the last night. */
  millridge: 'never' | 'always' | 'when-failing';
  /** The coin it tries to end with: sells and trades toward this. */
  goldGoal: number;
}

const BASE: Plan = {
  name: '', about: '', harvest: true, prepare: true, grainKeep: 80, timberKeep: 16, fellTo: 25,
  forage: true, social: false, socialEvery: 1, truth: false, courtly: false, avoidClues: false, goldFloor: 12, generous: false, millridge: 'never',
  goldGoal: 65,
};

export const PLANS: Plan[] = [
  {
    ...BASE, name: 'idle', about: 'Rests and does the minimum; a control',
    harvest: false, prepare: false, forage: false, fellTo: 0,
  },
  {
    ...BASE, name: 'harvest-only', about: 'Brings the crop in and keeps all of it',
    prepare: true, forage: false, fellTo: 0, grainKeep: 999, timberKeep: 999,
  },
  {
    ...BASE, name: 'quota', about: 'Harvests, fells to the decree, sells the surplus, mends what it must',
  },
  {
    ...BASE, name: 'timber-rush', about: 'Fells everything it can and ignores the decree',
    fellTo: 999, timberKeep: 15,
  },
  {
    ...BASE, name: 'balanced', about: 'Mostly the estate, a day in three given to people',
    social: true, socialEvery: 3, generous: false, fellTo: 25, grainKeep: 80, timberKeep: 16,
  },
  {
    ...BASE, name: 'valley', about: 'A steward who spends the season on the people of the valley',
    social: true, courtly: true, avoidClues: true, goldFloor: 30, generous: true, fellTo: 20, grainKeep: 92,
    timberKeep: 12,
  },
  {
    ...BASE, name: 'detective', about: 'Chases every fragment and answers for the evidence',
    social: true, truth: true, generous: true, fellTo: 20, grainKeep: 64, timberKeep: 10,
    millridge: 'when-failing',
  },
  {
    ...BASE, name: 'everything', about: 'People, evidence and a full barn; rides to 磨岭 if the books are short',
    social: true, truth: true, generous: true, fellTo: 20, grainKeep: 92, timberKeep: 14,
    millridge: 'when-failing',
  },
];

// ── What the steward does next ──────────────────────────────────────────────

const lotOf = (id: string): number => Number(id.split('_').pop());
const flagOf = (s: GameState, key: string): number => Number(s.flags[key] ?? 0);

/** Higher is better; below zero means "only if there is nothing else". */
function scoreFree(p: Plan, s: GameState, c: Choice): number {
  const { id } = c;
  const { grain, guldmark: gold, timber } = s.resources;
  const standing = getFieldGrain(s);
  const felled = flagOf(s, 'timberFelled');
  const fatigue = s.fatigue;
  const fx = c.effects ?? {};

  // What can be sold without ending the season short: the crop still standing and the
  // wood still to fell count as stock too, because a steward plans for them.
  // A steward who spends the afternoons on people only reaps in the mornings.
  const reapable = Math.min(Math.floor(standing * 0.85), (30 - s.day) * (!p.social ? 2 : p.socialEvery > 1 ? 1.7 : 1) * 6);
  // The Day 10 petition costs 40 coin and 10 wood to answer in full; a steward who means to
  // answer it sells what the barn holds at the Day 6 market to be able to.
  // An empty purse is the one thing a steward cannot sit on: the grain they meant to keep
  // goes to market first, and the number on the status bar is the reason.
  const grainFloor = gold < p.goldFloor ? p.grainKeep - 25 : p.grainKeep;
  const savingForPetition = p.generous && s.day <= 9 && gold < 45;
  const sellableGrain = savingForPetition
    ? grain
    : Math.min(grain, grain + reapable - grainFloor);
  // Nobody sells the last of the wood: the number goes red on the status bar well before that.
  const woodFloor = Math.max(p.timberKeep, 6);
  const sellableTimber = Math.min(timber, timber + Math.max(0, p.fellTo - felled) - woodFloor);

  // Talking to someone stops paying once the talk layer is full, so a steward who
  // knows that goes and does something else with the hour.
  const talksLeft = (npc: NpcId): boolean => {
    const per = TALKS_PER_TRUST_POINT_BY_NPC[npc] ?? TALKS_PER_TRUST_POINT;
    return (s.conversations[npc] ?? 0) < per * TALK_TRUST_CAP;
  };
  const woodLow = timber < p.timberKeep + 4 && felled < p.fellTo && !s.flags.respectedLand;
  const broke = gold < 5 && grain < 10 && s.day < 28;

  // Which days are given to people at all.
  const social = p.social && s.day % p.socialEvery === 0;

  let score = 5; // anything not listed below: a filler, better than nothing

  if (id.startsWith('fragment_')) score = p.social ? 95 : -1;
  else if (id === 'task_repair_tools') score = p.prepare && gold >= 19 ? 92 : -1;
  else if (id === 'task_clear_storage') score = p.prepare && gold >= 14 ? 90 : -1;
  else if (id === 'task_tenant_meeting') score = p.prepare ? 86 : -1;
  else if (id === 'task_survey_forest') score = p.prepare && p.fellTo > 0 ? 88 : -1;
  else if (id === 'task_survey_fields') score = p.prepare && s.day <= 9 ? 60 : -1;
  else if (id === 'task_repair_stable') score = social && gold >= 30 && timber >= 3 ? 85 : -1;
  else if (id === 'task_attire') score = social && gold >= 35 && s.day <= 6 ? 84 : -1;
  else if (id.startsWith('task_gift')) score = social && gold >= 30 ? 50 : -1;
  else if (id === 'harvest') {
    score = p.harvest && standing > 0
      ? (p.social && s.phase === 'morning' && grain < p.grainKeep + 15 ? 89 : 70)
      : -1;
  }
  else if (id === 'fell_timber') {
    score = felled < p.fellTo && !s.flags.respectedLand
      ? (p.fellTo > 100 ? 75 : woodLow ? (p.social && s.phase === 'morning' ? 90 : 72) : 55)
      : -1;
  } else if (id === 'forage') score = p.forage ? (broke ? 82 : 40) : -1;
  else if (id === 'orchard') score = p.forage ? (broke ? 83 : s.day <= 15 ? 45 : 30) : -1;
  else if (id === 'visit_office') score = social ? 38 : 8;
  else if (id === 'talk_marta') score = social && talksLeft('marta') ? 79 : social ? 20 : 6;
  else if (id === 'visit_lorenz') score = social && talksLeft('lorenz') ? 78 : social ? 20 : 6;
  else if (id === 'talk_gregor') score = social ? 30 : 6;
  else if (id === 'help_horses') score = social && talksLeft('gregor') ? 80 : social ? 15 : 6;
  else if (id === 'visit_boundary') score = social ? 85 : -1;
  else if (id === 'attend_dinner_gift') score = social && gold >= 25 ? 86 : -1;
  else if (id === 'attend_dinner') score = social ? 80 : -1;
  else if (id.startsWith('attend_hunt_day')) score = p.truth || p.courtly ? 93 : -1;
  else if (id === 'review_accounts') score = social && flagOf(s, 'nightLedgerCount') < 3 ? 66 : 10;
  else if (id === 'visit_chapel') score = social && fx.conversationWith === 'lorenz' ? 70 : 12;
  else if (id === 'rest') score = fatigue >= 3 ? 90 : 20;
  else if (id === 'go_to_market') {
    // Worth two phases if there is something to sell, or something to hear (the officers
    // are at the market on the Saturdays they appear).
    const stock = Math.max(0, sellableGrain) + Math.max(0, sellableTimber) * 2;
    score = (gold < 8 || savingForPetition) && stock >= 8 ? 96
      : p.truth || (stock >= 12 && (gold < 40 || s.day >= 27)) || (s.day === 27 && stock > 0) ? 74 : -1;
  } else if (id.startsWith('market_sell_grain_')) {
    score = lotOf(id) <= sellableGrain ? 100 + lotOf(id) : -1;
  } else if (id.startsWith('market_sell_timber_')) {
    score = lotOf(id) <= sellableTimber ? 100 + lotOf(id) : -1;
  } else if (id === 'market_finish') score = 10;
  else if (id === 'broker_grain_to_gold') {
    // Whatever the plan, a number gone red on the status bar gets fixed while there is time.
    score = gold < 16 && grain - 6 >= grainFloor ? 61
      : gold < p.goldGoal && grain - 6 >= p.grainKeep ? 46 : -1;
  } else if (id === 'broker_timber_to_gold') {
    score = gold < p.goldGoal && timber - 3 >= p.timberKeep ? 45 : -1;
  } else if (id === 'broker_gold_to_timber') {
    score = timber < 6 && gold - 5 >= 15 ? 60
      : timber < p.timberKeep && gold - 5 >= p.goldGoal ? 44 : -1;
  } else if (id === 'broker_timber_to_grain') {
    score = grain < p.grainKeep && timber - 2 >= p.timberKeep ? 43 : -1;
  } else if (id === 'day30_ride_millridge') {
    score = p.millridge === 'always'
      || (p.millridge === 'when-failing' && determineEnding(s) === 'ending1') ? 100 : -1;
  } else if (id === 'day30_close_book') score = 5;
  else if (id.startsWith('millridge_')) {
    score = { millridge_everything: 50, millridge_cash: 40, millridge_goods: 30, millridge_nothing: 0 }[id] ?? 0;
  }

  // Worn out: take the work that does not wear, so the day is not lost.
  if (fatigue >= 4 && (fx.fatigue ?? 0) > 0) score -= 60;
  return score;
}

/** The choices inside an event: what each one does, as a player would weigh it. */
function scoreEvent(p: Plan, s: GameState, c: Choice): number {
  const fx = c.effects ?? {};
  const flags = (fx.flags ?? {}) as Record<string, unknown>;
  const costWeight = p.generous ? 0.05 : 0.25;
  let score = 0;

  score -= Math.max(0, -(fx.guldmark ?? 0)) * costWeight;
  score -= Math.max(0, -(fx.timber ?? 0)) * costWeight * 3;
  score += (fx.renown ?? 0) * 3 + (fx.tenantTrust ?? 0) * 2 + (fx.nobleTrust ?? 0) * 5;
  score += (fx.lordImpression ?? 0) * 2;
  for (const delta of Object.values(fx.relationships ?? {})) score += (delta ?? 0) * 2;
  score += (fx.guldmark ?? 0) > 0 ? (fx.guldmark ?? 0) * 0.2 : 0;

  for (const [key, value] of Object.entries(flags)) {
    if (key.startsWith('clue_') && p.truth) score += 30;
    if (key.startsWith('clue_') && p.avoidClues) score -= 30;
    if (key === 'admittedWantToStay' && p.social) score += 6;
    if (key in DINNER_DECORUM_ANSWERS && (p.truth || p.courtly)) score += value === DINNER_DECORUM_ANSWERS[key] ? 20 : 0;
    if (key === 'huntDay18Pick' && (p.truth || p.courtly)) score += HUNT_OPENING_DECOROUS.includes(String(value)) ? 20 : 0;
    if (key === 'millridgeDealSigned') score += 4;
    if (key === 'clue_pos_locate' && p.truth) score += 20; // the position line, for the better ending
  }
  // Tells the player the thing they will pay for later; the ones that stop the felling.
  if (c.id === 'timber_stop') score += p.social ? 6 : -1;

  // The dinner is this afternoon and a stray errand would eat it.
  if (s.day === 7 && s.phase === 'afternoon' && p.social && fx.renown && !c.nextEvent && c.advancesPhase) score -= 10;
  if (c.id === 'ox_search' && s.day === 7 && p.social) score -= 10;

  // Choices that begin another scene tend to be the ones worth having seen.
  if (c.nextEvent) score += 1;
  return score;
}

export function nextAction(p: Plan, s: GameState, rng: () => number): SeasonAction {
  if (s.openingPage !== null) {
    return s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
  }
  if (s.pendingAdvance) return { type: 'COMMIT_ADVANCE' };
  if (s.activeEvent && s.currentChoices.length === 0) return { type: 'ADVANCE_DAY_EVENT' };

  const open = s.currentChoices.filter(c => !c.disabled);
  if (open.length === 0) throw new Error(`stuck on Day ${s.day} ${s.phase}: nothing to choose`);

  const score = s.activeEvent ? scoreEvent : scoreFree;
  let best = open[0];
  let bestScore = -Infinity;
  for (const c of open) {
    // A hair of noise so ties do not always go to the first button.
    const v = score(p, s, c) + rng() * 0.01;
    if (v > bestScore) { best = c; bestScore = v; }
  }
  return { type: 'MAKE_CHOICE', choiceId: best.id };
}

// ── A season, played out ────────────────────────────────────────────────────

export interface SeasonReport {
  plan: string;
  seed: number;
  ending: EndingId;
  grain: number;
  gold: number;
  timber: number;
  renown: number;
  nobleTrust: number;
  lordImpression: number;
  felled: number;
  trust: Record<string, number>;
  clues: { estate: number; officer: number; noble: number; position: number };
  threeGroups: boolean;
  positionLine: boolean;
  valleyTest: boolean;
  dismissedEarly: boolean;
  actions: number;
}

/**
 * Plays one whole season. `endowment` starts the steward with extra coin and wood, for the
 * one question the heuristic stewards cannot answer on their own: whether an ending whose
 * conditions are mostly about people can be reached once the purse is not the obstacle.
 */
export function playSeason(
  plan: Plan,
  seed: number,
  options: { endowment?: { guldmark?: number; timber?: number }; maxActions?: number } = {},
): SeasonReport {
  const maxActions = options.maxActions ?? 4000;
  const rng = seededRng('sim', plan.name, seed);
  let s = createInitialState(seed);
  if (options.endowment) {
    const { guldmark = 0, timber = 0 } = options.endowment;
    s = gameReducer(s, {
      type: 'LOAD_STATE',
      state: { ...s, resources: { ...s.resources, guldmark: s.resources.guldmark + guldmark, timber: s.resources.timber + timber } },
    });
  }
  let n = 0;
  while (!s.demoComplete && n < maxActions) {
    s = gameReducer(s, nextAction(plan, s, rng));
    n++;
  }
  if (!s.demoComplete) throw new Error(`${plan.name} seed ${seed}: no ending after ${maxActions} actions`);

  return {
    plan: plan.name,
    seed,
    ending: s.endingId as EndingId,
    grain: s.resources.grain,
    gold: s.resources.guldmark,
    timber: s.resources.timber,
    renown: s.resources.renown,
    nobleTrust: s.nobleTrust,
    lordImpression: s.lordImpression,
    felled: flagOf(s, 'timberFelled'),
    trust: Object.fromEntries(
      (['gregor', 'marta', 'elena', 'marguerite', 'henk', 'lorenz'] as const).map(npc => [npc, getTrust(s, npc)]),
    ),
    clues: getClueGroups(s),
    threeGroups: hasAllClueGroups(s),
    positionLine: isPositionLineComplete(s),
    valleyTest: meetsEnding3(s),
    dismissedEarly: !!s.flags.dismissedEarly,
    actions: n,
  };
}
