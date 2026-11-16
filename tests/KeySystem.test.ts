import { describe, it, expect } from 'vitest';
import {
  KeyDescription, ScreenDescription, Surface, Overlay, Beat, KeyIntent,
  decideKey, holdsFromBrowser, digitOf, MAX_NUMBERED,
} from '../src/systems/KeySystem';
import { HOTKEY_GUARD_MS, READ_ON_SCROLL_FRACTION, READ_ON_BOTTOM_SLACK_PX } from '../src/data/config';

const key = (code: string, extra: Partial<KeyDescription> = {}): KeyDescription => ({
  code, repeat: false, ctrl: false, meta: false, alt: false, shift: false, composing: false, typing: false, focus: 'other', ...extra,
});
const screen = (extra: Partial<ScreenDescription> = {}): ScreenDescription => ({
  surface: 'season', overlay: null, beat: 'choices', guard: false, ...extra,
});
const decide = (code: string, k: Partial<KeyDescription> = {}, s: Partial<ScreenDescription> = {}) =>
  decideKey(key(code, k), screen(s));
const NONE: KeyIntent = { kind: 'none' };

const SURFACES: Surface[] = ['title', 'nameEntry', 'opening', 'season', 'ending'];
const OVERLAYS: Overlay[] = ['notice', 'document', 'satchel', 'codex', 'saves', 'retrospect', 'sound'];
const BEATS: Beat[] = ['continue', 'choices', 'input', 'none'];
const DIGIT_CODES = Array.from({ length: 9 }, (_, i) => [`Digit${i + 1}`, `Numpad${i + 1}`, i + 1] as const);

describe('the numbers', () => {
  it('are read off event.code, one to nine, main row and numpad alike', () => {
    for (const [digit, numpad, n] of DIGIT_CODES) {
      expect(digitOf(digit)).toBe(n);
      expect(digitOf(numpad)).toBe(n);
    }
    expect(MAX_NUMBERED).toBe(9);
    for (const code of ['Digit0', 'Numpad0', 'KeyA', 'Space', 'Enter', 'Digit10', 'NumpadAdd', '1', 'Minus']) {
      expect(digitOf(code)).toBeNull();
    }
  });

  it('keeps the tuning numbers in the config', () => {
    expect(HOTKEY_GUARD_MS).toBe(300);
    expect(READ_ON_SCROLL_FRACTION).toBe(0.85);
    expect(READ_ON_BOTTOM_SLACK_PX).toBeGreaterThan(0);
  });
});

describe('choosing', () => {
  it('a digit chooses that number in a season or in the opening, with choices on screen', () => {
    for (const surface of ['season', 'opening'] as Surface[]) {
      for (const [digit, numpad, n] of DIGIT_CODES) {
        expect(decide(digit, {}, { surface })).toEqual({ kind: 'choose', n });
        expect(decide(numpad, {}, { surface })).toEqual({ kind: 'choose', n });
      }
    }
  });

  it('does nothing without choices to choose from, or off the reading surfaces', () => {
    for (const beat of ['continue', 'input', 'none'] as Beat[]) {
      expect(decide('Digit1', {}, { beat })).toEqual(NONE);
    }
    for (const surface of ['title', 'nameEntry', 'ending'] as Surface[]) {
      expect(decide('Digit1', {}, { surface, beat: 'choices' })).toEqual(NONE);
    }
  });

  it('does nothing while the screen has only just changed', () => {
    expect(decide('Digit1', {}, { guard: true })).toEqual(NONE);
    expect(decide('Numpad2', {}, { guard: true, surface: 'opening' })).toEqual(NONE);
    expect(decide('Digit1', {}, { guard: false })).toEqual({ kind: 'choose', n: 1 });
  });

  it('does nothing while an overlay is open, whichever it is', () => {
    for (const overlay of OVERLAYS) {
      for (const [digit] of DIGIT_CODES) expect(decide(digit, {}, { overlay })).toEqual(NONE);
    }
  });

  it('does nothing in a checkbox or slider, where the digits are its own', () => {
    expect(decide('Digit1', { focus: 'control' })).toEqual(NONE);
  });

  it('chooses with a mouse-focused or keyboard-focused button alike (a digit is nobody’s activation key)', () => {
    expect(decide('Digit3', { focus: 'mouseButton' })).toEqual({ kind: 'choose', n: 3 });
    expect(decide('Digit3', { focus: 'keyboardButton' })).toEqual({ kind: 'choose', n: 3 });
  });
});

