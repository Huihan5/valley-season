import { WeatherType } from '../types/game';

/**
 * Audio/visual cue seam (agreed after round-3 feedback on SFX/VFX). This is the map from a
 * game moment to a cue id, so that lighting sound or a diegetic visual layer is a data +
 * player change and never touches logic. The taste bar, per the design: cues deepen the
 * quiet, never add game "juice"; use them the way the status panel already uses the frost
 * accent — sparing and diegetic.
 *
 * A sound is found by its id: drop `amb_wind_cold.ogg` (or .mp3/.m4a/.wav) into
 * `src/assets/audio/` and the player picks it up (`src/audio/files.ts`); several versions are
 * numbered `act_axe_01.ogg`, `act_axe_02.ogg`… and heard in turn. A cue with no file is simply
 * silent. What to look for, per cue, is in docs/SOUND_LIST.md.
 */
export type CueChannel = 'ambient' | 'vfx' | 'sfx' | 'music';

export interface CueDef {
  id: string;
  channel: CueChannel;
}

const ids = (channel: CueChannel, list: string[]): [string, CueDef][] =>
  list.map(id => [id, { id, channel }]);

/** Every cue the game knows by name. A player resolves an id back to this. */
export const CUES: Record<string, CueDef> = Object.fromEntries([
  // Beds, looped. amb_market and amb_fog have no sound yet, and nothing says "in the market" in
  // the state: see docs/SOUND_LIST.md, section E (left for later on purpose).
  ...ids('ambient', [
    'amb_wind_cold', 'amb_rain', 'amb_rain_inside', 'amb_fields', 'amb_woods', 'amb_office', 'amb_forge',
    'amb_kitchen', 'amb_stable', 'amb_market', 'amb_night', 'amb_camp', 'amb_fog',
  ]),
  // Single sounds.
  ...ids('sfx', [
    'phase_dawn', 'phase_dusk', 'res_grain', 'res_coin', 'res_timber', 'act_axe', 'act_scythe',
    'evt_horn', 'evt_horn_far', 'evt_hooves', 'evt_paper', 'evt_stag',
    'evt_door_open', 'evt_door_close', 'evt_door_heavy_open', 'evt_door_heavy_close',
    'evt_steps_grass', 'evt_steps_leaves', 'evt_steps_dirt', 'evt_steps_stone', 'evt_horse', 'evt_livestock', 'evt_owl',
    'ui_page', 'ui_tap', 'ui_seal',
  ]),
  // Music: the title, and the end. Never inside a season.
  ...ids('music', ['mus_title', 'mus_end']),
  // Visual layers.
  ...ids('vfx', ['vfx_rain', 'vfx_frost', 'vfx_fog']),
]);

/** Weather → an ambient bed. Only the weathers that carry one appear. */
export const AMBIENT_BY_WEATHER: Partial<Record<WeatherType, string>> = {
  rainy: 'amb_rain',
  frost: 'amb_wind_cold',
};

/** Under a roof, a weather with a bed of its own for rooms (rain on the shutters) uses it, at full. */
export const AMBIENT_INDOORS_BY_WEATHER: Partial<Record<WeatherType, string>> = {
  rainy: 'amb_rain_inside',
};

/**
 * The choice a player made → the sound of doing it. It stands in for the resource sound that
 * step would earn (a log is felled, not "a timber change").
 */
export const CUE_BY_CHOICE: Record<string, string> = {
  fell_timber: 'act_axe',
  harvest: 'act_scythe',
};

/**
 * The moment an event opens → the sound that goes with it: a letter, the hunt's horn (near at the
 * opening, far from the camp at dawn), the horses on the ride, the stag in the wood.
 */
export const CUE_BY_EVENT: Record<string, string> = {
  day18_hunt_open: 'evt_paper',
  day18_hunt_arrival: 'evt_horn',
  day19_hunt_ride: 'evt_hooves',
  day20_hunt_stag: 'evt_stag',
  day21_hunt_morning: 'evt_horn_far',
  day23_lords_letter: 'evt_paper',
  // the two rides home in the dark
  day7_dinner_return: 'evt_hooves',
  day30_millridge: 'evt_hooves',
};

/** Weather → a diegetic visual layer. Sunny and cloudy carry none, on purpose. */
export const VFX_BY_WEATHER: Partial<Record<WeatherType, string>> = {
  rainy: 'vfx_rain',
  frost: 'vfx_frost',
  fog: 'vfx_fog',
};

/**
 * Scene → an ambient bed. Keys are `state.currentScene` values (the courtyard, 'default',
 * has none of its own: it carries the weather and, after dark, the night). A scene with no
 * entry simply carries no place bed.
 */
export const AMBIENT_BY_SCENE: Record<string, string> = {
  fields: 'amb_fields',
  forest: 'amb_woods',
  office: 'amb_office',
  kitchen: 'amb_kitchen',
  stable: 'amb_stable',
  forge_chapel: 'amb_forge',
};

/** Under a roof the weather is heard through the walls, and the day's place bed holds after dark. */
export const INDOOR_SCENES: ReadonlySet<string> = new Set(['office', 'kitchen', 'stable', 'forge_chapel']);

/** Out of doors, the evening swaps the place's day bed for the night one. */
export const NIGHT_BED = 'amb_night';

/** A room whose bed is turned down after dark rather than swapped (the forge-hall, its fire banked). */
export const AMBIENT_AT_NIGHT_GAIN: Record<string, number> = {
  forge_chapel: 0.5,
};

/** The hunters' camp (Day 20's night, kept if the steward stayed): a bed of its own, out of doors. */
export const CAMP_BED = 'amb_camp';

/** Where the music is: the title page, and the end. Nothing plays in between. */
export const MUSIC_TITLE = 'mus_title';
export const MUSIC_END = 'mus_end';

// ---- the sounds of going somewhere ---------------------------------------------------------

/** A room's door, and the sound it makes opening (going in) and closing (going out). */
export const DOORS_BY_SCENE: Record<string, { open: string; close: string }> = {
  office: { open: 'evt_door_open', close: 'evt_door_close' },
  kitchen: { open: 'evt_door_open', close: 'evt_door_close' },
  stable: { open: 'evt_door_open', close: 'evt_door_close' },
  forge_chapel: { open: 'evt_door_heavy_open', close: 'evt_door_heavy_close' },
};

/** Walking out to a place that is named: what is underfoot there. */
export const STEPS_BY_SCENE: Record<string, string> = {
  fields: 'evt_steps_grass',
  forest: 'evt_steps_leaves',
  market: 'evt_steps_dirt',
  // a room, but a stone one: the forge-hall is walked into
  forge_chapel: 'evt_steps_stone',
};

/** Something heard once on arriving, and not again until the next arrival. */
export const ARRIVAL_BY_SCENE: Record<string, string> = {
  stable: 'evt_horse',
  fields: 'evt_livestock',
};

/** A sound that is several in a row: a walk of `count` steps, `gapMs` apart. */
export const CUE_SERIES: Record<string, { count: number; gapMs: number }> = {
  evt_steps_grass: { count: 3, gapMs: 460 },
  evt_steps_leaves: { count: 3, gapMs: 460 },
  evt_steps_dirt: { count: 3, gapMs: 460 },
  evt_steps_stone: { count: 3, gapMs: 520 },
};

/** Heard now and then, at random, while the moment lasts: the owl, out of doors after dark. */
export const TOUCHES_AT_NIGHT: readonly string[] = ['evt_owl'];
