import { describe, it, expect } from 'vitest';
import { GameState, TextPart } from '../src/types/game';
import { createInitialState, gameReducer } from '../src/systems/GameEngine';
import {
  ReadMemory, ReadScreen, splitParagraphs, normaliseParagraph, isMemorable, hashText, paragraphKey,
  recordRead, isReadAt, furthestStep, recordScreen, screenOf, paragraphReader, withReadParts,
  readReadMemory, writeReadMemory, readReadingSettings, writeReadingSettings,
  READ_MEMORY_KEY, READING_SETTINGS_KEY,
} from '../src/systems/ReadMemorySystem';
import { READ_MEMORY_MIN_CHARS } from '../src/data/config';
import { seededRng } from '../src/utils/rng';
import { PLANS, nextAction } from './helpers/simulation';

function memoryStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    map,
  };
}

const joined = (parts: TextPart[] | null | undefined) => (parts ?? []).map(p => p.text).join('');
const knownText = (parts: TextPart[] | null | undefined) => (parts ?? []).filter(p => p.known).map(p => p.text).join('');

// ── The rule ────────────────────────────────────────────────────────────────

describe('the record and the rule', () => {
  it('remembers the season and the furthest step, and marks a paragraph another season read first', () => {
    expect(recordRead(undefined, 7, 10)).toEqual({ s: 7, t: 10 });
    expect(recordRead({ s: 7, t: 10 }, 7, 4)).toEqual({ s: 7, t: 10 });
    expect(recordRead({ s: 7, t: 10 }, 7, 12)).toEqual({ s: 7, t: 12 });
    expect(recordRead({ s: 7, t: 10 }, 8, 3)).toEqual({ s: 8, t: 3, o: 1 });
    expect(recordRead({ s: 8, t: 3, o: 1 }, 8, 9)).toEqual({ s: 8, t: 9, o: 1 });
  });

  it('finds the furthest step of this season, 0 when there is none', () => {
    const memory: ReadMemory = { a: { s: 7, t: 4 }, b: { s: 7, t: 12, o: 1 }, c: { s: 8, t: 30 } };
    expect(furthestStep(memory, 7)).toBe(12);
    expect(furthestStep(memory, 8)).toBe(30);
    expect(furthestStep(memory, 9)).toBe(0);
    expect(furthestStep({}, 7)).toBe(0);
  });

  it('counts as read in another season, or from this step on once the player stands before the furthest one', () => {
    // Nothing remembered.
    expect(isReadAt(undefined, 7, 10, 12)).toBe(false);
    // Same season, read at an earlier step than this one: the season's own line, the hints' business.
    expect(isReadAt({ s: 7, t: 4 }, 7, 10, 12)).toBe(false);
    // Same season, the same step, and the player has been further: coming back through this screen.
    expect(isReadAt({ s: 7, t: 10 }, 7, 10, 12)).toBe(true);
    // Same season, a later step: the player has come back.
    expect(isReadAt({ s: 7, t: 12 }, 7, 10, 12)).toBe(true);
    // At the frontier (this step is the furthest, or beyond it) nothing of this season counts.
    expect(isReadAt({ s: 7, t: 10 }, 7, 10, 10)).toBe(false);
    expect(isReadAt({ s: 7, t: 10 }, 7, 11, 10)).toBe(false);
    expect(isReadAt({ s: 7, t: 12 }, 7, 12, 12)).toBe(false);
    // Another season.
    expect(isReadAt({ s: 8, t: 3 }, 7, 10, 12)).toBe(true);
    expect(isReadAt({ s: 8, t: 3 }, 7, 10, 0)).toBe(true);
    // Another season read it first, then this one: read wherever this one stands, the frontier too.
    expect(isReadAt({ s: 7, t: 2, o: 1 }, 7, 10, 12)).toBe(true);
    expect(isReadAt({ s: 7, t: 2, o: 1 }, 7, 10, 10)).toBe(true);
  });
});

