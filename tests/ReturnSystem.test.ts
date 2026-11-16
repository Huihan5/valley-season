import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason, replayUntil } from '../src/systems/GameEngine';
import { calendarPoints, getReturnMornings, getReturnPoints, returnTo } from '../src/systems/ReturnSystem';
import {
  ReadMemory, recordScreen, screenOf, splitParagraphs, isMemorable, paragraphReader, paragraphKey,
} from '../src/systems/ReadMemorySystem';
import { HUNT_FIRST_DAY } from '../src/data/config';
import { seededRng } from '../src/utils/rng';
import { PLANS, nextAction } from './helpers/simulation';

/** A whole seeded season, played by a simulated steward; every state along the way is kept. */
function playWhole(planName: string, seed: number) {
  const plan = PLANS.find(p => p.name === planName)!;
  const rng = seededRng('sim', plan.name, seed);
  let s = createInitialState(seed);
  const states: GameState[] = [s];
  for (let n = 0; n < 4000 && !s.demoComplete; n++) {
    s = gameReducer(s, nextAction(plan, s, rng));
    states.push(s);
  }
  expect(s.demoComplete).toBe(true);
  return { finished: s, states };
}

const full = playWhole('quota', 20181030);

describe('the points', () => {
  it('are read off the calendar: the first, second and last market days, and the first day of the hunt', () => {
    expect(calendarPoints()).toEqual([
      { id: 'market1', day: 6 },
      { id: 'market2', day: 13 },
      { id: 'hunt', day: HUNT_FIRST_DAY },
      { id: 'marketLast', day: 27 },
    ]);
  });
});

describe('a season that ran to its end', () => {
  it('offers all four, in calendar order', () => {
    expect(full.finished.flags.dismissedEarly).toBeFalsy();
    expect(getReturnPoints(full.finished).map(p => p.id)).toEqual(['market1', 'market2', 'hunt', 'marketLast']);
  });

  it('returns the morning of that day, not finished, on a strict prefix of the history', () => {
    const history = full.finished.history!;
    for (const point of calendarPoints()) {
      const back = returnTo(full.finished, point.id)!;
      expect(back).not.toBeNull();
      expect(back.day).toBe(point.day);
      expect(back.demoComplete).toBe(false);
      expect(back.openingPage).toBeNull();
      expect(back.history!.length).toBeLessThan(history.length);
      expect(back.history).toEqual(history.slice(0, back.history!.length));
      expect(back.step).toBe(back.history!.length);
      // The state just before it was still on the day before.
      expect(full.states[back.step! - 1].day).toBeLessThan(point.day);
    }
  });

  it('gives the same mornings whichever way it is asked', () => {
    const mornings = getReturnMornings(full.finished);
    for (const m of mornings) expect(m.state).toEqual(returnTo(full.finished, m.id));
  });

  it('walks on to the same end when the rest of the history is played from there', () => {
    const history = full.finished.history!;
    for (const point of calendarPoints()) {
      let s = returnTo(full.finished, point.id)!;
      for (const action of history.slice(s.history!.length)) {
        const next = gameReducer(s, action);
        expect(next).not.toBe(s);
        s = next;
      }
      expect(s).toEqual(full.finished);
      expect(replaySeason(s)).not.toBeNull();
    }
  });
});

describe('what is not offered', () => {
  it('offers only the mornings a season that ended early reached', () => {
    // The idle steward runs the account dry and is let go in the fourth week.
    const { finished } = playWhole('idle', 1);
    expect(finished.flags.dismissedEarly).toBe(true);
    const offered = getReturnPoints(finished);
    const expected = calendarPoints().filter(p => p.day < finished.day);
    expect(offered).toEqual(expected);
    expect(offered.map(p => p.id)).toEqual(['market1', 'market2', 'hunt']);
    for (const p of calendarPoints().filter(p => p.day >= finished.day)) {
      expect(returnTo(finished, p.id)).toBeNull();
    }
  });

  it('offers nothing for a season without history, or one not finished', () => {
    const old: GameState = { ...full.finished };
    delete old.history;
    expect(getReturnPoints(old)).toEqual([]);
    expect(returnTo(old, 'market1')).toBeNull();
    const unseeded: GameState = { ...full.finished };
    delete unseeded.seed;
    expect(getReturnPoints(unseeded)).toEqual([]);
    const mid = full.states[Math.floor(full.states.length / 2)];
    expect(mid.demoComplete).toBe(false);
    expect(getReturnPoints(mid)).toEqual([]);
    expect(returnTo(mid, 'market1')).toBeNull();
  });

  it('offers nothing when the season does not replay to the same end', () => {
    const edited: GameState = { ...full.finished, resources: { ...full.finished.resources, guldmark: full.finished.resources.guldmark + 1 } };
    expect(getReturnPoints(edited)).toEqual([]);
  });
});

