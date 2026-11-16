import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Beat, FocusKind, KeyDescription, KeyIntent, ScreenDescription, Surface,
  decideKey, holdsFromBrowser, isSpace,
} from '../../systems/KeySystem';
import {
  HOTKEY_GUARD_MS, READ_ON_BOTTOM_SLACK_PX, READ_ON_SCROLL_FRACTION, READ_ON_SMOOTH_GRACE_MS,
} from '../../data/config';
import { closeTopOverlay, topOverlay } from './useEscape';

/**
 * The browser half of the keyboard controls: one listener, the scroll check, and finding and
 * clicking the numbered button. What a key means is KeySystem's; this only reads the page and acts.
 *
 * It clicks the real buttons, so the click sound and every existing code path stay as they are.
 * The buttons carry data attributes: `data-hotkey-choice` (a numbered choice, in reading order),
 * `data-hotkey-continue` (a 继续), and `data-reading` marks the reading column.
 */

interface Options {
  surface: Surface;
  beat: Beat;
  /** Changes whenever the screen does (a new step, a new opening page); the guard restarts on it. */
  screenKey: string;
  /** What Escape does with nothing open: exactly what the header's 存档 button does. */
  onOpenMenu: () => void;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const scrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

// ── Reading the page ────────────────────────────────────────────────────────

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);
const CONTROL_INPUT_TYPES = new Set(['checkbox', 'radio', 'range']);

function classify(target: EventTarget | null): { typing: boolean; focus: FocusKind } {
  const el = target instanceof Element ? target : null;
  if (!el || el === document.body || el === document.documentElement) return { typing: false, focus: 'other' };
  if ((el as HTMLElement).isContentEditable) return { typing: true, focus: 'other' };
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return { typing: true, focus: 'other' };
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    if (CONTROL_INPUT_TYPES.has(type)) return { typing: false, focus: 'control' };
    if (TEXT_INPUT_TYPES.has(type)) return { typing: true, focus: 'other' };
  }
  const pressable = el.closest('button, [role="button"], a[href], summary, input');
  if (!pressable) return { typing: false, focus: 'other' };
  let visible = true;
  try {
    visible = pressable.matches(':focus-visible');
  } catch {
    // No :focus-visible: leave Space and Enter to the browser rather than risk acting twice.
    visible = true;
  }
  return { typing: false, focus: visible ? 'keyboardButton' : 'mouseButton' };
}

const isRendered = (el: Element) => el.getClientRects().length > 0;

/** The part of the page `el` could be seen in: the viewport, narrowed by every ancestor that clips. */
function visibleBand(el: Element): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (overflowY === 'visible') continue;
    const r = p.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, bottom };
}

/** At least partly inside the visible reading area. */
function partlyVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const band = visibleBand(el);
  const overlap = Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top);
  return overlap > Math.min(2, r.height);
}

/**
 * The element that scrolls the reading and still has more than a few pixels left below, or null at
 * the bottom. At desktop width that is the reading column itself; below lg it is the page container.
 * When the page scrolls, "the bottom" is the end of the reading, not of the status panels under it.
 */
function findScroller(): HTMLElement | null {
  const reading = document.querySelector<HTMLElement>('[data-reading]');
  const candidates: HTMLElement[] = [];
  for (let el: HTMLElement | null = reading; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') candidates.push(el);
  }
  if (document.scrollingElement instanceof HTMLElement) candidates.push(document.scrollingElement);

  for (const el of candidates) {
    if (el.scrollHeight <= el.clientHeight) continue;
    let remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (reading && el !== reading) {
      const bottom = el === document.scrollingElement ? window.innerHeight : el.getBoundingClientRect().bottom;
      remaining = Math.min(remaining, reading.getBoundingClientRect().bottom - bottom);
    }
    if (remaining > READ_ON_BOTTOM_SLACK_PX) return el;
  }
  return null;
}

function scrollDown(el: HTMLElement) {
  const before = el.scrollTop;
  const by = Math.round(el.clientHeight * READ_ON_SCROLL_FRACTION);
  el.scrollBy({ top: by, behavior: scrollBehavior() });
  // Where a smooth scroll never starts (a page that is not being painted, a browser with it
  // switched off) the key would do nothing, and the bottom that lets it continue would never
  // come: if nothing has moved after a moment, jump instead.
  window.setTimeout(() => {
    if (el.scrollTop === before) el.scrollTop = before + by;
  }, READ_ON_SMOOTH_GRACE_MS);
}

function clickable(selector: string): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)].filter(isRendered);
}

// ── The hook ────────────────────────────────────────────────────────────────

export function useHotkeys(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  // Until when the choose and continue keys are held back; restarted by every new screen and every use.
  const guardUntil = useRef(0);
  // Space was taken on keydown: its keyup must not click a button either (some browsers click on keyup).
  const spaceTaken = useRef(false);

  useLayoutEffect(() => {
    guardUntil.current = now() + HOTKEY_GUARD_MS;
  }, [options.screenKey]);

  useEffect(() => {
    const perform = (intent: KeyIntent): boolean => {
      switch (intent.kind) {
        case 'none':
          return false;
        case 'closeOverlay':
        case 'ackNotice': {
          const closed = closeTopOverlay();
          if (closed && intent.kind === 'ackNotice') guardUntil.current = now() + HOTKEY_GUARD_MS;
          return closed;
        }
        case 'openMenu':
          latest.current.onOpenMenu();
          return true;
        case 'choose': {
          const button = clickable('[data-hotkey-choice]')[intent.n - 1];
          if (!button || button.disabled) return false;
          if (!partlyVisible(button)) {
            // Out of sight: bring it in; the next press chooses.
            button.scrollIntoView?.({ block: 'nearest' });
            return true;
          }
          guardUntil.current = now() + HOTKEY_GUARD_MS;
          button.click();
          return true;
        }
        case 'readOn': {
          const scroller = findScroller();
          if (scroller) {
            scrollDown(scroller);
            return true;
          }
          if (!intent.continues) return false;
          const button = clickable('[data-hotkey-continue]').find(b => !b.disabled);
          if (!button) return false;
          guardUntil.current = now() + HOTKEY_GUARD_MS;
          button.click();
          return true;
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const { typing, focus } = classify(e.target);
      const key: KeyDescription = {
        code: e.code,
        repeat: e.repeat,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
        composing: e.isComposing || e.keyCode === 229,
        typing,
        focus,
      };
      const { surface, beat } = latest.current;
      const screen: ScreenDescription = { surface, beat, overlay: topOverlay(), guard: now() < guardUntil.current };

      const used = perform(decideKey(key, screen));
      let hold = used || holdsFromBrowser(key, screen);
      // A held Space the game already took must not turn into a page scroll or a click either.
      if (!hold && key.repeat && isSpace(e.code) && spaceTaken.current) hold = true;
      if (!hold) return;
      e.preventDefault();
      if (isSpace(e.code)) spaceTaken.current = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSpace(e.code) || !spaceTaken.current) return;
      spaceTaken.current = false;
      e.preventDefault();
    };

    const onBlur = () => { spaceTaken.current = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