// ── Paragraphs ──────────────────────────────────────────────────────────────

describe('what a paragraph is', () => {
  it('is cut at runs of newlines, as the page cuts it', () => {
    expect(splitParagraphs('甲乙丙丁戊己\n\n庚辛壬癸子丑\n\n\n寅卯辰巳午未')).toEqual(['甲乙丙丁戊己', '庚辛壬癸子丑', '寅卯辰巳午未']);
    expect(splitParagraphs('')).toEqual([]);
  });

  it('is the same prose whatever the player is called and whatever the numbers', () => {
    expect(normaliseParagraph('  安，你收上来 5 单位。 ', '安')).toBe(normaliseParagraph('玛丽，你收上来 17 单位。', '玛丽'));
    expect(paragraphKey('You brought in 5 units of grain.', 'Ann')).toBe(paragraphKey('You brought in 7 units of grain.', 'Bo'));
    expect(paragraphKey('You brought in 5 units of grain.')).not.toBe(paragraphKey('You brought in 5 units of timber.'));
  });

  it('hashes to at least 48 bits', () => {
    expect(parseInt(hashText('雨在夜里停了。'), 36)).toBeGreaterThan(0);
    const keys = new Set(Array.from({ length: 2000 }, (_, i) => hashText(`段落 ${i} 的文字`)));
    expect(keys.size).toBe(2000);
    expect(hashText('a').length).toBeGreaterThanOrEqual(6);
  });

  it('leaves out what is too short to count, and does not count a speaker mark', () => {
    expect(READ_MEMORY_MIN_CHARS).toBe(6);
    expect(isMemorable('嗯。')).toBe(false);
    expect(isMemorable('{@gregor}“嗯。”')).toBe(false);
    expect(isMemorable('  a b c d e  ')).toBe(false);
    expect(isMemorable('雨在夜里停了。')).toBe(true);
    expect(paragraphKey('嗯。')).toBeNull();
    const memory = recordScreen({}, { seed: 1, step: 1, playerName: '', texts: ['嗯。\n\n雨在夜里停了。'] });
    expect(Object.keys(memory)).toHaveLength(1);
    expect(paragraphReader(memory, 2, 0)('嗯。')).toBe(false);
  });
});

// ── Setting back what was read ──────────────────────────────────────────────

