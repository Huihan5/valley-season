import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { resolveCues, mappedCueIds, cuesBetween, scheduleCues, musicFor } from '../src/systems/CueSystem';
import { CUES } from '../src/data/cues';
import { AUDIO_INDOOR_WEATHER_GAIN, AUDIO_NIGHT_BED_LAST_DAY } from '../src/data/config';

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
    // the forge-hall at night keeps its bed, with the fire banked
    const hall = resolveCues(makeState({ phase: 'evening', currentScene: 'forge_chapel' }));
    expect(hall.ambient).toEqual(['amb_forge']);
    expect(hall.gains).toEqual({ amb_forge: 0.5 });
  });

  it('rain under a roof is the rain on the shutters, at full; frost is still the wind through the wall', () => {
    const kitchen = resolveCues(makeState({ weather: 'rainy', currentScene: 'kitchen' }));
    expect(kitchen.ambient).toEqual(['amb_rain_inside', 'amb_kitchen']);
    expect(kitchen.gains).toEqual({});
    // out of doors it is the outdoor rain
    expect(resolveCues(makeState({ weather: 'rainy', currentScene: 'fields' })).ambient).toEqual(['amb_rain', 'amb_fields']);
  });

  it('the crickets are for the first nights only; after that the evening out of doors has no bed of its own', () => {
    const night = (day: number, scene = 'fields') => resolveCues(makeState({ day, phase: 'evening', currentScene: scene })).ambient;
    expect(night(AUDIO_NIGHT_BED_LAST_DAY)).toEqual(['amb_night']);
    expect(night(AUDIO_NIGHT_BED_LAST_DAY + 1)).toEqual([]);
    expect(night(25, 'default')).toEqual([]);
    // the weather is still heard, and a room keeps its own
    expect(resolveCues(makeState({ day: 25, phase: 'evening', weather: 'frost', currentScene: 'fields' })).ambient).toEqual(['amb_wind_cold']);
    expect(night(25, 'kitchen')).toEqual(['amb_kitchen']);
    expect(night(25, 'forge_chapel')).toEqual(['amb_forge']);
  });

  it('the hunters\' camp has its own fire for the night of Day 20 and the morning after, if the steward stayed', () => {
    const camp = (day: number, phase: GameState['phase'], flags: GameState['flags'] = { campOvernight: true }) =>
      resolveCues(makeState({ day, phase, flags, currentScene: 'forest' })).ambient;
    expect(camp(20, 'evening')).toEqual(['amb_camp']);
    expect(camp(21, 'morning')).toEqual(['amb_camp']);
    expect(camp(21, 'afternoon')).toEqual(['amb_woods']);
    expect(camp(20, 'afternoon')).toEqual(['amb_woods']);
    // nobody stayed: no fire
    expect(camp(20, 'evening', {})).toEqual([]);
  });

  it('after dark, out of doors, the owl is heard now and then; in a room, or by day, it is not', () => {
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'fields' })).touches).toEqual(['evt_owl']);
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'default', day: 25 })).touches).toEqual(['evt_owl']);
    expect(resolveCues(makeState({ phase: 'evening', currentScene: 'kitchen' })).touches).toEqual([]);
    expect(resolveCues(makeState({ phase: 'afternoon', currentScene: 'fields' })).touches).toEqual([]);
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

  it('felling and reaping are heard as the axe and the scythe, not as a timber or grain change', () => {
    const a = step(10, { phase: 'morning' });
    const did = (choiceId: string, resources: Partial<GameState['resources']>, over: Partial<GameState> = {}) => cuesBetween(a, step(11, {
      resources: { ...a.resources, ...resources },
      history: [{ type: 'MAKE_CHOICE', choiceId }],
      ...over,
    }));
    expect(did('fell_timber', { timber: 12 })).toEqual(['act_axe']);
    expect(did('harvest', { grain: 30 })).toEqual(['act_scythe']);
    // the axe first, then the light going
    expect(did('fell_timber', { timber: 12 }, { phase: 'evening' })).toEqual(['act_axe', 'phase_dusk']);
    // any other choice that moves the purse is still a coin
    expect(did('task_repair_tools', { guldmark: 35 })).toEqual(['res_coin']);
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

describe('going somewhere is heard, when nothing else is', () => {
  const step = (n: number, over: Partial<GameState> = {}) => makeState({ step: n, ...over });
  const go = (from: string, to: string, over: Partial<GameState> = {}) =>
    cuesBetween(step(10, { currentScene: from }), step(11, { currentScene: to, ...over }));

  it('opens the door of a room going in, and closes it going out', () => {
    expect(go('default', 'kitchen')).toEqual(['evt_door_open']);
    expect(go('kitchen', 'default')).toEqual(['evt_door_close']);
    expect(go('default', 'forge_chapel')).toEqual(['evt_door_heavy_open', 'evt_steps_stone']);
    expect(go('forge_chapel', 'default')).toEqual(['evt_door_heavy_close']);
    // from one room to another it is the door of the room entered
    expect(go('kitchen', 'office')).toEqual(['evt_door_open']);
  });

  it('walks out to a named place on its surface, and what lives there calls once on arriving', () => {
    expect(go('default', 'forest')).toEqual(['evt_steps_leaves']);
    expect(go('default', 'fields')).toEqual(['evt_steps_grass', 'evt_livestock']);
    expect(go('default', 'stable')).toEqual(['evt_door_open', 'evt_horse']);
    // out of a room to a place: the door, then the steps
    expect(go('kitchen', 'fields')).toEqual(['evt_door_close', 'evt_steps_grass', 'evt_livestock']);
    // the courtyard is no destination, and staying where you are is silent
    expect(go('fields', 'default')).toEqual([]);
    expect(go('fields', 'fields')).toEqual([]);
  });

  it('is silent when the step earns a sound of its own: a coin, an axe, the light going', () => {
    const base = makeState().resources;
    expect(go('default', 'kitchen', { resources: { ...base, guldmark: base.guldmark - 5 } })).toEqual(['res_coin']);
    expect(go('default', 'forest', {
      resources: { ...base, timber: base.timber + 3 },
      history: [{ type: 'MAKE_CHOICE', choiceId: 'fell_timber' }],
    })).toEqual(['act_axe']);
    const dusk = cuesBetween(step(10, { currentScene: 'default', phase: 'afternoon' }), step(11, { currentScene: 'stable', phase: 'evening' }));
    expect(dusk).toEqual(['phase_dusk']);
  });

  it('is silent on the morning the day turns', () => {
    expect(cuesBetween(step(10, { day: 3, phase: 'evening', currentScene: 'kitchen' }), step(11, { day: 4, phase: 'morning', currentScene: 'default' }))).toEqual(['phase_dawn']);
  });
});

describe('an event that opens has its sound', () => {
  const step = (n: number, over: Partial<GameState> = {}) => makeState({ step: n, ...over });
  const opening = (id: string) => ({ id, title: id }) as unknown as GameState['activeEvent'];

  it('plays the horn at the hunt, a letter on the letters, and nothing for an event with no sound', () => {
    const open = (id: string, over: Partial<GameState> = {}) =>
      cuesBetween(step(10), step(11, { activeEvent: opening(id), ...over }));
    expect(open('day18_hunt_arrival')).toEqual(['evt_horn']);
    expect(open('day21_hunt_morning')).toEqual(['evt_horn_far']);
    expect(open('day23_lords_letter')).toEqual(['evt_paper']);
    expect(open('day20_hunt_stag')).toEqual(['evt_stag']);
    // the two rides home in the dark
    expect(open('day7_dinner_return')).toEqual(['evt_hooves']);
    expect(open('day30_millridge')).toEqual(['evt_hooves']);
    expect(open('day6_timothy')).toEqual([]);
    // the same event staying open is not a new sound
    expect(cuesBetween(step(10, { activeEvent: opening('day18_hunt_arrival') }), step(11, { activeEvent: opening('day18_hunt_arrival') }))).toEqual([]);
  });

  it('comes after the dawn when the day turns, and takes the place of the walk there', () => {
    const morning = cuesBetween(step(10, { day: 17, phase: 'evening' }), step(11, { day: 18, phase: 'morning', activeEvent: opening('day18_hunt_open') }));
    expect(morning).toEqual(['phase_dawn', 'evt_paper']);
    const walk = cuesBetween(step(10, { currentScene: 'default' }), step(11, { currentScene: 'fields', activeEvent: opening('day19_hunt_ride') }));
    expect(walk).toEqual(['evt_hooves']);
  });
});

describe('scheduleCues puts a step\'s sounds one after another', () => {
  it('a walk\'s steps are a stride apart, and a single sound waits its turn', () => {
    expect(scheduleCues(['evt_door_open'])).toEqual([{ id: 'evt_door_open', at: 0 }]);
    const walk = scheduleCues(['evt_door_open', 'evt_steps_grass', 'evt_livestock']);
    expect(walk.map(w => w.id)).toEqual(['evt_door_open', 'evt_steps_grass', 'evt_steps_grass', 'evt_steps_grass', 'evt_livestock']);
    expect(walk.map(w => w.at)).toEqual([0, 700, 1160, 1620, 2080]);
  });
});

describe('the music', () => {
  it('belongs to the end of a season only', () => {
    expect(musicFor(null)).toBeNull();
    expect(musicFor(makeState())).toBeNull();
    expect(musicFor(makeState({ demoComplete: true, endingId: 'ending2' }))).toBe('mus_end');
  });
});
