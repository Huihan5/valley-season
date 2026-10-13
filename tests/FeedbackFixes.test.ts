import { describe, it, expect } from 'vitest';
import { FlagMap, GameState } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import { getEventById } from '../src/systems/EventSystem';
import { makeNotice, noticeKey } from '../src/systems/NoticeSystem';
import { seededRng } from '../src/utils/rng';
import { PLANS, nextAction } from './helpers/simulation';
import { composeEnding, getEndingSubtitle, getRetainFloor, meetsEnding2 } from '../src/systems/EndingSystem';
import { getEstateTaskChoices, getEstateTasks, getWinterStores } from '../src/systems/EstateTaskSystem';
import {
  ENDING2_GULDMARK, ENDING2_TIMBER, LOW_FUNDS_WARNING_AT, WINTER_LIST_FROM_DAY, DAILY_GULDMARK_COST,
} from '../src/data/config';
import zhResults from '../src/data/zh/scenes/action_results.json';
import enResults from '../src/data/en/scenes/action_results.json';
import zhEndings from '../src/data/zh/endings/endings.json';
import enEndings from '../src/data/en/endings/endings.json';
import zhLines from '../src/data/zh/system_lines.json';
import enLines from '../src/data/en/system_lines.json';
import zhUi from '../src/data/zh/ui.json';
import enUi from '../src/data/en/ui.json';
import zhDay28 from '../src/data/zh/events/day28_go_now.json';

/** A season already under way, with the flags, resources and clock the case needs. */
function at(over: Partial<GameState> = {}, flags: FlagMap = {}): GameState {
  const base = createInitialState(11);
  return { ...base, openingPage: null, activeEvent: null, ...over, flags: { ...base.flags, ...flags } };
}

describe('an event’s result is not followed by the event again', () => {
  const millridge = () => {
    const s0 = at(
      { day: 30, phase: 'evening', resources: { grain: 80, guldmark: 5, timber: 2, renown: 0 } },
      { rodeToMillridge: true },
    );
    const event = getEventById('day30_millridge', s0)!;
    return { ...s0, activeEvent: event, currentChoices: event.choices!, currentSceneText: event.sceneText };
  };

  it('shows only the result when the night’s last choice holds the advance', () => {
    const s = millridge();
    for (const choice of s.activeEvent!.choices!) {
      const after = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: choice.id });
      expect(after.pendingAdvance, choice.id).toBe(true);
      expect(after.lastResult, choice.id).toBeTruthy();
      expect(after.currentSceneText, choice.id).toBe('');
      expect(after.currentSceneText.includes('格雷格什么也没问')).toBe(false);
    }
  });

  it('still shows the place under the result of an ordinary evening action', () => {
    // A free choice in the evening, outside any event: the scene held is where the player acted.
    const plan = PLANS.find(p => p.name === 'quota')!;
    const rng = seededRng('feedback', 1);
    let s = createInitialState(3);
    for (let n = 0; n < 4000 && !(s.day >= 2 && s.phase === 'evening' && !s.activeEvent && !s.pendingAdvance
      && s.currentChoices.some(c => !c.disabled)); n++) {
      s = gameReducer(s, nextAction(plan, s, rng));
    }
    expect(s.phase).toBe('evening');
    let held = 0;
    for (const choice of s.currentChoices.filter(c => !c.disabled)) {
      const after = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: choice.id });
      if (after.pendingAdvance) {
        held++;
        expect(after.currentSceneText, choice.id).not.toBe('');
      }
    }
    expect(held).toBeGreaterThan(0);
  });
});

