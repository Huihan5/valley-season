# Valley Season v3 · 施工进度与移交记录

配套文档：`V3_BUILD_BRIEF.md`（施工说明）、`DELTA_v2_to_v3.md`（变更清单）、`GDD.md`（设计权威）。
本文件是活文档，每阶段完成后更新。

---

## 阶段状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 改名与废止清单扫描 | 已完成 |
| 1 | 改名 | 已完成（`15218a1`） |
| 2 | 新增系统与变量 | 未开始 |
| 3 | 可重复文本迁入 | 未开始 |
| 4 | 事件改造与新增 | 未开始 |
| 5 | 调查系统与结局 | 未开始 |
| 6 | PlaytestFeedback 收尾 | 未开始 |

---

## 已确认的施工决策

**决策一 · 结局改动从阶段一推迟到阶段五。**
brief 原定阶段一删除结局"高效的机器"并替换 `ending5`，但结局判定的重写在阶段五。若阶段一就动，`EndingSystem` 及其测试会从阶段二一直坏到阶段五。改为阶段一只做改名，结局结构整体在阶段五处理，保证每阶段结束时测试为绿。

**决策二 · 废止概念跟随承载事件，不在阶段一单独删除。**
理由同上，详见下方移交清单。删除与替换是同一个动作，替换文本属于阶段四的工作范围。

**决策三 · flag 与关系键保留英文。**
玩家不可见，改名收益为零、回归风险不低。仅面向玩家的文本全量中译。

---

## 废止概念移交清单

阶段一未处理，交由后续阶段随事件重写一并解决。

| 废止概念 | 位置 | 归属阶段 |
|---|---|---|
| 林地符号 / 刻痕 | `day15.json`、`day21_hunt_lorenz.json`、两个 `day22_*.json`、`endings.json`、`EventSystem.ts` 的 `research_symbols` 选项 | 阶段四（Day 15、21 重写）+ 阶段五（调查系统重写） |
| 维特"土地权属史"身份 | `day22_hunt_traveler.json:8`、`day22_traveler_estate.json:8` | 阶段四（Day 22 四档组装） |
| 维特与霍特曼通信、签名信 | `day22_traveler_estate.json:8` | 阶段四 |
| 洛伦茨的旧钥匙 | `endings.json:30`（结局五正文） | 阶段五（4A/4B 取代结局五） |
| 结局"高效的机器"、`ending5` 全文 | `endings.json`、`EndingSystem.ts` | 阶段五 |

**依赖链说明**：`documentedSymbols` 由 `day15.json` 写入，向下 gate 了 Day 21 与 Day 22 共三个选项及 `research_symbols` 夜间选项，再向下喂给 `EndingSystem` 的 `hartmannChainComplete`，最终决定结局五可达性。删除上游源头会使该链全线失效。

**已确认无需处理**（扫描零命中，v2 从未实现，仅存在于旧设计文档）：埃莱娜发现上锁的箱子、木匣、维特在 Day 18 至 21 出现。

---

## 阶段二待确认项

`EventSystem.ts:374` 的"去神殿拜访洛伦茨"下午选项。v3 中谷火神殿不再是可访问地点，洛伦茨改为到庄园炉堂出现（brief 阶段二"其他系统改动"）。需连同炉堂的 `unlockForgeChapel` 一并改造。

---

## 施工单（Jira 票拆分）

Epic 建议名：`Valley Season v3 rebuild`。合计 35 SP。

### 阶段一 · Rename & cleanup（3 SP）

| Summary | SP | 状态 |
|---|---|---|
| `[v3] Apply GDD ch.12 name table across all player-facing text` | 2 | 已完成 |
| `[v3] Strip retired concepts: woodland symbols, old key, Wynter's scholar identity` | 1 | 移交阶段四 / 五 |

### 阶段二 · New systems & variables（5 SP）

