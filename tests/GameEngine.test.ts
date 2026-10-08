import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameState, SeasonAction, FlagMap } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import { getFreeChoices } from '../src/systems/EventSystem';
import { seededRng } from '../src/utils/rng';
import { isPositionLineComplete } from '../src/systems/ClueSystem';
import { PLANS, nextAction as nextSimulatedAction } from './helpers/simulation';

// ── A player who clicks at random ───────────────────────────────────────────

/** What a person would do next on this screen. `pick` chooses among the open options. */
function nextAction(s: GameState, pick: () => number): SeasonAction {
  if (s.openingPage !== null) {
    return s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
  }
  if (s.pendingAdvance) return { type: 'COMMIT_ADVANCE' };
  if (s.activeEvent && s.currentChoices.length === 0) return { type: 'ADVANCE_DAY_EVENT' };
  const open = s.currentChoices.filter(c => !c.disabled);
  if (open.length === 0) throw new Error(`stuck on Day ${s.day} ${s.phase}: nothing to choose`);
  return { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
}

function play(seed: number, bot: number, until: (s: GameState, n: number) => boolean = () => false) {
  const pick = seededRng('bot', bot);
  let s = createInitialState(seed);
  let n = 0;
  while (!s.demoComplete && n < 4000 && !until(s, n)) {
    s = gameReducer(s, nextAction(s, pick));
    n++;
  }
  return s;
}

const SEASONS: [number, number][] = [[1, 1], [20181030, 7], [987654321, 42], [4242, 5]];

afterEach(() => {
  vi.doUnmock('../src/data/locale');
  vi.resetModules();
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('a season is a function of its seed and what the player did', () => {
  it('plays out the same twice', () => {
    for (const [seed, bot] of SEASONS) {
      expect(play(seed, bot)).toEqual(play(seed, bot));
    }
  });

  it('plays out differently on another seed', () => {
    const a = play(1, 1);
    const b = play(2, 1);
    expect(a.log.map(l => l.text)).not.toEqual(b.log.map(l => l.text));
  });

  it('reaches an ending when played through', () => {
    for (const [seed, bot] of SEASONS) {
      const s = play(seed, bot);
      expect(s.demoComplete).toBe(true);
      expect(s.endingId).toMatch(/^ending/);
    }
  });

  it('records the actions it accepted, and only those', () => {
    const s0 = createInitialState(9);
    expect(s0.history).toEqual([]);
    const refused = gameReducer(s0, { type: 'MAKE_CHOICE', choiceId: 'no-such-choice' });
    expect(refused).toBe(s0);
    const named = gameReducer(s0, { type: 'SET_PLAYER_NAME', name: '安' });
    expect(named.history).toEqual([{ type: 'SET_PLAYER_NAME', name: '安' }]);
    expect(named.step).toBe(1);
  });

  it('puts a loaded state back exactly as it was', () => {
    const mid = play(5, 5, (_, n) => n >= 30);
    expect(gameReducer(createInitialState(1), { type: 'LOAD_STATE', state: mid })).toBe(mid);
  });
});

// ── Replay ──────────────────────────────────────────────────────────────────

describe('replaying a season', () => {
  it('rebuilds the very same state, from the start and from the middle', () => {
    for (const [seed, bot] of SEASONS) {
      for (const stop of [12, 40, 90, Infinity]) {
        const saved = play(seed, bot, (_, n) => n >= stop);
        const replayed = replaySeason(saved);
        expect(replayed).not.toBeNull();
        expect(replayed).toEqual(saved);
      }
    }
  });

  it('is quick enough to do while the player waits', () => {
    const saved = play(77, 3);
    const t0 = Date.now();
    expect(replaySeason(saved)).not.toBeNull();
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('survives a trip through JSON, which is how saves are stored', () => {
    const saved = play(31, 9, (_, n) => n >= 60);
    const stored = JSON.parse(JSON.stringify(saved)) as GameState;
    expect(replaySeason(stored)).toEqual(saved);
  });

  it('declines a save from before seasons were recorded', () => {
    const saved = play(31, 9, (_, n) => n >= 60);
    const old: GameState = { ...saved };
    delete old.seed;
    delete old.history;
    expect(replaySeason(old)).toBeNull();
    // ...and does not start pretending, once it plays on, that it has a history.
    const open = old.currentChoices.find(c => !c.disabled);
    const onward = open
      ? gameReducer(old, { type: 'MAKE_CHOICE', choiceId: open.id })
      : gameReducer(old, { type: 'ADVANCE_DAY_EVENT' });
    expect(onward.history).toBeUndefined();
  });

  it('declines a replay whose rules or numbers come out different', () => {
    const saved = play(31, 9, (_, n) => n >= 60);
    const edited: GameState = { ...saved, resources: { ...saved.resources, guldmark: saved.resources.guldmark + 1 } };
    expect(replaySeason(edited)).toBeNull();
    const dropped: GameState = { ...saved, history: saved.history!.slice(0, -1).concat(saved.history!.slice(-1)).slice(1) };
    expect(replaySeason(dropped)).toBeNull();
  });
});

// ── Replay in the other language ────────────────────────────────────────────

describe('replaying a season in the other language', () => {
  it('keeps every rule and number and changes only the words', async () => {
    const zhSaved = play(20181030, 7, (_, n) => n >= 70);
    expect(zhSaved.day).toBeGreaterThan(3);

    vi.resetModules();
    vi.doMock('../src/data/locale', async (original) => ({
      ...(await original<typeof import('../src/data/locale')>()),
      getLocale: () => 'en',
    }));
    const en = await import('../src/systems/GameEngine');

    const replayed = en.replaySeason(zhSaved);
    expect(replayed).not.toBeNull();
    const r = replayed!;

    // The same season...
    for (const k of ['day', 'phase', 'weather', 'resources', 'fatigue', 'relationships', 'conversations',
      'nobleTrust', 'lordImpression', 'tenantTrust', 'flags', 'step', 'history', 'seed'] as const) {
      expect(r[k]).toEqual(zhSaved[k]);
    }
    expect(r.log.length).toBe(zhSaved.log.length);
    expect(r.currentChoices.map(c => c.id)).toEqual(zhSaved.currentChoices.map(c => c.id));

    // ...in the other language.
    const hasHan = (t: string) => /[一-鿿]/.test(t);
    expect(hasHan(zhSaved.currentSceneText)).toBe(true);
    expect(hasHan(r.currentSceneText)).toBe(false);
    expect(r.log.some(l => hasHan(l.text))).toBe(false);
    expect(r.currentChoices.some(c => hasHan(c.text))).toBe(false);
  });

  it('does the same from English to Chinese', async () => {
    vi.resetModules();
    vi.doMock('../src/data/locale', async (original) => ({
      ...(await original<typeof import('../src/data/locale')>()),
      getLocale: () => 'en',
    }));
    const en = await import('../src/systems/GameEngine');
    const pick = seededRng('bot', 3);
    let enSaved = en.createInitialState(555);
    for (let n = 0; n < 80 && !enSaved.demoComplete; n++) {
      enSaved = en.gameReducer(enSaved, nextAction(enSaved, pick));
    }

    vi.doUnmock('../src/data/locale');
    vi.resetModules();
    const zh = await import('../src/systems/GameEngine');
    const r = zh.replaySeason(enSaved);
    expect(r).not.toBeNull();
    expect(r!.resources).toEqual(enSaved.resources);
    expect(/[一-鿿]/.test(r!.currentSceneText)).toBe(true);
  });
});

// ── An action pays for the phase it takes ───────────────────────────────────

/** A free, sunny Day 1 morning with the flags the test needs, and choices built to match. */
function freeMorning(flags: FlagMap): GameState {
  let s = createInitialState(3);
  s = gameReducer(s, { type: 'SET_PLAYER_NAME', name: '安' });
  s = gameReducer(s, { type: 'SKIP_OPENING' });
  s = gameReducer(s, { type: 'ADVANCE_DAY_EVENT' });
  const base: GameState = {
    ...s, weather: 'sunny', activeEvent: null,
    flags: { ...s.flags, ...flags },
  };
  return { ...base, currentChoices: getFreeChoices(base) };
}

describe('an action that opens a scene still takes its phase', () => {
  it('charges the felling that brings Gregor’s talk about twenty units', () => {
    let s = freeMorning({ timberFelled: 17, event_done_day1_arrival: true });
    expect(s.phase).toBe('morning');
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'fell_timber' });
    expect(s.activeEvent?.id).toBe('timber_restraint');
    expect(s.phase).toBe('morning'); // the scene has not been played out yet
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'timber_stop' });
    expect(s.day).toBe(1);
    expect(s.phase).toBe('afternoon'); // ...and now the felling has cost its phase
    expect(s.resources.timber).toBeGreaterThan(8);
  });

  it('charges the second morning in the office, when the folio turns up', () => {
    let s = freeMorning({ officeWorkCount: 1, event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'visit_office' });
    expect(s.activeEvent?.id).toBe('office_folio');
    expect(s.phase).toBe('morning');
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'folio_replace' });
    expect(s.phase).toBe('afternoon');
    expect(s.relationships.elena).toBe(1);
  });

  it('charges a felling that raises no scene exactly once', () => {
    let s = freeMorning({ timberFelled: 3, event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'fell_timber' });
    expect(s.activeEvent).toBeNull();
    expect(s.phase).toBe('afternoon');
  });
});

