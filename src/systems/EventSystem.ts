import {
  GameState, Choice, ChoiceEffects, DayPhase, EventData, EventTiming, FlagMap,
} from '../types/game';
import { canHarvest, canFellTimber } from './WeatherSystem';
import {
  getHarvestYield, getTimberYield, getYieldTierLabel,
  getTimberFelled, getTimberQuotaLeft,
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
  SURVEY_FIELDS_LAST_DAY, SURVEY_FOREST_LAST_DAY,
  ORCHARD_FULL_YIELD_LAST_DAY, NIGHT_LEDGER_CLUE_AT,
} from '../data/config';

import day1Data from '../data/events/day1.json';
import day3Data from '../data/events/day3.json';
import day4Data from '../data/events/day4.json';
import day6Timothy from '../data/events/day6_timothy.json';
import day13Thierry from '../data/events/day13_thierry.json';
import day27Officers from '../data/events/day27_officers.json';
import day27StreetCorner from '../data/events/day27_street_corner.json';
import day7Arrival from '../data/events/day7_dinner_arrival.json';
import day7Hartmann from '../data/events/day7_dinner_hartmann.json';
import day7Departure from '../data/events/day7_dinner_departure.json';
import day7Return from '../data/events/day7_dinner_return.json';
import day8Echo from '../data/events/day8_echo.json';
import day10Data from '../data/events/day10.json';
import day11Echo from '../data/events/day11_echo.json';
import day13Echo from '../data/events/day13_echo.json';
import day12Data from '../data/events/day12.json';
import day15Data from '../data/events/day15.json';
import day15Stumps from '../data/events/day15_stumps.json';
import day15Record from '../data/events/day15_record.json';
import day18Data from '../data/events/day18.json';
import day18HuntArrival from '../data/events/day18_hunt_arrival.json';
import day19HuntRide from '../data/events/day19_hunt_ride.json';
import day20HuntStag from '../data/events/day20_hunt_stag.json';
import day20HuntOvernight from '../data/events/day20_hunt_overnight.json';
import day20CampBanquet from '../data/events/day20_camp_banquet.json';
import day21CampHarvest from '../data/events/day21_camp_harvest.json';
import day21HuntMorning from '../data/events/day21_hunt_morning.json';
import day21HuntLorenz from '../data/events/day21_hunt_lorenz.json';
import day22Wynter from '../data/events/day22.json';
import day23Data from '../data/events/day23.json';
import day30Morning from '../data/events/day30_morning.json';
import day30Evening from '../data/events/day30_evening.json';
import day30Millridge from '../data/events/day30_millridge.json';

