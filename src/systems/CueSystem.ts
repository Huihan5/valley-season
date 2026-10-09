import { GameState } from '../types/game';
import {
  CUES, AMBIENT_BY_WEATHER, AMBIENT_BY_SCENE, AMBIENT_AT_NIGHT_BY_SCENE, INDOOR_SCENES, NIGHT_BED,
  VFX_BY_WEATHER, MUSIC_END,
} from '../data/cues';
import { AUDIO_INDOOR_WEATHER_GAIN } from '../data/config';

/**
 * The audio/visual seam. `resolveCues` is a pure read of the world state into a set of cue
 * ids by channel — no audio object, no side effect. The player (`src/audio`) subscribes to
 * it and looks each id up; wiring a sound is a data + player change, never a change to game
 * logic. Replay-safe by construction: it reads the state and nothing else.
 */
export interface ResolvedCues {
  ambient: string[];
  vfx: string[];
  /** Beds that sound at less than full: the weather through a wall. Absent means 1. */
  gains: Record<string, number>;
}

/** Drop empties and duplicates, and keep only ids that are actually registered. */
function compact(ids: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && CUES[id] && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function resolveCues(state: GameState): ResolvedCues {
  const scene = state.currentScene;
  const indoors = INDOOR_SCENES.has(scene);
  const evening = state.phase === 'evening';

  const weather = AMBIENT_BY_WEATHER[state.weather];
  // After dark a room with a night bed of its own uses it; out of doors the night replaces the
  // day's place bed; an ordinary room keeps what it has.
  const place = evening && AMBIENT_AT_NIGHT_BY_SCENE[scene]
    ? AMBIENT_AT_NIGHT_BY_SCENE[scene]
    : evening && !indoors ? NIGHT_BED : AMBIENT_BY_SCENE[scene];

  const ambient = compact([weather, place]);
  const gains: Record<string, number> = {};
  if (indoors && weather && ambient.includes(weather)) gains[weather] = AUDIO_INDOOR_WEATHER_GAIN;

  return { ambient, vfx: compact([VFX_BY_WEATHER[state.weather]]), gains };
}

/**
 * The single sounds that one step of the season earns: the day turning, the light going, a
 * sack, a coin, a log. Two states a step apart, and nothing else; loading a save or jumping to a
 * season's end is not a step, so it is silent. At most one sound for the resources, and none on
 * the morning the day turns (the upkeep moving the purse is not a purchase).
 */
export function cuesBetween(prev: GameState, next: GameState): string[] {
  if (prev.step === undefined || next.step === undefined || next.step !== prev.step + 1) return [];

  if (next.day > prev.day) return compact(['phase_dawn']);

  const out: string[] = [];
  if (prev.phase !== 'evening' && next.phase === 'evening') out.push('phase_dusk');

  const a = prev.resources;
  const b = next.resources;
  if (b.grain > a.grain) out.push('res_grain');
  else if (b.timber !== a.timber) out.push('res_timber');
  else if (b.guldmark < a.guldmark) out.push('res_coin');
  return compact(out);
}

/** The music that goes with the moment outside a season: the title page, and the end. */
export function musicFor(state: GameState | null): string | null {
  if (state && state.demoComplete && state.endingId) return CUES[MUSIC_END] ? MUSIC_END : null;
  return null;
}

/** Every cue id a mapping points at — used by the test to guard against a typo'd id. */
export function mappedCueIds(): string[] {
  return [
    ...Object.values(AMBIENT_BY_WEATHER),
    ...Object.values(AMBIENT_BY_SCENE),
    ...Object.values(AMBIENT_AT_NIGHT_BY_SCENE),
    ...Object.values(VFX_BY_WEATHER),
    NIGHT_BED,
  ];
}
