# 河谷季 Valley Season

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni.

You play a newly appointed steward managing Maplegate Estate (枫径庄园) through a 30-day autumn harvest season. Every morning, afternoon, and evening brings choices — about grain, timber, money, and the people who live and work on the estate. Some choices open doors. Some close them.

The previous steward left without explanation.

---

## Gameplay

- **30-day cycle** across three daily phases: morning, afternoon, evening
- **Resource management**: grain, Guldmarks, timber, renown
- **Relationship system**: six NPCs with trust thresholds that unlock new dialogue and events
- **Fixed event chain**: Day 1–30 scripted events with flag-based branching
- **Five endings** determined by your choices and resources at Day 30
- One persistent mystery running underneath the harvest season

## Tech Stack

React · TypeScript · Tailwind CSS · Vite

No game engine. Pure browser, pure state.

## Development Status

Currently in active development. Core loop, event system, NPC relationships, and ending logic are complete. All 30 days are implemented.

| Phase | Status |
|-------|--------|
| Core loop (time, resources, weather) | ✅ Done |
| Fixed event chain (Day 1–30) | ✅ Done |
| Relationship + flag system | ✅ Done |
| Five endings | ✅ Done |
| UI polish + text refinement | 🔧 In progress |

## Running Locally

```bash
npm install
npm run dev       # dev server at localhost:5173
npm run build     # production build
npm test          # run test suite
```

## License

Private project. All rights reserved.
