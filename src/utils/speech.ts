import { TextPart } from '../types/game';

/**
 * Who is speaking, written into the prose itself.
 *
 * A paragraph that is one person's spoken line begins with `{@id}` (`{@thierry}“行。”蒂埃里说。`).
 * The mark travels with its paragraph, so rewriting the text around it cannot leave a
 * portrait on the wrong line, and it is the same in both languages. Narration, the player's
 * own lines and anyone without an entry are left unmarked: no portrait is better than
 * someone else's.
 *
 * Nothing but the panel that draws a passage should ever show a mark; everything that
 * reads prose for another purpose strips it first.
 */

const MARK = /^\{@([a-z]+)\}/;
const MARKS = /(^|\n\n)\{@[a-z]+\}/g;
const BREAK = '\n\n';

/** The prose without its speaker marks. */
export function stripSpeech(text: string): string {
  return text.includes('{@') ? text.replace(MARKS, '$1') : text;
}

export function hasSpeech(text: string): boolean {
  return text.includes('{@') && text.split(BREAK).some(p => MARK.test(p));
}

/** One paragraph of a passage: who is speaking in it, if marked, and the stretches it is made of. */
export interface SpeechBlock {
  speaker: string | null;
  spans: TextPart[];
}

/**
 * A passage cut into paragraphs, keeping the stretches the difference hints have set back.
 * The marks are taken off here and are not in the spans.
 */
export function splitSpeech(text: string, parts?: TextPart[] | null): SpeechBlock[] {
  const stretches: TextPart[] = parts && parts.map(p => p.text).join('') === text ? parts : [{ text }];

  const paragraphs: TextPart[][] = [[]];
  for (const stretch of stretches) {
    const pieces = stretch.text.split(BREAK);
    pieces.forEach((piece, i) => {
      if (i > 0) paragraphs.push([]);
      if (piece) paragraphs[paragraphs.length - 1].push(stretch.known ? { text: piece, known: true } : { text: piece });
    });
  }

  return paragraphs.map(spans => {
    const first = spans[0];
    const found = first ? first.text.match(MARK) : null;
    if (!found || !first) return { speaker: null, spans };
    const rest = first.text.slice(found[0].length);
    const head: TextPart[] = rest ? [{ ...first, text: rest }] : [];
    return { speaker: found[1], spans: [...head, ...spans.slice(1)] };
  });
}
