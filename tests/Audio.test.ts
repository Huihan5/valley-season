import { describe, it, expect } from 'vitest';
import { CuePlayer, AudioBackend, Voice, Every, Later } from '../src/audio/CuePlayer';
import { AUDIO_KEY, readAudioSettings, writeAudioSettings, clampVolume } from '../src/audio/settings';
import { indexByCue, AUDIO_FILES } from '../src/audio/files';
import { CUES } from '../src/data/cues';
import {
  AUDIO_BED_GAIN, AUDIO_DEFAULT_VOLUME, AUDIO_FADE_MS, AUDIO_ONE_SHOT_GAP_MS, AUDIO_ONE_SHOT_GAIN, AUDIO_CUE_GAIN,
  AUDIO_TOUCH_MIN_MS, AUDIO_TOUCH_MAX_MS,
} from '../src/data/config';

// The player is held to what it promises without any sound in the room: a fake backend records
// what was started, at what volume, and what was stopped.

interface Started { url: string; loop: boolean; volume: number; stopped: boolean; kicks: number }

function fakeBackend() {
  const started: Started[] = [];
  const backend: AudioBackend = {
    start(url, loop, volume): Voice {
      const record: Started = { url, loop, volume, stopped: false, kicks: 0 };
      started.push(record);
      return {
        setVolume: v => { record.volume = v; },
        kick: () => { record.kicks += 1; },
        stop: () => { record.stopped = true; },
      };
    },
  };
  return { backend, started };
}

const FILES = {
  amb_rain: ['rain.ogg'], amb_wind_cold: ['wind.ogg'], ui_page: ['page.ogg'], phase_dusk: ['anvil.ogg'],
  act_axe: ['chop1.ogg', 'chop2.ogg', 'chop3.ogg'], res_coin: ['coin.ogg'], evt_owl: ['owl1.ogg', 'owl2.ogg'],
};
/** No timer at all: the test moves the fades by hand. */
const noTimer: Every = () => () => undefined;

function player(over: Partial<{ muted: boolean; volume: number }> = {}, now = () => 0, save?: (s: { muted: boolean; volume: number }) => void) {
  const { backend, started } = fakeBackend();
  const p = new CuePlayer(backend, FILES, { muted: false, volume: 1, ...over }, { now, every: noTimer, save });
  return { p, started };
}

describe('settings live in the browser and survive bad storage', () => {
  const memory = (initial?: string) => {
    const data = new Map<string, string>(initial === undefined ? [] : [[AUDIO_KEY, initial]]);
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  };

  it('starts on the defaults', () => {
    expect(readAudioSettings(memory())).toEqual({ muted: false, volume: AUDIO_DEFAULT_VOLUME });
    expect(readAudioSettings(null)).toEqual({ muted: false, volume: AUDIO_DEFAULT_VOLUME });
  });

  it('round-trips, and clamps what it reads', () => {
    const store = memory();
    writeAudioSettings({ muted: true, volume: 0.25 }, store);
    expect(readAudioSettings(store)).toEqual({ muted: true, volume: 0.25 });
    expect(readAudioSettings(memory(JSON.stringify({ muted: true, volume: 7 })))).toEqual({ muted: true, volume: 1 });
    expect(readAudioSettings(memory(JSON.stringify({ volume: -3 }))).volume).toBe(0);
    expect(clampVolume('loud')).toBe(AUDIO_DEFAULT_VOLUME);
  });

  it('does not throw on garbage or a store that refuses', () => {
    expect(readAudioSettings(memory('not json'))).toEqual({ muted: false, volume: AUDIO_DEFAULT_VOLUME });
    const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(readAudioSettings(refusing)).toEqual({ muted: false, volume: AUDIO_DEFAULT_VOLUME });
    expect(() => writeAudioSettings({ muted: false, volume: 0.5 }, refusing)).not.toThrow();
  });
});

