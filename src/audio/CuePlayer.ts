import { AUDIO_BED_GAIN, AUDIO_ONE_SHOT_GAIN, AUDIO_FADE_MS, AUDIO_ONE_SHOT_GAP_MS } from '../data/config';
import { AudioSettings, clampVolume } from './settings';

/** One sound that has been started: it can be turned up or down, retried, and stopped. */
export interface Voice {
  setVolume(volume: number): void;
  /** Try again after the browser has had a gesture; harmless when it is already sounding. */
  kick(): void;
  stop(): void;
}

/** What actually makes sound. The browser one is in HtmlAudioBackend; tests use a fake. */
export interface AudioBackend {
  start(url: string, loop: boolean, volume: number): Voice;
}

/** Calls `fn` every `ms` until the returned function is called. */
export type Every = (ms: number, fn: () => void) => () => void;

const realEvery: Every = (ms, fn) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

interface Bed {
  voice: Voice;
  /** How far in the fade it is, 0 (silent) to 1 (full). */
  level: number;
  target: 0 | 1;
  gain: number;
}

const FRAME_MS = 100;

/**
 * Keeps the beds that should be sounding sounding, and fades the rest out. It decides nothing
 * about the game: it is told which cue ids to hold (from CueSystem) and which single sounds
 * to play, and it skips any cue it has no file for. A bed comes in and goes out over
 * AUDIO_FADE_MS so nothing starts or stops with an edge.
 */
export class CuePlayer {
  private beds = new Map<string, Bed>();
  private lastShot = new Map<string, number>();
  private stopTimer: (() => void) | null = null;

  constructor(
    private backend: AudioBackend,
    private files: Record<string, string>,
    private settings: AudioSettings,
    private options: { now?: () => number; every?: Every; save?: (settings: AudioSettings) => void } = {},
  ) {}

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** What the master volume lets through right now. */
  private master(): number {
    return this.settings.muted ? 0 : this.settings.volume;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setSettings(change: Partial<AudioSettings>): AudioSettings {
    this.settings = {
      muted: change.muted ?? this.settings.muted,
      volume: change.volume === undefined ? this.settings.volume : clampVolume(change.volume),
    };
    this.options.save?.(this.getSettings());
    this.applyVolumes();
    return this.getSettings();
  }

  /** The ids of the beds that are sounding or fading in (not those on their way out). */
  holding(): string[] {
    return [...this.beds].filter(([, bed]) => bed.target === 1).map(([id]) => id);
  }

  /**
   * The beds that should be sounding now. A new one fades in, one no longer listed fades out,
   * and one with no file is skipped. `gains` turns a bed down (the rain heard through a wall).
   */
  setBeds(wanted: string[], gains: Record<string, number> = {}): void {
    const want = new Set(wanted.filter(id => this.files[id]));
    for (const id of want) {
      const gain = gains[id] ?? 1;
      const bed = this.beds.get(id);
      if (bed) {
        bed.target = 1;
        bed.gain = gain;
      } else {
        this.beds.set(id, { voice: this.backend.start(this.files[id], true, 0), level: 0, target: 1, gain });
      }
    }
    for (const [id, bed] of this.beds) if (!want.has(id)) bed.target = 0;
    this.applyVolumes();
    this.keepFading();
  }

  /** A single sound. The same one is not repeated inside AUDIO_ONE_SHOT_GAP_MS, and nothing starts while muted. */
  playOnce(id: string): void {
    const url = this.files[id];
    if (!url || this.master() === 0) return;
    const now = this.now();
    const last = this.lastShot.get(id);
    if (last !== undefined && now - last < AUDIO_ONE_SHOT_GAP_MS) return;
    this.lastShot.set(id, now);
    this.backend.start(url, false, AUDIO_ONE_SHOT_GAIN * this.master());
  }

  /** The browser only lets sound start after a gesture: on the first one, try the beds again. */
  unlock(): void {
    for (const bed of this.beds.values()) bed.voice.kick();
  }

  /** Moves every fade on by `dtMs`; true while anything is still moving. */
  tick(dtMs: number): boolean {
    const step = dtMs / AUDIO_FADE_MS;
    let moving = false;
    for (const [id, bed] of this.beds) {
      if (bed.level < bed.target) bed.level = Math.min(bed.target, bed.level + step);
      else if (bed.level > bed.target) bed.level = Math.max(bed.target, bed.level - step);
      if (bed.level !== bed.target) moving = true;
      else if (bed.target === 0) {
        bed.voice.stop();
        this.beds.delete(id);
      }
    }
    this.applyVolumes();
    return moving;
  }

  private applyVolumes(): void {
    const master = this.master();
    for (const bed of this.beds.values()) bed.voice.setVolume(bed.level * bed.gain * AUDIO_BED_GAIN * master);
  }

  private keepFading(): void {
    if (this.stopTimer) return;
    const every = this.options.every ?? realEvery;
    this.stopTimer = every(FRAME_MS, () => {
      if (!this.tick(FRAME_MS)) {
        this.stopTimer?.();
        this.stopTimer = null;
      }
    });
  }
}
