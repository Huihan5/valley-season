import { describe, it, expect } from 'vitest';
import zh from '../src/data/zh';
import en from '../src/data/en';

/**
 * The two data directories are the same tree twice. TypeScript already refuses an
 * `en` bundle that is missing a key, but it has nothing to say about an array that
 * came back a line short or a `{playerName}` that got translated along with the
 * sentence around it. Those are the mistakes translation actually makes.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Every leaf, as `path -> value`, so a mismatch names the key it is in. */
function flatten(node: Json, path = '', out: Record<string, Json> = {}): Record<string, Json> {
  if (Array.isArray(node)) {
    out[`${path}[]`] = node.length;
    node.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, path ? `${path}.${key}` : key, out);
    }
  } else {
    out[path] = node;
  }
  return out;
}

const ZH = flatten(zh as unknown as Json);
const EN = flatten(en as unknown as Json);

/** `{playerName}` and the `{n}`-style slots the UI strings fill in. */
function placeholders(value: Json): string[] {
  if (typeof value !== 'string') return [];
  return (value.match(/\{\w+\}/g) ?? []).sort();
}

describe('zh and en are the same tree', () => {
  it('has the same keys on both sides', () => {
    const missing = Object.keys(ZH).filter(k => !(k in EN));
    const extra = Object.keys(EN).filter(k => !(k in ZH));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('has arrays of the same length on both sides', () => {
    const lengths = Object.keys(ZH).filter(k => k.endsWith('[]'));
    const wrong = lengths.filter(k => ZH[k] !== EN[k]);
    expect(wrong).toEqual([]);
  });

  it('keeps every placeholder through translation', () => {
    const wrong = Object.keys(ZH).filter(
      k => placeholders(ZH[k]).join('|') !== placeholders(EN[k]).join('|')
    );
    expect(wrong).toEqual([]);
  });

  it('keeps the paragraph breaks, which the renderer relies on', () => {
    const count = (v: Json) => (typeof v === 'string' ? v.split('\n\n').length : 0);
    const wrong = Object.keys(ZH).filter(
      k => typeof ZH[k] === 'string' && count(ZH[k]) !== count(EN[k])
    );
    expect(wrong).toEqual([]);
  });

  /**
   * The one key in `en` that is Chinese on purpose. The Chinese title screen puts
   * 河谷季 in the headline and VALLEY SEASON under it; the English one turns that
   * round, and keeps the original title as the small line. It is the same move a
   * Japanese game makes when it keeps its kanji title in an English release.
   *
   * Do not "fix" this by translating it. If the intent ever changes, remove the
   * key from both bundles rather than filling it in.
   */
  const CHINESE_ON_PURPOSE = ['ui.titleScreen.titleRoman'];

  const CJK = /[一-鿿]/;

  it('has no Chinese left in the English bundle', () => {
    const remaining = Object.keys(EN)
      .filter(k => typeof EN[k] === 'string' && CJK.test(EN[k] as string))
      .filter(k => !CHINESE_ON_PURPOSE.includes(k));
    expect(remaining).toEqual([]);
  });

  /** The mirror case: the Chinese title screen carries VALLEY SEASON as its small line. */
  const ENGLISH_ON_PURPOSE = ['ui.titleScreen.titleRoman'];

  it('has no English prose sitting in the Chinese bundle', () => {
    // A sentence that ended up in the wrong directory. What tells prose from an
    // identifier is the separator: prose puts spaces between words, `guarantee_letter`
    // and `random_lost_ox` do not. So count whitespace-separated words that are
    // nothing but letters, and call three of them a sentence.
    const englishWords = (s: string) =>
      s.replace(/\{\w+\}/g, '')
        .split(/\s+/)
        .map(t => t.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
        .filter(t => /^[A-Za-z]+$/.test(t))
        .length;

    const suspect = Object.keys(ZH).filter(k => {
      const v = ZH[k];
      if (typeof v !== 'string' || CJK.test(v)) return false;
      if (ENGLISH_ON_PURPOSE.includes(k)) return false;
      return englishWords(v) >= 3;
    });
    expect(suspect).toEqual([]);
  });

  it('closes every quotation it opens, on both sides', () => {
    // A dropped closing quote survives every other check here: the key is present,
    // the placeholders match, the paragraph count matches. It only shows up on
    // screen, in the middle of a scene. This caught one in day19_hunt_ride.
    const unbalanced = (bundle: Record<string, Json>, open: string, close: string) =>
      Object.entries(bundle).filter(([, v]) =>
        typeof v === 'string'
        && (v.split(open).length !== v.split(close).length)
      ).map(([k]) => k);

    expect(unbalanced(ZH, '「', '」')).toEqual([]);
    expect(unbalanced(ZH, '“', '”')).toEqual([]);
    expect(unbalanced(EN, '“', '”')).toEqual([]);
  });

  it('leaves identifiers alone', () => {
    // id, flag keys, resultKind and activationFlag are English already; a
    // translated one silently unhooks the event from the system that looks for it.
    const identifier = /(^|\.)(id|resultKind|activationFlag|nextEvent|next|target)$/;
    const wrong = Object.keys(ZH).filter(k => identifier.test(k) && ZH[k] !== EN[k]);
    expect(wrong).toEqual([]);
  });
});
