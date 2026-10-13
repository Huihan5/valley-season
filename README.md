# 河谷季 Valley Season

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni.

You play a newly appointed steward managing Maplegate Estate (枫径庄园) through a 30-day autumn harvest season. Every morning, afternoon, and evening brings choices — about grain, timber, money, and the people who live and work on the estate. Some choices open doors. Some close them.

The previous steward left without explanation.

Fully playable in **中文 and English**, with an in-game language toggle. Switching language replays your season in the other one, so a save is never stranded in a language.

---

## Gameplay

- **30-day cycle** across three daily phases: morning, afternoon, evening — preceded by a short Day 0 opening, the paper that brings you to the estate and a question from the man who signed it
- **Resource management**: grain, Guldmarks, timber, renown. Standing with people — the tenants, the nobility, the lord — is shown in words, never as a number
- **Relationship system**: six NPCs with trust thresholds that unlock new dialogue and events
- **Fixed event chain**: scripted events across the season with flag-based branching, and a pool of smaller random days between them
- **An investigation thread** runs underneath the harvest — follow it, or don't
- **The Satchel (行囊)**: the file of what you have learned, the papers you carry — the guarantee that brought you here can be opened and read in full, in the Old Tongue it was drawn up in with the Common Tongue beside it — and the small things people hand you. It shows what you have, never what you lack
- **The Compendium (见闻)**: a cross-run archive of the people you meet and the world you learn, carried between seasons — so a second playthrough starts from what you already know
- **Five endings** determined by your choices and the state of the estate. Under each, a few quiet lines about places the season did not reach
- **Quiet sound**: wind, rain, the forge, hooves on the yard. No music. A mute and a volume control sit on the title screen and the season's top bar

## World

Marigni is an ancient, wealthy Western European microstate with a "rational feudalism" — monarchy, council, and parliament coexist, and feudal contracts run inside a modern legal frame. Its national religion is built on forge-craft rather than a deity: the self as raw ore, a life the work of forging, tempering, devotion, and the reach toward eternity. Valewisp is its largest, most pastoral duchy, where time runs by the season and not the clock. You keep a mid-sized estate through one autumn.

## Tech Stack

React · TypeScript · Tailwind CSS · Vite

No game engine. Pure browser, pure state. Narrative content and game logic live in separate layers, all balance numbers in one config, and every string is paired 中文 / English.

A season is a pure function of its seed and what the player did: the engine draws no random number it cannot replay, saves record the seed and the history, and a replay rebuilds the season from them (which is also how the language switch works).

## Development Status

In active development. The core loop, the whole event chain, relationships, the investigation, the endings, the Compendium, the Satchel, sound and both languages are in; the full test suite (Vitest, around 900 tests) runs green. The work now is text and feel: a polished-text pass over the whole script, and blind playtests.

| Phase | Status |
|-------|--------|
| Core loop (time, resources, weather) | ✅ Done |
| Fixed event chain and opening | ✅ Done |
| Relationship + flag system | ✅ Done |
| Investigation + five endings | ✅ Done |
| Cross-run Compendium (见闻) | ✅ Done |
| Satchel: file, papers (readable in full), belongings | ✅ Done |
| Seeded replay; language switch by replay | ✅ Done |
| Sound (diegetic, no music) | ✅ Done |
| Bilingual 中文 / English | ✅ Done |
| Polished-text pass, UI polish | 🔧 In progress |
| Blind playtests | 🔧 In progress |

## Running Locally

```bash
npm install
npm run dev               # dev server at localhost:5173
npm run build             # production build
npm run build:standalone  # one self-contained index.html — plays offline, over file://
npm test                  # run the test suite
npm run sim -- --seeds 200   # simulated stewards play whole seasons on the real engine
```

`build:standalone` is what the playtest builds are made from: the whole game, sound included, in one HTML file that opens by double-click and can be uploaded to itch.io as it is.

## Project Layout

```
src/data/        all narrative text, one tree per language (zh/, en/); shared/ holds what is not translated
src/systems/     game rules — no prose in them
src/components/  the UI, which only renders
tests/           the suite; it also holds the two languages to each other
docs/            design documents (GDD_NEXT.md is the numeric and design authority)
剧情文本/         the Chinese story as one readable file, with an export/import (see 文本编辑指南.md)
```

Text tools: `npm run text:export` / `text:import` flatten all prose into a side-by-side zh/en mirror for editing, `npm run script:export` / `script:import` do the same for the Chinese story as one file, and `npm run audit` looks for lines whose claims their place does not back.

## License

Private project. All rights reserved. Sound clips are CC0; sources are listed in `docs/SOUND_CREDITS.md`.
