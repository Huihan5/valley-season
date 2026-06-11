import { DayPhase } from '../types/game';
import { DEMO_MAX_DAYS } from '../data/config';

export const PHASE_ORDER: DayPhase[] = ['morning', 'afternoon', 'evening'];

export const PHASE_LABELS: Record<DayPhase, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚间',
};

export const DAY_NAMES = [
  '', // 1-indexed
  '第一日', '第二日', '第三日', '第四日', '第五日',
  '第六日', '第七日', '第八日', '第九日', '第十日',
  '第十一日', '第十二日', '第十三日', '第十四日', '第十五日',
  '第十六日', '第十七日', '第十八日', '第十九日', '第二十日',
  '第二十一日', '第二十二日', '第二十三日', '第二十四日', '第二十五日',
  '第二十六日', '第二十七日', '第二十八日', '第二十九日', '第三十日',
];

export function nextPhase(day: number, phase: DayPhase): { day: number; phase: DayPhase; newDay: boolean } {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < PHASE_ORDER.length - 1) {
    return { day, phase: PHASE_ORDER[idx + 1], newDay: false };
  }
  return { day: day + 1, phase: 'morning', newDay: true };
}

export function isMarketDay(day: number): boolean {
  // Market opens Wednesday and Saturday. Day 1 = Monday (Day 3 = Wed, Day 6 = Sat, Day 10 = Wed...)
  const dayOfWeek = ((day - 1) % 7) + 1; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  return dayOfWeek === 3 || dayOfWeek === 6;
}

export function getDayOfWeek(day: number): string {
  const labels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return labels[((day - 1) % 7) + 1];
}

export function isDemoComplete(day: number): boolean {
  return day > DEMO_MAX_DAYS;
}
