/**
 * Seeded randomness. Every draw in a season comes from the season's seed, so the same
 * seed and the same list of player actions produce the same season — which is what
 * lets a save be replayed under the other language (see GameEngine.replaySeason).
 */

/** FNV-1a over the parts, folded to an unsigned 32-bit number. */
export function hashParts(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join('\u0001')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast generator whose whole state is one 32-bit number. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator for one purpose: the same parts always give the same stream. */
export function seededRng(...parts: (number | string)[]): () => number {
  return createRng(hashParts(...parts));
}

/** The one place a season's seed is born. Called outside the reducer, never inside it. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
