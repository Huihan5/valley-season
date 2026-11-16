/**
 * What a key press means. Pure: it is handed a described key and a described screen and says what,
 * if anything, the game should do; the listener (components/common/useHotkeys) does the doing.
 * Nothing here reaches the reducer, and nothing here is prose.
 *
 * The keys are matched on `event.code`, so a Chinese IME or a layout that is not QWERTY does not
 * change what a key is. Digits choose, space and enter read on, escape closes or opens the menu.
 * Everything that could act twice or act by accident is refused here: a held key, a modifier, a
 * key typed into a field, a key pressed while an input method is composing, and the first moments
 * of a new screen (the guard).
 */

export type Surface = 'title' | 'nameEntry' | 'opening' | 'season' | 'ending';

/** Something laid over the screen that Escape closes. The topmost one is the one described. */
export type Overlay = 'notice' | 'document' | 'satchel' | 'codex' | 'saves' | 'retrospect' | 'sound';

/** What the screen is waiting for: a 继续, numbered choices, a field to fill in, or nothing. */
export type Beat = 'continue' | 'choices' | 'input' | 'none';

/**
 * Where keyboard focus sits, as far as Space and Enter care:
 * - `keyboardButton`: a button the user reached with the keyboard (`:focus-visible`); the browser
 *   owns Space and Enter there.
 * - `mouseButton`: a button that merely kept focus from a mouse click; our handler owns the key,
 *   so the browser does not click it a second time.
 * - `control`: a checkbox, radio or slider; Space, Enter and the arrows are its own.
 * - `other`: nothing in particular.
 */
export type FocusKind = 'other' | 'keyboardButton' | 'mouseButton' | 'control';

export interface KeyDescription {
  /** `event.code`. */
  code: string;
  repeat: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** An input method is composing (`isComposing`, or keyCode 229). */
  composing: boolean;
  /** The key went to a text field, textarea, select or contenteditable. */
  typing: boolean;
  focus: FocusKind;
}

export interface ScreenDescription {
  surface: Surface;
  /** The topmost overlay, or null when there is none. */
  overlay: Overlay | null;
  beat: Beat;
  /** The screen has just changed: choose and continue are held back. */
  guard: boolean;
}

export type KeyIntent =
  | { kind: 'none' }
  | { kind: 'choose'; n: number }
  /** Scroll the reading down; at its bottom, go on and continue if `continues`. */
  | { kind: 'readOn'; continues: boolean }
  | { kind: 'closeOverlay' }
  | { kind: 'ackNotice' }
  | { kind: 'openMenu' };

const NONE: KeyIntent = { kind: 'none' };

/** The most numbered choices there are: the keys 1 to 9. */
export const MAX_NUMBERED = 9;

/** 1 to 9 for Digit1–Digit9 and Numpad1–Numpad9, otherwise null. */
export function digitOf(code: string): number | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) : null;
}

export const isSpace = (code: string) => code === 'Space';
export const isEnter = (code: string) => code === 'Enter' || code === 'NumpadEnter';
export const isEscape = (code: string) => code === 'Escape';

const inSeason = (s: Surface) => s === 'season' || s === 'ending';
const hasReading = (s: Surface) => s === 'season' || s === 'ending' || s === 'opening';

/** The key is refused whatever the screen: held, modified, composing, or typed into a field. */
function refused(key: KeyDescription): boolean {
  return key.repeat || key.ctrl || key.meta || key.alt || key.composing || key.typing;
}

export function decideKey(key: KeyDescription, screen: ScreenDescription): KeyIntent {
  if (refused(key)) return NONE;
  const { surface, overlay, beat, guard } = screen;

  // ── Escape ─────────────────────────────────────────────────────────────────
  if (isEscape(key.code)) {
    if (overlay === 'notice') return guard ? NONE : { kind: 'closeOverlay' };
    if (overlay) return { kind: 'closeOverlay' };
    return inSeason(surface) ? { kind: 'openMenu' } : NONE;
  }

  const space = isSpace(key.code);
  const enter = isEnter(key.code);
  const digit = digitOf(key.code);
  if (!space && !enter && digit === null) return NONE;

  // A checkbox or slider keeps Space, Enter and the digits for itself.
  if (key.focus === 'control') return NONE;

  // ── An overlay is open ─────────────────────────────────────────────────────
  if (overlay) {
    // The notice is read, then acknowledged; it is the only overlay Space and Enter answer.
    if (overlay === 'notice' && (space || enter)) return guard || key.shift ? NONE : { kind: 'ackNotice' };
    return NONE;
  }

  if (!hasReading(surface)) return NONE;

  // ── Digits ─────────────────────────────────────────────────────────────────
  if (digit !== null) {
    if (guard || beat !== 'choices' || surface === 'ending') return NONE;
    return { kind: 'choose', n: digit };
  }

  // ── Space and Enter: read on ───────────────────────────────────────────────
  // Shift+Space is the browser's own "up"; leave it. A button the user reached by keyboard is
  // the browser's too.
  if (key.shift || key.focus === 'keyboardButton') return NONE;
  // The ending's only button starts a new season and clears the autosave: never a key.
  if (beat === 'continue') return { kind: 'readOn', continues: !guard && surface !== 'ending' };
  // With choices (or a field, or an ending) space only scrolls; enter does nothing.
  return space ? { kind: 'readOn', continues: false } : NONE;
}

/**
 * Whether the browser's own action for this key must be stopped even when the game did nothing
 * with it (the listener also stops it whenever the game did use the key):
 * - Space or Enter on a button that merely kept focus from a mouse click, which the browser would
 *   click again;
 * - Space or Enter while a notice is up, which we answer ourselves (or, in the guard, not at all);
 * - a repeat of Space or Enter on any button, which the browser would turn into repeated clicks.
 * Modifiers, composition and typing leave the browser alone, as does a control's own key.
 */
export function holdsFromBrowser(key: KeyDescription, screen: ScreenDescription): boolean {
  if (key.ctrl || key.meta || key.alt || key.composing || key.typing) return false;
  if (!isSpace(key.code) && !isEnter(key.code)) return false;
  if (key.focus === 'control') return false;
  if (key.repeat) return key.focus === 'keyboardButton' || key.focus === 'mouseButton';
  if (screen.overlay === 'notice') return true;
  return key.focus === 'mouseButton';
}