describe('reading on', () => {
  it('on a screen with a continue, space and enter scroll, and continue at the bottom', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      for (const surface of ['season', 'opening'] as Surface[]) {
        expect(decide(code, {}, { surface, beat: 'continue' })).toEqual({ kind: 'readOn', continues: true });
      }
    }
  });

  it('with the screen just changed it may scroll but not continue', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      expect(decide(code, {}, { beat: 'continue', guard: true })).toEqual({ kind: 'readOn', continues: false });
    }
  });

  it('with choices on screen, space only scrolls and enter does nothing', () => {
    expect(decide('Space', {}, { beat: 'choices' })).toEqual({ kind: 'readOn', continues: false });
    expect(decide('Enter', {}, { beat: 'choices' })).toEqual(NONE);
    expect(decide('NumpadEnter', {}, { beat: 'choices' })).toEqual(NONE);
  });

  it('with a field to fill in or nothing to answer, space only scrolls and enter does nothing', () => {
    for (const beat of ['input', 'none'] as Beat[]) {
      expect(decide('Space', {}, { beat })).toEqual({ kind: 'readOn', continues: false });
      expect(decide('Enter', {}, { beat })).toEqual(NONE);
    }
  });

  it('never continues on the ending, which has no key of its own to start again', () => {
    const intents = ['Space', 'Enter', 'NumpadEnter'].flatMap(code => BEATS.map(beat => decide(code, {}, { surface: 'ending', beat })));
    for (const intent of intents) expect(intent.kind === 'readOn' && intent.continues).toBe(false);
  });

  it('does nothing on the title or the name entry', () => {
    for (const surface of ['title', 'nameEntry'] as Surface[]) {
      for (const beat of BEATS) {
        for (const code of ['Space', 'Enter', 'NumpadEnter']) {
          expect(decide(code, {}, { surface, beat })).toEqual(NONE);
        }
      }
    }
  });

  it('does nothing while an overlay is open, the notice aside', () => {
    for (const overlay of OVERLAYS.filter(o => o !== 'notice')) {
      for (const code of ['Space', 'Enter', 'NumpadEnter']) {
        for (const beat of BEATS) expect(decide(code, {}, { overlay, beat })).toEqual(NONE);
      }
    }
  });

  it('leaves Space and Enter to the browser on a button the user reached by keyboard', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      expect(decide(code, { focus: 'keyboardButton' }, { beat: 'continue' })).toEqual(NONE);
    }
  });

  it('owns them on a button that only kept focus from a mouse click', () => {
    for (const code of ['Space', 'Enter']) {
      expect(decide(code, { focus: 'mouseButton' }, { beat: 'continue' })).toEqual({ kind: 'readOn', continues: true });
    }
  });

  it('leaves Space and Enter to a checkbox or slider', () => {
    for (const code of ['Space', 'Enter']) expect(decide(code, { focus: 'control' }, { beat: 'continue' })).toEqual(NONE);
  });

  it('leaves Shift+Space, the browser’s own “up”', () => {
    expect(decide('Space', { shift: true }, { beat: 'continue' })).toEqual(NONE);
  });
});