describe('Marta’s word about the purse', () => {
  /** The evening of day 4, the advance held, with this much in the purse. */
  const morningAfter = (guldmark: number, flags: FlagMap = {}) => {
    const s = at(
      { day: 4, phase: 'evening', pendingAdvance: true, resources: { grain: 40, guldmark, timber: 5, renown: 1 } },
      flags,
    );
    return gameReducer(s, { type: 'COMMIT_ADVANCE' });
  };

  it('is said the first morning the purse stands at the line, with where coin comes from', () => {
    const next = morningAfter(LOW_FUNDS_WARNING_AT + DAILY_GULDMARK_COST);
    expect(next.resources.guldmark).toBe(LOW_FUNDS_WARNING_AT);
    expect(next.flags.lowFundsWarned).toBe(true);
    expect(next.lastResult).toContain('灶上的钱只够这几天了');
    expect(next.lastResult).toContain('周六有集');
  });

  it('is not said while there is more in the purse, nor twice', () => {
    expect(morningAfter(LOW_FUNDS_WARNING_AT + DAILY_GULDMARK_COST + 1).flags.lowFundsWarned).toBe(false);
    expect(morningAfter(LOW_FUNDS_WARNING_AT + DAILY_GULDMARK_COST + 1).lastResult ?? '').not.toContain('灶上的钱');
    const again = morningAfter(LOW_FUNDS_WARNING_AT, { lowFundsWarned: true });
    expect(again.lastResult ?? '').not.toContain('灶上的钱');
  });

  it('is said even when the purse went from comfortable to empty in a day', () => {
    // 8 → 6 passes the line; 3 → 1 and 2 → 0 have already crossed it. The first morning at or under is the one.
    const empty = morningAfter(DAILY_GULDMARK_COST);
    expect(empty.resources.guldmark).toBe(0);
    expect(empty.flags.lowFundsWarned).toBe(true);
  });

  it('does not stand in for the reprieve or the dismissal, which say more', () => {
    const reprieve = morningAfter(DAILY_GULDMARK_COST, {});
    const spent = at(
      { day: 9, phase: 'evening', pendingAdvance: true, tenantTrust: -2, resources: { grain: 40, guldmark: 0, timber: 5, renown: -1 } },
    );
    const next = gameReducer(spent, { type: 'COMMIT_ADVANCE' });
    expect(next.flags.stewardRescueUsed).toBe(true);
    expect(next.lastResult).toContain('铁盒');
    expect(next.lastResult).not.toContain('灶上的钱');
    expect(reprieve.lastResult).toBeTruthy();
  });

  it('is in English too, and spoken by Marta in both', () => {
    expect(enLines.lowFunds).toContain('{@marta}');
    expect(zhLines.lowFunds).toContain('{@marta}');
    expect(enLines.lowFunds).toContain('market on Saturday');
  });
});

