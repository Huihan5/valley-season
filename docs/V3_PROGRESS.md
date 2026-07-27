# Valley Season v3 · 施工进度与移交记录

配套文档：`V3_BUILD_BRIEF.md`（施工说明）、`DELTA_v2_to_v3.md`（变更清单）、`GDD.md`（设计权威）。
本文件是活文档，每阶段完成后更新。

---

## 阶段状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 改名与废止清单扫描 | 已完成 |
| 1 | 改名 | 已完成（`15218a1`） |
| 2 | 新增系统与变量 | 已完成 |
| 3 | 可重复文本迁入 | 已完成 |
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

## 阶段二遗留与待确认项

**一 · 猎场疲劳，已确认按 brief。** brief 阶段二写"前往猎场 +1 疲劳"，GDD 5.7 写"狩猎季出席消耗双倍疲劳"。作者确认 GDD 那句指的是"既要管庄园又要参加狩猎，那段时间总体消耗更大"，不是给出席本身挂双倍系数。实现为 `OUTING_FATIGUE = 1`，此条不再是待办。

**二 · 庄园炉堂在阶段四之前不可用。** 炉堂已按设计锁在 `unlockForgeChapel` 之后，而写入该 flag 的 Day 4 添柴事件属于阶段四。因此当前构建里晚间的"前往庄园炉堂"与下午的"去炉堂见洛伦茨"都不出现。晚间"早点休息"同样清零疲劳，玩法上没有断路。

**三 · 集市文案是占位。** 阶段二只搭了规则层（运力上限、批量档位、疲劳）。选项文案与日志文本待阶段四的"集市日完整结构"整体替换，含播放顺序与公务员遭遇。

**四 · 两处文本被系统改动带着改了，需要复核。**
- `EventSystem.ts` 洛伦茨拜访的日志把"神殿"换成了"炉堂"，句子结构未动。但洛伦茨此时是到庄园来的客人，"接待了你""泡了两杯茶"的主客关系可能不对。阶段三迁入招呼语时应整体替换。
- `day3.json` 选项 B 的 description 原写"获得领主支持"，与改后的数值（声望 -1、领主印象 +1）不符，已改写为"你换来了上级的容错，也承认了自己对庄园并未完全掌控"。**这句是我写的，不是定稿文本。**

**五 · "有效交谈"的判定。** GDD 只说"每 3 次有效交谈 +1"，未定义何为有效。现按"每次交谈动作计一次"实现，无每日上限。当前交谈选项只在下午出现，一天最多一次，所以实际无差别；若阶段三给晚间也加交谈选项，需要回来确认是否要加每日上限。

---

## 阶段三遗留与待确认项

**一 · 有文本但没有行动的四类。** 草稿 3.5 给了 8 类行动结果文本，其中"巡视农田""巡视林地""采集蘑菇草药""果园采摘"在代码里还没有对应的行动选项。文本已入库待用。采集与果园的收益 GDD 5.4 有数（2 至 3 金卢、5 至 8 金卢），巡视明确不产生数值。**需确认这四个行动归阶段三补做还是并入阶段四。**

**二 · 采伐额度只记不管。** 本季 25 单位额度现在会累计并显示在选项上，但超额没有触发 GDD 5.4 规定的声望 -3。判罚逻辑待接。

**三 · 两个数值是我定的，草稿里没有。**
- 等级制预估的分界：微薄 ≤ 3、尚可 ≤ 5、丰厚 > 5（`YIELD_TIER_*`）。收割基础产出 3 至 7，加天气修正后区间 1 至 8，这样切下来三档都用得上。
- 闲笔触发概率 `AMBIENT_CHANCE = 0.18`。草稿要求"一周两三次"。叠加上"晴或多云 + 疲劳正常 + 当日无固定事件"的前置，约一半时段够格，21 × 0.5 × 0.18 ≈ 每周 1.9 次，落在要求区间内。

**四 · 地点名前缀是系统加的，不是文本的一部分。** `locations.json` 里每个地点有 `label` 字段，正文是草稿原文逐字迁入。系统在正文前面拼"厨房。"这样的前缀，但正文本身已经以地点名开头时（如"农田已经安静了"）不重复拼。

**五 · 流言接在集市的"排队的时候听着"上，是临时接线。** 草稿 4.9 规定的集市日播放顺序是"上午场景 → 公务员遭遇 → 下午流言 → 交易 → 结束文案 → 归程"，整套结构属于阶段四，届时这个选项会被顺序化的流程取代。

**六 · 事件正文里仍有破折号。** Day 1 与 Day 12 的正文是 v2 时期写的，含作停顿用的破折号，违反 brief 硬规则五。这两个事件分别在阶段四重写，届时随草稿一并替换，现在不单独动。

---

## 施工单（Jira 票拆分）

Epic 建议名：`Valley Season v3 rebuild`。合计 35 SP。

### 阶段一 · Rename & cleanup（3 SP）

| Summary | SP | 状态 |
|---|---|---|
| `[v3] Apply GDD ch.12 name table across all player-facing text` | 2 | 已完成 |
| `[v3] Strip retired concepts: woodland symbols, old key, Wynter's scholar identity` | 1 | 移交阶段四 / 五 |

### 阶段二 · New systems & variables（5 SP）

| Summary | SP | 状态 |
|---|---|---|
| `[v3] playerName text input at Day 0 guarantee-letter signature` | 1 | 组件与状态已完成，接线待 Day 0 事件（阶段四） |
| `[v3] Add nobleTrust, lordImpression, and new narrative flags` | 1 | 已完成 |
| `[v3] Conversational trust layer (+1 per 3 talks, cap +2)` | 1 | 已完成 |
| `[v3] Market rework: Saturday only, 20-unit cap, fatigue cost` | 1 | 已完成（supersedes VALE-58） |
| `[v3] Phase-cost rules and two-tier grain thresholds (75 / 90)` | 1 | 已完成 |

### 阶段三 · Repeatable text（6 SP）

| Summary | SP | 状态 |
|---|---|---|
| `[v3] NPC greetings: 4 residents x 6 trust tiers x 2 variants` | 2 | 已完成 |
| `[v3] Location bases (3 fixes) and act-two/three variants` | 2 | 已完成 |
| `[v3] Weather lines and action-result text with tiered estimates` | 1 | 已完成（四类行动尚无选项，见遗留项一） |
| `[v3] Ambient pieces and four-layer rumour pool` | 1 | 已完成（流言接线为临时，见遗留项五） |

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
