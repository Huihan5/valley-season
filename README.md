# 河谷季 Valley Season

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni.

You play a newly appointed steward managing Maplegate Estate (枫径庄园) through a 30-day autumn harvest season. Every morning, afternoon, and evening brings choices — about grain, timber, money, and the people who live and work on the estate. Some choices open doors. Some close them.

The previous steward left without explanation.

Fully playable in **中文 and English**, with an in-game language toggle.

---

## Gameplay

- **30-day cycle** across three daily phases: morning, afternoon, evening
- **Resource management**: grain, Guldmarks, timber, renown
- **Relationship system**: six NPCs with trust thresholds that unlock new dialogue and events
- **Fixed event chain**: Day 1–30 scripted events with flag-based branching
- **An investigation thread** runs underneath the harvest — follow it, or don't
- **The Compendium (见闻)**: a cross-run archive of the people you meet and the world you learn, carried between seasons — so a second playthrough starts from what you already know
- **Five endings** determined by your choices and resources at Day 30

## World

Marigni is an ancient, wealthy Western European microstate with a "rational feudalism" — monarchy, council, and parliament coexist, and feudal contracts run inside a modern legal frame. Its national religion is built on forge-craft rather than a deity: the self as raw ore, a life the work of forging, tempering, devotion, and the reach toward eternity. Valewisp is its largest, most pastoral duchy, where time runs by the season and not the clock. You keep a mid-sized estate through one autumn.

## Tech Stack

React · TypeScript · Tailwind CSS · Vite

No game engine. Pure browser, pure state. Narrative content and game logic live in separate layers, all balance numbers in one config, and every string is paired 中文 / English.

## Development Status

In active development. Core loop, event system, NPC relationships, investigation, and ending logic are complete; all 30 days are implemented, and the full test suite (Vitest) runs green.

| Phase | Status |
|-------|--------|
| Core loop (time, resources, weather) | ✅ Done |
| Fixed event chain (Day 1–30) | ✅ Done |
| Relationship + flag system | ✅ Done |
| Investigation + five endings | ✅ Done |
| Cross-run Compendium (见闻) | ✅ Done |
| Bilingual 中文 / English | ✅ Done |
| UI polish + text refinement | 🔧 In progress |

## Running Locally

```bash
npm install
npm run dev               # dev server at localhost:5173
npm run build             # production build
npm run build:standalone  # one self-contained index.html — plays offline, over file://
npm test                  # run the test suite
```

## License

Private project. All rights reserved.
