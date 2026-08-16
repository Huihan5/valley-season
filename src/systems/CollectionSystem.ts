import { SaveStorage } from './SaveSystem';
import { ENDING_IDS, EndingId } from './EndingSystem';

/**
 * Which endings this browser has seen, across every season played in it.
 *
 * Deliberately not part of `GameState`, for the same reason the locale is not: it
 * outlives the season. Putting it in the save would force `SAVE_VERSION` to 2 and,
 * worse, tie the record to one save file — so branching from a Day 27 slot, which
 * is what the three manual slots exist for, would keep overwriting its own history.
 */

const KEY = 'valley-season:endings';

function defaultStorage(): SaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access alone can throw under some privacy settings.
    return null;
  }
}

function isEndingId(value: unknown): value is EndingId {
  return typeof value === 'string' && (ENDING_IDS as readonly string[]).includes(value);
}

/** In the order the game numbers them, not the order they were seen. */
export function readSeenEndings(storage = defaultStorage()): EndingId[] {
  if (!storage) return [];
  let parsed: unknown;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    // A hand-edited or half-written value costs the player their gallery, not their game.
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = parsed.filter(isEndingId);
  return ENDING_IDS.filter(id => seen.includes(id));
}

/** Idempotent: reaching the same ending twice, or loading a finished save, changes nothing. */
export function recordEnding(id: EndingId, storage = defaultStorage()): void {
  if (!storage) return;
  const seen = readSeenEndings(storage);
  if (seen.includes(id)) return;
  try {
    storage.setItem(KEY, JSON.stringify([...seen, id]));
  } catch {
    // A full quota should not take the ending screen down with it.
  }
}

export function clearSeenEndings(storage = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to do — the record stays where it was.
  }
}
