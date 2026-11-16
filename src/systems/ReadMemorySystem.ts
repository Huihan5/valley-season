import { GameState, TextPart } from '../types/game';
import { READ_MEMORY_MIN_CHARS } from '../data/config';
import { SaveStorage } from './SaveSystem';

/**
 * What this browser has read, across seasons. A second season walks the same mornings past
 * the same paragraphs; with the setting on, prose read in an earlier season is set back a step,
 * the way the difference hints set back a line that says what it said last time.
 *
 * Kept apart from the season for the same reason the gallery is (CollectionSystem): it outlives
 * a season and belongs to no save. Nothing here reaches the reducer or `GameState`; it is read
 * only when a screen is drawn. Recording is always on, whatever the setting says, so turning the
 * setting on later finds the earlier seasons already remembered.
 *
 * A paragraph is remembered by the season it was last read in and the furthest step it was read
 * at there. That is enough to tell "read in another season" from "read from here on in this one"
 * (the player has come back to an earlier point), and to leave alone what was read earlier along
 * the same season's own line, which is the hints' business.
 *
 * The rule for the same season: `furthest` is the largest step any paragraph of this season was
 * read at. At the frontier (step >= furthest: ordinary forward play, or picking the season up
 * again where it was left) nothing of this season is set back. Once the player stands earlier than
 * the furthest point they have read to, everything read from that step onward is: walking the same
 * mornings again meets each screen at the very step it was recorded at, so the test is "at or
 * after this step", not "after".
 */

/** One paragraph's record: the seed it was last read under, the furthest step there, and whether another season read it first. */
export interface ReadRecord {
  s: number;
  t: number;
  o?: 1;
}

export type ReadMemory = Record<string, ReadRecord>;

/** A screen as it was shown: the two passages the dimming applies to, and when they were on screen. */
export interface ReadScreen {
  seed: number;
  step: number;
  playerName: string;
  texts: string[];
}

const NAME_PLACEHOLDER = '{playerName}';
const SPEAKER_MARK = /^\{@[a-z]+\}/;

// ── Paragraphs ──────────────────────────────────────────────────────────────

/** A passage cut where the page cuts it: at runs of newlines. Empty paragraphs are dropped. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n+/).filter(p => p.trim() !== '');
}

/**
 * What makes two paragraphs the same prose: trimmed, the player's name taken out, and every
 * number the same (the yield "5 units" and "17 units" is one sentence read twice).
 */
export function normaliseParagraph(paragraph: string, playerName = ''): string {
  let text = paragraph.trim();
  const name = playerName.trim();
  if (name) text = text.split(name).join(NAME_PLACEHOLDER);
  // A whole number goes, not each digit: "9 units" and "12 units" are the same sentence.
  return text.replace(/[0-9]+/g, '#');
}

/** Long enough to count as something read. The speaker mark is not prose and is not counted. */
export function isMemorable(paragraph: string): boolean {
  return paragraph.trim().replace(SPEAKER_MARK, '').replace(/\s/g, '').length >= READ_MEMORY_MIN_CHARS;
}

/** cyrb53: a 53-bit string hash, written in base 36. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The key a paragraph is remembered under, or null when it is too short to remember. */
export function paragraphKey(paragraph: string, playerName = ''): string | null {
  if (!isMemorable(paragraph)) return null;
  return hashText(normaliseParagraph(paragraph, playerName));
}

// ── The rule ────────────────────────────────────────────────────────────────

export function recordRead(rec: ReadRecord | undefined, seed: number, step: number): ReadRecord {
  if (!rec) return { s: seed, t: step };
  if (rec.s === seed) {
    const t = Math.max(rec.t, step);
    return rec.o === 1 ? { s: seed, t, o: 1 } : { s: seed, t };
  }
  return { s: seed, t: step, o: 1 };
}

/** The furthest step any remembered paragraph was read at under this seed; 0 when none was. */
export function furthestStep(memory: ReadMemory, seed: number): number {
  let furthest = 0;
  for (const rec of Object.values(memory)) {
    if (rec.s === seed && rec.t > furthest) furthest = rec.t;
  }
  return furthest;
}

/**
 * Read before, as far as this screen is concerned: in another season; or in this one when the
 * player stands earlier than the furthest point they have read to (`step < furthest`) and the
 * paragraph was read at this step or later. At the frontier nothing of this season counts, and
 * what was read earlier along this season's own line does not either.
 */
export function isReadAt(rec: ReadRecord | undefined, seed: number, step: number, furthest: number): boolean {
  if (!rec) return false;
  if (rec.s !== seed) return true;
  return rec.o === 1 || (step < furthest && rec.t >= step);
}

/** The screen a state puts in front of the player, or null when there is nothing to remember. */
export function screenOf(state: GameState): ReadScreen | null {
  if (state.openingPage !== null || state.seed === undefined || state.step === undefined) return null;
  return {
    seed: state.seed,
    step: state.step,
    playerName: state.playerName,
    texts: [state.lastResult ?? '', state.currentSceneText ?? ''],
  };
}

/** Remember every paragraph of a screen. Returns the same object when nothing changed. */
export function recordScreen(memory: ReadMemory, screen: ReadScreen): ReadMemory {
  let next: ReadMemory | null = null;
  for (const text of screen.texts) {
    for (const paragraph of splitParagraphs(text)) {
      const key = paragraphKey(paragraph, screen.playerName);
      if (!key) continue;
      const before = (next ?? memory)[key];
      const after = recordRead(before, screen.seed, screen.step);
      if (before && before.s === after.s && before.t === after.t && before.o === after.o) continue;
      if (!next) next = { ...memory };
      next[key] = after;
    }
  }
  return next ?? memory;
}

