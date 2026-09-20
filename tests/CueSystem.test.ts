import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { resolveCues, mappedCueIds } from '../src/systems/CueSystem';
import { CUES } from '../src/data/cues';

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
  });

  it('a clear day in an unmapped scene carries nothing', () => {
    const cues = resolveCues(makeState({ weather: 'sunny', currentScene: 'default' }));
    expect(cues.ambient).toEqual([]);
    expect(cues.vfx).toEqual([]);
  });

  it('frost carries a cold-wind bed and a frost layer', () => {
    const cues = resolveCues(makeState({ weather: 'frost', currentScene: 'office' }));
    expect(cues.ambient).toEqual(['amb_wind_cold', 'amb_office']);
    expect(cues.vfx).toEqual(['vfx_frost']);
  });

  it('every mapped cue id is registered in CUES', () => {
    const stray = mappedCueIds().filter(id => !CUES[id]);
    expect(stray).toEqual([]);
  });
});
