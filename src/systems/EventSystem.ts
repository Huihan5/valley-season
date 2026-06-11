import { GameState, Choice, DayPhase } from '../types/game';
import { canHarvest, canFellTimber } from './WeatherSystem';
import { getHarvestYield, getTimberYield } from './ResourceSystem';

import day1Data from '../data/events/day1.json';
import day3Data from '../data/events/day3.json';
import day7Data from '../data/events/day7.json';
import day10Data from '../data/events/day10.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIXED_EVENTS: any[] = [day1Data, day3Data, day7Data, day10Data];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFixedEvent(day: number, phase: DayPhase): any | null {
  return FIXED_EVENTS.find(
    (e) => e.day === day && (e.phase === phase || e.phase === undefined)
  ) ?? null;
}

export function getFreeChoices(state: GameState): Choice[] {
  const { phase, weather, fatigue } = state;
  const exhausted = fatigue >= 5;
  const choices: Choice[] = [];

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
        logEntry: `你在林地采伐了木材。`,
      },
      disabled: !canFellTimber(weather) || exhausted,
      disabledReason: !canFellTimber(weather) ? '雨天无法采伐' : exhausted ? '你过于疲惫' : undefined,
    });
  }

  if (phase === 'morning') {
    choices.push({
      id: 'visit_office',
      text: '处理办公室文书',
      description: '整理账目和文件，可能发现有用信息',
      effects: {
        fatigue: 0,
        nextScene: 'office',
        logEntry: '你在办公室处理了一上午的文书。',
      },
    });
  }

  if (phase === 'afternoon') {
    choices.push({
      id: 'talk_marta',
      text: '和Marta聊聊',
      description: '了解庄园内部动态，Marta知道所有事',
      effects: {
        relationships: { marta: 0 },
        nextScene: 'kitchen',
        logEntry: '你和Marta在厨房聊了一会儿。',
      },
    });

    choices.push({
      id: 'talk_gregor',
      text: '去马厩找Gregor',
      description: '他在庄园里待了三十年，但话不多',
      effects: {
        relationships: { gregor: 0 },
        nextScene: 'stable',
        logEntry: '你去马厩和Gregor待了一段时间。',
      },
    });
  }

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

    choices.push({
      id: 'visit_chapel',
      text: '前往庄园炉堂',
      description: state.fatigue >= 3
        ? '守火冥想，恢复精力（疲劳归零）'
        : '守火冥想，但你现在还不觉得需要',
      effects: {
        fatigue: state.fatigue >= 3 ? -99 : 0, // -99 will be treated as reset
        nextScene: 'forge_chapel',
        logEntry: '你在庄园炉堂守火冥想了片刻。',
      },
    });

    choices.push({
      id: 'rest',
      text: '早点休息',
      description: '消除所有疲劳，明天精力充沛',
      effects: {
        fatigue: -99, // sentinel: reset to 0
        nextScene: 'default',
        logEntry: '你早早休息了。',
      },
    });
  }

  return choices;
}