describe('files are found by the cue they are named for', () => {
  it('reads the name before the extension', () => {
    expect(indexByCue({ '../assets/audio/amb_rain.ogg': 'a', '../assets/audio/phase_dusk.mp3': 'b' }))
      .toEqual({ amb_rain: ['a'], phase_dusk: ['b'] });
  });

  it('gathers numbered versions of one cue, in file-name order', () => {
    expect(indexByCue({
      '../assets/audio/act_axe_02.ogg': 'two',
      '../assets/audio/act_axe_01.ogg': 'one',
      '../assets/audio/amb_rain_inside.ogg': 'in',
      '../assets/audio/amb_rain.ogg': 'out',
    })).toEqual({ act_axe: ['one', 'two'], amb_rain_inside: ['in'], amb_rain: ['out'] });
  });

  it('every sound file in the folder is named for a cue the game knows (a typo would be silent)', () => {
    expect(Object.keys(AUDIO_FILES).filter(cue => !CUES[cue])).toEqual([]);
  });
});

describe('the beds fade in and out and never start without a file', () => {
  it('skips a cue it has no file for', () => {
    const { p, started } = player();
    p.setBeds(['amb_rain', 'amb_woods']);
    expect(started.map(s => s.url)).toEqual(['rain.ogg']);
    expect(p.holding()).toEqual(['amb_rain']);
  });

  it('comes in from silence over the fade and settles under the master', () => {
    const { p, started } = player({ volume: 0.5 });
    p.setBeds(['amb_rain']);
    expect(started[0]).toMatchObject({ loop: true, volume: 0 });
    p.tick(AUDIO_FADE_MS / 2);
    expect(started[0].volume).toBeCloseTo(0.5 * AUDIO_BED_GAIN * AUDIO_CUE_GAIN.amb_rain * 0.5);
    expect(p.tick(AUDIO_FADE_MS)).toBe(false);
    expect(started[0].volume).toBeCloseTo(0.5 * AUDIO_BED_GAIN * AUDIO_CUE_GAIN.amb_rain);
  });

  it('fades a bed that is no longer wanted and stops it only when it is silent', () => {
    const { p, started } = player();
    p.setBeds(['amb_rain']);
    p.tick(AUDIO_FADE_MS);
    p.setBeds(['amb_wind_cold']);
    expect(p.holding()).toEqual(['amb_wind_cold']);
    p.tick(AUDIO_FADE_MS / 2);
    expect(started[0].stopped).toBe(false);
    expect(started[0].volume).toBeGreaterThan(0);
    p.tick(AUDIO_FADE_MS);
    expect(started[0].stopped).toBe(true);
  });

  it('keeps a bed that is asked for again instead of starting it twice', () => {
    const { p, started } = player();
    p.setBeds(['amb_rain']);
    p.tick(AUDIO_FADE_MS);
    p.setBeds(['amb_rain', 'amb_wind_cold']);
    expect(started.filter(s => s.url === 'rain.ogg')).toHaveLength(1);
  });

  it('turns a bed down when it is heard through a wall', () => {
    const { p, started } = player();
    p.setBeds(['amb_rain'], { amb_rain: 0.35 });
    p.tick(AUDIO_FADE_MS);
    expect(started[0].volume).toBeCloseTo(0.35 * AUDIO_BED_GAIN * AUDIO_CUE_GAIN.amb_rain);
  });

  it('is silent while muted and comes back at the same level', () => {
    const { p, started } = player({ volume: 0.8 });
    p.setBeds(['amb_rain']);
    p.tick(AUDIO_FADE_MS);
    const level = started[0].volume;
    p.setSettings({ muted: true });
    expect(started[0].volume).toBe(0);
    p.setSettings({ muted: false });
    expect(started[0].volume).toBeCloseTo(level);
  });

  it('asks a bed to try again on the first gesture', () => {
    const { p, started } = player();
    p.setBeds(['amb_rain']);
    p.unlock();
    expect(started[0].kicks).toBe(1);
  });
});

