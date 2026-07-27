# Valley Season 河谷季

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni. React browser game with separated content and logic layers.

## Tech Stack

- React (functional components, hooks)
- JavaScript/TypeScript
- Tailwind CSS for styling
- Vite for build tooling
- No external game engine — pure React state management

## Project Structure

```
valley-season/
├── CLAUDE.md                # You are here — project rules
├── docs/                    # Design documents (READ-ONLY reference)
│   ├── GDD.md               # GDD v3.0 — sole design authority, numbers live in ch.5
│   ├── DELTA_v2_to_v3.md    # v2→v3 change manifest
│   ├── V3_BUILD_BRIEF.md    # Phased implementation brief for the v3 rebuild
│   ├── WORLDBOOK.md         # Kingdom of Marigni setting bible
│   ├── STYLE_GUIDE.md       # Writing tone & sensory reference for narrative text
│   └── CHANGELOG.md         # Track all changes with dates
├── src/
│   ├── components/          # React UI components
│   │   ├── ScenePanel/      # Left: narrative text, dialogue, events
│   │   ├── StatusPanel/     # Right: date, weather, resources, relationships
│   │   ├── ChoicePanel/     # Bottom: action buttons (2-3 options)
│   │   └── common/          # Shared UI primitives
│   ├── data/                # ALL narrative content lives here (content-logic separation)
│   │   ├── events/          # Fixed events (day1.json, day3.json...) and random event pool
│   │   ├── dialogue/        # NPC dialogue trees, keyed by trust level
│   │   ├── scenes/          # Location descriptions, weather variants, ambient text
│   │   └── endings/         # Five ending scripts
│   ├── systems/             # Game logic (no narrative text in these files)
│   │   ├── TimeSystem.ts    # Day/phase progression, 30-day cycle
│   │   ├── WeatherSystem.ts # Weather generation from probability pools
│   │   ├── ResourceSystem.ts# Grain, Guldmark, Timber, Renown tracking
│   │   ├── RelationSystem.ts# NPC trust values, threshold unlocks
│   │   ├── EventSystem.ts   # Fixed event triggers + random event pool draw
│   │   ├── FatigueSystem.ts # Rest/fatigue counter
│   │   └── EndingSystem.ts  # Day 30 ending determination logic
│   ├── assets/              # Art: character portraits, region map
│   ├── utils/               # Pure helper functions
│   └── App.tsx              # Root component, game state orchestration
├── public/
├── tests/                   # Test files mirror src/ structure
├── package.json
└── vite.config.js
```

## Critical Rules

### Content-Logic Separation (MOST IMPORTANT)
- **All narrative text** (scene descriptions, dialogue, event text, ending scripts) lives in `src/data/` as JSON/MD files
- **All game logic** (state changes, calculations, triggers) lives in `src/systems/`
- Changing a scene description must NEVER require touching system code
- Changing a game rule must NEVER require touching narrative files
- Components in `src/components/` are renderers — they read from systems and display from data

### Numerical Values
- NEVER hardcode game balance numbers in system files
- All values (harvest rates, costs, thresholds, weather probabilities) come from `src/data/config.ts`, which mirrors **GDD ch.5**
- GDD v3 is the sole numerical authority — the standalone `NUMBERS.md` was retired when v3 folded its tables into ch.5

### Writing Standards (for narrative content in src/data/)
- Refer to `docs/STYLE_GUIDE.md` for tone, sensory palette, and voice samples
- Writing tone: controlled, precise, cold-palette beauty. Reference: Sebald's architectural descriptions, Pamuk's Istanbul passages
- Avoid fantasy clichés. This world is ancient, rational, built to last — not magical or mystical
- The "sacred" should feel institutional and geological, not mystical
- Religion uses forge/craft metaphors, NOT pastoral/spiritual ones. The local religious figure is a 匠师 (Forge-keeper/Master), not a priest/father
- NPC dialogue must match their established voice (see GDD character section for voice samples)

### Testing
- Run: `npm test`
- Every system in `src/systems/` must have corresponding tests
- Test game-critical paths: can the player reach each of the 5 endings? Does the harvest math check out?

## Development Workflow

### Iteration Cycle
This project follows a phased development plan. Each phase has a clear deliverable:

The v2 build (core loop, fixed-event chain, 5 endings) shipped in June 2026. The project is now
rebuilding to GDD v3 — see `docs/V3_BUILD_BRIEF.md` for the authoritative phase plan:

0. **Stage 0 — Rename inventory**: enumerate every occurrence, mark replace vs. delete.
1. **Stage 1 — Rename & cleanup**: apply GDD ch.12 name table, strip retired concepts. Ending logic untouched.
2. **Stage 2 — New systems & variables**: playerName, nobleTrust, lordImpression, market rework.
3. **Stage 3 — Repeatable text**: greetings, location bases, act variants, weather lines, action results.
4. **Stage 4 — Events**: 16 rewrites + Day 0/4/8/11/13/27, market structure, officer encounters.
5. **Stage 5 — Investigation & endings**: three clue groups, rewritten ending determination.
6. **Stage 6 — Playtest fixes**: remaining UI items from `PlaytestFeedback.md`.

### Self-Management Protocol
When working autonomously:
1. Before starting work, read the relevant docs/ file to confirm design intent
2. After completing a unit of work, update `docs/CHANGELOG.md` with what changed and why
3. If a design decision is ambiguous (not covered in the GDD), **stop and ask**. Do not guess and do not leave a TODO in the code — this world's setting density is high enough that one wrong detail causes rework in ten other places (see `docs/V3_BUILD_BRIEF.md`)
4. Run tests after every system change
5. Never modify docs/ files without explicit user approval — those are the user's design authority

### Commands
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## World Context (brief — see docs/ for full reference)

Marigni is a wealthy Western European microstate with a unique "rational feudalism" — monarchy, council, and parliament coexist, and feudal contracts operate within a modern legal framework. The national religion (Temple Forged by the Sacred Flame) worships forge-craft, not a deity in the Christian sense. Currency is the Guldmark (圣火金卢). The game takes place in the Duchy of Valewisp, a pastoral agricultural region, on a mid-sized estate called Maplegate (枫径庄园). The player is a newly hired steward managing the estate through a 30-day autumn harvest season.
