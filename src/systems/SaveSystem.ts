import { GameState, DayPhase } from '../types/game';
import { INITIAL_FLAGS } from './FlagRegistry';

/**
 * Saving is a copy of the state and nothing else (PlaytestFeedback 4.h).
 *
 * `GameState` is plain data all the way down — no functions, no dates, no class
 * instances — and every random result is already resolved into it by the time it
 * is stored. The scene text, the action result, the variant a random event drew:
 * all of them were decided when the phase was built. Loading therefore returns
 * the player to the exact season they left, not to a season that gets rerolled
 * around them.
 */

/** Bump when the shape of GameState changes. Older saves are then refused, not guessed at. */
export const SAVE_VERSION = 1;

export const AUTO_SLOT = 'auto';
export const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type ManualSlot = typeof MANUAL_SLOTS[number];

const KEY_PREFIX = 'valley-season:save:';

export interface SaveSummary {
  slot: string;
  day: number;
  phase: DayPhase;
  /** ISO string, written at save time. */
  savedAt: string;
  /** True once the season has ended — the slot holds an ending, not a position. */
  finished: boolean;
}

interface SaveFile extends SaveSummary {
  version: number;
  state: GameState;
}

/** Anything with the three methods we use. localStorage satisfies it; so does a Map in tests. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): SaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Storage can throw on access alone under some privacy settings.
    return null;
  }
}

// ── 纯函数（可在 node 下测） ────────────────────────────────────────────────

export function packSave(slot: string, state: GameState, savedAt = new Date().toISOString()): string {
  const file: SaveFile = {
    slot,
    day: state.day,
    phase: state.phase,
    savedAt,
    finished: state.demoComplete,
    version: SAVE_VERSION,
    state,
  };
  return JSON.stringify(file);
}

/**
 * A save is refused rather than repaired when it comes from another build. What
 * is repaired is only the flag map: a save written before a flag existed reads
 * that flag as undefined otherwise, and half the game asks flags questions.
 */
export function unpackSave(raw: string | null): GameState | null {
  if (!raw) return null;
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(raw);
  } catch {
    return null;
  }
  if (file?.version !== SAVE_VERSION || !file.state) return null;

  return { ...file.state, flags: { ...INITIAL_FLAGS, ...file.state.flags } };
}

export function readSummary(raw: string | null): SaveSummary | null {
  if (!raw) return null;
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(raw);
  } catch {
    return null;
  }
  if (file?.version !== SAVE_VERSION || !file.state) return null;

  return {
    slot: String(file.slot ?? ''),
    day: Number(file.day ?? file.state.day),
    phase: (file.phase ?? file.state.phase) as DayPhase,
    savedAt: String(file.savedAt ?? ''),
    finished: !!file.finished,
  };
}

// ── 存储 ────────────────────────────────────────────────────────────────────

// Writing must never take the game down with it: a full quota or a locked-down
// browser costs the player their save, not their season.
export function writeSlot(slot: string, state: GameState, storage = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY_PREFIX + slot, packSave(slot, state));
    return true;
  } catch {
    return false;
  }
}

export function readSlot(slot: string, storage = defaultStorage()): GameState | null {
  if (!storage) return null;
  try {
    return unpackSave(storage.getItem(KEY_PREFIX + slot));
  } catch {
    return null;
  }
}

export function readSlotSummary(slot: string, storage = defaultStorage()): SaveSummary | null {
  if (!storage) return null;
  try {
    return readSummary(storage.getItem(KEY_PREFIX + slot));
  } catch {
    return null;
  }
}

export function clearSlot(slot: string, storage = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY_PREFIX + slot);
  } catch {
    // Nothing to do — the slot stays where it was.
  }
}

/** The three manual slots in order, with null for the empty ones. */
export function listManualSlots(storage = defaultStorage()): (SaveSummary | null)[] {
  return MANUAL_SLOTS.map(slot => readSlotSummary(slot, storage));
}