describe('the first dismissal, sold past', () => {
  /** The evening before a morning on which the account is empty, both axes spent and the tin already used. */
  const eve = (resources: Partial<GameState['resources']>, flags: FlagMap = {}) =>
    at(
      {
        day: 13, phase: 'evening', pendingAdvance: true, tenantTrust: -2,
        resources: { grain: 103, guldmark: 1, timber: 5, renown: -1, ...resources },
      },
      { stewardRescueUsed: true, lowFundsWarned: true, storageCleared: true, ...flags },
    );

  it('sells part of the barn instead of dismissing, and says so on the morning', () => {
    const next = gameReducer(eve({}), { type: 'COMMIT_ADVANCE' });
    expect(next.demoComplete).toBe(false);
    expect(next.flags.forcedSaleUsed).toBe(true);
    expect(next.resources.grain).toBe(103 - 20);
    expect(next.resources.guldmark).toBe(20);
    expect(next.lastResult).toContain('河谷城粮栈的车');
    expect(next.lastResult).toContain('粮食 20 单位，换回 20 金卢');
    expect(next.lastResult).toContain('{@elena}');
    expect(next.log.some(l => l.text.includes('折价卖了一部分'))).toBe(true);
  });

  it('says only what was sold: timber alone is the timber yard’s cart', () => {
    const next = gameReducer(eve({ grain: 70, timber: 12 + 11 }), { type: 'COMMIT_ADVANCE' });
    expect(next.demoComplete).toBe(false);
    expect(next.lastResult).toContain('木行的车');
    expect(next.lastResult).toContain('木柴 10 单位，换回 20 金卢');
    expect(next.lastResult).not.toContain('粮食');
  });

  it('dismisses the second time, and a steward with nothing to spare the first', () => {
    expect(gameReducer(eve({}, { forcedSaleUsed: true }), { type: 'COMMIT_ADVANCE' }).demoComplete).toBe(true);
    const bare = gameReducer(eve({ grain: 70 }), { type: 'COMMIT_ADVANCE' });
    expect(bare.demoComplete).toBe(true);
    expect(bare.endingId).toBe('ending1');
  });

  it('keeps the whole chain in order on a real season: the tin, then the sale, then the dismissal', () => {
    const plan = PLANS.find(p => p.name === 'harvest-only')!;
    const rng = seededRng('sim', plan.name, 1);
    let s = createInitialState(1);
    const days: Record<string, number> = {};
    for (let n = 0; n < 4000 && !s.demoComplete; n++) {
      s = gameReducer(s, nextAction(plan, s, rng));
      if (s.flags.stewardRescueUsed && !('rescue' in days)) days.rescue = s.day;
      if (s.flags.forcedSaleUsed && !('sale' in days)) days.sale = s.day;
    }
    expect(days.rescue).toBeLessThan(days.sale);
    expect(days.sale).toBeLessThanOrEqual(s.day);
    expect(s.flags.dismissedEarly).toBe(true);
    expect(s.day).toBeGreaterThan(days.sale);
  });

  it('stops the screen with a notice that says the same, until the next action', () => {
    const next = gameReducer(eve({}), { type: 'COMMIT_ADVANCE' });
    expect(next.notice).toEqual({ title: '账上空了', text: next.lastResult });
    expect(next.notice!.text).toContain('河谷城粮栈的车');
    // The notice is gone with the player's next action, whichever it is.
    const open = next.currentChoices.find(c => !c.disabled)!;
    const after = gameReducer(next, { type: 'MAKE_CHOICE', choiceId: open.id });
    expect(after.notice ?? null).toBeNull();
  });

  it('raises no notice when nothing was sold', () => {
    expect(gameReducer(eve({ grain: 70 }), { type: 'COMMIT_ADVANCE' }).notice ?? null).toBeNull();
    const ordinary = at({ day: 4, phase: 'evening', pendingAdvance: true });
    expect(gameReducer(ordinary, { type: 'COMMIT_ADVANCE' }).notice ?? null).toBeNull();
  });

  it('is rebuilt with the season: a replay of a save made at that moment shows the same notice', () => {
    const plan = PLANS.find(p => p.name === 'harvest-only')!;
    const rng = seededRng('sim', plan.name, 1);
    let state = createInitialState(1);
    for (let n = 0; n < 4000 && !state.notice && !state.demoComplete; n++) {
      state = gameReducer(state, nextAction(plan, state, rng));
    }
    expect(state.notice?.title).toBe('账上空了');
    const replayed = replaySeason(JSON.parse(JSON.stringify(state)) as GameState);
    expect(replayed?.notice).toEqual(state.notice);
    expect(noticeKey(state)).toBe([state.seed ?? 0, state.day, state.phase, '账上空了'].join('|'));
  });

  it('is in English too', () => {
    expect(enLines.forcedSaleTitle).toBe('The account is empty');
    expect(enUi.notice.ok).toBe('Understood');
    expect(zhUi.notice.ok).toBe('知道了');
    expect(enLines.forcedSale).toContain('Valehold grain store');
    expect(enLines.forcedSale).toContain('{grain}');
    expect(enLines.forcedSale).toContain('{gold}');
    expect(enLines.forcedSaleTimber).toContain('timber yard');
    expect(enLines.forcedSaleLog).toContain('Elena sold part');
  });
});

