# Valley Season — Changelog

## [Unreleased] — GDD Revisions from Review Session

### Religion System Overhaul
- **Father Lorenz → Master Lorenz (匠师 Lorenz)**
  - Title changed from "Father/牧师" to "Master/匠师" (or more precisely "Forge-keeper/炉匠")
  - Rationale: Marigni's national religion is the Temple Forged by the Sacred Flame. Its clergy are craftspeople, not pastors. The terminology should reflect forge-craft tradition, not Christian pastoral tradition.
  - Lorenz's dialogue voice updated: his mediation style should use forge/repair metaphors ("有些东西烧过了就脆了，但如果温度对，还能回火") rather than spiritual comfort language
  - All references to "牧师", "神殿牧师", "Father" in GDD and narrative text should be replaced

### New Location: Estate Forge-Chapel (庄园炉堂)
- Added to Section 3.3 (庄园内可访问区域) as a new accessible area
- Description: A small stone chamber in the estate's west wing. A miniature stone hearth is set into the floor at its center, maintaining a low, steady flame — the estate's own fragment of the Sacred Fire. The air smells of old smoke and cold stone. The room is rarely used but meticulously maintained.
- Available actions:
  - Pray/meditate → Alternative fatigue recovery (resets fatigue counter, but cannot be used on consecutive days)
  - When Master Lorenz visits → Exclusive dialogue scene (higher information density than meeting him elsewhere)
  - Investigate → Possible Hartmann clue (he spent time here in his final weeks — why?)
- Mechanical impact: Adds a fatigue management option that trades flexibility for a narrative scene

### Numerical Framework Added
- Full resource balance tables added as `docs/NUMBERS.md`
- Core loop flow diagram created (see `docs/core_loop.html`)
- Covers: time budget, grain/guldmark/timber/renown systems, weather probabilities, NPC trust thresholds, ending conditions
- All values marked as initial estimates pending playtest

---

---

## [2026-06-05] — GDD Import + Phase 1 Scaffold

### Added
- `docs/GDD.md` — converted from Valley_Season_GDD.docx, all CHANGELOG revisions applied (祈祷室→庄园炉堂, 牧师→炉匠/匠师)
- Full project scaffold: `package.json`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- `src/types/game.ts` — all TypeScript interfaces (GameState, Choice, EventData, etc.)
- `src/data/config.ts` — central numerical constants mirroring NUMBERS.md
- `src/systems/WeatherSystem.ts` — weather generation from probability pools
- `src/systems/TimeSystem.ts` — day/phase progression, market day detection
- `src/systems/ResourceSystem.ts` — grain/guldmark/timber/renown tracking and modifiers
- `src/systems/FatigueSystem.ts` — fatigue state and thresholds
- `src/systems/EventSystem.ts` — fixed event lookup + free choice generation
- `src/data/events/day1.json` — arrival narrative (no choices)
- `src/data/events/day3.json` — ledger discovery (3 choices)
- `src/data/events/day7.json` — Thornwall dinner (3 choices)
- `src/data/events/day10.json` — tenant petition (3 choices)
- `src/data/scenes/locations.json` — location descriptions per phase for 6 locations
- `src/components/ScenePanel/` — left panel: narrative text + log
- `src/components/StatusPanel/` — right panel: date/weather/resources/relationships
- `src/components/ChoicePanel/` — bottom panel: action buttons
- `src/App.tsx` — game state orchestration via useReducer
- `src/main.tsx` + `src/index.css` — entry point + Tailwind setup
- `tests/WeatherSystem.test.ts`, `tests/TimeSystem.test.ts`, `tests/FatigueSystem.test.ts`

### Phase 1 Scope
10-day demo covers: Day 1 narrative → Day 3 ledger event → Day 7 dinner → Day 10 petition.
Free actions each phase: harvest (weather-dependent), timber felling, office/NPC visits, rest.
Daily operating cost (2 guldmark) auto-deducted each morning.
Exhaustion (fatigue=5) forces morning rest the next day.

### [DECISION NEEDED]
- Market day travel (2-phase cost) not yet implemented — currently market days are flagged in StatusPanel but no travel mechanic exists. Needed for Phase 2.
- Repair actions (tools, storage) not yet in choice pool — add in Phase 2 when resource investment loop is built out.

---

## [2026-06-11] — GitHub 初始化 + Phase 2 事件与结局系统

### Added
- `.gitignore` — Node/React 标准忽略规则
- `src/data/events/day12.json` — Kessler 税务审计（3个选项；结果与 Day 3 账本选择挂钩）
- `src/data/events/day15.json` — 林地边界调查（3个选项；`foundForestSymbols` flag 开启结局五线索链）
- `src/systems/EndingSystem.ts` — 五结局判定逻辑，按 NUMBERS.md §6 优先级顺序
- `src/data/endings/endings.json` — 五个结局草稿文本（来自 GDD，结局五有扩写；Phase 3 正式润色）
- `src/types/game.ts` — 新增 `DialogueLine` 接口、`EventData.sceneImage`、`EventData.dialogue`、`GameState.endingId` 字段（为 NPC 头像和场景图片预留）

### Changed
- `src/systems/EventSystem.ts` — 重构为 flag 条件逻辑版本：
  - `getFixedEvent()` 新增 `state` 参数，对 Day 12 做后处理（`investigatedLedger` → 额外声望；`deferredLedger` → 禁用"主动解释"选项，拖延惩罚加倍）
  - `getFreeChoices()` 新增 4 个 flag 解锁选项：深查账目记录（Day 3 调查后+Day<12）、拜访 Lorenz（晚宴后）、翻查旧档案（记录符号后）、Marta 对话描述随信任变化
- `src/data/config.ts` — `DEMO_MAX_DAYS`: 10 → 30，解锁完整 30 天循环
- `src/App.tsx` — Day 30 结束时调用 `EndingSystem.determineEnding()`，底部显示结局标题和"重新开始"按钮；移除旧的演示结束文本
- GitHub 仓库初始化：`https://github.com/Huihan5/valley-season`（private）

### 待处理（Phase 2 剩余）
- Day 18（狩猎季开幕）、Day 22（旅人）、Day 27（领主来信）、Day 30（结算场景）事件 JSON 尚未写
- `travelerDialogueCorrect` flag 在 Day 22 事件写完后才能激活结局五判定
- EventSystem 测试尚未补充（CLAUDE.md 要求每个 system 有对应测试）

---

*Format for future entries:*

## [Date] — Phase N: Description
### Added
- What was added
### Changed
- What was modified and why
### [DECISION NEEDED]
- Ambiguous items flagged for user review