const FIXED_EVENTS = [
  day1Data, day3Data, day4Data,
  day7Arrival, day7Hartmann, day7Departure, day7Return,
  day6Timothy,
  day8Echo, day10Data, day11Echo, day13Echo, day13Thierry,
  day12Data, day15Data, day15Stumps, day15Record,
  day27Officers, day27StreetCorner,
  day18Data, day18HuntArrival,
  day19HuntRide,
  day20HuntStag, day20HuntOvernight, day20CampBanquet,
  day21HuntMorning, day21CampHarvest, day21HuntLorenz,
  day22Wynter,
  day23Data,
  day30Morning, day30Evening, day30Millridge,
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
    v.closing,
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
    // The reordering itself is assembled from per-clue lines the drafts have
    // not written yet; until they exist he says the order is wrong and stops.
    parts.push(v.tier2_open, v.tier2_close);
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
      effects: { ...choice.effects, guldmark: 1, logEntry: '你在磨岭开了口，但你们还没到那个份上。' },
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
      text: `出售粮食 ${lot} 单位`,
      description: `${getGrainRevenue(lot)} 金卢（${MARKET_GRAIN_PRICE} 金卢/单位）`,
      effects: {
        grain: -lot,
        guldmark: getGrainRevenue(lot),
        ...tradeEffects(lot),
        logEntry: `你在集市卖出 ${lot} 单位粮食，换得 ${getGrainRevenue(lot)} 金卢。`,
      },
      resultText: getMarketTradeResult('market_grain', state),
      advancesPhase: false,
    });
  }

  for (const lot of getSellLots(resources.timber, capacityLeft)) {
    choices.push({
      id: `market_sell_timber_${lot}`,
      text: `出售木材 ${lot} 单位`,
      description: `${getTimberRevenue(state, lot)} 金卢（${timberPrice} 金卢/单位）`,
      effects: {
        timber: -lot,
        guldmark: getTimberRevenue(state, lot),
        ...tradeEffects(lot),
        logEntry: `你在集市卖出 ${lot} 单位木材，换得 ${getTimberRevenue(state, lot)} 金卢。`,
      },
      resultText: getMarketTradeResult('market_timber', state),
      advancesPhase: false,
    });
  }

  const capacityNote = capacityLeft > 0
    ? `马车还能装 ${capacityLeft} 单位（单次运力上限 ${MARKET_TRANSPORT_CAP}）`
    : `马车已装满（单次运力上限 ${MARKET_TRANSPORT_CAP}）`;

  // Coming home empty is not a wasted trip: you now know what things go for.
  const sold = soldSoFar > 0;
  choices.push({
    id: 'market_finish',
    text: sold ? '装车返程' : '什么都不做',
    description: sold ? `今日已出手 ${soldSoFar} 单位。${capacityNote}` : undefined,
    effects: {
      nextScene: 'default',
      logEntry: sold
        ? '你结清了今天的账，把空车赶回枫径。'
        : '你在集市转了一圈，没有交易。',
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
      text: '前往农田收割',
      description: canHarvest(weather)
        ? `预计收割 ${getYieldTierLabel(grainGain)}`
        : '阴雨天气，田地泥泞，收割效率极低',
      effects: {
        grain: grainGain,
        fatigue: 1,
        nextScene: 'fields',
        logEntry: `你在${phase === 'morning' ? '上午' : '下午'}收割了农田，收上来 ${grainGain} 单位。`,
      },
      resultKind: 'harvest',
      resultVars: { n: grainGain },
      disabled: exhausted,
      disabledReason: exhausted ? '你过于疲惫，需要先休息' : undefined,
    });

    const timberGain = canFellTimber(weather) ? getTimberYield(state) : 0;
    const quotaLeft = getTimberQuotaLeft(state);
    choices.push({
      id: 'fell_timber',
      text: '前往林地采伐',
      description: canFellTimber(weather)
        ? `预计采伐 ${getYieldTierLabel(timberGain)}，本季额度还剩 ${quotaLeft} 单位`
        : '阴雨天，林地工作暂停',
      effects: {
        timber: timberGain,
        fatigue: 1,
        nextScene: 'forest',
        flags: { timberFelled: getTimberFelled(state) + timberGain },
        logEntry: `你在林地采伐了 ${timberGain} 单位木材。`,
      },
      resultKind: 'fell_timber',
      resultVars: { n: timberGain, r: Math.max(0, quotaLeft - timberGain) },
      disabled: !canFellTimber(weather) || exhausted,
      disabledReason: !canFellTimber(weather) ? '雨天无法采伐' : exhausted ? '你过于疲惫' : undefined,
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
      text: '去林地采集蘑菇草药',
      description: `1 时段 · ${forageYield} 金卢 · 计一次与玛莎的交谈`,
      effects: {
        guldmark: forageYield,
        fatigue: 1,
        conversationWith: 'marta',
        nextScene: 'forest',
        logEntry: `你采了一趟，换了 ${forageYield} 金卢。`,
      },
      resultKind: 'forage',
      resultVars: { n: forageYield },
      disabled: exhausted,
      disabledReason: exhausted ? '你过于疲惫' : undefined,
    });

    const orchardYield = getOrchardYield(state);
    const orchardCapped = getOrchardTenantGain(state) === 0;
    choices.push({
      id: 'orchard',
      text: '去果园采摘',
      description: `1 时段 · ${orchardYield} 金卢${orchardCapped ? '' : ' · 佃户整体信任 +1'}`
        + (day > ORCHARD_FULL_YIELD_LAST_DAY ? '（果子过熟，收益减半）' : ''),
      effects: {
        guldmark: orchardYield,
        fatigue: 1,
        tenantTrust: getOrchardTenantGain(state),
        flags: { orchardTenantGained: getOrchardTenantTotal(state) + getOrchardTenantGain(state) },
        nextScene: 'fields',
        logEntry: `你在果园摘了一趟，换了 ${orchardYield} 金卢。`,
      },
      resultKind: 'orchard',
      disabled: exhausted,
      disabledReason: exhausted ? '你过于疲惫' : undefined,
    });
  }

  if (phase === 'morning') {
    // v3: the office is where 埃莱娜 is. There is no separate "go and talk to her".
    choices.push({
      id: 'visit_office',
      text: '处理办公室文书',
      description: '1 时段 · 计一次与埃莱娜的交谈',
      effects: {
        fatigue: 0,
        conversationWith: 'elena',
        nextScene: 'office',
        logEntry: '你在办公室处理了一上午的文书。',
      },
      resultKind: 'office_paperwork',
    });

    // 巡视是限时的一次性行动：用途只有对应的那一个事件，过期就不能再做。
    if (!flags.surveyedFields && day <= SURVEY_FIELDS_LAST_DAY) {
      choices.push({
        id: 'survey_fields',
        text: '巡视农田',
        description: '1 时段 · 无产出',
        effects: {
          fatigue: 1,
          flags: { surveyedFields: true },
          nextScene: 'fields',
          logEntry: '你把每一块地都走了一遍。',
        },
        resultKind: 'survey_fields',
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    if (!flags.surveyedForest && day <= SURVEY_FOREST_LAST_DAY) {
      choices.push({
        id: 'survey_forest',
        text: '巡视林地',
        description: '1 时段 · 无产出',
        effects: {
          fatigue: 1,
          flags: { surveyedForest: true },
          nextScene: 'forest',
          logEntry: '你在林地里走了一趟，把看见的都记下来了。',
        },
        resultKind: 'survey_forest',
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    if (flags.investigatedLedger && !flags.foundLedgerSource && day < 12) {
      choices.push({
        id: 'deep_investigate_ledger',
        text: '深查账目付款记录',
        description: '那笔规律性的"杂项维护费"——你还没查清楚是付给谁的',
        effects: {
          fatigue: 1,
          flags: { deepInvestigatedLedger: true },
          nextScene: 'office',
          logEntry: '你在账簿里追查那笔不明支出的去向。数字本身不说谎，但它们被记录的方式说了很多。',
        },
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    // Hunt season does not lock the market out: Day 20 is a Saturday, and giving up
    // that day's hunt to make the trip is a choice the player is allowed to make.
    if (isMarketDay(day) && !flags[`visitedMarket_day${day}`]) {
      choices.push({
        id: 'go_to_market',
        text: `前往集市（${getDayOfWeek(day)}）`,
        description: `往返占用上午与下午两个时段，单次运力上限 ${MARKET_TRANSPORT_CAP} 单位`,
        effects: {
          fatigue: OUTING_FATIGUE,
          flags: {
            visitingMarketToday: day,
            [`visitedMarket_day${day}`]: true,
            // Drawn once, on the way in — see drawRumours.
            [rumoursFlagKey(day)]: encodeRumours(drawRumours(Math.random)),
          },
          nextScene: 'market',
          logEntry: '你出发前往河谷城集市。',
        },
        resultText: getMarketArrival(state),
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫，无力出城' : undefined,
      });
    }

    // The local field rides out on Day 19, 20 and 21; the duke's party goes on
    // without them. Day 22 is back at the manor. The decision is made fresh each
    // morning, so attending the opening commits the player to nothing.
    if (inHuntSeason && day >= 19 && day <= HUNT_LAST_DAY && !flags[`huntAttendedDay${day}`]) {
      choices.push({
        id: `attend_hunt_day${day}`,
        text: '出席今日猎场',
        description: `2 时段 · 疲劳 +${OUTING_FATIGUE}`,
        effects: {
          fatigue: OUTING_FATIGUE,
          flags: { [`huntAttendedDay${day}`]: true },
          nextScene: 'forest',
          logEntry: '你骑马前往公国猎场，加入今日的狩猎队伍。',
        },
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫，无法出席猎场' : undefined,
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
        text: '前往棘墙庄园赴宴',
        description: '2 时段（下午与晚间）',
        effects: {
          flags: { attendedDinner: true },
          nextScene: 'default',
          logEntry: '你换了衣服，骑马去了棘墙庄园。',
        },
      });
    }

    // 北面林地: the tenant's message comes at midday, and going out to look at
    // what he could not describe costs the afternoon it interrupts.
    if (flags.forestReportReceived && !flags.visitedBoundary) {
      choices.push({
        id: 'visit_boundary',
        text: '前往北面林地查看',
        description: '1 时段',
        effects: {
          fatigue: 1,
          flags: { visitedBoundary: true },
          nextScene: 'forest',
          logEntry: '你往北面林地走了一趟。',
        },
        nextEvent: 'day15_stumps',
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    choices.push({
      id: 'talk_marta',
      text: '和玛莎聊聊',
      description: flags.repairedAllHousing
        ? '玛莎最近话比以前多了——这是信任的表现'
        : '了解庄园内部动态，玛莎知道所有事',
      effects: {
        conversationWith: 'marta',
        nextScene: 'kitchen',
        logEntry: '你和玛莎在厨房聊了一会儿。',
      },
    });

    choices.push({
      id: 'talk_gregor',
      text: '去马厩找格雷格',
      description: '他在庄园里待了三十年，但话不多',
      effects: {
        conversationWith: 'gregor',
        nextScene: 'stable',
        logEntry: '你去马厩和格雷格待了一段时间。',
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
        text: '去炉堂见洛伦茨',
        description: '1 时段 · 计一次与洛伦茨的交谈',
        effects: {
          conversationWith: 'lorenz',
          flags: { lorenzFirstVisitDone: true, ...extra?.flags },
          nextScene: 'forge_chapel',
          logEntry: extra?.logEntry ?? '你去炉堂找洛伦茨说了一会儿话。',
        },
        ...(extra ? { resultText: extra.resultText } : {}),
      });
    }

    // ── 经纪人换货渠道 (Day 24-30, unlocked by lord's letter) ────────────
    if (flags.brokerUnlocked && day <= 30) {
      choices.push({
        id: 'broker_grain_to_gold',
        text: '以粮换钱（经纪人渠道）',
        description: resources.grain >= 6 && resources.timber >= 1
          ? '消耗6粮食 + 1木材，换取4金卢（应急汇率偏低）'
          : '消耗6粮食 + 1木材，换取4金卢——当前储备不足',
        effects: {
          grain: -6,
          guldmark: 4,
          timber: -1,
          logEntry: '你通过驻地经纪人进行了应急换算，以粮食换取了金卢。包装和运费从木材里扣了一部分。',
        },
        disabled: resources.grain < 6 || resources.timber < 1,
        disabledReason: resources.grain < 6 ? '粮食不足（需要6单位）' : '木材不足（需要1单位）',
      });

      choices.push({
        id: 'broker_timber_to_gold',
        text: '以木换钱（经纪人渠道）',
        description: resources.timber >= 3
          ? '消耗3木材，换取3金卢（木材加工后折价出售）'
          : '消耗3木材，换取3金卢——当前储备不足',
        effects: {
          timber: -3,
          guldmark: 3,
          logEntry: '你通过驻地经纪人将木材折价出售。价格远不如集市，但眼下也只有这条路了。',
        },
        disabled: resources.timber < 3,
        disabledReason: '木材不足（需要3单位）',
      });

      choices.push({
        id: 'broker_timber_to_grain',
        text: '以木换粮（经纪人渠道）',
        description: resources.timber >= 2 && resources.guldmark >= 1
          ? '消耗2木材 + 1金卢，换取7粮食（邻庄调运，效率尚可）'
          : '消耗2木材 + 1金卢，换取7粮食——当前储备不足',
        effects: {
          timber: -2,
          grain: 7,
          guldmark: -1,
          logEntry: '你通过经纪人从邻庄调运了一批粮食。运费以金卢结清，木材用于抵扣部分货款。',
        },
        disabled: resources.timber < 2 || resources.guldmark < 1,
        disabledReason: resources.timber < 2 ? '木材不足（需要2单位）' : '金卢不足（需要1单位）',
      });
    }
  }

  // 格雷格 does not judge people by what they say to him (GDD 5.5). Spending an
  // afternoon on his work, once, is the second of his three trust routes and the
  // one that carries him to 4 — where the cloth bundle is. No deadline: a player
  // who works out in the third act that they should be in the stable is not too late.
  if ((phase === 'afternoon' || phase === 'evening')
    && !flags.helpedWithHorses && isGregorAtStable(state)) {
    choices.push({
      id: 'help_horses',
      text: '去马厩搭把手',
      description: '1 时段 · 无产出',
      effects: {
        relationships: { gregor: 1 },
        flags: { helpedWithHorses: true },
        nextScene: 'stable',
        logEntry: '你在马厩跟着格雷格干了半天活。',
      },
      resultKind: 'stable_help',
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
    const ledgerNights = Number(flags.nightLedgerCount ?? 0);
    choices.push({
      id: 'review_accounts',
      text: '夜间审查账目',
      description: '1 时段 · 疲劳 +1 · 无产出',
      effects: {
        fatigue: 1,
        flags: {
          nightLedgerCount: ledgerNights + 1,
          ...(ledgerNights + 1 === NIGHT_LEDGER_CLUE_AT ? { clue_mot_handwriting: true } : {}),
        },
        nextScene: 'office',
        logEntry: '你在灯下审查了账目到深夜。',
      },
      // Only the first three nights have text; past that the ledger has said its piece.
      resultKind: `night_ledger_${ledgerNights + 1}`,
    });

    // 洛伦茨 keeps vigil at the manor forge-hall on Thursdays. Any other night the
    // room is empty, so sitting there is meditation and counts for nothing with him.
    if (flags.unlockForgeChapel) {
      const vigil = isVigilNight(day);
      // The empty room gives rest; the room with him in it may give something else.
      const extra = vigil ? getLorenzChapelExtra(state) : null;
      choices.push({
        id: 'visit_chapel',
        text: vigil ? '去炉堂陪洛伦茨守夜' : '前往庄园炉堂',
        description: vigil
          ? '1 时段 · 计一次与洛伦茨的交谈'
          : '1 时段 · 疲劳归零',
        effects: vigil
          ? {
            conversationWith: 'lorenz',
            ...(flags.satVigilWithLorenz ? {} : { relationships: { lorenz: 1 } }),
            flags: { satVigilWithLorenz: true, ...extra?.flags },
            nextScene: 'forge_chapel',
            logEntry: extra?.logEntry ?? '你在炉堂陪洛伦茨守了一夜的火。',
          }
          : {
            fatigue: -99,
            nextScene: 'forge_chapel',
            logEntry: '你在庄园炉堂守火冥想了片刻。',
          },
        ...(extra ? { resultText: extra.resultText } : {}),
      });
    }

    choices.push({
      id: 'rest',
      text: '早点休息',
      description: '消除所有疲劳，明天精力充沛',
      effects: {
        fatigue: -99,
        nextScene: 'default',
        logEntry: '你早早休息了。',
      },
      resultKind: 'rest',
    });
  }

  return choices;
}