describe('the parts a passage is drawn with', () => {
  const readOnly = (...paragraphs: string[]) => (p: string) => paragraphs.includes(p.trim());

  it('comes back untouched when nothing is read', () => {
    const hints: TextPart[] = [{ text: '甲乙丙丁戊己', known: true }, { text: '\n\n庚辛壬癸子丑' }];
    expect(withReadParts('甲乙丙丁戊己\n\n庚辛壬癸子丑', hints, () => false)).toBe(hints);
    expect(withReadParts('甲乙丙丁戊己', null, () => false)).toBeNull();
    expect(withReadParts('甲乙丙丁戊己', undefined, () => false)).toBeUndefined();
  });

  it('sets back a read paragraph whole, and joins to exactly the text', () => {
    const text = '第一段文字在这里。\n\n第二段文字在这里。\n\n第三段文字在这里。';
    const parts = withReadParts(text, null, readOnly('第二段文字在这里。'));
    expect(joined(parts)).toBe(text);
    expect(knownText(parts).trim()).toBe('第二段文字在这里。');
  });

  it('keeps what the hints set back, and adds to it', () => {
    const text = '第一段文字在这里。\n\n第二段文字在这里。\n\n第三段文字在这里。';
    const hints: TextPart[] = [{ text: '第一段文字在这里。\n\n', known: true }, { text: '第二段文字在这里。\n\n第三段文字在这里。' }];
    const parts = withReadParts(text, hints, readOnly('第三段文字在这里。'));
    expect(joined(parts)).toBe(text);
    const known = (parts ?? []).filter(p => p.known).map(p => p.text.trim());
    expect(known).toContain('第一段文字在这里。');
    expect(known.join('')).toContain('第三段文字在这里。');
    expect(knownText(parts)).not.toContain('第二段');
  });

  it('ignores hint parts that no longer describe the text', () => {
    const text = '第一段文字在这里。\n\n第二段文字在这里。';
    const stale: TextPart[] = [{ text: '别的文字', known: true }];
    const parts = withReadParts(text, stale, readOnly('第一段文字在这里。'));
    expect(joined(parts)).toBe(text);
    expect(knownText(parts).trim()).toBe('第一段文字在这里。');
  });

  it('keeps speaker marks where the panel looks for them', () => {
    const text = '院子里很安静，马在棚里。\n\n{@gregor}“马蹄铁该换了，明天我去镇上。”格雷格说。\n\n{@marta}“早饭在灶上，别凉了。”';
    const read = '{@gregor}“马蹄铁该换了，明天我去镇上。”格雷格说。';
    const parts = withReadParts(text, null, readOnly(read));
    expect(joined(parts)).toBe(text);
    // Each paragraph still starts a part or follows a break, so the mark stays at its head.
    const known = (parts ?? []).find(p => p.known);
    expect(known?.text.startsWith('{@gregor}')).toBe(true);
    expect(knownText(parts)).not.toContain('{@marta}');
  });

  it('works with the reader the memory hands out', () => {
    const name = '安';
    const memory = recordScreen({}, { seed: 1, step: 5, playerName: name, texts: ['安走进了账房，账本摊在桌上。', '今天收上来 5 单位粮食，仓里满了。'] });
    const reader = paragraphReader(memory, 2, 3, '玛丽');
    const text = '玛丽走进了账房，账本摊在桌上。\n\n今天收上来 9 单位粮食，仓里满了。\n\n这是新的一段文字。';
    const parts = withReadParts(text, null, reader);
    expect(joined(parts)).toBe(text);
    expect(knownText(parts)).toContain('玛丽走进了账房');
    expect(knownText(parts)).toContain('9 单位');
    expect(knownText(parts)).not.toContain('新的一段');
  });
});

// ── Storage ─────────────────────────────────────────────────────────────────

describe('kept in the browser', () => {
  it('round-trips the memory', () => {
    const store = memoryStore();
    const memory: ReadMemory = { abc: { s: 1, t: 4 }, def: { s: 2, t: 9, o: 1 } };
    writeReadMemory(memory, store);
    expect(store.map.has(READ_MEMORY_KEY)).toBe(true);
    expect(readReadMemory(store)).toEqual(memory);
  });

  it('reads a corrupt or missing value as nothing read, and drops malformed records', () => {
    expect(readReadMemory(memoryStore())).toEqual({});
    expect(readReadMemory(memoryStore({ [READ_MEMORY_KEY]: '{not json' }))).toEqual({});
    expect(readReadMemory(memoryStore({ [READ_MEMORY_KEY]: '[1,2,3]' }))).toEqual({});
    expect(readReadMemory(memoryStore({ [READ_MEMORY_KEY]: 'null' }))).toEqual({});
    expect(readReadMemory(memoryStore({ [READ_MEMORY_KEY]: JSON.stringify({ a: { s: 1, t: 2 }, b: { s: 'x', t: 2 }, c: 5, d: { s: 1, t: 2, o: 2 } }) })))
      .toEqual({ a: { s: 1, t: 2 } });
    expect(readReadMemory(null)).toEqual({});
  });

  it('survives a storage that throws', () => {
    const angry = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(readReadMemory(angry)).toEqual({});
    expect(() => writeReadMemory({ a: { s: 1, t: 1 } }, angry)).not.toThrow();
    expect(readReadingSettings(angry)).toEqual({ dimRead: false });
    expect(() => writeReadingSettings({ dimRead: true }, angry)).not.toThrow();
  });

  it('keeps the setting, off unless turned on', () => {
    const store = memoryStore();
    expect(readReadingSettings(store)).toEqual({ dimRead: false });
    writeReadingSettings({ dimRead: true }, store);
    expect(store.map.get(READING_SETTINGS_KEY)).toBe('{"dimRead":true}');
    expect(readReadingSettings(store)).toEqual({ dimRead: true });
    expect(readReadingSettings(memoryStore({ [READING_SETTINGS_KEY]: '{"dimRead":"yes"}' }))).toEqual({ dimRead: false });
    expect(readReadingSettings(memoryStore({ [READING_SETTINGS_KEY]: 'garbage' }))).toEqual({ dimRead: false });
  });
});

