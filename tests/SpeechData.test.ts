import { describe, it, expect } from 'vitest';
import zh from '../src/data/zh';
import en from '../src/data/en';
import { isSpeakerId } from '../src/data/speakers';

/**
 * The speaker marks written into the prose (utils/speech.ts) are content, so the checks
 * here are about the content being consistent: the same lines are marked in both languages,
 * every mark names someone who can speak, and a mark only sits where a line is spoken.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function strings(node: Json, path = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === 'string') out[path] = node;
  else if (Array.isArray(node)) node.forEach((n, i) => strings(n, `${path}[${i}]`, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) strings(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

const ZH = strings(zh as unknown as Json);
const EN = strings(en as unknown as Json);

/** `path#paragraph -> speaker`, for every marked paragraph of every string. */
function marks(all: Record<string, string>): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [path, text] of Object.entries(all)) {
    text.split('\n\n').forEach((paragraph, i) => {
      const m = paragraph.match(/^\{@([a-z]+)\}/);
      if (m) found[`${path}#${i}`] = m[1];
    });
  }
  return found;
}

const ZH_MARKS = marks(ZH);
const EN_MARKS = marks(EN);

/** Only prose that is drawn by the scene panel is allowed to carry marks. */
const MAY_CARRY = /^(events|randomEvents|endings|scenes\.market)\b/;

describe('speaker marks in the data', () => {
  it('are used somewhere, so the check below is not about nothing', () => {
    expect(Object.keys(ZH_MARKS).length).toBeGreaterThan(50);
  });

  it('are the same lines in zh and en', () => {
    expect(EN_MARKS).toEqual(ZH_MARKS);
  });

  it('name someone who can speak', () => {
    const unknown = Object.entries(ZH_MARKS).filter(([, id]) => !isSpeakerId(id));
    expect(unknown).toEqual([]);
  });

  it('sit only at the start of a paragraph', () => {
    const stray = [...Object.entries(ZH), ...Object.entries(EN)]
      .filter(([, text]) => text.split('\n\n').some(p => p.slice(1).includes('{@')));
    expect(stray.map(([path]) => path)).toEqual([]);
  });

  it('are only in prose the scene panel draws', () => {
    const wrong = Object.keys(ZH_MARKS).filter(key => !MAY_CARRY.test(key));
    expect(wrong).toEqual([]);
  });

  it('go in front of a spoken line, in both languages', () => {
    const notSpoken = (all: Record<string, string>) => Object.keys(ZH_MARKS).filter(key => {
      const [path, index] = key.split('#');
      const paragraph = all[path].split('\n\n')[Number(index)];
      return !/^\{@[a-z]+\}[“‘]/.test(paragraph);
    });
    expect(notSpoken(ZH)).toEqual([]);
    expect(notSpoken(EN)).toEqual([]);
  });
});
