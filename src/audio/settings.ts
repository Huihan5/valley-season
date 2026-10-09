import { AUDIO_DEFAULT_VOLUME } from '../data/config';

/**
 * What the player has set for sound. It lives in the browser, beside the saves and the codex,
 * and never in a season's state: the volume is a thing about this machine, not about the run
 * (and replaying a season must not depend on it).
 */
export interface AudioSettings {
  muted: boolean;
  /** 0 to 1. */
  volume: number;
}

export const AUDIO_KEY = 'valley-season:audio';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function clampVolume(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : AUDIO_DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Storage can be missing, full or blocked; sound then runs on the defaults. */
export function readAudioSettings(store: Store | null = browserStore()): AudioSettings {
  const fallback: AudioSettings = { muted: false, volume: AUDIO_DEFAULT_VOLUME };
  if (!store) return fallback;
  try {
    const raw = store.getItem(AUDIO_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { muted?: unknown; volume?: unknown } | null;
    return { muted: parsed?.muted === true, volume: clampVolume(parsed?.volume) };
  } catch {
    return fallback;
  }
}

export function writeAudioSettings(settings: AudioSettings, store: Store | null = browserStore()): void {
  if (!store) return;
  try {
    store.setItem(AUDIO_KEY, JSON.stringify({ muted: settings.muted, volume: clampVolume(settings.volume) }));
  } catch {
    // nothing to do: the setting just does not outlast this page
  }
}
