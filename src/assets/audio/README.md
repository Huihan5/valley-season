# Sound files

Drop a sound here named after its cue and the game plays it: `amb_wind_cold.ogg`, `phase_dusk.mp3`
(ogg, mp3, m4a, wav and webm are picked up). A single sound may have several versions, numbered
`act_axe_01.ogg`, `act_axe_02.ogg`…; the game plays them in turn. The cue ids are in
`src/data/cues.ts` and what to look for is in `docs/SOUND_LIST.md`. A cue with no file is silent,
and a file named for no cue is caught by `tests/Audio.test.ts`.

The single-file build inlines every file into the HTML, so keep an eye on the total size.
Record each file's source and licence in `docs/SOUND_CREDITS.md`.
