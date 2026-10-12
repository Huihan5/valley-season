import { describe, it, expect } from 'vitest';
import { FlagMap, GameState, SeasonAction } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import { getEventById } from '../src/systems/EventSystem';
import {
  OPENING_PAGES, answeredChoice, isQuestion, openingBody,
} from '../src/systems/OpeningSystem';
// The plot script is a plain ESM script with no type declarations.
// @ts-ignore
import { renderScript, loadData } from '../scripts/lib/script-format.mjs';
import zhOpening from '../src/data/zh/opening.json';
import enOpening from '../src/data/en/opening.json';
import zhDay3 from '../src/data/zh/events/day3.json';
import enDay3 from '../src/data/en/events/day3.json';

/**
 * The Baron's second question (N4): in Forgehold he asks what the steward would do about an
 * expense they cannot read. It is the player's to answer, with the same three things Day 3
 * lets them do about the ledger, and Day 3 says the answer back.
 */

const ANSWERS = ['investigate', 'report', 'defer'] as const;
const QUESTION_ID = 'forgehold_2';

const act = (s: GameState, a: SeasonAction) => gameReducer(s, a);

/** A new season, signed for, standing on the Baron's page. */
function atTheBaron(seed = 1): GameState {
  let s = act(createInitialState(seed), { type: 'SET_PLAYER_NAME', name: '安' });
  while (OPENING_PAGES[s.openingPage as number].id !== QUESTION_ID) {
    s = act(s, { type: 'ADVANCE_OPENING' });
  }
  return s;
}

const page = () => OPENING_PAGES.find(p => p.id === QUESTION_ID)!;

describe('the question page', () => {
  it('is the Baron’s second page, and the only question in the opening', () => {
    expect(OPENING_PAGES.filter(p => isQuestion(p)).map(p => p.id)).toEqual([QUESTION_ID]);
    expect(page().kind).toBe('question');
    expect(page().choices).toHaveLength(3);
  });

  it('keeps the page count the opening always had, so a save from before still lines up', () => {
    expect(OPENING_PAGES).toHaveLength(13);
  });

  it('ends on the question, and does not say “可以” until the steward has answered', () => {
    const body = openingBody(page(), atTheBaron().flags);
    expect(body.endsWith('你会先做什么。')).toBe(true);
    expect(body).not.toContain('“可以。”');
  });

  it('answers with the same three things Day 3 lets the steward do about the ledger', () => {
    const written = page().choices!.map(c => (c.effects?.flags as FlagMap).ledgerAnswer);
    expect(written).toEqual([...ANSWERS]);
    const day3 = zhDay3.choices.map(c => c.id);
    for (const a of ANSWERS) expect(day3).toContain(a);
  });

  it('is the same page, with the same answers, in English', () => {
    const en = enOpening.pages.find(p => p.id === QUESTION_ID)!;
    expect(en.kind).toBe('question');
    expect(en.choices!.map(c => (c.effects.flags as FlagMap).ledgerAnswer)).toEqual([...ANSWERS]);
    expect(en.choices!.map(c => c.id)).toEqual(page().choices!.map(c => c.id));
    expect(Object.keys(en.variants ?? {})).toEqual(Object.keys(page().variants!));
    expect(enOpening.pages).toHaveLength(zhOpening.pages.length);
  });
});

