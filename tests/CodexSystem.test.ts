import { describe, it, expect } from 'vitest';
import { GameState, NpcId } from '../src/types/game';
import { SaveStorage } from '../src/systems/SaveSystem';
import { CODEX_ENTRIES } from '../src/data/codex';
import {
  currentUnlocks, getCodex, readCodex, recordCodex, clearCodex, codexEntryOf, codexCategoryOf,
} from '../src/systems/CodexSystem';
import zh from '../src/data/zh';
import en from '../src/data/en';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 0, guldmark: 50, timber: 8, renown: 0 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    conversations: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
    flags: {},
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
    ...overrides,
  };
}

function fakeStorage(): SaveStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

const find = (cats: ReturnType<typeof getCodex>, cat: string, id: string) =>
  cats.find(c => c.id === cat)!.entries.find(e => e.id === id);

// ── structure ↔ text never drift ─────────────────────────────────────────────

describe('every registry entry has its text on both sides', () => {
  for (const bundleName of ['zh', 'en'] as const) {
    const codex = (bundleName === 'zh' ? zh : en).codex as unknown as {
      entries: Record<string, { title?: string; silhouette?: string; text?: string; layers?: Record<string, string> }>;
      layerLabels: Record<string, string>;
      categories: Record<string, string>;
    };

    it(`${bundleName}: each id carries a title, a silhouette, and its body or layers`, () => {
      for (const e of CODEX_ENTRIES) {
        const t = codex.entries[e.id];
        expect(t, `${bundleName} missing entry ${e.id}`).toBeTruthy();
        expect(t.title).toBeTruthy();
        expect(typeof t.silhouette).toBe('string');
        expect(codex.categories[e.category]).toBeTruthy();
        if (e.layers) {
          for (const l of e.layers) {
            expect(t.layers?.[l.id], `${bundleName} ${e.id} missing layer ${l.id}`).toBeTruthy();
            expect(codex.layerLabels[l.id]).toBeTruthy();
          }
        } else {
          expect(t.text, `${bundleName} ${e.id} missing body`).toBeTruthy();
        }
      }
    });
  }
});

// ── unlock evaluation ────────────────────────────────────────────────────────

describe('currentUnlocks reads the run for what it satisfies', () => {
  it('opens fromStart lore and the resident household on Day 1, but not the flag-gated', () => {
    const keys = currentUnlocks(makeState());
    expect(keys).toContain('rational_feudalism');
    expect(keys).toContain('valewisp_duchy');
    // Gregor/Martha/Elena live in the house — met on arrival (isNpcKnown).
    expect(keys).toContain('gregor');
    expect(keys).toContain('marta');
    // Lorenz and the nobles wait on their flags; the local faith waits on Lorenz.
    expect(keys).not.toContain('lorenz');
    expect(keys).not.toContain('marguerite');
    expect(keys).not.toContain('sacred_flame');
  });

  it('opens a flag-met person on their flag, and a deeper layer only on trust', () => {
    expect(currentUnlocks(makeState())).not.toContain('lorenz');
    const metLorenz = makeState({ flags: { unlockForgeChapel: true } });
    const keys = currentUnlocks(metLorenz);
    expect(keys).toContain('lorenz');
    expect(keys).toContain('lorenz:face');
    expect(keys).not.toContain('lorenz:inside');     // trust still 0
    expect(keys).toContain('sacred_flame');          // the faith rides in with Lorenz

    // A resident is met from the start; the deeper layers still wait on trust.
    expect(currentUnlocks(makeState())).toContain('gregor:face');
    expect(currentUnlocks(makeState())).not.toContain('gregor:inside');
    const trusted = makeState({ relationships: { gregor: 4, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 } });
    expect(currentUnlocks(trusted)).toContain('gregor:inside');       // >= 2
    expect(currentUnlocks(trusted)).toContain('gregor:archetype');    // >= 4
  });

  it('opens the hidden entry only once its clue flag is set', () => {
    expect(currentUnlocks(makeState())).not.toContain('millridge');
    expect(currentUnlocks(makeState({ flags: { clue_mot_handwriting: true } }))).toContain('millridge');
  });
});

