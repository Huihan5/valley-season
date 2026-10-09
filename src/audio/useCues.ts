import { useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { resolveCues, cuesBetween, musicFor } from '../systems/CueSystem';
import { MUSIC_TITLE } from '../data/cues';
import { getPlayer } from './index';

/**
 * Plays the world: the title's music before a season, the beds that fit the moment during
 * one, the end's music after it, and a single sound for each step that earns one. It only
 * reads the state, so a season replayed from its seed sounds the same, and when there is no
 * sound to play it does nothing.
 */
export function useCues(where: 'title' | 'season', state: GameState): void {
  const previous = useRef<GameState | null>(null);

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    if (where === 'title') {
      player.setBeds([MUSIC_TITLE]);
      return;
    }
    const music = musicFor(state);
    if (music) {
      player.setBeds([music]);
    } else {
      const cues = resolveCues(state);
      player.setBeds(cues.ambient, cues.gains);
    }
  }, [where, state.weather, state.phase, state.currentScene, state.demoComplete, state.endingId]);

  useEffect(() => {
    const before = previous.current;
    previous.current = where === 'season' ? state : null;
    if (where !== 'season' || !before) return;
    const player = getPlayer();
    if (!player) return;
    for (const id of cuesBetween(before, state)) player.playOnce(id);
  }, [where, state]);
}