/** Whether a paragraph counts as read on the screen at (seed, step). */
export function paragraphReader(
  memory: ReadMemory,
  seed: number,
  step: number,
  playerName = '',
): (paragraph: string) => boolean {
  // Once per reader, not per paragraph: a screen asks this for every paragraph it draws.
  const furthest = furthestStep(memory, seed);
  return (paragraph) => {
    const key = paragraphKey(paragraph, playerName);
    return key !== null && isReadAt(memory[key], seed, step, furthest);
  };
}

/**
 * The parts a passage is drawn with, once what was read is set back too. The hints' own parts
 * are kept (`known` stays where they put it); a paragraph that counts as read is set back whole.
 * The parts join to exactly `text`, speaker marks and breaks included, which is what the panel
 * checks before using them. When nothing is read, the input comes back untouched.
 */
export function withReadParts(
  text: string,
  hintParts: TextPart[] | null | undefined,
  isRead: (paragraph: string) => boolean,
): TextPart[] | null | undefined {
  // Where each paragraph sits in the text, and whether it is read.
  const ranges: { start: number; end: number; read: boolean }[] = [];
  const breaks = /\n+/g;
  let from = 0;
  let anyRead = false;
  const take = (start: number, end: number) => {
    const paragraph = text.slice(start, end);
    if (!paragraph.trim()) return;
    const read = isRead(paragraph);
    anyRead = anyRead || read;
    ranges.push({ start, end, read });
  };
  for (let m = breaks.exec(text); m; m = breaks.exec(text)) {
    take(from, m.index);
    from = m.index + m[0].length;
  }
  take(from, text.length);
  if (!anyRead) return hintParts;

  // The hints' parts, if they still describe this text; otherwise the text as one stretch.
  const base: TextPart[] = hintParts && hintParts.map(p => p.text).join('') === text ? hintParts : [{ text }];

  const out: TextPart[] = [];
  const push = (piece: string, known: boolean | null) => {
    if (!piece) return;
    const last = out[out.length - 1];
    // A break between paragraphs reads as nothing; it goes with whatever came before it.
    const k = known ?? !!last?.known;
    if (last && !!last.known === k) last.text += piece;
    else out.push(k ? { text: piece, known: true } : { text: piece });
  };

  // Cut wherever a hint part or a paragraph begins or ends; each piece then has one of each.
  const cuts = new Set<number>([0, text.length]);
  const partAt: { start: number; known: boolean }[] = [];
  let offset = 0;
  for (const part of base) {
    partAt.push({ start: offset, known: !!part.known });
    cuts.add(offset);
    offset += part.text.length;
  }
  for (const r of ranges) { cuts.add(r.start); cuts.add(r.end); }
  const points = [...cuts].sort((a, b) => a - b);

  let p = 0;
  let r = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    while (p + 1 < partAt.length && partAt[p + 1].start <= a) p++;
    while (r < ranges.length && ranges[r].end <= a) r++;
    const range = r < ranges.length && ranges[r].start <= a ? ranges[r] : null;
    const hinted = partAt[p]?.known ?? false;
    // Outside every paragraph is a break: it has nothing of its own to say.
    push(text.slice(a, b), range ? hinted || range.read : hinted ? true : null);
  }
  return out;
}

// ── Storage ─────────────────────────────────────────────────────────────────

export const READ_MEMORY_KEY = 'valley-season:read';
export const READING_SETTINGS_KEY = 'valley-season:reading';

type Store = Pick<SaveStorage, 'getItem' | 'setItem'>;

function defaultStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access alone can throw under some privacy settings.
    return null;
  }
}

function isRecord(value: unknown): value is ReadRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.s === 'number' && Number.isFinite(r.s)
    && typeof r.t === 'number' && Number.isFinite(r.t)
    && (r.o === undefined || r.o === 1);
}

/** A missing, blocked or hand-edited value reads as nothing read: it costs the dimming, never the game. */
export function readReadMemory(storage: Store | null = defaultStorage()): ReadMemory {
  if (!storage) return {};
  let parsed: unknown;
  try {
    const raw = storage.getItem(READ_MEMORY_KEY);
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const memory: ReadMemory = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isRecord(value)) memory[key] = value.o === 1 ? { s: value.s, t: value.t, o: 1 } : { s: value.s, t: value.t };
  }
  return memory;
}

export function writeReadMemory(memory: ReadMemory, storage: Store | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(READ_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // A full quota costs the memory of this screen, not the screen.
  }
}

/** What the player has set for reading. It lives in the browser, beside the sound. */
export interface ReadingSettings {
  /** Set back prose read in an earlier season. Off until the player turns it on. */
  dimRead: boolean;
}

export function readReadingSettings(storage: Store | null = defaultStorage()): ReadingSettings {
  const fallback: ReadingSettings = { dimRead: false };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(READING_SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { dimRead?: unknown } | null;
    return { dimRead: parsed?.dimRead === true };
  } catch {
    return fallback;
  }
}

export function writeReadingSettings(settings: ReadingSettings, storage: Store | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(READING_SETTINGS_KEY, JSON.stringify({ dimRead: settings.dimRead === true }));
  } catch {
    // nothing to do: the setting just does not outlast this page
  }
}
