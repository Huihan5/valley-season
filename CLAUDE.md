# Valley Season 河谷季

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni. A React browser game with separated content and logic layers, in Chinese and English. The player is a newly hired steward of the Maplegate estate (枫径庄园) through a 30-day autumn season, and the game has five endings (`ENDING_IDS` in `src/systems/EndingSystem.ts`: `ending1`, `ending2`, `ending3`, `ending4a`, `ending4b`).

## Tech Stack

- React 18 (functional components, hooks), TypeScript, Tailwind CSS, Vite. No game engine: plain React state through one reducer.
- Vitest in the `node` environment (no DOM), vite-node for the scripts in `scripts/`.
- Two builds: `npm run build` (ordinary `dist/`) and `npm run build:standalone` (one self-contained HTML file, `dist-standalone/index.html`).

## Project Structure

```
valley-season/
├── CLAUDE.md                # You are here. AGENTS.md carries the same rules for other agents; change both together
├── docs/
│   ├── GDD_NEXT.md          # Sole design and numbers authority (numbers in ch.5)
│   ├── DEVELOPMENT_PLAN.md  # Where things stand (its opening 现状 block, updated at the end of each round),
│   │                        #   what is not built yet, what waits on the author (4.1), far-future ideas (5)
│   ├── CHANGELOG.md         # Chinese, newest entry on top, headed `## [YYYY-MM-DD] — …`
│   ├── legacy/              # Retired plans (ImplementationPlan_2026-09.md). History, not instructions
│   ├── WORLDBOOK.md  STYLE_GUIDE.md  SOUND_LIST.md  SOUND_CREDITS.md
│   ├── GDD.md  DELTA_v2_to_v3.md  V3_BUILD_BRIEF.md  V3_PROGRESS.md  HANDOVER_2026-07-28.md  # history
│   └── playtest/            # Tester feedback
├── 剧情文本/                 # The plot script: all Chinese story text as one readable file. A mirror
├── 文本编辑指南.md           # How the author edits text (script and text-review round trips)
├── text-review/             # (gitignored) flat zh/en mirror of all prose, from `npm run text:export`
├── design-drafts/           # (gitignored) author drafts and source material
├── src/
│   ├── data/                # All content and tuning
│   │   ├── zh/  en/         # Paired trees: actions, codex, documents, inventory, opening, ui,
│   │   │                    #   system_lines, dialogue/, endings/, events/, scenes/
│   │   ├── shared/          # Language-neutral data (the deed)
│   │   └── config.ts  cues.ts  codex.ts  speakers.ts  locale.ts  index.ts
│   ├── systems/             # Game logic, no prose (see below)
│   ├── components/          # Renderers: ScenePanel, StatusPanel, ChoicePanel, common/, OpeningSequence, TitleScreen
│   ├── audio/               # Cue player, settings, `useCues`; sound files in src/assets/audio
│   ├── assets/  types/  utils/   # Portraits and map; `types/game.ts`; rng, speech, text helpers
│   └── App.tsx              # Shell: title, opening, season, overlays; owns the reducer
├── scripts/                 # simulate, audit-text, text-export/import, script-export/import
├── tests/                   # `tests/**/*.test.ts`, one file or more per system; helpers/ holds the sim bots
└── .claude/launch.json      # Dev server entry for the browser preview, name `valley-season`
```

`src/systems/`, by what each does:
- **Engine, time, weather**: `GameEngine` (the reducer, `replaySeason`, `replayUntil`), `TimeSystem`, `WeatherSystem`, `FatigueSystem`.
- **Economy**: `ResourceSystem`, `MarketSystem`, `EstateTaskSystem`, `ChoicePreview`.
- **People**: `RelationSystem`, `NobleSystem`.
- **Events**: `EventSystem` (fixed events and action results), `RandomEventSystem`, `OpeningSystem`, `NoticeSystem`, `FlagRegistry`.
- **Investigation and endings**: `ClueSystem`, `JournalSystem`, `EndingSystem`, `MissedSystem`, `ReturnSystem`.
- **Text composition and hints**: `SceneSystem`, `SeenSystem`, `BottomLineSystem`, `DocumentSystem`, `InventorySystem`, `CueSystem`.
- **Browser-level records** (outlive a season): `SaveSystem`, `CollectionSystem` (endings gallery), `CodexSystem`, `ReadMemorySystem`.
- **Keys**: `KeySystem` (pure decision), with the DOM half in `components/common/useHotkeys.ts` and `useEscape.ts`.

## Critical Rules

### Content and logic stay apart (most important)
- Every user-visible string lives in `src/data/zh/` **and** `src/data/en/`, paired. The suite enforces it (`tests/Localization.test.ts` compares the key sets). Chinese is still a draft: revising it means carrying the English along.
- Logic lives in `src/systems/` with no prose; components only render. Changing a scene must never touch system code, changing a rule must never touch narrative files.
- Numbers (rates, costs, thresholds, probabilities, timings) live in `src/data/config.ts`, which mirrors GDD_NEXT ch.5. Never hardcode a balance number in a system.
- Trust, renown and standing are shown as words or ↑/↓, never as raw numbers. Counts (grain, gold, timber) keep their numbers.

### The engine is a pure function of `(seed, history)`
- `GameEngine.ts` is a reducer. A season is its seed plus the list of `SeasonAction`s; saves store both, and loading a save in the other language replays the season so the words change and the numbers do not. No `Math.random()`: draw from the season's rng.
- A new player action must be added to `SeasonAction` (`src/types/game.ts`) and handled in `reduceSeason`. Anything that makes zh and en differ in logic (a branch on text, a different count of choices) breaks cross-language replay; `tests/GameEngine.test.ts` guards it.
- Things that outlive a season (saves list, endings seen, codex, sound and reading settings, read memory) live in `localStorage` through their own system and never in `GameState`.

### Text
- Tone and sensory palette: `docs/STYLE_GUIDE.md`. Controlled, precise, cold-palette beauty (Sebald's architecture, Pamuk's Istanbul). No fantasy clichés: this world is ancient, rational, built to last. The sacred is institutional and geological, not mystical.
- Religion uses forge and craft metaphors, never pastoral ones. The local religious figure is a 匠师 (Forge-keeper), not a priest or father. NPC dialogue must match the established voice (GDD character section).
- Punctuation: Chinese uses fullwidth punctuation and “” quotes (never 「」 or half-width); English uses curly ’.
- A paragraph spoken by someone starts with `{@id}` (ids in `src/data/speakers.ts`; `tests/SpeechData.test.ts`).
- A line that depends on state is a keyed part: difference hints (`SeenSystem`) set back what is unchanged since last shown. A random pool line is not keyed.
- `npm run audit` finds lines whose claims their place does not back.
- After editing prose in `src/data`, re-export the mirrors with `npm run text:export` and `npm run script:export`, but only when `text-review/` holds no unimported edits (see `文本编辑指南.md`: import first, export after).
- Edit JSON with minimal diffs, keeping each file's formatting.

### UI
- Layout is narrative-first: the choices sit inline under the prose in the reading column, with the estate tasks and the log in a left rail and the readouts on the right. Below `lg` everything stacks into one scrolling column. Do not re-open the layout question.
- Keyboard: `KeySystem` decides what a key means (matched on `event.code`; held keys, modifiers, IME composition, typing in a field and the first `HOTKEY_GUARD_MS` of a new screen are refused), `useHotkeys` acts on the page. A numbered choice carries `data-hotkey-choice`, a 继续 button `data-hotkey-continue`, the reading column `data-reading`. Every overlay registers with `useEscape` so one Escape closes one thing. Keep the number shown equal to the key that works.
- Anything that restarts or replaces a season (重新开始, 新的一季, 继续 on the title) is deliberately not bound to a key.

## Testing

- `npm test` (Vitest) and `npx tsc --noEmit` must both be clean before a unit of work is done. Every system has tests; logic you want tested is a pure function in `src/systems/`.
- `npm run sim -- --seeds 200` after touching the economy, the events or the ending numbers: strategy bots play seasons on the real engine and report ending reach and economy. `tests/Simulation.test.ts` guards the same.
- UI changes are checked in the browser preview (`.claude/launch.json`, name `valley-season`); tests cannot see the DOM.
- When the check is done, stop the dev server **and close the preview tab**. The game has sound: a tab left open keeps playing birds and wind on the author's machine, even after the server has stopped.
- `npm run lint` has no ESLint config and fails. Known and accepted; not a task.

## Workflow

- Read the relevant doc before starting. `GDD_NEXT.md` for rules and numbers, `DEVELOPMENT_PLAN.md` for what is next.
- After each unit of work, add an entry to `docs/CHANGELOG.md` (Chinese, newest on top). At the end of a round, bring the 现状 block at the top of `docs/DEVELOPMENT_PLAN.md` up to date; it is what the next session resumes from.
- If a design decision is ambiguous, stop and ask. No guessing and no TODOs in code: this world's setting density is high enough that one wrong detail causes rework in ten other places.
- Never edit `docs/` without the author's approval. `CHANGELOG.md` and the 现状 block of `DEVELOPMENT_PLAN.md` are the exceptions, and GDD_NEXT is updated when the author says so.
- Work on `main`; no feature branches. Commit and push only when asked.
- Small connective Chinese may be written by Claude (keep the author's sentences, flag it in the CHANGELOG). Big scenes are the author's.

## Status

The v3 rebuild (Stage 0 to 6 in `V3_BUILD_BRIEF.md`) is finished and is history. Current work is text polish, blind playtests, and the items in `DEVELOPMENT_PLAN.md`.

## Commands

- `npm run dev` · `npm run build` · `npm run build:standalone` · `npm run preview`
- `npm test` · `npm run test:watch` · `npm run lint` (broken, see above)
- `npm run sim -- --seeds 200` · `npm run audit`
- `npm run text:export` · `npm run text:import` · `npm run script:export` · `npm run script:import`

## World Context (brief; see docs/ for full reference)

Marigni is a wealthy Western European microstate with a "rational feudalism": monarchy, council and parliament coexist, and feudal contracts operate within a modern legal framework. The national religion (Temple Forged by the Sacred Flame) worships forge-craft, not a deity in the Christian sense. Currency is the Guldmark (圣火金卢). The game takes place in the Duchy of Valewisp, a pastoral agricultural region, on a mid-sized estate called Maplegate (枫径庄园).
