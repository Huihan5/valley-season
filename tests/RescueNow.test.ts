import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import { getFixedEvent } from '../src/systems/EventSystem';
import { getMissed, missedIds } from '../src/systems/MissedSystem';
import { seededRng } from '../src/utils/rng';
import { PLANS, nextAction } from './helpers/simulation';

// Day 28, dawn: a steward who knows where he is can go at once. The season ends there, with
// 4B, whatever the harvest looks like — if you bring him back, nobody counts the wheat.

const ID = 'day28_go_now';

function toTheDawn(planName: string, seed: number): GameState {
  const plan = PLANS.find(p => p.name === planName)!;
  const rng = seededRng('sim', plan.name, seed);
  let s = createInitialState(seed);
  for (let n = 0; !s.demoComplete && s.activeEvent?.id !== ID && n < 4000; n++) {
    s = gameReducer(s, nextAction(plan, s, rng));
  }
  return s;
}

/** The first seed of the truth-seeking steward who reaches the morning of Day 28 knowing where. */
let dawn: GameState | null = null;
for (let i = 1; i <= 60 && !dawn; i++) {
  const s = toTheDawn('detective', i * 7919);
  if (s.activeEvent?.id === ID) dawn = s;
}

describe('the morning of Day 28', () => {
  it('is offered to the one who knows where, on that morning and no other', () => {
    expect(dawn).not.toBeNull();
    expect(dawn!.day).toBe(28);
    expect(dawn!.phase).toBe('morning');
    expect(dawn!.currentChoices.map(c => c.id)).toEqual(['day28_go_now', 'day28_wait']);
  });

  it('is not offered to a steward without the position line', () => {
    const without = { ...dawn!, flags: { ...dawn!.flags, clue_pos_locate: false } };
    expect(getFixedEvent(28, 'morning', without)).toBeNull();
    expect(getFixedEvent(27, 'morning', { ...dawn!, day: 27 })?.id).not.toBe(ID);
    expect(getFixedEvent(29, 'morning', { ...dawn!, day: 29 })?.id).not.toBe(ID);
  });

  it('is never taken by the plans, which measure seasons that run their course', () => {
    for (const plan of PLANS) {
      const s = toTheDawn(plan.name, 7919);
      if (s.activeEvent?.id !== ID) continue;
      const after = gameReducer(s, nextAction(plan, s, seededRng('x', 1)));
      expect(after.demoComplete, plan.name).toBe(false);
    }
  });
});

describe('going now', () => {
  it('ends the season at once with 4B, and records the act', () => {
    const s = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(s.demoComplete).toBe(true);
    expect(s.endingId).toBe('ending4b');
    expect(s.day).toBe(28);
    expect(s.activeEvent).toBeNull();
    expect(s.currentChoices).toEqual([]);
    expect(s.history![s.history!.length - 1]).toEqual({ type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(s.log[s.log.length - 1]?.text).toBe('你没有等秋收完，当天就去找了蒂埃里。');
  });

  it('does not look at the estate: an empty granary and no standing still get the same ending', () => {
    const bare: GameState = {
      ...dawn!,
      resources: { grain: 0, guldmark: 0, timber: 0, renown: -3 },
      lordImpression: 0,
      nobleTrust: 0,
    };
    const s = gameReducer(bare, { type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(s.endingId).toBe('ending4b');
    expect(s.currentSceneText).toContain('傍晚到了庄园');
  });

  it('reads as the ending it is: the same one the handover leads to, and nothing about days not lived', () => {
    const s = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(s.currentSceneText).toContain('你把手上的东西摊在蒂埃里面前');
    expect(s.currentSceneText).toContain('他还活着');
    expect(s.currentSceneText).toContain('冬天就要来了');
    expect(s.currentSceneText).not.toContain('undefined');
    // Millridge on Day 30 was never reached, so nothing in the ending says it was missed.
    expect(getMissed(s).map(l => l.id)).not.toContain('millridge');
  });

  it('plays the same again from the seed, in the middle of it and at the end', () => {
    expect(replaySeason(dawn!)).toEqual(dawn);
    const after = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(replaySeason(after)).toEqual(after);
    expect(replaySeason(JSON.parse(JSON.stringify(after)) as GameState)).toEqual(after);
  });
});

describe('waiting for the harvest', () => {
  it('leaves the morning as it was, to be worked, with nothing decided', () => {
    const s = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_wait' });
    expect(s.demoComplete).toBe(false);
    expect(s.day).toBe(28);
    expect(s.phase).toBe('morning');
    expect(s.activeEvent).toBeNull();
    expect(s.flags.event_done_day28_go_now).toBe(true);
    expect(s.lastResult).toContain('秋收完再说');
    expect(s.flags.waitedAtDawn28).toBe(true);
    expect(s.currentChoices.length).toBeGreaterThan(0);
  });

  it('is not asked again, and the season runs on to its own ending', () => {
    let s = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_wait' });
    const plan = PLANS.find(p => p.name === 'detective')!;
    const rng = seededRng('wait', 1);
    for (let n = 0; !s.demoComplete && s.activeEvent?.id !== 'ending_handover' && n < 2000; n++) {
      expect(s.activeEvent?.id, `step ${n}`).not.toBe(ID);
      s = gameReducer(s, nextAction(plan, s, rng));
    }
    expect(s.demoComplete || s.activeEvent?.id === 'ending_handover').toBe(true);
    expect(s.day).toBeGreaterThanOrEqual(30);
  });
});

describe('after the ending, for the one who waited', () => {
  it('names the other morning, and only for them', () => {
    expect(missedIds(dawn!)).not.toContain('rescue_waited');
    const waited = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_wait' });
    expect(missedIds({ ...waited, day: 30 })).toContain('rescue_waited');
    const went = gameReducer(dawn!, { type: 'MAKE_CHOICE', choiceId: 'day28_go_now' });
    expect(missedIds(went)).not.toContain('rescue_waited');
  });
});
