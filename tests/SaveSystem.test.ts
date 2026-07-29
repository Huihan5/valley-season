import { describe, it, expect } from 'vitest';
import { GameState, NpcId } from '../src/types/game';
import {
  SAVE_VERSION, AUTO_SLOT, MANUAL_SLOTS, SaveStorage,
  packSave, unpackSave, readSummary,
  writeSlot, readSlot, readSlotSummary, clearSlot, listManualSlots,
} from '../src/systems/SaveSystem';
import { INITIAL_FLAGS } from '../src/systems/FlagRegistry';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

/** A season in progress: mid-event, with flags, a log, and money spent. */
function makeState(over: Partial<GameState> = {}): GameState {
  return {
    day: 17,
    phase: 'afternoon',
    weather: 'frost',
    playerName: '安',
    openingPage: null,
    resources: { grain: 52, guldmark: 9, timber: 14, renown: 3 },
    fatigue: 2,
    relationships: { ...ZERO, gregor: 3, marta: 1 },
    conversations: { ...ZERO, gregor: 4, lorenz: 2 },
    nobleTrust: 1,
    lordImpression: 1,
    tenantTrust: 0,
    flags: { toolsRepaired: true, clue_pos_horses_intact: true, timberFelled: 12 },
    currentSceneText: '场景',
    currentScene: 'stable',
    lastResult: '刚刚发生的事',
    currentChoices: [{ id: 'a', text: '一个选项', effects: { grain: 1 } }],
    activeEvent: null,
    eventResolved: false,
    log: [{ day: 16, phase: 'evening', text: '你在夜里对了账。' }],
    demoComplete: false,
    endingId: null,
    ...over,
  };
}

/** Storage the tests can hold in their hand — vitest runs in node, with no localStorage. */
function fakeStorage(): SaveStorage & { size(): number } {
  const map = new Map<string, string>();
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
    size: () => map.size,
  };
}

// ── 纯函数 ──────────────────────────────────────────────────────────────────

describe('packSave / unpackSave', () => {
  it('returns the same season it was given', () => {
    const state = makeState();
    // Flags come back sitting on their defaults — see the missing-flag case below.
    expect(unpackSave(packSave(AUTO_SLOT, state)))
      .toEqual({ ...state, flags: { ...INITIAL_FLAGS, ...state.flags } });
  });

  it('carries an event and its choices through unchanged', () => {
    const state = makeState({
      activeEvent: {
        id: 'random_well', day: 17, forced: true, title: '淘井',
        sceneText: '玛莎说厨房的水这两天有点浑。', choices: null,
      },
    });
    expect(unpackSave(packSave(AUTO_SLOT, state))?.activeEvent?.id).toBe('random_well');
  });

  it('refuses a save from another build', () => {
    const raw = JSON.parse(packSave(AUTO_SLOT, makeState()));
    raw.version = SAVE_VERSION + 1;
    expect(unpackSave(JSON.stringify(raw))).toBeNull();
  });

  it('refuses a save that is not JSON, and one that is not there', () => {
    expect(unpackSave('{ not json')).toBeNull();
    expect(unpackSave(null)).toBeNull();
    expect(unpackSave('')).toBeNull();
  });

  it('refuses a well-formed file with no season in it', () => {
    expect(unpackSave(JSON.stringify({ version: SAVE_VERSION }))).toBeNull();
  });

  it('fills in flags the save was written before', () => {
    const raw = JSON.parse(packSave(AUTO_SLOT, makeState()));
    delete raw.state.flags.dismissedEarly;
    delete raw.state.flags.randomRolledDay;
    const loaded = unpackSave(JSON.stringify(raw));
    expect(loaded?.flags.dismissedEarly).toBe(INITIAL_FLAGS.dismissedEarly);
    expect(loaded?.flags.randomRolledDay).toBe(INITIAL_FLAGS.randomRolledDay);
    // and does not undo what the save did record
    expect(loaded?.flags.toolsRepaired).toBe(true);
  });

  it('reads a summary without unpacking the season', () => {
    const summary = readSummary(packSave('slot1', makeState()));
    expect(summary?.slot).toBe('slot1');
    expect(summary?.day).toBe(17);
    expect(summary?.phase).toBe('afternoon');
    expect(summary?.finished).toBe(false);
    expect(Number.isNaN(new Date(summary!.savedAt).getTime())).toBe(false);
  });

  it('marks a finished season as finished', () => {
    const done = makeState({ demoComplete: true, endingId: 'ending2' });
    expect(readSummary(packSave(AUTO_SLOT, done))?.finished).toBe(true);
  });
});

// ── 槽位 ────────────────────────────────────────────────────────────────────

describe('slots', () => {
  it('writes, reads back, and clears', () => {
    const storage = fakeStorage();
    const state = makeState();

    expect(writeSlot('slot1', state, storage)).toBe(true);
    expect(readSlot('slot1', storage))
      .toEqual({ ...state, flags: { ...INITIAL_FLAGS, ...state.flags } });

    clearSlot('slot1', storage);
    expect(readSlot('slot1', storage)).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it('keeps the autosave and the manual slots apart', () => {
    const storage = fakeStorage();
    writeSlot(AUTO_SLOT, makeState({ day: 20 }), storage);
    writeSlot('slot1', makeState({ day: 5 }), storage);

    expect(readSlot(AUTO_SLOT, storage)?.day).toBe(20);
    expect(readSlot('slot1', storage)?.day).toBe(5);
  });

  it('lists the three manual slots in order, with holes for the empty ones', () => {
    const storage = fakeStorage();
    writeSlot(MANUAL_SLOTS[2], makeState({ day: 27 }), storage);

    const listed = listManualSlots(storage);
    expect(listed.length).toBe(3);
    expect(listed[0]).toBeNull();
    expect(listed[1]).toBeNull();
    expect(listed[2]?.day).toBe(27);
  });

  it('reads nothing rather than throwing when there is no storage at all', () => {
    expect(readSlot('slot1', null)).toBeNull();
    expect(readSlotSummary('slot1', null)).toBeNull();
    expect(writeSlot('slot1', makeState(), null)).toBe(false);
    expect(() => clearSlot('slot1', null)).not.toThrow();
    expect(listManualSlots(null)).toEqual([null, null, null]);
  });

  it('survives a storage that refuses to write', () => {
    const hostile: SaveStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('nope'); },
    };
    expect(writeSlot('slot1', makeState(), hostile)).toBe(false);
    expect(() => clearSlot('slot1', hostile)).not.toThrow();
  });
});
