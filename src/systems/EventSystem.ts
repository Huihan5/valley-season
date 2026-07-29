import {
  GameState, Choice, ChoiceEffects, DayPhase, EventData, EventTiming, FlagMap,
} from '../types/game';
import { canHarvest, canFellTimber } from './WeatherSystem';
import {
  getHarvestYield, getTimberYield, getYieldTierLabel,
  getTimberFelled, getTimberQuotaLeft, getForestTier,
  getForageYield, getOrchardYield, getOrchardTenantGain, getOrchardTenantTotal,
} from './ResourceSystem';
import { isMarketDay, isVigilNight, getDayOfWeek } from './TimeSystem';
import {
  marketSoldKey, getUnitsSoldToday, getCapacityLeft,
  getGrainRevenue, getTimberRevenue, getTimberUnitPrice, getSellLots,
} from './MarketSystem';
import { getEstateTaskChoices } from './EstateTaskSystem';
import {
  getDinnerDecorum, getDinnerSettlement, getDinnerAbsenceEffects, isHuntOpeningDecorous,
} from './NobleSystem';
import { getTrust } from './RelationSystem';
import { countFlagsWithPrefix, countClues, CLUE_PREFIXES } from './FlagRegistry';
import { getFragmentChoices, getLorenzChapelExtra } from './ClueSystem';
import {
  getMarketArrival, getMarketTradeResult, getMarketReturn, getMarketNoTrade,
  drawRumours, encodeRumours, rumoursFlagKey,
  isGregorAtStable,
} from './SceneSystem';
import {
  MARKET_TRANSPORT_CAP, MARKET_GRAIN_PRICE,
  OUTING_FATIGUE, MARKET_TRADE_FATIGUE,
  DINNER_DAY, PETITION_INFORMED_TRUST, ECHO_DECOROUS_AT,
  HUNT_FIRST_DAY, HUNT_LAST_DAY, LORENZ_FRAGMENT_TRUST, MARGUERITE_FRAGMENT_TRUST,
  WYNTER_PARTIAL_ACCOUNT, WYNTER_FULL_ACCOUNT, POSITION_LINE_COMPLETE,
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD, LETTER_GOOD_GULDMARK,
  ELENA_QUILTS_TRUST, MILLRIDGE_TRUST, MILLRIDGE_CASH, MILLRIDGE_TIMBER, MILLRIDGE_SPRING_SEED,
  SURVEY_FIELDS_LAST_DAY, TIMBER_SEASON_QUOTA,
  TIMBER_OVERRUN_RENOWN, TIMBER_BROKEN_PROMISE_TRUST,
  ORCHARD_FULL_YIELD_LAST_DAY, NIGHT_LEDGER_CLUE_AT,
  HORSE_CARE_TRUST_AT, OFFICE_FOLIO_AT, TIMBER_RESTRAINT_AT,
} from '../data/config';
import DATA from '../data';
import { fill } from '../utils/text';

const ui = DATA.ui;
const lines = DATA.systemLines;

/** Every label, microcopy line and log sentence an action writes lives here. */
const A = DATA.actions;

/** The scheduled events by name; the order they play in is the table below. */
const E = DATA.events;

const FIXED_EVENTS = [
  E.day1, E.day3, E.day4,
  E.day7DinnerArrival, E.day7DinnerHartmann, E.day7DinnerDeparture, E.day7DinnerReturn,
  E.day6Timothy,
  E.day8Echo, E.day10, E.day11Echo, E.day13Echo, E.day13Thierry,
  E.day12, E.day12Officer, E.day15, E.day15Stumps, E.day15Record,
  E.timberRestraint, E.officeFolio,
  E.day27Officers, E.day27StreetCorner,
  E.day18, E.day18HuntArrival,
  E.day19HuntRide,
  E.day20HuntStag, E.day20HuntOvernight, E.day20CampBanquet,
  E.day21HuntMorning, E.day21CampHarvest, E.day21HuntLorenz,
  E.day22,
  E.day23,
  E.day30Morning, E.day30Evening, E.day30Millridge,
] as unknown as EventData[];

// ── Timing ─────────────────────────────────────────────────────────────────

// 日中 sits between the morning action and the afternoon one, so it plays at the
// head of the afternoon; 入夜前 likewise at the head of the evening. Neither
// costs the phase it opens.
const TIMING_PHASE: Record<EventTiming, DayPhase> = {
  dawn: 'morning',
  midday: 'afternoon',
  dusk: 'evening',
  evening: 'evening',
};

export function eventPhase(event: EventData): DayPhase | undefined {
  return event.timing ? TIMING_PHASE[event.timing] : event.phase;
}

export function eventAdvancesPhase(event: EventData): boolean {
  if (event.timing) return event.timing === 'evening';
  return event.advancesPhase ?? false;
}

// ── Per-event post-processors ──────────────────────────────────────────────