describe('escape', () => {
  it('closes the overlay that is open, whichever it is', () => {
    for (const surface of SURFACES) {
      for (const overlay of OVERLAYS.filter(o => o !== 'notice')) {
        expect(decide('Escape', {}, { surface, overlay })).toEqual({ kind: 'closeOverlay' });
      }
    }
    expect(decide('Escape', {}, { overlay: 'notice' })).toEqual({ kind: 'closeOverlay' });
  });

  it('opens the menu with nothing open and a season on screen, the ending included', () => {
    for (const beat of BEATS) {
      expect(decide('Escape', {}, { surface: 'season', beat })).toEqual({ kind: 'openMenu' });
      expect(decide('Escape', {}, { surface: 'ending', beat })).toEqual({ kind: 'openMenu' });
    }
  });

  it('opens nothing on the title, the name entry or the opening', () => {
    for (const surface of ['title', 'nameEntry', 'opening'] as Surface[]) {
      expect(decide('Escape', {}, { surface })).toEqual(NONE);
    }
  });

  it('works from a checkbox or slider, which the menu and the sound popover are full of', () => {
    expect(decide('Escape', { focus: 'control' }, { overlay: 'saves' })).toEqual({ kind: 'closeOverlay' });
    expect(decide('Escape', { focus: 'control' }, { overlay: 'sound' })).toEqual({ kind: 'closeOverlay' });
  });

  it('works from a button of either kind', () => {
    for (const focus of ['mouseButton', 'keyboardButton'] as const) {
      expect(decide('Escape', { focus }, { overlay: 'codex' })).toEqual({ kind: 'closeOverlay' });
      expect(decide('Escape', { focus })).toEqual({ kind: 'openMenu' });
    }
  });

  it('does not answer a notice in the first moments of its screen', () => {
    expect(decide('Escape', {}, { overlay: 'notice', guard: true })).toEqual(NONE);
    expect(decide('Escape', {}, { overlay: 'saves', guard: true })).toEqual({ kind: 'closeOverlay' });
    expect(decide('Escape', {}, { guard: true })).toEqual({ kind: 'openMenu' });
  });
});

describe('the notice', () => {
  it('is acknowledged by space and enter, from any surface a season is on', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      for (const beat of BEATS) expect(decide(code, {}, { overlay: 'notice', beat })).toEqual({ kind: 'ackNotice' });
    }
  });

  it('is acknowledged even when a button holds keyboard focus (the dialog’s own button does)', () => {
    for (const focus of ['keyboardButton', 'mouseButton'] as const) {
      expect(decide('Space', { focus }, { overlay: 'notice' })).toEqual({ kind: 'ackNotice' });
    }
  });

  it('is not acknowledged in the guard, so a double tap cannot dismiss it unread', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter', 'Escape']) {
      expect(decide(code, {}, { overlay: 'notice', guard: true })).toEqual(NONE);
    }
  });

  it('takes neither digits nor read-on while it is up', () => {
    expect(decide('Digit1', {}, { overlay: 'notice' })).toEqual(NONE);
  });
});

