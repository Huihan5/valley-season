import { WeatherType } from '../types/game';

/**
 * Audio/visual cue seam (agreed after round-3 feedback on SFX/VFX). No assets yet —
 * this is only the map from a game moment to a cue id, so that lighting sound or a
 * diegetic visual layer up later is a data + player change and never touches logic.
 * The taste bar, per the design: cues deepen the quiet, never add game "juice"; use
 * them the way the status panel already uses the frost accent — sparing and diegetic.
 */
export type CueChannel = 'ambient' | 'vfx' | 'sfx';

export interface CueDef {
  id: string;
  channel: CueChannel;
  /** Asset path (audio) or effect key (vfx). Empty until the asset actually exists. */
  src?: string;
}

/** Every cue the game knows by name. A player (none yet) resolves an id back to this. */
export const CUES: Record<string, CueDef> = {
  amb_rain: { id: 'amb_rain', channel: 'ambient' },
  amb_wind_cold: { id: 'amb_wind_cold', channel: 'ambient' },
  amb_woods: { id: 'amb_woods', channel: 'ambient' },
  amb_office: { id: 'amb_office', channel: 'ambient' },
  amb_forge: { id: 'amb_forge', channel: 'ambient' },
  vfx_rain: { id: 'vfx_rain', channel: 'vfx' },
  vfx_frost: { id: 'vfx_frost', channel: 'vfx' },
  vfx_fog: { id: 'vfx_fog', channel: 'vfx' },
};

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
 * Scene → an ambient bed. Keys are `state.currentScene` values; this is a starter
 * set keyed to the scenes that already exist (`fields` / `forest` / `office`) — an
 * unmapped scene simply carries no place bed, only the weather one. Extend as scenes
 * are given sound.
 */
export const AMBIENT_BY_SCENE: Record<string, string> = {
  fields: 'amb_woods',
  forest: 'amb_woods',
  office: 'amb_office',
};