// ── Whoever you went to see is the face on the result ───────────────────────

describe('who is speaking', () => {
  it('shows Gregor on the result of lending him a hand, which has a text of its own', () => {
    // Afternoon, Gregor at the stable (his working hours): the action has its own result.
    let s = freeMorning({ event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'harvest' }); // morning spent -> afternoon
    expect(s.phase).toBe('afternoon');
    expect(s.currentChoices.find(c => c.id === 'help_horses')).toBeDefined();
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'help_horses' });
    expect(s.lastSpeaker).toBe('gregor');
    expect(s.lastResult).toBeTruthy();
  });

  it('shows Elena on the morning in the office', () => {
    let s = freeMorning({ event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'visit_office' });
    expect(s.lastSpeaker).toBe('elena');
  });

  it('shows no one on a result that is nobody’s voice', () => {
    let s = freeMorning({ event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'harvest' });
    expect(s.lastSpeaker).toBeNull();
  });
});

// ── The two walks, end to end ───────────────────────────────────────────────

describe('walking the woods, then cutting', () => {
  it('takes the walk as an estate task: a phase, a point of fatigue, no coin', () => {
    let s = freeMorning({ event_done_day1_arrival: true });
    const coin = s.resources.guldmark;
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'task_survey_forest' });
    expect(s.flags.surveyedForest).toBe(true);
    expect(s.fatigue).toBe(1);
    expect(s.resources.guldmark).toBe(coin);
    expect(s.phase).toBe('afternoon');
    expect(s.lastResult).toContain('林地里光进不来'); // the woods, as they stand: untouched
  });

  it('pays two more timber for every felling afterwards, and shows the woods each time', () => {
    let s = freeMorning({ event_done_day1_arrival: true });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'task_survey_forest' });
    const before = s.resources.timber;
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'fell_timber' });
    // base 3 + the walk's 2, with fatigue still under the line
    expect(s.resources.timber - before).toBe(5);
    expect(s.lastResult).toContain('5 单位');
    expect(s.lastResult).toContain('林地里光进不来');
  });

  it('shows the woods opening up as the cutting adds up', () => {
    let s = freeMorning({ event_done_day1_arrival: true, timberFelled: 8 });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'fell_timber' });
    // 8 + 3 = 11: the second band, where the stumps are still new
    expect(s.lastResult).toContain('树桩还新');
  });
});

