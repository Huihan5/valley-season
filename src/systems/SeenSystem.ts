import { DayPhase, KeyedPart, SeenRecord, TextPart } from '../types/game';
import { PHASE_ORDER } from './TimeSystem';

/**
 * Difference hints. Repetition is the estate's rhythm and stays on the page; what the
 * player is helped to notice is what is new. A line that rests on a state of the world
 * is set back a step when it says what it said the last time it was shown, and left
 * alone when the state has moved on, so the eye lands on what changed. A new act changes
 * every base text at once, so nothing is set back and nothing needs special handling.
 */

/**
 * Which day-and-phase this is, as one number that only ever goes up. A scene is dated
 * by this: it is composed again when the clock has not moved (a market sale), and then
 * it has to read the same. A result is dated by the action that made it instead, so
 * a slot is only ever used by one of the two.
 */
export function instantOf(moment: { day: number; phase: DayPhase }): number {
  return moment.day * PHASE_ORDER.length + PHASE_ORDER.indexOf(moment.phase);
}

export function partsText(parts: Pick<TextPart, 'text'>[]): string {
  return parts.map(p => p.text).join('');
}

export interface Marked {
  parts: TextPart[];
  seen: Record<string, SeenRecord>;
  /** False when there is nothing to set back, in which case the plain string is enough. */
  anyKnown: boolean;
}

/**
 * Compare each keyed part with what its slot said last time, and note what it says now.
 * Asking twice about the same moment answers the same: the second time round compares
 * against what the slot said before this moment, not against itself.
 */
export function markKnown(
  parts: KeyedPart[],
  seen: Record<string, SeenRecord> | undefined,
  at: number,
): Marked {
  const next = { ...(seen ?? {}) };
  const marked: TextPart[] = [];
  let anyKnown = false;

  for (const part of parts) {
    if (!part.text) continue;
    let known = false;
    if (part.slot !== undefined && part.key !== undefined) {
      const record = next[part.slot];
      const previous = record && record.at === at ? record.before : (record?.key ?? null);
      known = previous === part.key;
      next[part.slot] = { key: part.key, at, before: previous };
    }
    anyKnown = anyKnown || known;

    // Neighbours that read the same way are one stretch. A paragraph break is nothing to
    // see, so it goes with the stretch before it.
    const last = marked[marked.length - 1];
    const isBreak = part.slot === undefined && !part.text.trim();
    if (last && (isBreak || !!last.known === known)) last.text += part.text;
    else marked.push(known ? { text: part.text, known: true } : { text: part.text });
  }

  return { parts: marked, seen: next, anyKnown };
}
