# Sound files

Drop a sound here named after its cue and the game plays it: `amb_wind_cold.ogg`, `phase_dusk.mp3`
(ogg, mp3, m4a, wav and webm are picked up). The cue ids and what to look for are in
`docs/SOUND_LIST.md`; the ids themselves are in `src/data/cues.ts`. A cue with no file is silent.

Keep the first batch small: the single-file build inlines every file into the HTML.
Record each file's source and licence in `docs/SOUND_CREDITS.md`.