describe('what must never act', () => {
  const everyKey = ['Digit1', 'Numpad3', 'Space', 'Enter', 'NumpadEnter', 'Escape'];
  const screens: ScreenDescription[] = [];
  for (const surface of SURFACES) {
    for (const beat of BEATS) {
      for (const overlay of [null, ...OVERLAYS]) {
        for (const guard of [false, true]) screens.push({ surface, beat, overlay, guard });
      }
    }
  }

  const refusals: [string, Partial<KeyDescription>][] = [
    ['a held key', { repeat: true }],
    ['Ctrl', { ctrl: true }],
    ['Meta', { meta: true }],
    ['Alt', { alt: true }],
    ['an input method composing', { composing: true }],
    ['a key typed into a field', { typing: true }],
  ];

  for (const [name, extra] of refusals) {
    it(`${name} does nothing, on any screen`, () => {
      for (const code of everyKey) {
        for (const s of screens) expect(decideKey(key(code, extra), s)).toEqual(NONE);
      }
    });
  }

  it('anything else is no key at all', () => {
    for (const code of ['KeyA', 'KeyJ', 'Tab', 'ArrowDown', 'PageDown', 'Backspace', 'F5', 'Digit0', 'Numpad0', 'Period']) {
      for (const s of screens) expect(decideKey(key(code), s)).toEqual(NONE);
    }
  });

  it('only a digit ever chooses, and only with choices, no overlay, no guard, and a reading surface', () => {
    for (const s of screens) {
      for (const [digit, numpad, n] of DIGIT_CODES) {
        for (const code of [digit, numpad]) {
          const intent = decideKey(key(code), s);
          const allowed = s.beat === 'choices' && !s.overlay && !s.guard && (s.surface === 'season' || s.surface === 'opening');
          expect(intent).toEqual(allowed ? { kind: 'choose', n } : NONE);
        }
      }
    }
  });

  it('only a continue screen, with no guard and no overlay, ever continues', () => {
    for (const s of screens) {
      for (const code of ['Space', 'Enter', 'NumpadEnter']) {
        const intent = decideKey(key(code), s);
        if (intent.kind === 'readOn' && intent.continues) {
          expect(s.beat).toBe('continue');
          expect(s.guard).toBe(false);
          expect(s.overlay).toBeNull();
          expect(['season', 'opening']).toContain(s.surface);
        }
      }
    }
  });

  it('the keys that replace or clear a season are bound to nothing here: the restart and the title are buttons', () => {
    // No intent names a button other than a numbered choice or a continue; the title and ending
    // surfaces yield no choose and no continue at all.
    for (const surface of ['title', 'ending'] as Surface[]) {
      for (const beat of BEATS) {
        for (const code of everyKey) {
          const intent = decideKey(key(code), { surface, beat, overlay: null, guard: false });
          expect(intent.kind === 'choose' || (intent.kind === 'readOn' && intent.continues)).toBe(false);
        }
      }
    }
  });
});

describe('what the browser must not do either', () => {
  const s = screen();

  it('a held Space or Enter on a button must not turn into repeated clicks', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      for (const focus of ['keyboardButton', 'mouseButton'] as const) {
        expect(holdsFromBrowser(key(code, { repeat: true, focus }), s)).toBe(true);
      }
    }
  });

  it('Space or Enter on a button that kept focus from a mouse click is ours, so the browser does not click it again', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      expect(holdsFromBrowser(key(code, { focus: 'mouseButton' }), s)).toBe(true);
      for (const overlay of OVERLAYS) {
        expect(holdsFromBrowser(key(code, { focus: 'mouseButton' }), screen({ overlay }))).toBe(true);
      }
    }
  });

  it('but the browser keeps Space and Enter on a button reached by keyboard', () => {
    for (const code of ['Space', 'Enter', 'NumpadEnter']) {
      expect(holdsFromBrowser(key(code, { focus: 'keyboardButton' }), s)).toBe(false);
    }
  });

  it('the notice answers Space and Enter itself, whatever has focus', () => {
    for (const focus of ['other', 'keyboardButton', 'mouseButton'] as const) {
      expect(holdsFromBrowser(key('Space', { focus }), screen({ overlay: 'notice' }))).toBe(true);
      expect(holdsFromBrowser(key('Enter', { focus }), screen({ overlay: 'notice', guard: true }))).toBe(true);
    }
  });

  it('leaves alone the keys it has no business with: typing, modifiers, composition, a control, other keys', () => {
    expect(holdsFromBrowser(key('Space', { typing: true, focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Space', { ctrl: true, focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Enter', { meta: true, focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Enter', { alt: true, focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Enter', { composing: true, focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Space', { focus: 'control' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Space', { repeat: true, focus: 'control' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Space'), s)).toBe(false);
    expect(holdsFromBrowser(key('Digit1', { focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Escape', { focus: 'mouseButton' }), s)).toBe(false);
    expect(holdsFromBrowser(key('Tab', { focus: 'keyboardButton' }), s)).toBe(false);
  });
});
