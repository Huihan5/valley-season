import { describe, it, expect } from 'vitest';
import { SaveStorage } from '../src/systems/SaveSystem';
import { readSeenEndings, recordEnding, clearSeenEndings } from '../src/systems/CollectionSystem';

/** vitest runs under `environment: 'node'`, so localStorage has to be handed in. */
function fakeStorage(seed: Record<string, string> = {}): SaveStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: key => { map.delete(key); },
  };
}

const KEY = 'valley-season:endings';

describe('the ending gallery', () => {
  it('starts empty', () => {
    expect(readSeenEndings(fakeStorage())).toEqual([]);
  });

  it('remembers an ending across seasons', () => {
    const storage = fakeStorage();
    recordEnding('ending2', storage);
    expect(readSeenEndings(storage)).toEqual(['ending2']);
  });

  /** Reaching the same ending twice, or reloading a finished save, changes nothing. */
  it('records an ending once however many times it is reached', () => {
    const storage = fakeStorage();
    recordEnding('ending3', storage);
    recordEnding('ending3', storage);
    recordEnding('ending3', storage);
    expect(readSeenEndings(storage)).toEqual(['ending3']);
  });

  it('lists endings in the order the game numbers them, not the order they were seen', () => {
    const storage = fakeStorage();
    recordEnding('ending4b', storage);
    recordEnding('ending1', storage);
    recordEnding('ending3', storage);
    expect(readSeenEndings(storage)).toEqual(['ending1', 'ending3', 'ending4b']);
  });

  it('can be cleared', () => {
    const storage = fakeStorage();
    recordEnding('ending1', storage);
    clearSeenEndings(storage);
    expect(readSeenEndings(storage)).toEqual([]);
  });
});

describe('a record that cannot be trusted', () => {
  it('reads as empty when the value is not JSON', () => {
    expect(readSeenEndings(fakeStorage({ [KEY]: 'not json{' }))).toEqual([]);
  });

  it('reads as empty when the value is JSON but not a list', () => {
    expect(readSeenEndings(fakeStorage({ [KEY]: '{"ending1":true}' }))).toEqual([]);
  });

  /** A hand-edited file should not put a sixth ending into the gallery. */
  it('drops ids the game does not have', () => {
    const storage = fakeStorage({ [KEY]: '["ending1","ending9","the-good-one"]' });
    expect(readSeenEndings(storage)).toEqual(['ending1']);
  });

  it('survives storage being unavailable altogether', () => {
    expect(readSeenEndings(null)).toEqual([]);
    expect(() => recordEnding('ending1', null)).not.toThrow();
    expect(() => clearSeenEndings(null)).not.toThrow();
  });
});
