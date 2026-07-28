import { GameState, Choice, ChoiceEffects, DayPhase, EventData, EventTiming } from '../types/game';
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
import { getDinnerDecorum, getDinnerSettlement, getDinnerAbsenceEffects } from './NobleSystem';
import { getTrust } from './RelationSystem';
import {
  MARKET_TRANSPORT_CAP, MARKET_GRAIN_PRICE,
  OUTING_FATIGUE, MARKET_TRADE_FATIGUE,
  DINNER_DAY, PETITION_INFORMED_TRUST, ECHO_DECOROUS_AT,
  SURVEY_FIELDS_LAST_DAY, SURVEY_FOREST_LAST_DAY,
  ORCHARD_FULL_YIELD_LAST_DAY, NIGHT_LEDGER_CLUE_AT,
} from '../data/config';

import day1Data from '../data/events/day1.json';
import day3Data from '../data/events/day3.json';
import day4Data from '../data/events/day4.json';
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
import day18Data from '../data/events/day18.json';
import day18HuntArrival from '../data/events/day18_hunt_arrival.json';
import day19HuntRide from '../data/events/day19_hunt_ride.json';
import day20HuntStag from '../data/events/day20_hunt_stag.json';
import day20HuntOvernight from '../data/events/day20_hunt_overnight.json';
import day21HuntMorning from '../data/events/day21_hunt_morning.json';
import day21HuntLorenz from '../data/events/day21_hunt_lorenz.json';
import day22HuntTraveler from '../data/events/day22_hunt_traveler.json';
import day22TravelerEstate from '../data/events/day22_traveler_estate.json';
import day23Data from '../data/events/day23.json';
import day30Morning from '../data/events/day30_morning.json';
import day30Evening from '../data/events/day30_evening.json';

const FIXED_EVENTS = [
  day1Data, day3Data, day4Data,
  day7Arrival, day7Hartmann, day7Departure, day7Return,
  day8Echo, day10Data, day11Echo, day13Echo,
  day12Data, day15Data,
  day18Data, day18HuntArrival,
  day19HuntRide,
  day20HuntStag, day20HuntOvernight,
  day21HuntMorning, day21HuntLorenz,
  day22HuntTraveler, day22TravelerEstate,
  day23Data,
  day30Morning, day30Evening,
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

// Day 22 evening: show full estate encounter if player missed hunt,
// or a brief follow-up if they already met the traveler at the hunt.
function processDay22Estate(event: EventData, state: GameState): EventData {
  if (!state.flags.huntAttendedDay22) return event;

  return {
    ...event,
    title: '猎场归来',
    sceneText: '你从猎场回来，脑子里还在想那个自称学者的人。进厨房拿水时，玛莎看了你一眼："你今天遇到了什么？脸色不太对。"',
    choices: [
      {
        id: 'tell_marta_traveler',
        text: '跟玛莎说说那个旅人',
        description: '把疑虑说出来，听听她的看法',
        effects: {
          relationships: { marta: 1 },
          logEntry: '玛莎听完后沉默了一会儿，说："霍特曼也问过我关于林地的事，就在他走之前。"',
        },
      },
      {
        id: 'keep_quiet_traveler',
        text: '什么都不说',
        description: '这件事还不到说的时候',
        effects: {
          logEntry: '你说今天很累，早点休息了。',
        },
      },
    ],
  };
}

// Day 23: assemble the lord's letter from conditional paragraphs.
function processDay23(event: EventData, state: GameState): EventData {
  const { grain, guldmark, timber, renown } = state.resources;

  // Three-tier thresholds (see GDD ch.5)
  const grainTier = grain < 40 ? 'low' : grain < 70 ? 'mid' : 'high';
  const guldmarkTier = guldmark < 10 ? 'low' : guldmark < 25 ? 'mid' : 'high';
  const timberTier = timber < 5 ? 'low' : timber < 13 ? 'mid' : 'high';
  const renownTier = renown <= 0 ? 'low' : renown < 6 ? 'mid' : 'high';

  const pick = (prefix: string, tier: string) =>
    event.letterParagraphs?.find(p => p.condition === `${prefix}_${tier}`)?.text ?? '';

  const body = [
    pick('grain', grainTier),
    pick('guldmark', guldmarkTier),
    pick('timber', timberTier),
    pick('renown', renownTier),
  ]
    .filter(Boolean)
    .join('\n\n');

  const assembled = [event.letterOpening, body, event.letterClosing]
    .filter(Boolean)
    .join('\n\n');

  return { ...event, sceneText: assembled };
}

// Day 30 evening: replace {resource} placeholders and add a summary sentence.
function processDay30(event: EventData, state: GameState): EventData {
  const { grain, guldmark, timber, renown } = state.resources;

  let summary = '';
  if (state.flags.travelerDialogueCorrect) {
    summary = '在所有的事务之外，你发现了某件庄园本身不知道的事——那个叫维特的学者，还有他问你的那些问题。也许这才是这三十天里最重要的部分。';
  } else if (renown >= 6) {
    summary = '三十天后，枫径庄园的名字在河谷一带多了几分分量。这不是单靠账簿能做到的。';
  } else if (grain >= 110 && guldmark >= 30) {
    summary = '账簿上的数字很好看。效率、产出、成本控制——这些你都做得不错。';
  } else {
    summary = '三十天，一个季节，一本账簿。';
  }

  const text = event.sceneText
    .replace('{grain}', String(grain))
    .replace('{guldmark}', String(guldmark))
    .replace('{timber}', String(timber))
    .replace('{renown}', String(renown))
    .replace('{summary}', summary);

  return { ...event, sceneText: text };
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
  if (event.id === 'day10_petition') return processDay10(event, state);
  if (event.id === 'day12_audit') return processDay12(event, state);
  if (event.id === 'day22_traveler_estate') return processDay22Estate(event, state);
  if (event.id === 'day23_lords_letter') return processDay23(event, state);
  if (event.id === 'day30_evening') return processDay30(event, state);
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
      description: `换得 ${getGrainRevenue(lot)} 金卢（集市价 ${MARKET_GRAIN_PRICE} 金卢/单位）`,
      effects: {
        grain: -lot,
        guldmark: getGrainRevenue(lot),
        ...tradeEffects(lot),
        logEntry: `你在集市卖出 ${lot} 单位粮食，换得 ${getGrainRevenue(lot)} 金卢。`,
      },
      advancesPhase: false,
    });
  }

  for (const lot of getSellLots(resources.timber, capacityLeft)) {
    choices.push({
      id: `market_sell_timber_${lot}`,
      text: `出售木材 ${lot} 单位`,
      description: `换得 ${getTimberRevenue(state, lot)} 金卢（集市价 ${timberPrice} 金卢/单位）`,
      effects: {
        timber: -lot,
        guldmark: getTimberRevenue(state, lot),
        ...tradeEffects(lot),
        logEntry: `你在集市卖出 ${lot} 单位木材，换得 ${getTimberRevenue(state, lot)} 金卢。`,
      },
      advancesPhase: false,
    });
  }

  const capacityNote = capacityLeft > 0
    ? `马车还能装 ${capacityLeft} 单位（单次运力上限 ${MARKET_TRANSPORT_CAP}）`
    : `马车已装满（单次运力上限 ${MARKET_TRANSPORT_CAP}）`;

  if (!flags[`marketRumours_day${day}`]) {
    choices.push({
      id: 'market_listen',
      text: '排队的时候听着',
      description: '你什么也不做，但你什么都听得见',
      effects: {
        flags: { [`marketRumours_day${day}`]: true },
        logEntry: '你在粮商摊位后面排了一会儿队。',
      },
      resultKind: 'market_rumours',
      advancesPhase: false,
    });
  }

  choices.push({
    id: 'market_finish',
    text: soldSoFar > 0 ? '装车返程' : '转一圈，不交易',
    description: soldSoFar > 0
      ? `今日已出手 ${soldSoFar} 单位。${capacityNote}`
      : '了解市场行情，或许能听到些有用的消息',
    effects: {
      logEntry: soldSoFar > 0
        ? '你结清了今天的账，把空车赶回枫径。'
        : '你在集市转了一圈，听了些闲言碎语，没有进行交易。',
    },
  });

  return choices;
}