// ── A season ────────────────────────────────────────────────────────────────

/** Plays a seeded season with a simulated steward and remembers every screen it leaves, as the app does. */
function playRemembering(seed: number, actions: number, planName = 'balanced') {
  const plan = PLANS.find(p => p.name === planName)!;
  const rng = seededRng('sim', plan.name, seed);
  let s = createInitialState(seed);
  let memory: ReadMemory = {};
  const screens: ReadScreen[] = [];
  for (let n = 0; n < actions && !s.demoComplete; n++) {
    const shown = screenOf(s);
    if (shown) { screens.push(shown); }
    const next = gameReducer(s, nextAction(plan, s, rng));
    if (shown && next !== s) memory = recordScreen(memory, shown);
    s = next;
  }
  return { state: s, memory, screens };
}

describe('across seasons', () => {
  it('records nothing during the opening or for a save without a seed', () => {
    const s0 = createInitialState(5);
    expect(screenOf(s0)).toBeNull();
    const old: GameState = { ...s0, openingPage: null };
    delete old.seed;
    expect(screenOf(old)).toBeNull();
  });

  it('a new season sees what an earlier one read; the season itself, at the same step, does not', () => {
    const { state, memory, screens } = playRemembering(20181030, 160);
    expect(screens.length).toBeGreaterThan(50);
    // Leaving the last screen too, as going to the title would.
    const last = screenOf(state)!;
    const all = recordScreen(memory, last);

    const paragraphs = (screen: ReadScreen) => screen.texts.flatMap(splitParagraphs).filter(p => isMemorable(p));
    const lastParagraphs = paragraphs(last);
    expect(lastParagraphs.length).toBeGreaterThan(0);

    // Another seed: every paragraph this season showed is read.
    const otherSeason = paragraphReader(all, 99, 0, state.playerName);
    for (const screen of [...screens, last]) {
      for (const p of paragraphs(screen)) expect(otherSeason(p)).toBe(true);
    }

    // This season, on its last screen: nothing it shows is set back, however often it was read before.
    const here = paragraphReader(all, last.seed, last.step, state.playerName);
    for (const p of lastParagraphs) expect(here(p)).toBe(false);

    // In a first season with the setting on, the panel is exactly what it was.
    expect(withReadParts(state.currentSceneText, state.sceneParts, here)).toBe(state.sceneParts);

    // A screen in the middle, the player having come back to it: the screen itself and everything
    // read from it onward is read; what was only read before it is not.
    const mid = screens[Math.floor(screens.length / 2)];
    const atMid = paragraphReader(all, mid.seed, mid.step, state.playerName);
    for (const p of paragraphs(mid)) expect(atMid(p)).toBe(true);
    const keyOf = (p: string) => paragraphKey(p, state.playerName);
    const fromMid = new Set([...screens.filter(s => s.step >= mid.step), last].flatMap(paragraphs).map(keyOf));
    const beforeOnly = screens.filter(s => s.step < mid.step).flatMap(paragraphs).filter(p => !fromMid.has(keyOf(p)));
    expect(beforeOnly.length).toBeGreaterThan(0);
    for (const p of beforeOnly) expect(atMid(p)).toBe(false);
  });
});