describe('notices, for any reason', () => {
  it('can be raised by any rule, with its own words', () => {
    expect(makeNotice('标题', '正文')).toEqual({ title: '标题', text: '正文' });
  });

  it('is named by the season, the moment and the title, so closing it is remembered for that moment only', () => {
    const s = { ...at({ day: 9, phase: 'morning' }), notice: makeNotice('A', 'x') };
    expect(noticeKey(s)).toBe([s.seed ?? 0, 9, 'morning', 'A'].join('|'));
    expect(noticeKey({ ...s, day: 10 })).not.toBe(noticeKey(s));
    expect(noticeKey({ ...s, notice: null })).toBeNull();
    expect(noticeKey(at())).toBeNull();
  });

  it('is cleared by whatever the player does next, and a refused action leaves it standing', () => {
    const s = { ...at({ day: 4, phase: 'evening', pendingAdvance: true }), notice: makeNotice('A', 'x') };
    expect(gameReducer(s, { type: 'COMMIT_ADVANCE' }).notice ?? null).toBeNull();
    // Nothing to commit: the reducer refuses, and nothing about the screen changes.
    const idle = { ...at({ day: 4, phase: 'morning', pendingAdvance: false }), notice: makeNotice('A', 'x') };
    const refused = gameReducer(idle, { type: 'COMMIT_ADVANCE' });
    expect(refused).toBe(idle);
    expect(refused.notice).toEqual({ title: 'A', text: 'x' });
  });
});

describe('the winter-stores list', () => {
  const stores = (day: number, resources: Partial<GameState['resources']>, over: Partial<GameState> = {}) =>
    getWinterStores(at({ day, resources: { grain: 100, guldmark: 50, timber: 12, renown: 0, ...resources }, ...over }));

  it('does not appear until late in the season', () => {
    expect(stores(WINTER_LIST_FROM_DAY - 1, {})).toBeNull();
    expect(stores(WINTER_LIST_FROM_DAY, {})).not.toBeNull();
  });

  it('lists grain, coin and wood against the same lines the ending is judged by', () => {
    const rows = stores(25, {})!;
    expect(rows.map(r => r.id)).toEqual(['grain', 'guldmark', 'timber']);
    const state = at({ day: 25 });
    expect(rows.map(r => r.need)).toEqual([getRetainFloor(state), ENDING2_GULDMARK, ENDING2_TIMBER]);
  });

  it('marks what is held and what is short, down to the one coin', () => {
    const met = (r: ReturnType<typeof stores>) => r!.map(x => x.met);
    expect(met(stores(25, {}))).toEqual([true, true, true]);
    expect(met(stores(25, { guldmark: ENDING2_GULDMARK - 0.5 }))).toEqual([true, false, true]);
    expect(met(stores(25, { timber: ENDING2_TIMBER - 1 }))).toEqual([true, true, false]);
  });

  it('agrees with the ending: all three met is the competent ending’s books, any one short is not', () => {
    for (const r of [{}, { guldmark: 49 }, { timber: 11 }, { grain: 60 }]) {
      const state = at({ day: 30, resources: { grain: 100, guldmark: 50, timber: 12, renown: 0, ...r } });
      expect(meetsEnding2(state)).toBe(getWinterStores(state)!.every(row => row.met));
    }
  });

  it('has its words in both languages', () => {
    expect(zhUi.estateTaskList.winterTitle).toBe('冬储清单');
    expect(enUi.estateTaskList.winterTitle).toBe('Winter stores');
  });
});

