import { WeatherType } from '../types/game';

/**
 * Audio/visual cue seam (agreed after round-3 feedback on SFX/VFX). This is the map from a
 * game moment to a cue id, so that lighting sound or a diegetic visual layer is a data +
 * player change and never touches logic. The taste bar, per the design: cues deepen the
 * quiet, never add game "juice"; use them the way the status panel already uses the frost
 * accent — sparing and diegetic.
 *
 * A sound is found by its id: drop `amb_wind_cold.ogg` (or .mp3/.m4a/.wav) into
 * `src/assets/audio/` and the player picks it up (`src/audio/files.ts`). A cue with no file
 * is simply silent. What to look for, per cue, is in docs/SOUND_LIST.md.
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
  // Beds, looped.
  ...ids('ambient', [
    'amb_wind_cold', 'amb_rain', 'amb_fields', 'amb_woods', 'amb_office', 'amb_forge', 'amb_kitchen',
    'amb_stable', 'amb_market', 'amb_night', 'amb_camp', 'amb_fog', 'amb_hall_night',
  ]),
  // Single sounds.
  ...ids('sfx', [
    'phase_dawn', 'phase_dusk', 'res_grain', 'res_coin', 'res_timber', 'act_axe', 'act_scythe',
    'evt_horn', 'evt_hooves', 'evt_paper', 'evt_door', 'evt_steps_frost', 'evt_stag',
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

/** The night bed of a room that has its own (the forge-hall after dark). */
export const AMBIENT_AT_NIGHT_BY_SCENE: Record<string, string> = {
  forge_chapel: 'amb_hall_night',
};

/** Where the music is: the title page, and the end. Nothing plays in between. */
export const MUSIC_TITLE = 'mus_title';
export const MUSIC_END = 'mus_end';
