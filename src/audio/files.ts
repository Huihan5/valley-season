/**
 * The sound files there are, by cue id. A file is found by its name: `amb_rain.ogg` in
 * `src/assets/audio/` is the sound of the cue `amb_rain` (data/cues.ts). Nothing is listed
 * anywhere else, so adding a sound is dropping a file in, and a cue without one is silent.
 * The single-file build inlines whatever is there, which is why the first batch is small
 * (docs/SOUND_LIST.md).
 */
const found = import.meta.glob('../assets/audio/*.{ogg,mp3,m4a,wav,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** `../assets/audio/amb_rain.ogg` → `amb_rain`. */
export function indexByCue(paths: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(paths)) {
    const name = path.split('/').pop()?.replace(/\.[^.]+$/, '');
    if (name) out[name] = url;
  }
  return out;
}

export const AUDIO_FILES: Record<string, string> = indexByCue(found);