// ── The truth endings wait for the player ───────────────────────────────────

describe('handing the truth to 蒂埃里', () => {
  /** Plays a steward's season up to the moment the engine asks for the handover, or to its end. */
  function toTheMorning(planName: string, seed: number): GameState {
    const plan = PLANS.find(p => p.name === planName)!;
    const rng = seededRng('sim', plan.name, seed);
    let s = createInitialState(seed);
    for (let n = 0; !s.demoComplete && s.activeEvent?.id !== 'ending_handover' && n < 4000; n++) {
      s = gameReducer(s, nextSimulatedAction(plan, s, rng));
    }
    return s;
  }

  /** The first seeds of the truth-seeking steward that end in 4A, and in 4B. */
  const found: Record<'4a' | '4b', GameState | null> = { '4a': null, '4b': null };
  for (let i = 1; i <= 60 && (!found['4a'] || !found['4b']); i++) {
    const s = toTheMorning('detective', i * 7919);
    if (s.activeEvent?.id !== 'ending_handover') continue;
    const key = isPositionLineComplete(s) ? '4b' : '4a';
    found[key] ??= s;
  }

  it('stops before the ending is written, on a morning with one thing to do', () => {
    for (const key of ['4a', '4b'] as const) {
      const s = found[key]!;
      expect(s, key).not.toBeNull();
      expect(s.demoComplete).toBe(false);
      expect(s.endingId).toBeNull();
      expect(s.activeEvent?.id).toBe('ending_handover');
      expect(s.currentChoices.map(c => c.id)).toEqual(['hand_over_to_thierry']);
      expect(s.currentSceneText).toContain('天亮之后你去找蒂埃里');
    }
  });

  it('says only what is true about where he can be found', () => {
    expect(found['4a']!.currentSceneText).toContain('没有一样东西指着地方');
    expect(found['4a']!.currentSceneText).not.toContain('他带路');
    expect(found['4b']!.currentSceneText).toContain('他带路');
    expect(found['4b']!.currentSceneText).not.toContain('没有一样东西指着地方');
  });

  it('writes the ending once the player has done it, and records the act', () => {
    for (const key of ['4a', '4b'] as const) {
      const before = found[key]!;
      const s = gameReducer(before, { type: 'MAKE_CHOICE', choiceId: 'hand_over_to_thierry' });
      expect(s.demoComplete).toBe(true);
      expect(s.endingId).toBe(key === '4a' ? 'ending4a' : 'ending4b');
      expect(s.activeEvent).toBeNull();
      expect(s.history![s.history!.length - 1]).toEqual({ type: 'MAKE_CHOICE', choiceId: 'hand_over_to_thierry' });
      expect(s.log[s.log.length - 1]?.text).toBe('你把整理出的判断交给了蒂埃里。');
    }
  });

  it('plays the same again from the seed, in the middle of it and at the end', () => {
    for (const key of ['4a', '4b'] as const) {
      const before = found[key]!;
      expect(replaySeason(before)).toEqual(before);
      const after = gameReducer(before, { type: 'MAKE_CHOICE', choiceId: 'hand_over_to_thierry' });
      expect(replaySeason(after)).toEqual(after);
      expect(replaySeason(JSON.parse(JSON.stringify(after)) as GameState)).toEqual(after);
    }
  });

  it('does not ask for it on any other ending', () => {
    for (const name of ['idle', 'quota', 'balanced']) {
      const s = toTheMorning(name, 7919);
      expect(s.demoComplete, name).toBe(true);
      expect(s.history!.some(a => a.type === 'MAKE_CHOICE' && a.choiceId === 'hand_over_to_thierry'), name)
        .toBe(false);
    }
  });
});
