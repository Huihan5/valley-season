/**
 * The sound files there are, by cue id. A file is found by its name: `amb_rain.ogg` in
 * `src/assets/audio/` is the sound of the cue `amb_rain` (data/cues.ts). A cue may have several
 * versions, numbered `act_axe_01.ogg`, `act_axe_02.ogg`…, and a single sound takes them in turn so
 * the same chop is never heard twice running. Nothing is listed anywhere else, so adding a sound
 * is dropping a file in, and a cue without one is silent. The single-file build inlines whatever
 * is there (docs/SOUND_LIST.md).
 */
const found = import.meta.glob('../assets/audio/*.{ogg,mp3,m4a,wav,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/**
 * `../assets/audio/amb_rain.ogg` → `amb_rain`; `../assets/audio/act_axe_02.ogg` → `act_axe`, one
 * of its versions. The versions of a cue come in file-name order.
 */
export function indexByCue(paths: Record<string, string>): Record<string, string[]> {
  const named: { cue: string; name: string; url: string }[] = [];
  for (const [path, url] of Object.entries(paths)) {
    const name = path.split('/').pop()?.replace(/\.[^.]+$/, '');
    if (name) named.push({ cue: name.replace(/_\d{2}$/, ''), name, url });
  }
  named.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const out: Record<string, string[]> = {};
  for (const { cue, url } of named) (out[cue] ??= []).push(url);
  return out;
}

export const AUDIO_FILES: Record<string, string[]> = indexByCue(found);
