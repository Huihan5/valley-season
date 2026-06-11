import { GameState, Choice, DayPhase, EventData } from '../types/game';
import { canHarvest, canFellTimber } from './WeatherSystem';
import { getHarvestYield, getTimberYield } from './ResourceSystem';

import day1Data from '../data/events/day1.json';
import day3Data from '../data/events/day3.json';
import day7Data from '../data/events/day7.json';
import day10Data from '../data/events/day10.json';
import day12Data from '../data/events/day12.json';
import day15Data from '../data/events/day15.json';

const FIXED_EVENTS = [
  day1Data, day3Data, day7Data, day10Data, day12Data, day15Data,
] as unknown as EventData[];

// Day 12: Kessler audit — choices shift based on how the player handled Day 3's ledger
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

export function getFixedEvent(day: number, phase: DayPhase, state: GameState): EventData | null {
  const raw = FIXED_EVENTS.find(
    (e) => e.day === day && (e.phase === phase || e.phase === undefined)
  ) ?? null;

  if (!raw) return null;
  if (raw.id === 'day12_audit') return processDay12(raw, state);
  return raw;
}

export function getFreeChoices(state: GameState): Choice[] {
  const { phase, weather, fatigue, day, flags } = state;
  const exhausted = fatigue >= 5;
  const ledgerResolved = !!(flags.investigatedLedger || flags.reportedLedger || flags.deferredLedger);
  const choices: Choice[] = [];

  // ── Morning + Afternoon shared actions ──────────────────────────────────

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

  // ── Morning-only actions ─────────────────────────────────────────────────

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

    // Flag unlock: deeper ledger investigation before Kessler arrives
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
  }

  // ── Afternoon-only actions ───────────────────────────────────────────────

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

    // Flag unlock: Lorenz visit after Thornwall dinner
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
  }

  // ── Evening-only actions ─────────────────────────────────────────────────

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

    // Flag unlock: archive research after forest symbols found
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
