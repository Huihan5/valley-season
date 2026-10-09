import { CuePlayer } from './CuePlayer';
import { HtmlAudioBackend } from './HtmlAudioBackend';
import { AUDIO_FILES } from './files';
import { readAudioSettings, writeAudioSettings, AudioSettings } from './settings';

let player: CuePlayer | null = null;

/**
 * The one player, made on first use. It is null when there is nothing to play (no sound file
 * in src/assets/audio/) or no audio in this environment, so a build without sound has no
 * player, no listeners and no cost.
 */
export function getPlayer(): CuePlayer | null {
  if (player) return player;
  if (typeof Audio === 'undefined' || typeof window === 'undefined') return null;
  if (Object.keys(AUDIO_FILES).length === 0) return null;

  player = new CuePlayer(new HtmlAudioBackend(), AUDIO_FILES, readAudioSettings(), { save: writeAudioSettings });
  // A browser starts sound only after the player has done something: the first gesture lets it.
  const unlock = () => {
    player?.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return player;
}

/** A single sound for something the player did (a page turned, a choice made). */
export function playCue(id: string): void {
  getPlayer()?.playOnce(id);
}

/** For the volume and mute controls, once the author has placed them (null when there is no sound). */
export function getAudioSettings(): AudioSettings | null {
  return getPlayer()?.getSettings() ?? null;
}

export function setAudioSettings(change: Partial<AudioSettings>): AudioSettings | null {
  return getPlayer()?.setSettings(change) ?? null;
}
