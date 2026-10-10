import { GameState } from '../types/game';
import {
  CUES, AMBIENT_BY_WEATHER, AMBIENT_INDOORS_BY_WEATHER, AMBIENT_BY_SCENE, AMBIENT_AT_NIGHT_GAIN,
  INDOOR_SCENES, NIGHT_BED, CAMP_BED, CUE_BY_CHOICE, CUE_BY_EVENT, CUE_SERIES, DOORS_BY_SCENE, STEPS_BY_SCENE,
  ARRIVAL_BY_SCENE, TOUCHES_AT_NIGHT, VFX_BY_WEATHER, MUSIC_END,
} from '../data/cues';
import {
  AUDIO_INDOOR_WEATHER_GAIN, AUDIO_NIGHT_BED_LAST_DAY, AUDIO_CAMP_NIGHT_DAY, AUDIO_STAGGER_MS,
} from '../data/config';

/**
 * The audio/visual seam. `resolveCues` is a pure read of the world state into a set of cue
 * ids by channel — no audio object, no side effect. The player (`src/audio`) subscribes to
 * it and looks each id up; wiring a sound is a data + player change, never a change to game
 * logic. Replay-safe by construction: it reads the state and nothing else.
 */
export interface ResolvedCues {
  ambient: string[];
  vfx: string[];
  /** Beds that sound at less than full: the weather through a wall, a banked fire. Absent means 1. */
  gains: Record<string, number>;
  /** Single sounds that come now and then, at random, while this moment lasts (the owl). */
  touches: string[];
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

/** The hunters' camp: the night of Day 20 kept at the fire, and the morning after. */
function atCamp(state: GameState): boolean {
  if (!state.flags.campOvernight) return false;
  return (state.day === AUDIO_CAMP_NIGHT_DAY && state.phase === 'evening')
    || (state.day === AUDIO_CAMP_NIGHT_DAY + 1 && state.phase === 'morning');
}

export function resolveCues(state: GameState): ResolvedCues {
  const scene = state.currentScene;
  const indoors = INDOOR_SCENES.has(scene);
  const evening = state.phase === 'evening';

  // Under a roof a weather that has a room bed of its own (rain on the shutters) uses it; the
  // others are the outdoor bed heard through the wall.
  const roomWeather = indoors ? AMBIENT_INDOORS_BY_WEATHER[state.weather] : undefined;
  const weather = roomWeather ?? AMBIENT_BY_WEATHER[state.weather];

  // The camp has its own fire. Otherwise, out of doors the night replaces the day's place bed
  // (for the first nights only: by mid-October the crickets are gone, and the valley is quiet); a
  // room keeps its own bed, turned down where its fire is banked.
  let place: string | undefined;
  if (atCamp(state)) place = CAMP_BED;
  else if (evening && !indoors) place = state.day <= AUDIO_NIGHT_BED_LAST_DAY ? NIGHT_BED : undefined;
  else place = AMBIENT_BY_SCENE[scene];

  const ambient = compact([weather, place]);
  const gains: Record<string, number> = {};
  if (indoors && !roomWeather && weather && ambient.includes(weather)) gains[weather] = AUDIO_INDOOR_WEATHER_GAIN;
  if (evening && indoors && place && AMBIENT_AT_NIGHT_GAIN[scene] !== undefined && ambient.includes(place)) {
    gains[place] = AMBIENT_AT_NIGHT_GAIN[scene];
  }

  return {
    ambient,
    vfx: compact([VFX_BY_WEATHER[state.weather]]),
    gains,
    touches: evening && !indoors ? compact([...TOUCHES_AT_NIGHT]) : [],
  };
}

/**
 * What is heard on going from one place to another: the door of a room being entered (or, going
 * out, the door of the room being left), the steps of a walk to a named place, and whatever lives
 * there and calls once on arrival.
 */
function movementCues(from: string, to: string): string[] {
  const out: string[] = [];
  if (INDOOR_SCENES.has(to)) out.push(DOORS_BY_SCENE[to]?.open);
  else if (INDOOR_SCENES.has(from)) out.push(DOORS_BY_SCENE[from]?.close);
  out.push(STEPS_BY_SCENE[to]);
  out.push(ARRIVAL_BY_SCENE[to]);
  return out.filter((id): id is string => !!id);
}

/**
 * The single sounds that one step of the season earns: the day turning, the light going, an
 * axe, a sack, a coin, a log, a door, a walk. Two states a step apart, and nothing else; loading
 * a save or jumping to a season's end is not a step, so it is silent. At most one sound for what
 * was done (an act with a sound of its own, else the resources), then the dusk after it. Going
 * somewhere is heard only when nothing else is, so no two short sounds fall on each other. None
 * on the morning the day turns (the upkeep moving the purse is not a purchase).
 */
export function cuesBetween(prev: GameState, next: GameState): string[] {
  if (prev.step === undefined || next.step === undefined || next.step !== prev.step + 1) return [];

  // An event that has just opened has its sound (a letter, the horn); the day turning keeps its dawn first.
  const opened = next.activeEvent && next.activeEvent.id !== prev.activeEvent?.id ? CUE_BY_EVENT[next.activeEvent.id] : undefined;
  if (next.day > prev.day) return compact(['phase_dawn', opened]);

  const out: string[] = [];
  const last = next.history?.[next.history.length - 1];
  const act = last?.type === 'MAKE_CHOICE' ? CUE_BY_CHOICE[last.choiceId] : undefined;
  const a = prev.resources;
  const b = next.resources;
  if (act) out.push(act);
  else if (opened) out.push(opened);
  else if (b.grain > a.grain) out.push('res_grain');
  else if (b.timber !== a.timber) out.push('res_timber');
  else if (b.guldmark < a.guldmark) out.push('res_coin');

  if (prev.phase !== 'evening' && next.phase === 'evening') out.push('phase_dusk');

  if (out.length === 0 && prev.currentScene !== next.currentScene) {
    out.push(...movementCues(prev.currentScene, next.currentScene));
  }
  return compact(out);
}

/**
 * When each sound of a step is to start, in ms from the step: one after another, a walk's steps
 * apart, a single sound `AUDIO_STAGGER_MS` after the one before it.
 */
export function scheduleCues(ids: string[]): { id: string; at: number }[] {
  const out: { id: string; at: number }[] = [];
  let t = 0;
  for (const id of ids) {
    const series = CUE_SERIES[id];
    const count = series?.count ?? 1;
    for (let k = 0; k < count; k += 1) out.push({ id, at: t + k * (series?.gapMs ?? 0) });
    t += series ? count * series.gapMs : AUDIO_STAGGER_MS;
  }
  return out;
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
    ...Object.values(AMBIENT_INDOORS_BY_WEATHER),
    ...Object.values(CUE_BY_CHOICE),
    ...Object.values(CUE_BY_EVENT),
    ...Object.values(AMBIENT_BY_SCENE),
    ...Object.values(DOORS_BY_SCENE).flatMap(d => [d.open, d.close]),
    ...Object.values(STEPS_BY_SCENE),
    ...Object.values(ARRIVAL_BY_SCENE),
    ...Object.keys(CUE_SERIES),
    ...TOUCHES_AT_NIGHT,
    ...Object.values(VFX_BY_WEATHER),
    NIGHT_BED,
    CAMP_BED,
  ].filter((id): id is string => !!id);
}