export function getFreeChoices(state: GameState): Choice[] {
  const { phase, weather, fatigue, day, flags, resources } = state;
  const exhausted = fatigue >= 5;
  const inHuntSeason = !!(flags.huntingSeasonStarted && day >= 18 && day <= 22);
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
        conversationWith: 'lena',
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
          flags: { visitingMarketToday: day, [`visitedMarket_day${day}`]: true },
          nextScene: 'market',
          logEntry: '你出发前往河谷城集市，上午的路上有些风，但天气不算差。',
        },
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫，无力出城' : undefined,
      });
    }

    if (inHuntSeason && day >= 19 && day <= 22 && !flags[`huntAttendedDay${day}`]) {
      choices.push({
        id: `attend_hunt_day${day}`,
        text: '出席今日猎场',
        description: '往返占用上午与下午两个时段，午后将触发猎场事件',
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
      choices.push({
        id: 'visit_lorenz',
        text: '去炉堂见洛伦茨',
        description: '1 时段 · 计一次与洛伦茨的交谈',
        effects: {
          conversationWith: 'lorenz',
          flags: { lorenzFirstVisitDone: true },
          nextScene: 'forge_chapel',
          logEntry: '你去炉堂找洛伦茨说了一会儿话。',
        },
      });
    }

    // ── 经纪人换货渠道 (Day 24-30, unlocked by lord's letter) ────────────
    if (flags.lordsLetterRead && day >= 24 && day <= 30) {
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

    if (flags.documentedSymbols) {
      choices.push({
        id: 'research_symbols',
        text: '翻查庄园旧档案',
        description: '林地橡树上的符号或许在霍特曼的旧文件里有记载',
        effects: {
          fatigue: 1,
          flags: { researchedSymbols: true },
          nextScene: 'office',
          logEntry: '你在灯下翻查旧档案，寻找关于林地符号的线索。霍特曼的文件里有一页被撕去了——撕痕很整齐，像是被人有意为之。',
        },
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    // 洛伦茨 keeps vigil at the manor forge-hall on Thursdays. Any other night the
    // room is empty, so sitting there is meditation and counts for nothing with him.
    if (flags.unlockForgeChapel) {
      const vigil = isVigilNight(day);
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
            flags: { satVigilWithLorenz: true },
            nextScene: 'forge_chapel',
            logEntry: '你在炉堂陪洛伦茨守了一夜的火。',
          }
          : {
            fatigue: -99,
            nextScene: 'forge_chapel',
            logEntry: '你在庄园炉堂守火冥想了片刻。',
          },
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