// ── the reveal rules on the view ─────────────────────────────────────────────

describe('getCodex shapes the shelves by the reveal rules', () => {
  it('shows locked people as silhouette slots and counts them, but hides the hidden entry', () => {
    const cats = getCodex(makeState(), fakeStorage());
    const people = cats.find(c => c.id === 'people')!;
    expect(people.total).toBe(8);
    expect(people.unlockedCount).toBe(3);            // the three residents
    // Lorenz is flag-gated, so on Day 1 he is a locked silhouette: shape, not name.
    expect(find(cats, 'people', 'lorenz')!.unlocked).toBe(false);
    expect(find(cats, 'people', 'lorenz')!.title).toBe(zh.codex.entries.lorenz.silhouette);

    const valewisp = cats.find(c => c.id === 'valewisp')!;
    // millridge is reveal:'hidden' and locked → not present, not counted.
    expect(valewisp.entries.some(e => e.id === 'millridge')).toBe(false);
    expect(valewisp.total).toBe(2);
  });

  it('an unlocked person shows the name and locks the deeper layers in place', () => {
    // Gregor is a resident, met from Day 1, but his trust starts at 0.
    const gregor = find(getCodex(makeState(), fakeStorage()), 'people', 'gregor')!;
    expect(gregor.unlocked).toBe(true);
    expect(gregor.title).toBe(zh.codex.entries.gregor.title);
    const face = gregor.layers.find(l => l.id === 'face')!;
    const archetype = gregor.layers.find(l => l.id === 'archetype')!;
    expect(face.locked).toBe(false);
    expect(face.text).toBeTruthy();
    expect(archetype.locked).toBe(true);             // trust not reached
  });

  it('brings the hidden entry into its shelf and the count once unlocked', () => {
    const found = makeState({ flags: { clue_mot_handwriting: true } });
    const valewisp = getCodex(found, fakeStorage()).find(c => c.id === 'valewisp')!;
    expect(valewisp.entries.some(e => e.id === 'millridge' && e.unlocked)).toBe(true);
    expect(valewisp.total).toBe(3);
  });
});

// ── cross-run persistence ────────────────────────────────────────────────────

describe('the codex outlives the run', () => {
  it('records what a run unlocked and shows it with no run in hand', () => {
    const storage = fakeStorage();
    const run = makeState({ relationships: { gregor: 4, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 } });
    recordCodex(currentUnlocks(run), storage);

    // A brand-new season (state = null) still sees Gregor and his layers.
    const gregor = find(getCodex(null, storage), 'people', 'gregor')!;
    expect(gregor.unlocked).toBe(true);
    expect(gregor.layers.find(l => l.id === 'archetype')!.locked).toBe(false);
  });

  it('is idempotent and clears', () => {
    const storage = fakeStorage();
    recordCodex(['gregor', 'gregor:face'], storage);
    recordCodex(['gregor'], storage);
    expect(readCodex(storage).sort()).toEqual(['gregor', 'gregor:face']);
    clearCodex(storage);
    expect(readCodex(storage)).toEqual([]);
  });
});

// ── a name elsewhere opens its page ──────────────────────────────────────────

