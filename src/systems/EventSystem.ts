import { GameState, Choice, DayPhase, EventData } from '../types/game';
import { canHarvest, canFellTimber } from './WeatherSystem';
import { getHarvestYield, getTimberYield } from './ResourceSystem';

import day1Data from '../data/events/day1.json';
import day3Data from '../data/events/day3.json';
import day7Data from '../data/events/day7.json';
import day10Data from '../data/events/day10.json';
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
  day1Data, day3Data, day7Data, day10Data,
  day12Data, day15Data,
  day18Data, day18HuntArrival,
  day19HuntRide,
  day20HuntStag, day20HuntOvernight,
  day21HuntMorning, day21HuntLorenz,
  day22HuntTraveler, day22TravelerEstate,
  day23Data,
  day30Morning, day30Evening,
] as unknown as EventData[];

// ── Per-event post-processors ──────────────────────────────────────────────

function processDay12(event: EventData, state: GameState): EventData {
  if (!event.choices) return event;
  const choices = event.choices.map(c => ({ ...c, effects: { ...c.effects } }));

  if (state.flags.investigatedLedger) {
    choices[0] = {
      ...choices[0],
      description: '你已整理好证据，可以从容作答。有备而来的陈述更有分量。',
      effects: { ...choices[0].effects, renown: 2 },
    };
  } else if (state.flags.reportedLedger) {
    choices[0] = {
      ...choices[0],
      description: '你已向男爵报告过异常。Kessler或许已知情——主动开口比被追问更好。',
    };
  } else if (state.flags.deferredLedger) {
    choices[0] = {
      ...choices[0],
      disabled: true,
      disabledReason: '你没有调查过这些账目，无从解释。',
    };
    choices[2] = {
      ...choices[2],
      description: '争取时间——但你没有更多可以准备的了，而Kessler对拖延很敏感。',
      effects: { ...choices[2].effects, renown: -2 },
    };
  }
  return { ...event, choices };
}

