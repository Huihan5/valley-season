import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { resolveCues, mappedCueIds, cuesBetween, musicFor } from '../src/systems/CueSystem';
import { CUES } from '../src/data/cues';
import { AUDIO_INDOOR_WEATHER_GAIN } from '../src/data/config';

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

describe('resolveCues reads the moment into cue ids', () => {
  it('layers the weather bed and the place bed', () => {
    const cues = resolveCues(makeState({ weather: 'rainy', currentScene: 'forest' }));
    expect(cues.ambient).toEqual(['amb_rain', 'amb_woods']);
    expect(cues.vfx).toEqual(['vfx_rain']);
    expect(cues.gains).toEqual({});
  });

  it('a clear day in the courtyard carries nothing', () => {
    const cues = resolveCues(makeState({ weather: 'sunny', currentScene: 'default' }));
    expect(cues.ambient).toEqual([]);
    expect(cues.vfx).toEqual([]);
  });

  it('frost carries a cold-wind bed and a frost layer, quieter under a roof', () => {
    const cues = resolveCues(makeState({ weather: 'frost', currentScene: 'office' }));
    expect(cues.ambient).toEqual(['amb_wind_cold', 'amb_office']);
    expect(cues.vfx).toEqual(['vfx_frost']);
    expect(cues.gains).toEqual({ amb_wind_cold: AUDIO_INDOOR_WEATHER_GAIN });
  });

  it('every room has its own bed', () => {
    for (const [scene, bed] of [['kitchen', 'amb_kitchen'], ['stable', 'amb_stable'], ['forge_chapel', 'amb_forge'], ['fields', 'amb_fields']]) {
      expect(resolveCues(makeState({ currentScene: scene })).ambient, scene).toEqual([bed]);
    }
  });

  it('after dark the outdoors goes to the night, and a room keeps its own', () => {
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'fields' })).ambient).toEqual(['amb_night']);
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'default' })).ambient).toEqual(['amb_night']);
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'kitchen' })).ambient).toEqual(['amb_kitchen']);
    // the forge-hall at night has a bed of its own
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'forge_chapel' })).ambient).toEqual(['amb_hall_night']);
  });

  it('every mapped cue id is registered in CUES', () => {
    const stray = mappedCueIds().filter(id => !CUES[id]);
    expect(stray).toEqual([]);
  });

  it('is a function of the state and nothing else', () => {
    const state = makeState({ weather: 'frost', phase: 'evening', currentScene: 'stable' });
    expect(resolveCues(state)).toEqual(resolveCues({ ...state }));
  });
});

describe('cuesBetween: the single sounds a step earns', () => {
  const step = (n: number, over: Partial<GameState> = {}) => makeState({ step: n, ...over });

  it('is silent unless the second state is exactly one step after the first', () => {
    const a = step(4);
    expect(cuesBetween(a, step(4, { resources: { ...a.resources, grain: 9 } }))).toEqual([]);
    expect(cuesBetween(a, step(9, { resources: { ...a.resources, grain: 9 } }))).toEqual([]);
    expect(cuesBetween(makeState(), makeState({ resources: { grain: 9, guldmark: 50, timber: 8, renown: 0 } }))).toEqual([]);
  });

  it('marks the morning the day turns, and nothing else that morning', () => {
    const a = step(10, { day: 3, phase: 'evening' });
    const b = step(11, { day: 4, phase: 'morning', resources: { ...a.resources, guldmark: 48 } });
    expect(cuesBetween(a, b)).toEqual(['phase_dawn']);
  });

  it('marks the light going', () => {
    const a = step(10, { phase: 'afternoon' });
    expect(cuesBetween(a, step(11, { phase: 'evening' }))).toEqual(['phase_dusk']);
    expect(cuesBetween(step(10, { phase: 'evening' }), step(11, { phase: 'evening' }))).toEqual([]);
  });

  it('gives one sound for the resources: grain, then timber, then coin spent', () => {
    const a = step(10);
    const moved = (resources: Partial<GameState['resources']>) => cuesBetween(a, step(11, { resources: { ...a.resources, ...resources } }));
    expect(moved({ grain: 5 })).toEqual(['res_grain']);
    expect(moved({ grain: 5, timber: 12, guldmark: 40 })).toEqual(['res_grain']);
    expect(moved({ timber: 12 })).toEqual(['res_timber']);
    expect(moved({ timber: 6 })).toEqual(['res_timber']);
    expect(moved({ guldmark: 40 })).toEqual(['res_coin']);
    // coin coming in is not a purchase
    expect(moved({ guldmark: 60 })).toEqual([]);
  });
});

describe('the music', () => {
  it('belongs to the end of a season only', () => {
    expect(musicFor(null)).toBeNull();
    expect(musicFor(makeState())).toBeNull();
    expect(musicFor(makeState({ demoComplete: true, endingId: 'ending2' }))).toBe('mus_end');
  });
});