describe('answering', () => {
  it('writes the answer and keeps the page, now answered', () => {
    for (const choice of page().choices!) {
      const before = atTheBaron();
      const after = act(before, { type: 'ANSWER_OPENING', choiceId: choice.id });
      expect(after.flags.ledgerAnswer).toBe((choice.effects!.flags as FlagMap).ledgerAnswer);
      expect(after.openingPage).toBe(before.openingPage);
      expect(answeredChoice(page(), after.flags)?.id).toBe(choice.id);
    }
  });

  it('says what was said, then goes on exactly as it always did, whichever the answer', () => {
    const tails = new Set<string>();
    const lines = new Set<string>();
    for (const choice of page().choices!) {
      const s = act(atTheBaron(), { type: 'ANSWER_OPENING', choiceId: choice.id });
      const body = openingBody(page(), s.flags);
      expect(body.startsWith(page().text)).toBe(true);
      expect(body).toContain(choice.resultText!);
      expect(body).toContain('“可以。”他在那份担保书上签了字');
      expect(body).toContain('你手里攥着一张火车票。');
      tails.add(body.slice(body.indexOf('“可以。”')));
      lines.add(choice.resultText!);
    }
    // The Baron signs whatever was said: the ending of the page is one text, the answers three.
    expect(tails.size).toBe(1);
    expect(lines.size).toBe(3);
  });

  it('can be answered once, and only on its own page', () => {
    const answered = act(atTheBaron(), { type: 'ANSWER_OPENING', choiceId: 'ledger_report' });
    const again = act(answered, { type: 'ANSWER_OPENING', choiceId: 'ledger_defer' });
    expect(again.flags.ledgerAnswer).toBe('report');

    const earlier = act(createInitialState(1), { type: 'SET_PLAYER_NAME', name: '安' });
    expect(act(earlier, { type: 'ANSWER_OPENING', choiceId: 'ledger_report' }).flags.ledgerAnswer).toBe('');

    expect(act(atTheBaron(), { type: 'ANSWER_OPENING', choiceId: 'nonsense' }).flags.ledgerAnswer).toBe('');
  });

  it('does not stop the opening for a steward who turns the page unanswered, as an older save would', () => {
    const s = act(atTheBaron(), { type: 'ADVANCE_OPENING' });
    expect(OPENING_PAGES[s.openingPage as number].id).not.toBe(QUESTION_ID);
    expect(s.flags.ledgerAnswer).toBe('');
  });

  it('is recorded, so that a replay answers the same way', () => {
    let s = act(atTheBaron(7), { type: 'ANSWER_OPENING', choiceId: 'ledger_investigate' });
    while (s.openingPage !== null) s = act(s, { type: 'ADVANCE_OPENING' });
    expect(s.history!.some(a => a.type === 'ANSWER_OPENING')).toBe(true);
    const replayed = replaySeason(JSON.parse(JSON.stringify(s)) as GameState);
    expect(replayed).not.toBeNull();
    expect(replayed!.flags.ledgerAnswer).toBe('investigate');
  });

  it('is not asked of a steward who skips the opening, and nothing breaks for it', () => {
    const s = act(act(createInitialState(1), { type: 'SET_PLAYER_NAME', name: '安' }), { type: 'SKIP_OPENING' });
    expect(s.openingPage).toBeNull();
    expect(s.flags.ledgerAnswer).toBe('');
  });
});

describe('Day 3 says the answer back', () => {
  const day3 = (flags: FlagMap = {}) => {
    const base = createInitialState(3);
    const state: GameState = { ...base, openingPage: null, day: 3, activeEvent: null, flags: { ...base.flags, ...flags } };
    return getEventById('day3_ledger', state)!;
  };

  it('ends the scene on the words the steward gave in Forgehold, for each of the three', () => {
    const base = day3().sceneText;
    for (const a of ANSWERS) {
      const text = day3({ ledgerAnswer: a }).sceneText;
      expect(text.startsWith(base), a).toBe(true);
      const echo = text.slice(base.length).trim();
      expect(echo, a).toContain('你在铸都是这么说的');
      expect(echo.split('\n\n'), a).toHaveLength(1);
    }
    const lines = ANSWERS.map(a => day3({ ledgerAnswer: a }).sceneText.slice(base.length));
    expect(new Set(lines).size).toBe(3);
  });

  it('says nothing to a steward who was never asked', () => {
    expect(day3().sceneText).not.toContain('铸都是这么说的');
    expect(day3({ ledgerAnswer: '' }).sceneText).toBe(day3().sceneText);
  });

  it('leaves the choices as they were, whatever was said: the answer is not a promise', () => {
    const plain = day3().choices!.map(c => ({ id: c.id, effects: c.effects, text: c.text }));
    for (const a of ANSWERS) {
      expect(day3({ ledgerAnswer: a }).choices!.map(c => ({ id: c.id, effects: c.effects, text: c.text }))).toEqual(plain);
    }
  });

  it('has the same three echoes in English, one for each answer', () => {
    expect(Object.keys(enDay3.variants).sort()).toEqual(ANSWERS.map(a => `echo_${a}`).sort());
    expect(Object.keys(zhDay3.variants).sort()).toEqual(Object.keys(enDay3.variants).sort());
  });
});

describe('the plot script', () => {
  it('shows the question page with its answers and what they write', () => {
    const md = renderScript() as string;
    const at = md.indexOf('> ID forgehold_2');
    const unit = md.slice(at, md.indexOf('\n### ', at));
    expect(unit).toContain('类型 问答');
    expect(unit).toContain('#### 选项｜先查下去，弄清这笔钱付给了谁');
    expect(unit).toContain('旗标 ledgerAnswer=report');
    expect(unit).toContain('#### ◇ 变体｜after_answer');
    expect(loadData().byId.get(QUESTION_ID)).toBeTruthy();
  });
});