describe('single sounds', () => {
  it('play once at the master level, and not twice in a breath', () => {
    let t = 1000;
    const { p, started } = player({ volume: 0.5 }, () => t);
    p.playOnce('ui_page');
    p.playOnce('ui_page');
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ url: 'page.ogg', loop: false });
    t += AUDIO_ONE_SHOT_GAP_MS + 1;
    p.playOnce('ui_page');
    expect(started).toHaveLength(2);
  });

  it('take their versions in turn, so one chop is not heard twice running', () => {
    let t = 0;
    const { p, started } = player({}, () => t);
    for (let i = 0; i < 5; i += 1) {
      p.playOnce('act_axe');
      t += AUDIO_ONE_SHOT_GAP_MS + 1;
    }
    expect(started.map(s => s.url)).toEqual(['chop1.ogg', 'chop2.ogg', 'chop3.ogg', 'chop1.ogg', 'chop2.ogg']);
  });

  it('do not start while muted, or when there is no file', () => {
    const { p, started } = player({ muted: true });
    p.playOnce('phase_dusk');
    p.setSettings({ muted: false });
    p.playOnce('res_grain');
    expect(started).toEqual([]);
  });
});

describe('each sound has its own level', () => {
  it('a single sound sits under the one-shot level by its own gain', () => {
    const { p, started } = player({ volume: 0.5 });
    p.playOnce('res_coin');
    expect(started[0].volume).toBeCloseTo(AUDIO_ONE_SHOT_GAIN * AUDIO_CUE_GAIN.res_coin * 0.5);
  });
});

describe('sounds that come now and then', () => {
  function withTimer() {
    const { backend, started } = fakeBackend();
    const scheduled: { ms: number; fn: () => void; cancelled: boolean }[] = [];
    const later: Later = (ms, fn) => {
      const entry = { ms, fn, cancelled: false };
      scheduled.push(entry);
      return () => { entry.cancelled = true; };
    };
    const p = new CuePlayer(backend, FILES, { muted: false, volume: 1 }, { now: () => 0, every: noTimer, later, random: () => 0.5 });
    return { p, started, scheduled };
  }

  it('first comes after a wait inside the window, never at once, and then again, until the list is emptied', () => {
    const { p, started, scheduled } = withTimer();
    p.setTouches(['evt_owl']);
    expect(started).toEqual([]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe((AUDIO_TOUCH_MIN_MS + AUDIO_TOUCH_MAX_MS) / 2);
    scheduled[0].fn();
    expect(started.map(s => s.url)).toEqual(['owl1.ogg']);
    expect(scheduled).toHaveLength(2);
    // asking for the same thing again does not stack another timer
    p.setTouches(['evt_owl']);
    expect(scheduled).toHaveLength(2);
    p.setTouches([]);
    expect(scheduled[1].cancelled).toBe(true);
  });

  it('are not arranged for a sound with no file', () => {
    const { p, scheduled } = withTimer();
    p.setTouches(['evt_nothing']);
    expect(scheduled).toEqual([]);
  });

  it('wait no shorter than the window allows, and no longer', () => {
    const { backend } = fakeBackend();
    for (const r of [0, 0.999]) {
      const seen: number[] = [];
      const later: Later = ms => { seen.push(ms); return () => undefined; };
      new CuePlayer(backend, FILES, { muted: false, volume: 1 }, { later, random: () => r }).setTouches(['evt_owl']);
      expect(seen[0]).toBeGreaterThanOrEqual(AUDIO_TOUCH_MIN_MS);
      expect(seen[0]).toBeLessThanOrEqual(AUDIO_TOUCH_MAX_MS);
    }
  });
});

describe('changing a setting saves it', () => {
  it('hands the new setting to whoever keeps it, clamped', () => {
    const saved: { muted: boolean; volume: number }[] = [];
    const { p } = player({}, () => 0, s => saved.push(s));
    p.setSettings({ volume: 4 });
    p.setSettings({ muted: true });
    expect(saved).toEqual([{ muted: false, volume: 1 }, { muted: true, volume: 1 }]);
    expect(p.getSettings()).toEqual({ muted: true, volume: 1 });
  });
});