describe('a clicked name goes to that person’s page', () => {
  const NPCS: NpcId[] = ['gregor', 'marta', 'elena', 'marguerite', 'henk', 'lorenz'];

  it('every person in the relations list has a page of their own', () => {
    for (const npc of NPCS) {
      const id = codexEntryOf(npc);
      expect(id, npc).toBe(npc);
      expect(codexCategoryOf(id!), npc).toBe('people');
    }
  });

  it('a lore entry that unlocks on meeting someone is not their page', () => {
    expect(codexEntryOf('lorenz')).toBe('lorenz');           // not 'sacred_flame'
    expect(codexCategoryOf('sacred_flame')).toBe('marigni');
  });

  it('the two officers have pages of their own, found by the name the reading uses', () => {
    expect(codexEntryOf('timothy')).toBe('timothy');
    expect(codexEntryOf('thierry')).toBe('thierry');
    expect(codexCategoryOf('timothy')).toBe('people');
  });

  it('an id the codex does not hold opens nothing', () => {
    expect(codexCategoryOf('wynter')).toBeNull();
    expect(codexEntryOf('wynter')).toBeNull();
    expect(codexCategoryOf('')).toBeNull();
  });

  it('opening the page gives away nothing beyond what the run already holds', () => {
    // The panel reads the same view whether or not a name was clicked: the click only picks
    // the shelf and the scroll, so the layers stay locked until their trust is reached.
    const run = makeState({ relationships: { gregor: 1, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 } });
    const before = getCodex(run, fakeStorage());
    const entry = find(before, 'people', codexEntryOf('gregor')!)!;
    expect(entry.unlocked).toBe(true);
    expect(entry.layers.find(l => l.id === 'face')!.locked).toBe(false);
    expect(entry.layers.find(l => l.id === 'inside')!.locked).toBe(true);
    expect(entry.layers.find(l => l.id === 'archetype')!.locked).toBe(true);
    expect(getCodex(run, fakeStorage())).toEqual(before);
  });
});

// ── the two officers: pages opened by what the player has been through with them ──

describe('the officers’ pages', () => {
  const layers = (flags: Record<string, unknown>, id: 'timothy' | 'thierry') => {
    const entry = find(getCodex(makeState({ flags: flags as never }), fakeStorage()), 'people', id)!;
    return { entry, locked: Object.fromEntries(entry.layers.map(l => [l.id, l.locked])) };
  };

  it('are silhouettes until they are met, and the six who keep trust are not displaced', () => {
    const t = layers({}, 'timothy');
    expect(t.entry.unlocked).toBe(false);
    expect(t.entry.title).toBe(zh.codex.entries.timothy.silhouette);
    expect(layers({}, 'thierry').entry.unlocked).toBe(false);
  });

  it('Timothy opens on the Day 6 meeting or on the Day 12 audit, whichever the player had', () => {
    expect(layers({ met_timothy: true }, 'timothy').entry.unlocked).toBe(true);
    expect(layers({ timothyDay12: 'A' }, 'timothy').entry.unlocked).toBe(true);
    expect(layers({ met_timothy: true }, 'timothy').locked).toEqual({ face: false, inside: true, archetype: true });
  });

  it('Timothy goes deeper with the audit, and deepest with the Day 27 conversation with him', () => {
    expect(layers({ met_timothy: true, timothyDay12: 'C' }, 'timothy').locked).toEqual({ face: false, inside: false, archetype: true });
    expect(layers({ timothyDay12: 'C', clue_ofc_timothy_declaration: true }, 'timothy').locked).toEqual({ face: false, inside: false, archetype: false });
    // the other officer's Day 27 talk does not open his
    expect(layers({ met_timothy: true, timothyDay12: 'C', clue_pos_locate: true }, 'timothy').locked.archetype).toBe(true);
  });

  it('Thierry opens on any meeting, goes deeper on the stumps or the ride, deepest on the Day 27 talk', () => {
    expect(layers({ met_thierry: true }, 'thierry').locked).toEqual({ face: false, inside: true, archetype: true });
    expect(layers({ met_thierry: true, thierryDay15: 'C' }, 'thierry').locked.inside).toBe(false);
    expect(layers({ met_thierry: true, thierryDay19: 'A' }, 'thierry').locked.inside).toBe(false);
    expect(layers({ met_thierry: true, clue_pos_locate: true }, 'thierry').locked.archetype).toBe(false);
  });

  it('has its words in both languages, three layers each', () => {
    for (const id of ['timothy', 'thierry'] as const) {
      for (const book of [zh, en]) {
        const e = book.codex.entries[id] as { title: string; subtitle: string; silhouette: string; layers: Record<string, string> };
        expect(e.title.length, id).toBeGreaterThan(0);
        expect(Object.keys(e.layers).sort(), id).toEqual(['archetype', 'face', 'inside']);
      }
    }
  });
});
