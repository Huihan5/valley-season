import { AudioBackend, Voice } from './CuePlayer';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The browser's own audio element: enough for loops, fades by volume and single sounds. */
export class HtmlAudioBackend implements AudioBackend {
  start(url: string, loop: boolean, volume: number): Voice {
    const el = new Audio(url);
    el.loop = loop;
    el.volume = clamp01(volume);
    const attempt = () => {
      // Refused until the page has had a gesture; unlock() asks again.
      el.play()?.catch(() => undefined);
    };
    attempt();
    return {
      setVolume: v => { el.volume = clamp01(v); },
      kick: () => { if (el.paused) attempt(); },
      stop: () => { el.pause(); el.removeAttribute('src'); el.load(); },
    };
  }
}