// Day 22 evening: show full estate encounter if player missed hunt,
// or a brief follow-up if they already met the traveler at the hunt.
function processDay22Estate(event: EventData, state: GameState): EventData {
  if (!state.flags.huntAttendedDay22) return event;

  return {
    ...event,
    title: '猎场归来',
    sceneText: '你从猎场回来，脑子里还在想那个自称学者的人。进厨房拿水时，Marta看了你一眼："你今天遇到了什么？脸色不太对。"',
    choices: [
      {
        id: 'tell_marta_traveler',
        text: '跟Marta说说那个旅人',
        description: '把疑虑说出来，听听她的看法',
        effects: {
          relationships: { marta: 1 },
          logEntry: 'Marta听完后沉默了一会儿，说："Hartmann也问过我关于林地的事，就在他走之前。"',
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

  // Three-tier thresholds (can be tuned in NUMBERS.md §2)
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
    summary = '在所有的事务之外，你发现了某件庄园本身不知道的事——那个叫Aldric的学者，还有他问你的那些问题。也许这才是这三十天里最重要的部分。';
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
  const raw = FIXED_EVENTS.find(
    (e) => e.day === day && (e.phase === phase || e.phase === undefined)
  ) ?? null;

  if (!raw) return null;

  if (raw.activationFlag && !state.flags[raw.activationFlag]) return null;

  if (raw.id === 'day12_audit') return processDay12(raw, state);
  if (raw.id === 'day22_traveler_estate') return processDay22Estate(raw, state);
  if (raw.id === 'day23_lords_letter') return processDay23(raw, state);
  if (raw.id === 'day30_evening') return processDay30(raw, state);
  return raw;
}

export function getFreeChoices(state: GameState): Choice[] {
  const { phase, weather, fatigue, day, flags, resources } = state;
  const exhausted = fatigue >= 5;
  const ledgerResolved = !!(flags.investigatedLedger || flags.reportedLedger || flags.deferredLedger);
  const inHuntSeason = !!(flags.huntingSeasonStarted && day >= 18 && day <= 22);
  const choices: Choice[] = [];

  // ── Morning + Afternoon shared ───────────────────────────────────────────

  if (phase === 'morning' || phase === 'afternoon') {
    const harvestYield = getHarvestYield(state);
    choices.push({
      id: 'harvest',
      text: '前往农田收割',
      description: canHarvest(weather)
        ? `预计收割 ${harvestYield} 单位粮食`
        : '阴雨天气，田地泥泞，收割效率极低',
      effects: {
        grain: canHarvest(weather) ? harvestYield : Math.max(0, harvestYield - 2),
        fatigue: 1,
        nextScene: 'fields',
        logEntry: `你在${phase === 'morning' ? '上午' : '下午'}收割了农田。`,
      },
      disabled: exhausted,
      disabledReason: exhausted ? '你过于疲惫，需要先休息' : undefined,
    });

    const timberYield = getTimberYield(state);
    choices.push({
      id: 'fell_timber',
      text: '前往林地采伐',
      description: canFellTimber(weather)
        ? `预计采伐 ${timberYield} 单位木材`
        : '阴雨天，林地工作暂停',
      effects: {
        timber: canFellTimber(weather) ? timberYield : 0,
        fatigue: 1,
        nextScene: 'forest',
        logEntry: '你在林地采伐了木材。',
      },
      disabled: !canFellTimber(weather) || exhausted,
      disabledReason: !canFellTimber(weather) ? '雨天无法采伐' : exhausted ? '你过于疲惫' : undefined,
    });
  }

  // ── Morning-only ─────────────────────────────────────────────────────────

  if (phase === 'morning') {
    choices.push({
      id: 'visit_office',
      text: '处理办公室文书',
      description: ledgerResolved
        ? '整理日常文书，处理Hartmann留下的文件堆'
        : '整理账目和文件，可能发现有用信息',
      effects: {
        fatigue: 0,
        nextScene: 'office',
        logEntry: '你在办公室处理了一上午的文书。',
      },
    });

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

    if (inHuntSeason && day >= 19 && day <= 22 && !flags[`huntAttendedDay${day}`]) {
      choices.push({
        id: `attend_hunt_day${day}`,
        text: '出席今日猎场',
        description: '疲劳消耗加倍，午后将触发猎场事件',
        effects: {
          fatigue: 2,
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
    choices.push({
      id: 'talk_marta',
      text: '和Marta聊聊',
      description: flags.repairedAllHousing
        ? 'Marta最近话比以前多了——这是信任的表现'
        : '了解庄园内部动态，Marta知道所有事',
      effects: {
        relationships: { marta: 1 },
        nextScene: 'kitchen',
        logEntry: '你和Marta在厨房聊了一会儿。',
      },
    });

    choices.push({
      id: 'talk_gregor',
      text: '去马厩找Gregor',
      description: '他在庄园里待了三十年，但话不多',
      effects: {
        relationships: { gregor: 1 },
        nextScene: 'stable',
        logEntry: '你去马厩和Gregor待了一段时间。',
      },
    });

    if (flags.metLorenzAtDinner) {
      choices.push({
        id: 'visit_lorenz',
        text: '去神殿拜访Lorenz',
        description: flags.lorenzFirstVisitDone
          ? 'Lorenz总是有时间说几句话'
          : '晚宴上他欲言又止，今天也许能说完那半句话',
        effects: {
          relationships: { lorenz: 1 },
          flags: { lorenzFirstVisitDone: true },
          nextScene: 'forge_chapel',
          logEntry: flags.lorenzFirstVisitDone
            ? 'Lorenz在神殿接待了你。你们在炉膛边又坐了一会儿。'
            : 'Lorenz在神殿接待了你。他泡了两杯茶，先喝了很长时间才开口。"Hartmann在走之前来找过我，"他说，"他烧了一些东西。我没有拦他。"',
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
    choices.push({
      id: 'review_accounts',
      text: '夜间审查账目',
      description: '油灯下细看Hartmann的记录',
      effects: {
        fatigue: 1,
        nextScene: 'office',
        logEntry: '你在灯下审查了账目到深夜。',
      },
    });

    if (flags.documentedSymbols) {
      choices.push({
        id: 'research_symbols',
        text: '翻查庄园旧档案',
        description: '林地橡树上的符号或许在Hartmann的旧文件里有记载',
        effects: {
          fatigue: 1,
          flags: { researchedSymbols: true },
          nextScene: 'office',
          logEntry: '你在灯下翻查旧档案，寻找关于林地符号的线索。Hartmann的文件里有一页被撕去了——撕痕很整齐，像是被人有意为之。',
        },
        disabled: exhausted,
        disabledReason: exhausted ? '你过于疲惫' : undefined,
      });
    }

    choices.push({
      id: 'visit_chapel',
      text: '前往庄园炉堂',
      description: state.fatigue >= 3
        ? '守火冥想，恢复精力（疲劳归零）'
        : '守火冥想，但你现在还不觉得需要',
      effects: {
        fatigue: state.fatigue >= 3 ? -99 : 0,
        nextScene: 'forge_chapel',
        logEntry: '你在庄园炉堂守火冥想了片刻。',
      },
    });

    choices.push({
      id: 'rest',
      text: '早点休息',
      description: '消除所有疲劳，明天精力充沛',
      effects: {
        fatigue: -99,
        nextScene: 'default',
        logEntry: '你早早休息了。',
      },
    });
  }

  return choices;
}