// Day 12: 提莫西 reads the same two months the player either read on Day 3 or
// did not. Missing them is not an accusation, but it does cost standing, and it
// is what the Day 13 echo is made of.
function processDay12(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const noticed = !!(state.flags.investigatedLedger || state.flags.reportedLedger);

  const sceneText = [
    event.sceneText,
    state.flags.met_timothy ? v.met_before : v.first_meeting,
    v.body,
    noticed ? v.noticed : v.missed,
    // He asks who filed the receipts before he asks anything of the steward.
    v.receipts,
  ].filter(Boolean).join('\n\n');

  return {
    ...event,
    sceneText,
    onEnterEffects: {
      ...event.onEnterEffects,
      ...(noticed ? {} : { renown: -1 }),
      flags: {
        ...event.onEnterEffects?.flags,
        auditResult: noticed ? 'clean' : 'flagged',
        ...(noticed ? {} : { auditFlagged: true }),
      },
    },
  };
}

/**
 * Day 13: whether the office was tidied this morning. She does not know what was
 * said to the inspector, only that he never came to find her — and that is the
 * whole of it (drafts 4.16). The point she is owed is paid here, not on Day 12.
 */
function processDay13Echo(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const protectedHer = !!state.flags.protectedElena;
  const auditOpen = !!state.flags.auditFlagged;

  return {
    ...event,
    sceneText: [
      protectedHer ? v.protected : v.exposed,
      auditOpen ? v.audit_tail : '',
    ].filter(Boolean).join('\n\n'),
    onEnterEffects: {
      ...event.onEnterEffects,
      ...(protectedHer ? { relationships: { elena: 1 } } : {}),
    },
  };
}

// The ride home is where the evening is settled: three judgment points, plus
// whatever the player wore, decide 贵族信任 and standing in one stroke.
function processDinnerReturn(event: EventData, state: GameState): EventData {
  const decorum = getDinnerDecorum(state);
  return {
    ...event,
    onEnterEffects: { ...event.onEnterEffects, ...getDinnerSettlement(decorum) },
  };
}

// Day 10: whether the player can rank five families by need depends on having
// walked the fields or having talked to 玛莎. Without that, three of five is a
// guess, and the tenants can tell it was a guess (GDD 5.5, drafts 4.6).
function processDay10(event: EventData, state: GameState): EventData {
  const informed = getTrust(state, 'marta') >= PETITION_INFORMED_TRUST || !!state.flags.surveyedFields;
  const layer = event.variants?.[informed ? 'informed' : 'uninformed'] ?? '';
  const choices = (event.choices ?? []).map(choice => {
    if (choice.id !== 'repair_partial') return choice;
    return {
      ...choice,
      effects: {
        ...choice.effects,
        ...(informed ? { renown: 1, tenantTrust: 1 } : {}),
        flags: { ...choice.effects?.flags, petitionFairness: informed ? 'fair' : 'unfair' },
      },
      resultText: event.variants?.[informed ? 'partial_fair' : 'partial_unfair'],
    };
  });

  return {
    ...event,
    sceneText: [event.sceneText, layer].filter(Boolean).join('\n\n'),
    choices,
  };
}

/**
 * The three echoes. Yesterday's decision comes back the next morning as
 * something a person does — a dried fruit pressed into your hand, a laugh that
 * stops when you walk in — rather than as a number moving on a panel.
 */
function processEcho(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  let tail = '';

  if (event.id === 'day8_echo') {
    tail = Number(state.flags.dinnerPerformance ?? 0) >= ECHO_DECOROUS_AT ? v.decorous : v.graceless;
  } else if (event.id === 'day11_echo') {
    const fairness = String(state.flags.petitionFairness ?? 'unfair');
    tail = v[fairness] ?? v.unfair;
  }

  return { ...event, sceneText: [event.sceneText, tail].filter(Boolean).join('\n\n') };
}

// Day 15: having already met 蒂埃里 at the market changes what the old survey
// note means — the disputed stream stops being a line in a file and becomes the
// one he told you about.
function processForestReport(event: EventData, state: GameState): EventData {
  const layer = event.variants?.[state.flags.met_thierry ? 'met' : 'unmet'] ?? '';
  return { ...event, sceneText: [event.sceneText, layer].filter(Boolean).join('\n\n') };
}

// The site itself. Having walked the woods before Day 14 is the only way to know
// the cut is new; 蒂埃里 supplies the technical reading, the player supplies the date.
function processStumps(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const sceneText = [
    event.sceneText,
    state.flags.surveyedForest ? v.surveyed : '',
    v.road,
    state.flags.met_thierry ? v.met : v.unmet,
  ].filter(Boolean).join('\n\n');
  return { ...event, sceneText };
}

// Day 18 at the camp: 蒂埃里 introduces himself only if the market and the north
// woods were both skipped, and the four ways of entering the camp settle 贵族信任.
function processHuntOpening(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const meeting = state.flags.met_thierry ? v.thierry_met : v.thierry_unmet;

  const choices = (event.choices ?? []).map(choice => {
    const pick = choice.effects?.flags?.huntDay18Pick;
    const decorous = isHuntOpeningDecorous(pick, state);
    return {
      ...choice,
      effects: { ...choice.effects, ...(decorous ? { nobleTrust: 1 } : {}) },
      // Watching him work is how the player meets him if nothing else has.
      ...(choice.id === 'hunt18_thierry'
        ? { resultText: [choice.resultText, meeting].filter(Boolean).join('\n\n') }
        : {}),
    };
  });

  return { ...event, choices };
}