describe('replayUntil', () => {
  it('stops at the first state the test accepts, the initial state included', () => {
    const start = replayUntil(full.finished, () => true)!;
    expect(start).toEqual(createInitialState(full.finished.seed!));
    const tenth = replayUntil(full.finished, s => (s.step ?? 0) >= 10)!;
    expect(tenth).toEqual(full.states[10]);
  });

  it('returns null when the test never holds, or there is nothing to replay', () => {
    expect(replayUntil(full.finished, () => false)).toBeNull();
    const old: GameState = { ...full.finished };
    delete old.history;
    expect(replayUntil(old, () => true)).toBeNull();
  });

  it('returns null on a refused action', () => {
    const history = full.finished.history!;
    const broken: GameState = {
      ...full.finished,
      history: [...history.slice(0, 20), { type: 'MAKE_CHOICE', choiceId: 'no-such-choice' }, ...history.slice(20)],
    };
    expect(replayUntil(broken, s => s.day >= 29)).toBeNull();
    // ...but a test met before the refused action is still answered.
    expect(replayUntil(broken, s => (s.step ?? 0) >= 5)).toEqual(full.states[5]);
  });
});

describe('going back, and what was read', () => {
  /** The season remembered as the app does: every screen left, the ending included. */
  function rememberedThrough(count: number): ReadMemory {
    let memory: ReadMemory = {};
    for (const s of full.states.slice(0, count)) {
      const shown = screenOf(s);
      if (shown) memory = recordScreen(memory, shown);
    }
    return memory;
  }
  const paragraphsOf = (state: GameState) => {
    const sc = screenOf(state);
    return sc ? sc.texts.flatMap(splitParagraphs).filter(p => isMemorable(p)) : [];
  };

  it('sets back what was read from that morning on, and leaves what was only read before it', () => {
    // Leaving the ending for the morning recorded the ending too.
    const memory = rememberedThrough(full.states.length);

    const back = returnTo(full.finished, 'market2')!;
    const reader = paragraphReader(memory, back.seed!, back.step!, back.playerName);

    // The ending was only ever read after this morning: it is set back here.
    const ending = splitParagraphs(full.finished.currentSceneText).filter(p => isMemorable(p));
    expect(ending.length).toBeGreaterThan(0);
    for (const p of ending) expect(reader(p)).toBe(true);

    // What was read only before this morning is not.
    const keyOf = (p: string) => paragraphKey(p, back.playerName);
    const fromHere = new Set(full.states.filter(s => (s.step ?? 0) >= back.step!).flatMap(paragraphsOf).map(keyOf));
    const earlierOnly = full.states.filter(s => (s.step ?? 0) < back.step!)
      .flatMap(paragraphsOf)
      .filter(p => !fromHere.has(keyOf(p)));
    expect(earlierOnly.length).toBeGreaterThan(0);
    for (const p of earlierOnly) expect(reader(p)).toBe(false);
  });

  it('counts the screen at the very step you come back through as read, and every one after it, when they were left before', () => {
    const memory = rememberedThrough(full.states.length);
    const back = returnTo(full.finished, 'market2')!;
    // Walking the same steps again meets each screen at the step it was recorded at.
    let checked = 0;
    for (const s of full.states.filter(s => (s.step ?? 0) >= back.step! && !s.demoComplete)) {
      const reader = paragraphReader(memory, s.seed!, s.step!, s.playerName);
      for (const p of paragraphsOf(s)) { expect(reader(p)).toBe(true); checked++; }
    }
    expect(checked).toBeGreaterThan(20);
    // The morning itself is among them.
    const morning = paragraphReader(memory, back.seed!, back.step!, back.playerName);
    const morningParagraphs = paragraphsOf(back);
    expect(morningParagraphs.length).toBeGreaterThan(0);
    for (const p of morningParagraphs) expect(morning(p)).toBe(true);
  });

  it('sets nothing of the season back at its frontier: the screen just left is not read, nor is the one picked up again', () => {
    // The player has read through screen k - 1 and stands at k: ordinary forward play, or a season picked up again.
    for (const k of [5, 40, Math.floor(full.states.length / 2)]) {
      const memory = rememberedThrough(k);
      const here = full.states[k];
      const reader = paragraphReader(memory, here.seed!, here.step!, here.playerName);
      const left = paragraphsOf(full.states[k - 1]);
      expect(left.length).toBeGreaterThan(0);
      for (const p of left) expect(reader(p)).toBe(false);
      for (const p of paragraphsOf(here)) expect(reader(p)).toBe(false);
    }
  });
});
