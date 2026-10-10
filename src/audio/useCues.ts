import { useEffect, useRef } from 'react';
import { GameState } from '../types/game';
import { resolveCues, cuesBetween, scheduleCues, musicFor } from '../systems/CueSystem';
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
      player.setTouches([]);
      return;
    }
    const music = musicFor(state);
    if (music) {
      player.setBeds([music]);
      player.setTouches([]);
    } else {
      const cues = resolveCues(state);
      player.setBeds(cues.ambient, cues.gains);
      player.setTouches(cues.touches);
    }
  }, [where, state.weather, state.phase, state.day, state.currentScene, state.demoComplete, state.endingId]);

  useEffect(() => {
    const before = previous.current;
    previous.current = where === 'season' ? state : null;
    if (where !== 'season' || !before) return;
    const player = getPlayer();
    if (!player) return;
    // The first sound is at once; those after it (the dusk after the axe, a walk's steps) wait their turn.
    const timers = scheduleCues(cuesBetween(before, state)).map(({ id, at }) => (
      at === 0 ? (player.playOnce(id), undefined) : setTimeout(() => player.playOnce(id), at)
    ));
    return () => timers.forEach(t => t !== undefined && clearTimeout(t));
  }, [where, state]);
}