// Day 21 at the tree. Both fragments are given, not found: 洛伦茨 needs to have
// decided you are worth telling, and 玛格丽特 will only say it in her carriage.
function processHuntLorenz(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const flags: FlagMap = {};
  const parts = [event.sceneText];

  if (getTrust(state, 'lorenz') >= LORENZ_FRAGMENT_TRUST) {
    const repeat = !!state.flags.clue_mot_lorenz_question;
    parts.push(repeat ? v.lorenz_question_again : v.lorenz_question);
    if (!repeat) flags.clue_mot_lorenz_question = true;
  }

  if (state.nobleTrust >= MARGUERITE_FRAGMENT_TRUST && !state.flags.clue_nob_marguerite) {
    parts.push(v.marguerite);
    flags.clue_nob_marguerite = true;
  }

  return {
    ...event,
    sceneText: parts.filter(Boolean).join('\n\n'),
    onEnterEffects: {
      ...event.onEnterEffects,
      // GDD 5.5: the tree is one of his two action-trust occasions, and the only
      // one that carries him to 4 — where he says why he told the player anything.
      relationships: { lorenz: 1 },
      flags: { ...event.onEnterEffects?.flags, ...flags },
    },
  };
}

// Day 19 in the saddle: asking where his patrol ends pays once, and asking a
// second time gets the three places told apart.
function processHuntRide(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const asked = !!state.flags.clue_ofc_thierry_range;
  const choices = (event.choices ?? []).map(choice =>
    choice.id === 'ride_ask_range'
      ? { ...choice, resultText: asked ? v.range_again : v.range_first }
      : choice,
  );
  return { ...event, choices };
}

/**
 * Day 22. 维特 supplies no new information at any tier — he only puts what the
 * player already holds into the order things happened in. What he can say is
 * therefore a function of how much the player has been told by other people.
 */
function processWynter(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const clues = countClues(state.flags);
  const positionLine = countFlagsWithPrefix(state.flags, CLUE_PREFIXES.position);

  const parts = [event.sceneText];
  const flags: FlagMap = {};

  if (clues >= WYNTER_FULL_ACCOUNT) {
    parts.push(v.tier3);
    flags.wynterRestated = true;
    if (positionLine >= POSITION_LINE_COMPLETE) {
      parts.push(v.tier4);
      flags.wynterKnowsYouKnow = true;
    }
  } else if (clues >= WYNTER_PARTIAL_ACCOUNT) {
    // He does not repeat anything the player told him. He counts categories —
    // some about time, one about a number, one about a visit, one about a horse
    // — which is all a man who listened for half an hour can honestly give.
    const has = (prefix: string) => countFlagsWithPrefix(state.flags, prefix) > 0;
    parts.push(
      v.tier2_open,
      v.tier2_count,
      has(CLUE_PREFIXES.motive) ? v.shape_motive : '',
      has(CLUE_PREFIXES.officer) ? v.shape_officer : '',
      has(CLUE_PREFIXES.noble) ? v.shape_noble : '',
      has(CLUE_PREFIXES.position) ? v.shape_position : '',
      v.tier2_cannot,
      v.tier2_close,
    );
  } else {
    parts.push(v.tier1);
  }

  return {
    ...event,
    sceneText: parts.filter(Boolean).join('\n\n'),
    onEnterEffects: {
      ...event.onEnterEffects,
      flags: { ...event.onEnterEffects?.flags, ...flags },
    },
  };
}

/**
 * Day 23. The chancery writes about the harvest and about the guarantee running
 * out in the same letter, because both come out of the same office. That is the
 * moment the 30th stops being only a work deadline.
 */
function processDay23(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const { grain, guldmark } = state.resources;

  const tier = grain >= GRAIN_EXCELLENT_THRESHOLD && guldmark >= LETTER_GOOD_GULDMARK
    ? 'good'
    : grain >= GRAIN_RETAIN_THRESHOLD ? 'fair' : 'poor';

  const sceneText = [event.sceneText, v[tier], v.renewal, v.after, v.broker]
    .filter(Boolean)
    .join('\n\n');

  return { ...event, sceneText };
}

// Day 30 morning: 埃莱娜 airs the winter quilts on the day the contract expires.
// She has not asked anyone whether that is still worth doing.
function processDay30Morning(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const close = getTrust(state, 'elena') >= ELENA_QUILTS_TRUST;
  return {
    ...event,
    sceneText: [event.sceneText, close ? v.elena_close : v.elena_distant].filter(Boolean).join('\n\n'),
  };
}

/**
 * Day 30 evening. Either the books balance, or they are short by exactly the
 * amount one more morning two weeks ago would have covered — and then there is
 * one person left to ask.
 */
function processDay30(event: EventData, state: GameState): EventData {
  const v = event.variants ?? {};
  const short = state.resources.grain < GRAIN_RETAIN_THRESHOLD;

  const sceneText = [
    event.sceneText,
    state.flags.admittedWantToStay ? v.admitted : '',
    v.review,
    short ? v.short : v.settled,
  ].filter(Boolean).join('\n\n');

  return {
    ...event,
    sceneText,
    // The ride to 磨岭 is offered only to a steward who needs it.
    onEnterEffects: {
      ...event.onEnterEffects,
      flags: { ...event.onEnterEffects?.flags, ...(short ? { day30Short: true } : {}) },
    },
  };
}

