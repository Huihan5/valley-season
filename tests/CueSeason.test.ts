import { describe, it, expect } from 'vitest';
import { GameState, SeasonAction } from '../src/types/game';
import { createInitialState, gameReducer } from '../src/systems/GameEngine';
import { cuesBetween, scheduleCues } from '../src/systems/CueSystem';
import { CUES, DOORS_BY_SCENE, STEPS_BY_SCENE, ARRIVAL_BY_SCENE } from '../src/data/cues';
import { PLANS, nextAction } from './helpers/simulation';
import { seededRng } from '../src/utils/rng';

// The sounds of a whole season, played on the real engine: how many a step earns, and that the
// ones for going somewhere never fall on top of a sound that the step already has.

const MOVING = new Set<string>([
  ...Object.values(DOORS_BY_SCENE).flatMap(d => [d.open, d.close]),
  ...Object.values(STEPS_BY_SCENE),
  ...Object.values(ARRIVAL_BY_SCENE),
]);

interface Tally {
  steps: number;
  silent: number;
  withMovement: number;
  collisions: string[];
  longest: number;
  perCue: Map<string, number>;
}

function sweep(): Tally {
  const tally: Tally = { steps: 0, silent: 0, withMovement: 0, collisions: [], longest: 0, perCue: new Map() };
  const record = (prev: GameState, next: GameState, who: string) => {
    const ids = cuesBetween(prev, next);
    tally.steps += 1;
    if (ids.length === 0) tally.silent += 1;
    for (const id of ids) tally.perCue.set(id, (tally.perCue.get(id) ?? 0) + 1);
    const moving = ids.filter(id => MOVING.has(id));
    const others = ids.filter(id => !MOVING.has(id));
    if (moving.length) tally.withMovement += 1;
    if (moving.length && others.length) tally.collisions.push(`${who} Day ${next.day} ${next.phase}: ${ids.join(',')}`);
    const at = scheduleCues(ids);
    if (at.length) tally.longest = Math.max(tally.longest, at[at.length - 1].at);
  };

  for (const plan of PLANS) {
    for (let seed = 1; seed <= 6; seed += 1) {
      const rng = seededRng('cue-season', plan.name, seed);
      let s = createInitialState(seed);
      for (let n = 0; !s.demoComplete && n < 4000; n += 1) {
        const before = s;
        s = gameReducer(s, nextAction(plan, s, rng));
        record(before, s, `${plan.name} ${seed}`);
      }
    }
  }
  for (let seed = 1; seed <= 40; seed += 1) {
    const pick = seededRng('cue-season-click', seed);
    let s = createInitialState(seed);
    for (let n = 0; !s.demoComplete && n < 4000; n += 1) {
      let action: SeasonAction;
      if (s.openingPage !== null) action = s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
      else if (s.pendingAdvance) action = { type: 'COMMIT_ADVANCE' };
      else if (s.activeEvent && s.currentChoices.length === 0) action = { type: 'ADVANCE_DAY_EVENT' };
      else {
        const open = s.currentChoices.filter(c => !c.disabled);
        action = { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
      }
      const before = s;
      s = gameReducer(s, action);
      record(before, s, `clicker ${seed}`);
    }
  }
  return tally;
}

describe('the sounds of whole seasons', () => {
  const tally = sweep();

  it('never put a walking sound on top of a sound the step already has', () => {
    expect(tally.collisions).toEqual([]);
  });

  it('keep a step\'s sounds inside a few seconds, and only ever name cues the game knows', () => {
    expect(tally.longest).toBeLessThan(4000);
    expect([...tally.perCue.keys()].filter(id => !CUES[id])).toEqual([]);
  });

  it('are sparing: going somewhere is heard on under a third of the steps (about one in five in the sweep) and a fair number are silent', () => {
    expect(tally.withMovement / tally.steps).toBeLessThan(0.3);
    expect(tally.silent / tally.steps).toBeGreaterThan(0.2);
  });

  it('reach the doors, the steps and the animals at all (this is not a vacuous sweep)', () => {
    for (const id of ['evt_door_open', 'evt_door_close', 'evt_steps_grass', 'evt_steps_leaves', 'evt_horse', 'evt_livestock', 'act_axe', 'phase_dawn', 'phase_dusk']) {
      expect(tally.perCue.get(id) ?? 0, id).toBeGreaterThan(0);
    }
  });
});
