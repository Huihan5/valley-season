import { GameState } from '../types/game';
import {
  CUES, AMBIENT_BY_WEATHER, AMBIENT_BY_SCENE, VFX_BY_WEATHER,
} from '../data/cues';

/**
 * The audio/visual seam. `resolveCues` is a pure read of the world state into a set
 * of cue ids by channel — no assets, no audio object, no side effect. A player (not
 * built yet) would subscribe to it and look each id up in `CUES`; until then it is
 * exercised only by its test. The point is that wiring sound or a visual layer later
 * is a data + player change, not a change to any game logic.
 */
export interface ResolvedCues {
  ambient: string[];
  vfx: string[];
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
  return {
    ambient: compact([AMBIENT_BY_WEATHER[state.weather], AMBIENT_BY_SCENE[state.currentScene]]),
    vfx: compact([VFX_BY_WEATHER[state.weather]]),
  };
}

/** Every cue id a mapping points at — used by the test to guard against a typo'd id. */
export function mappedCueIds(): string[] {
  return [
    ...Object.values(AMBIENT_BY_WEATHER),
    ...Object.values(AMBIENT_BY_SCENE),
    ...Object.values(VFX_BY_WEATHER),
  ];
}