| Summary | SP |
|---|---|
| `[v3] playerName text input at Day 0 guarantee-letter signature` | 1 |
| `[v3] Add nobleTrust, lordImpression, and new narrative flags` | 1 |
| `[v3] Conversational trust layer (+1 per 3 talks, cap +2)` | 1 |
| `[v3] Market rework: Saturday only, 20-unit cap, fatigue cost` | 1 |
| `[v3] Phase-cost rules and two-tier grain thresholds (75 / 90)` | 1 |

### 阶段三 · Repeatable text（6 SP）

| Summary | SP |
|---|---|
| `[v3] NPC greetings: 4 residents x 6 trust tiers x 2 variants` | 2 |
| `[v3] Location bases (3 fixes) and act-two/three variants` | 2 |
| `[v3] Weather lines and action-result text with tiered estimates` | 1 |
| `[v3] Ambient pieces and four-layer rumour pool` | 1 |

### 阶段四 · Events（12 SP）

| Summary | SP |
|---|---|
| `[v3] Day 0 opening: three acts plus guarantee letter` | 2 |
| `[v3] Rewrite Day 1 and Day 3` | 1 |
| `[v3] Day 4 hearth-feeding and Day 8/11/13 echo events` | 2 |
| `[v3] Market day full structure` | 1 |
| `[v3] Day 15 rewrite: stumps and skid road` | 1 |
| `[v3] Hunt season Day 18-21 rewrite: remove Wynter, add Thierry, camp options` | 2 |
| `[v3] Day 22 Wynter four-tier assembly` | 1 |
| `[v3] Timothy and Thierry encounters plus Day 27 street corner` | 1 |
| `[v3] Day 23 renewal window and Day 30 review plus Henk night visit` | 1 |

### 阶段五 · Investigation & endings（6 SP）

| Summary | SP |
|---|---|
| `[v3] Three-group clue system with prefix counting` | 2 |
| `[v3] Rewrite ending determination; retire "The Efficient Machine"` | 2 |
| `[v3] Conditional ending text and Ludwig epilogue` | 2 |

### 阶段六 · Playtest fixes（3 SP）

| Summary | SP |
|---|---|
| `[v3] Convert date references to real calendar dates (Day X = Oct X)` | 1 |
| `[v3] Remaining PlaytestFeedback UI items` | 2 |

---

## 已有 Jira 票需要调整

| 票 | 处理 |
|---|---|
| VALE-58 集市 | v3 改了规则，不 reopen；在阶段二 market rework 票注明 supersedes VALE-58 |
| VALE-39 随机事件池 | v3 只要 5 个随机事件，非 10-15，改描述 |
| VALE-41 ~ 44 立绘 | 六张已交付可关闭；关闭前把 summary 里的 v2 名字（Elke、Elena）改为 v3 名字 |
| VALE-66 地图 | 已有成品 PNG，改为"用现有图加热区"，不需要重绘 SVG |
| VALE-9 / 29 ~ 33 结局文本 | 结构变更：结局二删除、结局五拆为 4A/4B，需重开 |

---

## 美术需求

**地图**（`src/assets/map_valehold.png` 已入库）：需补一版中文标注（棘墙、枫径、磨岭、河谷城、谷水河），以及猎场的位置标记。谷火神殿已画在 Valehold 下方，v3 中不作为可访问地点，无需单独标注。

**立绘**（`src/assets/portraits/` 已入库六张）：常驻四人（格雷格、玛莎、埃莱娜、洛伦茨）加遭遇二人（提莫西、蒂埃里）已齐。事件 NPC 玛格丽特与亨克尚无立绘，优先级可后置。

---

## 施工笔记

**JSON 转义符会破坏正则词边界。** 形如 `\n\nHenk看见你` 的文本中，转义序列 `\n` 的字母 `n` 紧邻人名首字母，使 `\b` 边界失效导致漏替换。处理 JSON 文本时须先屏蔽转义序列再做替换。阶段一第一轮因此漏掉 36 处。

**叙事文本混入了系统文件。** `EventSystem.ts` 内嵌了大量选项文案与 log 文本，违反内容逻辑分离原则，也是阶段一改名命中最多的文件（28 处）。后续阶段触及该文件时应顺手将文本抽往 `src/data/`。