describe('what the fixing tasks say', () => {
  const repairs = (r: typeof zhResults | typeof enResults) => r.repair.join('\n');

  it('does not claim a cost the task did not charge', () => {
    expect(repairs(zhResults)).not.toContain('钱比预算多了一点');
    expect(repairs(zhResults)).not.toContain('多花了一笔');
    expect(repairs(enResults)).not.toMatch(/a little over what you had put aside|that cost more/);
  });

  it('gives clearing the stores its own text, not the smith’s', () => {
    expect(zhResults.clear_storage).toHaveLength(3);
    expect(enResults.clear_storage).toHaveLength(3);
    const state = at({ day: 6 }, { toolsRepaired: true });
    const choice = getEstateTaskChoices(state).find(c => c.id === 'task_clear_storage')!;
    expect(choice.resultKind).toBe('clear_storage');
    expect(choice.resultVars).toBeUndefined();
    expect(zhResults.clear_storage.join('')).not.toContain('铁匠');
    const repair = getEstateTaskChoices(at({ day: 6 })).find(c => c.id === 'task_repair_tools')!;
    expect(repair.resultKind).toBe('repair');
    expect(repair.resultVars).toEqual({ item: expect.any(String) });
  });

  it('does not say “修农具 修好了”: the repair line is the same words whatever was repaired', () => {
    for (const line of zhResults.repair) {
      expect(line).toContain('{item}，办完了。');
      expect(line).not.toContain('修好了');
    }
    expect(getEstateTasks(at({ day: 6 })).some(t => t.id === 'task_clear_storage')).toBe(true);
  });

  it('does not put the steward in the stable when the choice was to rest', () => {
    for (const line of [...zhResults.rest, ...enResults.rest]) {
      expect(line).not.toMatch(/在马厩坐了一会儿|sat in the stable/);
    }
    expect(zhResults.rest).toHaveLength(3);
    expect(enResults.rest).toHaveLength(3);
  });
});

describe('an early dismissal and its card', () => {
  it('has its own small print, because the Secretariat’s letter never came', () => {
    const early = at({}, { dismissedEarly: true });
    const late = at();
    expect(getEndingSubtitle(early, 'ending1')).toBe(zhEndings.ending1.variants.early_subtitle);
    expect(getEndingSubtitle(late, 'ending1')).toBe(zhEndings.ending1.subtitle);
    expect(getEndingSubtitle(early, 'ending1')).not.toContain('文秘室不评价你');
    // Other endings are untouched, whatever flag is set.
    expect(getEndingSubtitle(early, 'ending2')).toBe(zhEndings.ending2.subtitle);
    expect(enEndings.ending1.variants.early_subtitle).toBeTruthy();
  });

  it('agrees with the text under it: the letter that says it did not wait for the term', () => {
    expect(composeEnding(at({}, { dismissedEarly: true }), 'ending1')).toContain('这件事没有等到期限');
  });
});

describe('4B after going at dawn on Day 28', () => {
  const ending = (flags: FlagMap) => composeEnding(at({ day: 28 }, flags), 'ending4b');

  it('has the Baron’s reply, the one that asked where the man was, before the renewal is spoken of', () => {
    const text = ending({ wentAtDawn28: true });
    expect(text).toContain('只问了一句：人在哪儿');
    expect(text).toContain('签的是十月三十日');
    expect(text.indexOf('只问了一句：人在哪儿')).toBeLessThan(text.indexOf('你的续签下来了'));
    expect(ending({})).not.toContain('人在哪儿');
  });

  it('is written by the choice itself, so the ending can read it', () => {
    const go = zhDay28.choices.find(c => c.id === 'day28_go_now')!;
    expect(go.effects.flags).toEqual({ wentAtDawn28: true });
    expect(go.effects.endsSeason).toBe('ending4b');
    expect(enEndings.ending4b.variants.dawn_letter).toContain('where is he');
  });
});

describe('the opening’s name prompt', () => {
  it('does not promise a page the player cannot see yet', () => {
    expect(zhUi.opening.namePrompt).not.toContain('先在担保书摘要页上签收');
    expect(zhUi.opening.namePrompt).toContain('签收栏');
    expect(enUi.opening.namePrompt).toContain('receipt line');
  });
});