/**
 * 磨岭 at night. What 亨克 gives depends on how far the player has actually got
 * with him; asking for more than that is the worst conversation in the game,
 * because he is not rude about it. The renown is gone either way — not for what
 * was asked, but for having gone.
 */
function processMillridge(event: EventData, state: GameState): EventData {
  const trust = getTrust(state, 'henk');
  const shortfall = Math.max(0, GRAIN_RETAIN_THRESHOLD - state.resources.grain);

  const choices = (event.choices ?? []).map(choice => {
    const needed = MILLRIDGE_TRUST[choice.id];
    if (needed === undefined) return choice;
    if (trust >= needed) {
      return { ...choice, effects: { ...choice.effects, ...millridgeGift(choice.id, shortfall) } };
    }
    // He does not refuse. He explains the account, and gives you a coin for the horse.
    return {
      ...choice,
      effects: { ...choice.effects, guldmark: 1, logEntry: lines.millridgeShortOfTrust },
      resultText: event.variants?.short_of_trust,
    };
  });

  return { ...event, choices };
}

function millridgeGift(choiceId: string, shortfall: number): ChoiceEffects {
  const flags = { tookHenkDeal: true };
  if (choiceId === 'millridge_cash') return { guldmark: MILLRIDGE_CASH, flags };
  if (choiceId === 'millridge_goods') return { grain: shortfall, timber: MILLRIDGE_TIMBER, flags };
  return {
    grain: shortfall + MILLRIDGE_SPRING_SEED,
    timber: MILLRIDGE_TIMBER,
    guldmark: MILLRIDGE_CASH,
    flags,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getFixedEvent(day: number, phase: DayPhase, state: GameState): EventData | null {
  const found = FIXED_EVENTS.find(
    (e) => e.day === day && (eventPhase(e) === phase || eventPhase(e) === undefined)
  ) ?? null;

  if (!found) return null;

  if (found.activationFlag && !state.flags[found.activationFlag]) return null;

  return process(found, state);
}

/**
 * Whether the day carries a scheduled event at all. The random window narrows on
 * such days: a day that already has something in it does not need another thing.
 */
export function hasFixedEventToday(state: GameState): boolean {
  return FIXED_EVENTS.some(
    e => e.day === state.day && (!e.activationFlag || !!state.flags[e.activationFlag])
  );
}

function process(raw: EventData, state: GameState): EventData {
  // Timing is the authority once an event declares it; phase and cost follow from it.
  const event: EventData = raw.timing
    ? { ...raw, phase: eventPhase(raw), advancesPhase: eventAdvancesPhase(raw) }
    : raw;

  if (event.id === 'day7_dinner_return') return processDinnerReturn(event, state);
  if (event.id === 'day8_echo' || event.id === 'day11_echo') return processEcho(event, state);
  if (event.id === 'day15_forest_report') return processForestReport(event, state);
  if (event.id === 'day15_stumps') return processStumps(event, state);
  if (event.id === 'day18_hunt_arrival') return processHuntOpening(event, state);
  if (event.id === 'day19_hunt_ride') return processHuntRide(event, state);
  if (event.id === 'day21_hunt_lorenz') return processHuntLorenz(event, state);
  if (event.id === 'day13_echo') return processDay13Echo(event, state);
  if (event.id === 'day10_petition') return processDay10(event, state);
  if (event.id === 'day12_audit') return processDay12(event, state);
  if (event.id === 'day22_wynter') return processWynter(event, state);
  if (event.id === 'day23_lords_letter') return processDay23(event, state);
  if (event.id === 'day30_morning') return processDay30Morning(event, state);
  if (event.id === 'day30_evening') return processDay30(event, state);
  if (event.id === 'day30_millridge') return processMillridge(event, state);
  return event;
}

/**
 * What a day charges the player for on its way out. Right now only the dinner:
 * an invitation you did not answer is answered anyway, by your absence.
 */
export function getDayEndEffects(state: GameState): ChoiceEffects | null {
  if (state.day === DINNER_DAY && !state.flags.attendedDinner && !state.flags.dinnerMissed) {
    return getDinnerAbsenceEffects();
  }
  return null;
}

/** The next beat of a chained scene, looked up by id rather than by the clock. */
export function getEventById(id: string, state: GameState): EventData | null {
  const found = FIXED_EVENTS.find(e => e.id === id);
  return found ? process(found, state) : null;
}

// Trading happens inside the afternoon at the market: each sale keeps the phase open
// until the player carts up and leaves, or fills the cart.
function getMarketAfternoonChoices(state: GameState): Choice[] {
  const { day, flags, resources } = state;
  const soldSoFar = getUnitsSoldToday(state);
  const capacityLeft = getCapacityLeft(state);
  const soldKey = marketSoldKey(day);
  const firstTradeToday = soldSoFar === 0;
  const renownBonus = !flags.marketFirstVisitDone ? 1 : 0;
  const timberPrice = getTimberUnitPrice(state);
  const choices: Choice[] = [];

  const tradeEffects = (units: number) => ({
    // 集市交易本身 +1 疲劳，每日一次，不按笔计
    fatigue: firstTradeToday ? MARKET_TRADE_FATIGUE : 0,
    ...(renownBonus ? { renown: renownBonus } : {}),
    flags: { marketFirstVisitDone: true, [soldKey]: soldSoFar + units },
  });

  for (const lot of getSellLots(resources.grain, capacityLeft)) {
    choices.push({
      id: `market_sell_grain_${lot}`,
      text: fill(A.market.sellGrain, { n: lot }),
      description: fill(A.market.sellGrainDescription, {
        revenue: getGrainRevenue(lot),
        price: MARKET_GRAIN_PRICE,
      }),
      effects: {
        grain: -lot,
        guldmark: getGrainRevenue(lot),
        ...tradeEffects(lot),
        logEntry: fill(A.market.sellGrainLog, { n: lot, revenue: getGrainRevenue(lot) }),
      },
      resultText: getMarketTradeResult('market_grain', state),
      advancesPhase: false,
    });
  }

  for (const lot of getSellLots(resources.timber, capacityLeft)) {
    choices.push({
      id: `market_sell_timber_${lot}`,
      text: fill(A.market.sellTimber, { n: lot }),
      description: fill(A.market.sellTimberDescription, {
        revenue: getTimberRevenue(state, lot),
        price: timberPrice,
      }),
      effects: {
        timber: -lot,
        guldmark: getTimberRevenue(state, lot),
        ...tradeEffects(lot),
        logEntry: fill(A.market.sellTimberLog, { n: lot, revenue: getTimberRevenue(state, lot) }),
      },
      resultText: getMarketTradeResult('market_timber', state),
      advancesPhase: false,
    });
  }

  const capacityNote = capacityLeft > 0
    ? fill(A.market.capacityLeft, { n: capacityLeft, cap: MARKET_TRANSPORT_CAP })
    : fill(A.market.capacityFull, { cap: MARKET_TRANSPORT_CAP });

  // Coming home empty is not a wasted trip: you now know what things go for.
  const sold = soldSoFar > 0;
  choices.push({
    id: 'market_finish',
    text: sold ? A.market.finishSold : A.market.finishIdle,
    description: sold
      ? fill(A.market.finishDescription, { n: soldSoFar, capacity: capacityNote })
      : undefined,
    effects: {
      nextScene: 'default',
      logEntry: sold ? A.market.finishSoldLog : A.market.finishIdleLog,
    },
    resultText: [sold ? '' : getMarketNoTrade(), getMarketReturn(sold)].filter(Boolean).join('\n\n'),
  });

  return choices;
}

export function getFreeChoices(state: GameState): Choice[] {
  const { phase, weather, fatigue, day, flags, resources } = state;
  const exhausted = fatigue >= 5;
  const inHuntSeason = !!(flags.huntingSeasonStarted && day >= HUNT_FIRST_DAY && day <= HUNT_LAST_DAY);
  const choices: Choice[] = [];

  // Market visit: spent morning traveling — afternoon is for trading at the market
  if (phase === 'afternoon' && flags.visitingMarketToday === day) {
    return getMarketAfternoonChoices(state);
  }

  // ── Morning + Afternoon shared ───────────────────────────────────────────

  if (phase === 'morning' || phase === 'afternoon') {
    // The weather penalty is already in getHarvestYield — do not charge it twice.
    const grainGain = getHarvestYield(state);
    choices.push({
      id: 'harvest',
      text: A.harvest.text,
      description: canHarvest(weather)
        ? fill(A.harvest.estimate, { tier: getYieldTierLabel(grainGain) })
        : A.harvest.rainedOut,
      effects: {
        grain: grainGain,
        fatigue: 1,
        nextScene: 'fields',
        logEntry: fill(A.harvest.log, {
          phase: phase === 'morning' ? ui.phase.morning : ui.phase.afternoon,
          n: grainGain,
        }),
      },
      resultKind: 'harvest',
      resultVars: { n: grainGain },
      disabled: exhausted,
      disabledReason: exhausted ? A.common.tooTiredRest : undefined,
    });

    const timberGain = canFellTimber(weather) ? getTimberYield(state) : 0;
    const quotaLeft = getTimberQuotaLeft(state);
    const felledAfter = getTimberFelled(state) + timberGain;
    // The allowance is a line, not a wall (GDD 5.4). Crossing it is priced up front
    // so that going over is a decision rather than an accident.
    const overruns = felledAfter > TIMBER_SEASON_QUOTA && !flags.timberOverrun;
    // Taking the wood after telling him you would not. He is in the stable; the
    // load has to go past him.
    const breaksPromise = !!flags.respectedLand;
    choices.push({
      id: 'fell_timber',
      text: A.fellTimber.text,
      description: !canFellTimber(weather)
        ? A.fellTimber.rainedOut
        : breaksPromise
          ? fill(A.fellTimber.brokePromise, {
            tier: getYieldTierLabel(timberGain), trust: TIMBER_BROKEN_PROMISE_TRUST,
          })
          : overruns
            ? fill(A.fellTimber.overruns, {
              tier: getYieldTierLabel(timberGain), renown: TIMBER_OVERRUN_RENOWN,
            })
            // Past the line the allowance stops being the useful number. Saying
            // "0 left" would read as a wall, and it is not one.
            : quotaLeft <= 0
              ? fill(A.fellTimber.pastQuota, { tier: getYieldTierLabel(timberGain) })
              : fill(A.fellTimber.withinQuota, {
                tier: getYieldTierLabel(timberGain), n: quotaLeft,
              }),
      effects: {
        timber: timberGain,
        fatigue: 1,
        ...(overruns ? { renown: TIMBER_OVERRUN_RENOWN } : {}),
        ...(breaksPromise ? { relationships: { gregor: TIMBER_BROKEN_PROMISE_TRUST } } : {}),
        nextScene: 'forest',
        flags: {
          timberFelled: felledAfter,
          ...(overruns ? { timberOverrun: true } : {}),
          // The promise is spent either way: he does not get to be disappointed twice.
          ...(breaksPromise ? { respectedLand: false, brokeLandPromise: true } : {}),
        },
        logEntry: fill(A.fellTimber.log, { n: timberGain }),
      },
      resultKind: 'fell_timber',
      resultVars: { n: timberGain, r: Math.max(0, quotaLeft - timberGain) },
      // Crossing 20 is where he stops counting and says the thing about sixty years.
      ...(felledAfter >= TIMBER_RESTRAINT_AT && !flags.timberRestraintAnswered
        ? { nextEvent: 'timber_restraint' }
        : {}),
      disabled: !canFellTimber(weather) || exhausted,
      disabledReason: !canFellTimber(weather)
        ? A.fellTimber.rainBlocked
        : exhausted ? A.common.tooTired : undefined,
    });
  }

  // ── Morning-only ─────────────────────────────────────────────────────────

  // 庄园事务: one-off preparations, taken like any other action in a working phase.
  if (phase === 'morning' || phase === 'afternoon') {
    choices.push(...getEstateTaskChoices(state));

    // 采集与果园开局即有，不需要解锁。第一幕性价比高于收割是有意的。
    const forageYield = getForageYield(state);
    choices.push({
      id: 'forage',
      text: A.forage.text,
      description: fill(A.forage.description, { n: forageYield }),
      effects: {
        guldmark: forageYield,
        fatigue: 1,
        conversationWith: 'marta',
        nextScene: 'forest',
        logEntry: fill(A.forage.log, { n: forageYield }),
      },
      resultKind: 'forage',
      resultVars: { n: forageYield },
      disabled: exhausted,
      disabledReason: exhausted ? A.common.tooTired : undefined,
    });

    const orchardYield = getOrchardYield(state);
    const orchardCapped = getOrchardTenantGain(state) === 0;
    choices.push({
      id: 'orchard',
      text: A.orchard.text,
      description: fill(A.orchard.description, { n: orchardYield })
        + (orchardCapped ? '' : A.orchard.tenantBonus)
        + (day > ORCHARD_FULL_YIELD_LAST_DAY ? A.orchard.overripe : ''),
      effects: {
        guldmark: orchardYield,
        fatigue: 1,
        tenantTrust: getOrchardTenantGain(state),
        flags: { orchardTenantGained: getOrchardTenantTotal(state) + getOrchardTenantGain(state) },
        nextScene: 'fields',
        logEntry: fill(A.orchard.log, { n: orchardYield }),
      },
      resultKind: 'orchard',
      disabled: exhausted,
      disabledReason: exhausted ? A.common.tooTired : undefined,
    });
  }

  if (phase === 'morning') {
    // v3: the office is where 埃莱娜 is. There is no separate "go and talk to her".
    // The second morning in the archive turns something up: a folio with a
    // pressed sprig in it, and a decision about whether to ask her (drafts 3.5c).
    const officeVisits = Number(flags.officeWorkCount ?? 0) + 1;
    const findsFolio = officeVisits === OFFICE_FOLIO_AT && !flags.folioAnswered;
    choices.push({
      id: 'visit_office',
      text: A.office.text,
      description: A.office.description,
      effects: {
        fatigue: 0,
        conversationWith: 'elena',
        flags: { officeWorkCount: officeVisits },
        nextScene: 'office',
        logEntry: A.office.log,
      },
      resultKind: 'office_paperwork',
      ...(findsFolio ? { nextEvent: 'office_folio' } : {}),
    });

    // 巡视是限时的一次性行动：用途只有对应的那一个事件，过期就不能再做。
    if (!flags.surveyedFields && day <= SURVEY_FIELDS_LAST_DAY) {
      choices.push({
        id: 'survey_fields',
        text: A.surveyFields.text,
        description: A.common.noYield,
        effects: {
          fatigue: 1,
          flags: { surveyedFields: true },
          nextScene: 'fields',
          logEntry: A.surveyFields.log,
        },
        resultKind: 'survey_fields',
        disabled: exhausted,
        disabledReason: exhausted ? A.common.tooTired : undefined,
      });
    }

    // Unlike the fields, this one repeats and never expires: the woods change as
    // they are cut, and going to look before deciding is the point of it. The
    // first walk is still what lets Day 15 tell a fresh stump from an old one.
    choices.push({
      id: 'survey_forest',
      text: A.surveyForest.text,
      description: A.common.noYield,
      effects: {
        fatigue: 1,
        flags: { surveyedForest: true },
        nextScene: 'forest',
        logEntry: A.surveyForest.log,
      },
      resultKind: `survey_forest_${getForestTier(state)}`,
      disabled: exhausted,
      disabledReason: exhausted ? A.common.tooTired : undefined,
    });

    if (flags.investigatedLedger && !flags.foundLedgerSource && day < 12) {
      choices.push({
        id: 'deep_investigate_ledger',
        text: A.deepLedger.text,
        description: A.deepLedger.description,
        effects: {
          fatigue: 1,
          flags: { deepInvestigatedLedger: true },
          nextScene: 'office',
          logEntry: A.deepLedger.log,
        },
        disabled: exhausted,
        disabledReason: exhausted ? A.common.tooTired : undefined,
      });
    }

    // Hunt season does not lock the market out: Day 20 is a Saturday, and giving up
    // that day's hunt to make the trip is a choice the player is allowed to make.
    if (isMarketDay(day) && !flags[`visitedMarket_day${day}`]) {
      choices.push({
        id: 'go_to_market',
        text: fill(A.market.go, { weekday: getDayOfWeek(day) }),
        description: fill(A.market.goDescription, { cap: MARKET_TRANSPORT_CAP }),
        effects: {
          fatigue: OUTING_FATIGUE,
          flags: {
            visitingMarketToday: day,
            [`visitedMarket_day${day}`]: true,
            // Drawn once, on the way in — see drawRumours.
            [rumoursFlagKey(day)]: encodeRumours(drawRumours(Math.random)),
          },
          nextScene: 'market',
          logEntry: A.market.goLog,
        },
        resultText: getMarketArrival(state),
        disabled: exhausted,
        disabledReason: exhausted ? A.market.goTooTired : undefined,
      });
    }

    // The local field rides out on Day 19, 20 and 21; the duke's party goes on
    // without them. Day 22 is back at the manor. The decision is made fresh each
    // morning, so attending the opening commits the player to nothing.
    if (inHuntSeason && day >= 19 && day <= HUNT_LAST_DAY && !flags[`huntAttendedDay${day}`]) {
      choices.push({
        id: `attend_hunt_day${day}`,
        text: A.hunt.text,
        description: fill(A.hunt.description, { n: OUTING_FATIGUE }),
        effects: {
          fatigue: OUTING_FATIGUE,
          flags: { [`huntAttendedDay${day}`]: true },
          nextScene: 'forest',
          logEntry: A.hunt.log,
        },
        disabled: exhausted,
        disabledReason: exhausted ? A.hunt.tooTired : undefined,
      });
    }
  }

  // ── Afternoon-only ───────────────────────────────────────────────────────

  if (phase === 'afternoon') {
    // 棘墙晚宴: an outing that takes the afternoon to get there and the whole
    // evening once you have. Not going is a choice too, and it costs standing.
    if (day === DINNER_DAY && !flags.attendedDinner) {
      choices.push({
        id: 'attend_dinner',
        text: A.dinner.text,
        description: A.dinner.description,
        effects: {
          flags: { attendedDinner: true },
          nextScene: 'default',
          logEntry: A.dinner.log,
        },
      });
    }

    // 北面林地: the tenant's message comes at midday, and going out to look at
    // what he could not describe costs the afternoon it interrupts.
    if (flags.forestReportReceived && !flags.visitedBoundary) {
      choices.push({
        id: 'visit_boundary',
        text: A.boundary.text,
        description: A.common.onePhase,
        effects: {
          fatigue: 1,
          flags: { visitedBoundary: true },
          nextScene: 'forest',
          logEntry: A.boundary.log,
        },
        nextEvent: 'day15_stumps',
        disabled: exhausted,
        disabledReason: exhausted ? A.common.tooTired : undefined,
      });
    }

    choices.push({
      id: 'talk_marta',
      text: A.talkMarta.text,
      description: flags.repairedAllHousing
        ? A.talkMarta.descriptionOpen
        : A.talkMarta.description,
      effects: {
        conversationWith: 'marta',
        nextScene: 'kitchen',
        logEntry: A.talkMarta.log,
      },
    });

    // He tells you where you stand and changes nothing by it. Talking to 格雷格
    // is worth exactly what he thinks talking is worth; the work is what counts.
    choices.push({
      id: 'talk_gregor',
      text: A.talkGregor.text,
      description: A.talkGregor.description,
      effects: {
        greetingFrom: 'gregor',
        nextScene: 'stable',
        logEntry: A.talkGregor.log,
      },
    });

    // v3: 谷火神殿 is no longer a place you can go. 洛伦茨 works the manor's own
    // forge-hall, which opens once he has walked you into it on Day 4. The afternoon
    // call is his working day and pays conversational trust only — the fragments
    // belong to the Thursday vigil (brief appendix 六).
    if (flags.unlockForgeChapel) {
      // He does not hand anything over on a schedule. If he has decided the player
      // is worth telling, the visit is where it happens (drafts 2.4, 2.5).
      const extra = getLorenzChapelExtra(state);
      choices.push({
        id: 'visit_lorenz',
        text: A.visitLorenz.text,
        description: A.visitLorenz.description,
        effects: {
          conversationWith: 'lorenz',
          flags: { lorenzFirstVisitDone: true, ...extra?.flags },
          nextScene: 'forge_chapel',
          logEntry: extra?.logEntry ?? A.visitLorenz.log,
        },
        ...(extra ? { resultText: extra.resultText } : {}),
      });
    }

    // ── 经纪人换货渠道 (Day 24-30, unlocked by lord's letter) ────────────
    if (flags.brokerUnlocked && day <= 30) {
      choices.push({
        id: 'broker_grain_to_gold',
        text: A.broker.grainToGold.text,
        description: resources.grain >= 6 && resources.timber >= 1
          ? A.broker.grainToGold.description
          : A.broker.grainToGold.descriptionShort,
        effects: {
          grain: -6,
          guldmark: 4,
          timber: -1,
          logEntry: A.broker.grainToGold.log,
        },
        disabled: resources.grain < 6 || resources.timber < 1,
        disabledReason: resources.grain < 6
          ? A.broker.grainToGold.shortGrain
          : A.broker.grainToGold.shortTimber,
      });

      choices.push({
        id: 'broker_timber_to_gold',
        text: A.broker.timberToGold.text,
        description: resources.timber >= 3
          ? A.broker.timberToGold.description
          : A.broker.timberToGold.descriptionShort,
        effects: {
          timber: -3,
          guldmark: 3,
          logEntry: A.broker.timberToGold.log,
        },
        disabled: resources.timber < 3,
        disabledReason: A.broker.timberToGold.shortTimber,
      });

      choices.push({
        id: 'broker_timber_to_grain',
        text: A.broker.timberToGrain.text,
        description: resources.timber >= 2 && resources.guldmark >= 1
          ? A.broker.timberToGrain.description
          : A.broker.timberToGrain.descriptionShort,
        effects: {
          timber: -2,
          grain: 7,
          guldmark: -1,
          logEntry: A.broker.timberToGrain.log,
        },
        disabled: resources.timber < 2 || resources.guldmark < 1,
        disabledReason: resources.timber < 2
          ? A.broker.timberToGrain.shortTimber
          : A.broker.timberToGrain.shortGuldmark,
      });
    }
  }

  // 格雷格 does not judge people by what they say to him (GDD 5.5). Three
  // afternoons of his work is the route that carries him to 4, where the cloth
  // bundle is. No deadline: a player who works out in the third act that they
  // should be in the stable is not too late.
  if ((phase === 'afternoon' || phase === 'evening') && isGregorAtStable(state)) {
    const cared = Number(flags.horseCareCount ?? 0) + 1;
    const earns = cared === HORSE_CARE_TRUST_AT;
    choices.push({
      id: 'help_horses',
      text: A.helpHorses.text,
      description: A.helpHorses.description,
      effects: {
        conversationWith: 'gregor',
        ...(earns ? { relationships: { gregor: 1 } } : {}),
        flags: { horseCareCount: cared },
        nextScene: 'stable',
        logEntry: A.helpHorses.log,
      },
      // The third time he takes a second brush down off the rack.
      resultKind: earns ? 'stable_help_third' : 'stable_help',
    });
  }

  // The estate's own fragments. They cost a phase like any other visit and appear
  // only when the person in question has decided the player is worth telling.
  choices.push(...getFragmentChoices(state));

  // ── Evening-only ─────────────────────────────────────────────────────────

  if (phase === 'evening') {
    // Reading the ledger at night pays off only as a habit: the third night is the
    // one where eight Octobers laid side by side say something. This is the only
    // clue in the game that needs no NPC at all.
    // Past the third night the ledger has said its piece; the player may keep
    // sitting with it, and the text says so (drafts 3.5b).
    const ledgerNights = Number(flags.nightLedgerCount ?? 0);
    const ledgerKind = Math.min(ledgerNights + 1, NIGHT_LEDGER_CLUE_AT + 1);
    choices.push({
      id: 'review_accounts',
      text: A.reviewAccounts.text,
      description: A.reviewAccounts.description,
      effects: {
        fatigue: 1,
        flags: {
          nightLedgerCount: ledgerNights + 1,
          ...(ledgerNights + 1 === NIGHT_LEDGER_CLUE_AT ? { clue_mot_handwriting: true } : {}),
        },
        nextScene: 'office',
        logEntry: A.reviewAccounts.log,
      },
      resultKind: `night_ledger_${ledgerKind}`,
    });

    // 洛伦茨 keeps vigil at the manor forge-hall on Thursdays. Any other night the
    // room is empty, so sitting there is meditation and counts for nothing with him.
    if (flags.unlockForgeChapel) {
      const vigil = isVigilNight(day);
      // The empty room gives rest; the room with him in it may give something else.
      const extra = vigil ? getLorenzChapelExtra(state) : null;
      choices.push({
        id: 'visit_chapel',
        text: vigil ? A.chapel.vigilText : A.chapel.text,
        description: vigil ? A.chapel.vigilDescription : A.chapel.description,
        effects: vigil
          ? {
            conversationWith: 'lorenz',
            ...(flags.satVigilWithLorenz ? {} : { relationships: { lorenz: 1 } }),
            flags: { satVigilWithLorenz: true, ...extra?.flags },
            nextScene: 'forge_chapel',
            logEntry: extra?.logEntry ?? A.chapel.vigilLog,
          }
          : {
            fatigue: -99,
            nextScene: 'forge_chapel',
            logEntry: A.chapel.log,
          },
        ...(extra ? { resultText: extra.resultText } : {}),
      });
    }

    choices.push({
      id: 'rest',
      text: A.rest.text,
      description: A.rest.description,
      effects: {
        fatigue: -99,
        nextScene: 'default',
        logEntry: A.rest.log,
      },
      resultKind: 'rest',
    });
  }

  return choices;
}
