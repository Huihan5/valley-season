import { useEffect, useRef } from 'react';
import type { Overlay } from '../../systems/KeySystem';

/**
 * One small stack of the things Escape closes, the last registered on top. Each overlay (and the
 * sound popover) registers while it is open; the keyboard listener (useHotkeys) asks which is on
 * top and runs it, so a single Escape closes exactly one thing and never two. The "open the menu"
 * rule sits below the stack: it applies only when the stack is empty (KeySystem).
 */

interface Entry {
  id: number;
  kind: Overlay;
  close: () => void;
}

const stack: Entry[] = [];
let nextId = 1;

/** The overlay Escape would close now, or null when none is open. */
export function topOverlay(): Overlay | null {
  return stack.length > 0 ? stack[stack.length - 1].kind : null;
}

/** Run the topmost close handler. Returns whether there was one. */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/**
 * Register `handler` as what Escape does while `active`. The handler may change between
 * renders; the latest one runs.
 */
export function useEscape(handler: () => void, active: boolean, kind: Overlay) {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!active) return;
    const entry: Entry = { id: nextId++, kind, close: () => latest.current() };
    stack.push(entry);
    return () => {
      const i = stack.findIndex(e => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active, kind]);
}
