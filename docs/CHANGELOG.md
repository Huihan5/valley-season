# Valley Season — Changelog

## [2026-07-30] — 阶段八票二：平行 zh / en 目录与语言开关

### Added
- `src/data/zh/**` 与 `src/data/en/**`，54 个 JSON 各一份，形状完全一致。`en` 目前是 `zh` 的逐字拷贝，正文由票三逐文件替换
- `src/data/zh/index.ts` 导出整包并 `export type Bundle = typeof bundle`；`src/data/en/index.ts` 声明为 `const bundle: Bundle`，**漏译一个键是编译错误**，不是屏幕上的一个洞
- `src/data/locale.ts` — locale 存 `localStorage`，切换后 `location.reload()`。**不进 `GameState`**：它是外壳设置不是季节的一部分，放进去要把 `SAVE_VERSION` 顶到 2，而且同一个存档会被锁在一种语言上
- `src/data/index.ts` — 按 locale 选一份导出。两份都静态 import：全部正文两种语言加起来约 90KB，比一张立绘还小，换来所有系统不必为读一句话变成 async
- 标题页底部的语言开关（中文 / English）。阶段七留的位置正好用上，没有动结构
- `tests/Localization.test.ts` — 五条：键集合相同、数组长度相同、占位符集合相同、`\n\n` 段落数相同、`id` / `resultKind` / `activationFlag` 这类标识符两边一字不差。TypeScript 管得了少一个键，管不了少一行数组或者把 `{playerName}` 连着句子一起译了，而后者正是翻译真会犯的错

### Changed
- 24 个系统与组件改为从 `../data` 读整包。`EventSystem` 的 36 条事件 import 收成一句 `const E = DATA.events`，事件的**播放顺序仍然留在系统里**（`FIXED_EVENTS` 表），语言包只是一张 key → 数据的映射
- 测试里 7 处直接 import 的 JSON 改指 `src/data/zh/`。测试断言的是中文，指向 zh 是准确的而不是碰巧
- **第一个真译的文件：`en/ui.json`**。三十个日名拼成 `Day One`…`Day Thirty`（中文也是 `第一日` 不是 `第1日`，这个郑重是有意的）；产出档位 meagre / fair / heavy（heavy 是英语农事里现成的说法）；疲劳 Spent / Tired / Rested；常驻三人用名，另外三人带称谓（Baroness Marguerite / Baron Henk / Master Lorenz），与中文栏一致；`dateLocale` 从 `zh-CN` 改 `en-GB`

### Notes
- 浏览器验证：切到 English，标题页与右栏全英文，正文与选项仍是中文——因为那些 en 文件还是拷贝。**这正好证明了包是真的换了**，不是悄悄回退到 zh
- 中文存档在英文界面下照常读出（`Day Six · Afternoon`），因为 locale 不在存档里
- 485 个测试全绿，`tsc --noEmit` 干净

---

## [2026-07-30] — 阶段八票一：面向玩家的字符串迁出代码

### Added
- **`src/data/ui.json`** — 界面文字：时段名、三十个日名与星期、天气、疲劳、NPC 显示名、产出档位、资源名，以及六个组件的全部 chrome（面板标题、按钮、存档槽位名、标题页）
- **`src/data/actions.json`** — 行动层：`EventSystem` 的全部自由选项（标签、小字、日志句、禁用原因）、集市交易、经纪人三条渠道、`EstateTaskSystem` 的七件庄园事务
- **`src/data/system_lines.json`** — 系统自己发出的叙述句：抵达、力竭的上午、缺席晚宴、磨岭开口未果、破产三级下滑的三条日志
- `utils/text.ts` 新增 `fill(template, vars)`，替换 `{name}` 槽位。与 `interpolate` 分开是有意的：后者跑在叙事文本上、遇到不认识的占位符要原样留着，前者的每个槽位在调用点都有值

### Changed
- 18 个代码文件里的 **247 处**面向玩家的中文串全部改为读数据层。扫描器现在在 `src/**/*.ts(x)` 上返回 0
- 数量比开工须知记的 225 多 22 处，因为那次的扫描漏了 JSX 文本节点（`— 选择 —`、`{outstanding} 项未办` 这类）
- `SaveMenu` 的 `toLocaleString('zh-CN')` 改为读 `ui.saveMenu.dateLocale`——存档时间戳的格式也是随语言走的
- 唯一的文本改动：`深查账目付款记录` 的小字里 `"杂项维护费"` 的直引号改为全角 `“杂项维护费”`。阶段六归一时明确只动 `src/data`、不碰代码里的字面量；这句现在进了 `src/data`，就该守那个目录的规矩

### Notes
- 这批本来就违反内容与逻辑分离，抽出来是还旧债，不是为双语额外付的成本
- 480 个测试全绿，`tsc --noEmit` 干净。文本零改动（除上面那对引号），所以断言一条都没动
- 浏览器验证：开局到 Day 6 集市，选项、庄园事务清单、资源栏、日志、集市交易的十二个模板串全部照常渲染，没有 `undefined`，没有漏填的 `{n}`

---

## [2026-07-30] — STYLE_GUIDE 的 v2 名字更新（经作者批准）

### Changed
- `docs/STYLE_GUIDE.md` 的 NPC 声音表全部改为 GDD ch.12 的名字，并给出中英对照（双语建设要用这一对）：`Lena` → `Elena Rosendale 埃莱娜`、`Baroness Elke` → `Marguerite de Thornwall 玛格丽特男爵夫人`、`Marta` → `Martha Cresswell 玛莎`、`Inspektor Kessler` → `Inspector Kessler 提莫西·凯斯勒`、`The Traveler` → `Wynter 维特`，其余补上姓氏
- **维特那一行的性格描述是错的**，不只是名字。原文写「Asks questions that reveal he knows too much」，但 GDD 4.5 与 9.6 明写他不认识霍特曼、不提供任何玩家未持有的信息，只把已有的碎片按因果顺序重述。改为对应的描述并标了出处
- **路德维希不再是「letters only」**。v3 里他在开场（铸都十五分钟）与每个结局的尾声都出场，改为「letters, the opening, the epilogue」
- 洛伦茨那节的 `炉匠` 改为 `匠师`，与已入库文本一致（`src/data` 里 匠师 四处、炉匠 零处）。术语表仍保留两者，与 GDD 11.3 一致
- 洛伦茨的例句里混写的 `Hartmann` 改为 `霍特曼`；场景结构那节的 `Maple Avenue` 改为 `枫径大道`（GDD ch.12 没有给这条路的英文，不自造）

- **蒂埃里补进声音表**（作者当场批准）。排在凯斯勒后面，两人是 GDD 说的「理性封建制」最直接的一对载体。这一行不是从 GDD 的性格形容词抄的，是从他已入库的台词里读出来的：Day 13 公告板前比划着树的粗细、Day 15 量三个树桩的断面「量得很快，但每一次都量了两遍」、把最要命的那句说得很轻（「也可能是量错了。人会量错。」紧接着「但集材道不会走错方向。」）、以及那句唯一的冷「我就是公国」。落成一句是：**他递给你的是尺寸，不是指控**

---

## [2026-07-30] — 阶段八开工须知（压缩前写入）

### Notes
- `V3_PROGRESS.md` 新增「阶段八开工须知」：量的盘点（正文 45,002 汉字 / 51 文件、代码内 225 处中文串，都按文件列了）、架构建议（平行 `zh` / `en` 目录 + locale 存 `localStorage` + 切换重载，locale **不进 `GameState`**）、翻译时的六条硬约束
- **更正一条昨天的错判**：`STYLE_GUIDE.md` 本身就是英文写的，参考作者 Sebald 与 Pamuk 读的也是英译本，而且已经带了英文的宗教术语对照表（Forge-keeper / tempering / Codex of Fires / the Hearth）——英译最难的一块是现成的，不需要另立一份英文声音说明
- 该文档真正的问题是**人名停在 v2**：`Lena (女仆)`、`Baroness Elke` 都是阶段一改掉的名字，`The Traveler` 的学者身份在 v3 也退役了。改 `docs/` 需要作者批准，列为阶段八第一张票

---

## [2026-07-30] — 阶段七：解雇线收紧 + 存档系统

### Added
- **存档系统**（PlaytestFeedback 4.h）。新增 `SaveSystem.ts`、标题页、三个手动槽位
  - 自动档跟着每一次状态变化写，包括事件进行到一半的时候。关掉标签页不会丢掉任何东西
  - 三个手动槽位是为了分叉：在 Day 27 存一次，可以反复回去走另一条路，不必重打一个月
  - 读档不会重新掷骰。所有随机结果（场景文本、行动结果、随机事件抽到的变体与流言）在写进 state 的那一刻就已经定死，存的就是那一份
  - 版本不符或文件损坏一律拒绝读取，不做猜测性修复。**唯一修复的是旗标**：读到的 flags 铺在 `INITIAL_FLAGS` 上面，旧档缺了新加的旗标不会读出 `undefined`
  - 存储访问全部包在 try/catch 里，无痕模式与配额用尽都不会让游戏崩掉
- **标题页**（PlaytestFeedback 3.a）。此前游戏一进来就是担保书第一页，没有地方放「继续」，也没有地方放阶段八的语言开关。两个都落在这里
- `TimeSystem.dayName` / `formatMoment`：`第五日 · 下午` 这个写法此前在四个地方各写了一遍

### Changed
- **解雇线由两条轴的下限收到 ≤ 0**（作者 2026-07-30 定）。原来要声望 -10、佃户信任 -5 才解雇，空账到被开除十三天，实际只在极端局面发生。现在是：账上为 0 且声望 ≤ 0 且佃户信任 ≤ 0，当天解雇
  - **佃户整体信任开局就是 -2**，所以那半个条件开局即成立。实际效果是「账上一空，只要声望不是正的，当天就走」。挣来的声望是唯一能垫的东西
  - 三级下滑的形状不动，只是每一级都变短：声望 ≥ 1 时每日 -1；声望 ≤ 0 而佃户 ≥ 1 时佃户每日 -1；两者都 ≤ 0 则结束
  - 浏览器实测：一局早早买了农具的自动通关在**第十三日**被解雇（原先同类局面撑到第三十日）
- 结局面板的「重新开始」由 `window.location.reload()` 改为清掉自动档并回到标题页。否则自动档停在结局上，「继续」会变成继续一个已经结束的季节

### Fixed
- **提前解雇正文里的一句设定错误**。原文写「来的是磨岭那边转过来的一张便条」，一是与前一句「男爵的人是上午到的」自相矛盾，二是凭空暗示亨克插手了解雇这件事——那是发明设定，违反 brief 硬规则二。改为「他带来的是男爵的字，半张纸，写得很快」，接回全篇已有的母题（Day 18 请柬「亨克男爵亲笔写的」、结局二与三「这一次是男爵的字」）。**路德维希不通过邻居解雇你。** 日志行同步改
- 480 个测试通过（新增 13 + 3）

## [2026-07-29] — 账上空了之后（作者裁定）

### Added
- **金卢归零的三级下滑**（PlaytestFeedback 4.a.iii，作者 7-29 裁定）。每日运营扣款之后结算一次：
  1. 账上为 0 → 声望每日 -1，直到再有钱为止
  2. 声望到下限（-10）→ 佃户整体信任每日 -1
  3. 金卢为 0 且两者都到下限 → **男爵不等期限，结局一提前发生，游戏当场结束**
- `ResourceSystem.getInsolvencyEffects`，两个数值在 `config.ts`。每天在记录里留一行，三个阶段各一句
- `dismissedEarly` 旗标：结局一改用另一段正文。没有文秘室的信——文秘室处理的是期限，而这件事没有等到期限。来的是磨岭转过来的半张纸，「即日起停止支付。三日内交接。」结尾仍然落在站台，所以格雷格那两句条件台词照常
- **这段提前解雇的正文是施工方写的**，属于占位级别，随时可替换。它没有复用结局一的任何句子，因为原文整段建立在「三十一天前」「十一月一日」「上个星期的霜」之上，提前解雇时这些全部不成立

### Notes
- 触发门槛很深：声望从 0 掉到 -10 要十天空账，佃户信任再从 -2 掉到 -5 要五天。只有前期把钱花光又一路做坏选择的局面才可能在第三十日之前走到这一步
- 464 个测试通过（新增 9）

## [2026-07-29] — 阶段六：PlaytestFeedback 的 UI 收尾

### Changed
- **底部选项框固定高度**（2.g）。市集下午九个选项与一个「继续」现在占同样的位置，多出来的在框内滚动。结局面板、签名框、继续框一律同高，「记录」不再被下面的选项推着走
- **「记录」改为可展开**（2.g.i）。收起时两行，点一下向上展开全部，展开区自己滚动并停在最新一条。展开不改变面板总高，因此不推动任何东西
- **右栏只显示已经见过的人**（2.h）。开局三个住在这里的；洛伦茨随炉堂开放（Day 4）；两位贵族在棘墙晚宴，跳过晚宴的话在狩猎季。新增 `RelationSystem.isNpcKnown` / `getKnownNpcs`
- **微文字提亮**（2.h.ii）。`game.dim` 由 `#8a7e6a` 提到 `#9c8f78`（对卡片底约 3.8:1 → 4.7:1），分节标题另用 `cream-dim`
- **「重新开始」改为实心金按钮**（4.g.v），并与结局标题一起居中
- 正文限宽 46rem（2.a），不再随窗口拉成整行

### Added
- **金卢不足的提示**（4.a.iii）。低于每日运营开销时资源栏下方出一行，归零时是「账上已经空了。」。**惩罚未做**——GDD 只在 ch.5 提了一句「若无收入则 30 天后为 -10，破产」，没有规则，等作者定

### Notes
- 4.g.iv（Day 30「男爵的人明天才到」与当夜读信矛盾）**已被阶段四的重写解决**：现在 Day 30 夜间不出现这句话，结局的信是十月三十一日 / 十一月一日寄到的，本来就在第三十日之后
- 2.a 的另一半（左右隔太远）由阶段三的「庄园事务」左栏填上了，请作者再看一眼是否还成立

## [2026-07-29] — 阶段六：引号归一、历法、随机事件池

### Added
- **随机事件池上线**（GDD 8.2，草稿 §06）。五个事件全部实装：走丢的牛、上门卖农具的人、铸都来的行商、淘井、第三幕的一天。新增 `RandomEventSystem.ts` 与 `src/data/events/random/` 五个文件
- 每日一次判定，在上午行动结束、进入下午的时候做。基础 30%，当天已排固定事件降到 10%，连续两天无事件升到 50%。窗口与概率都在 `config.ts`
- 每个事件一季只出一次；卖农具的人在农具已修之后不再上门
- `lastEventDay` 旗标：任何事件上屏都记一次日期，「连续两天没有事」才算得出来
- 行商那晚播的是**王国层流言**，抽取在判定时完成并存入旗标，渲染保持可重现。`SceneSystem` 新增 `drawKingdomRumour` / `readKingdomRumour`
- `EventSystem.hasFixedEventToday`：判定概率要知道今天本来有没有安排

### Changed
- **`src/data` 全库引号归一到全角**，直引号 410 处 → 0。做法是按 JSON 字符串词法逐个替换，文件格式与键序不动。玛莎那句嵌套引语按中文惯例改为外双内单（「我说‘那我还能干什么’」）
- 狩猎季请柬「至第二十二日日落为止」改为「至十月二十二日日落为止」。这是公国发的正式文书，会写历法日期，不会写游戏日序号

### Notes
- 历法一票**只有这一处需要改**。扫全库的日期表述之后确认：定稿文本早已按 Day X = 10 月 X 日写成（Day 1「今天是十月一日」、提莫西「你的第三十天是十月三十日」、Day 23 公文「十月三十日届满」），其余 `第二天`「那天」都是相对指代，不是日序号
- 随机事件不挂任何线索，也不给贵族信任与领主印象（brief 附录二第四节）。测试里有一条专门断言整池为空
- 全库 449 个测试通过（新增 33）

## [2026-07-29] — 洛伦茨互斥补全 + 阶段六开工须知

### Added
- 炉堂版洛伦茨的「已经说过」回应，播一次后退回普通招呼语。措辞不提场景，猎场与炉堂两个方向都成立。**四行是施工方写的**（作者授权）
- `V3_PROGRESS.md` 新增「阶段六开工须知」：四张票、PlaytestFeedback 的逐条分诊（哪些已被阶段二至五解决、哪些仍待做、哪些超出范围）、随机事件的触发规则与硬约束、引号归一的做法与风险
- 阶段六新增一张票：`[v3] Normalise all quotation marks in src/data to full-width`（1 SP）。全库 508 全角 + 406 直引号，作者已定统一到全角

### Notes
- 日期改历法一票**无需再确认月份**：定稿文本已把它钉死在十月（Day 27 街口"十月二十七日"、担保书"十月三十日届满"、结局信件"十月三十一日"与"十一月一日"）。PlaytestFeedback 里"能否 assume 这是 9 月"的猜测已被 v3 覆盖

---

## [2026-07-29] — 格雷格只认干活，采伐额度改为软上限

### Changed
- **与格雷格交谈不再计信任。** GDD 5.5 把「去马厩找格雷格」与「照顾马匹」并列为交谈性来源，作者改为只有干活算数。选项保留并仍显示他的分档招呼语，但不产生任何信任
- `Choice` 新增 `greetingFrom`：看见了人，与 `conversationWith`（有效交谈）分开。这是唯一让招呼语脱离信任计数的办法，否则他那 12 条分档招呼语会变成死内容
- **采伐额度改为软上限**（覆盖草稿 3.5c 的「锁定 20」）。超过 25 声望 -3 只收一次；选了「就到这儿」之后又去砍，格雷格 -2 并清除 `respectedLand`；采满 25 不罚
- **巡视林地改为可重复、不过期**，`SURVEY_FOREST_LAST_DAY` 随之删除。首次仍写入 `surveyedForest`
- 三个设计源文件收进 `design-drafts/`，`.gitignore` 由三条规则并为一条

### Added
- 四档林地状态文本，按本季累计采伐量（<10 / <15 / <20 / ≥20）追加在巡视结果之后。不给建议、不给数字，只描述看见的东西。**这四句是施工方写的**

- 洛伦茨互斥的最后一格：猎场版先触发时，炉堂那边现在会应一句「那件事我跟您说过了」，播一次。**这四行是施工方写的**（作者授权），措辞不提场景，两个方向都成立

### Fixed
- 超额采伐之后选项小字仍显示「本季额度还剩 0 单位」，读起来像一堵墙。改为「已超出本季额度」

---

## [2026-07-29] — v3.2 同步：四条信任途径 + 九项文本结清

### Changed
- `docs/GDD.md` 升 v3.2、`docs/V3_BUILD_BRIEF.md` 升 v1.2。**v3.2 有三处是回退而非设计变更**，经作者确认按本地版本恢复：伴手礼与秋装拆为两件并附得体加成、`佃户整体信任` 整节（v3.2 删了定义却仍在三处引用它）、果园的佃户信任每次 +1 上限 +2。原因是 `docs/GDD.md` 的本地修改从未同步进 v3.1
- 「去马厩搭把手」改为**累计 3 次**才给 +1，每次计一次交谈。第 3 次他从工具架上取下另一把刷子
- Day 12 审计拆为两拍：收条节点（新）→ `day12_officer`（原公务员组判定）
- Day 13 回音的触发从 `auditFlagged` 改为 `auditResult`——按草稿 v1.2，审计之后确定触发，不再取决于审计有没有查出问题
- `tookHenkDeal` 的追加段改为**五个结局通用**，各有各的文本。原先只接了结局三与 4B
- 维特第二档不再等待"逐条重述"的文本：他只数类别分布，几件关于时间的、一件关于数目的、一件关于拜访的、一件关于马的
- 猎场版洛伦茨的「已经说过」回应换成草稿 4.10.6 的新文本

### Added
- 采伐克制（草稿 3.5c）：累计砍到 20 单位触发选择。停手 +1 并把本季上限锁死在 20，采满不罚。`getTimberQuota` 随之成为硬上限，GDD 5.4 原定的超额声望 -3 不再需要
- 埃莱娜两条途径：Day 12「谁经手过这些收条」（供出她 -1，撒谎与技术性回避都算保护），以及第 2 次处理办公室文书翻出的册页（放回原处 +1）
- 结局 4A 与 4B 的圣火节镜像段落：同一张长桌，4A 桌尾一副没有人坐的餐具，4B 楼上楼下两个吃了大半的盘子
- 夜账第 4 晚起的收尾文本
- `tests/EndingSystem.test.ts` 与 `tests/Wynter.test.ts` 各补一组；全套 406 个测试

### [DECISION NEEDED]
- 炉堂版洛伦茨在猎场版**先**触发时仍无「已经说过」的回应文本，退回普通招呼语。草稿给的是反方向那一条
- 随机事件池排入阶段六：五个事件正文齐全，代码零实现。触发规则见 GDD v3.2 第 753 行（30% / 有固定事件 10% / 连续 2 天无事件 50%，上午行动后判定）

---

## [2026-07-29] — 关系键改名 + 去马厩搭把手

### Changed
- `NpcId` 的两个键改掉 v2 残留的名字：`lena` → `elena`、`elke` → `marguerite`。后者尤其误导，它指向的是玛格丽特男爵夫人。同步改了 `LENA_*` 常量、`greetings.json` / `fragments.json` 的键与两个事件变体键，共 100 处
- 这不违反阶段一决策三（关系键保留英文）：新键一样是英文，只是不再指错人。`NpcId` 是联合类型，漏改会被 tsc 直接报出来

### Added
- 「去马厩搭把手」——格雷格的第二条行动性信任途径（GDD 5.5）。1 时段、无产出、0 疲劳、一次性、不过期，下午与晚间可做，他不在马厩时不出现。补上之后他是 2（交谈）+ 1（修屋顶）+ 1 = 4，`clue_pos_horse_condition` 与整条位置线打通，**结局 4B 现在可达**
- `action_results.json` 新增 `stable_help` 空槽，等作者补结果文本

### [DECISION NEEDED]
- 埃莱娜仍无任何行动性信任来源，两条碎片都拿不到。需要 GDD 5.5 那两条途径**全部**落地才能到 4
- 待补文本全量清单见 `V3_PROGRESS.md` 阶段五遗留项五（9 项，其中 2 项阻塞）
- 草稿 §06 的五个随机事件正文齐全但随机事件池未实现，且不在任何一张票里

---

## [2026-07-28] — v3 阶段五：调查系统与结局

### Added
- `src/systems/ClueSystem.ts` — 庄园内组的七条碎片按信任档位交付（草稿 2.1 至 2.5）。没有搜寻机制，是四个人各自决定管事值不值得告诉，一次说一件
- `src/data/dialogue/fragments.json` — 九段碎片正文逐字迁入，另含选项文本与日志句
- 格雷格三条按顺序解锁（事实 → 修正 → 材料），玛莎与埃莱娜各自开一次口、把最重的一句留到信任 4
- 洛伦茨的两段挂在炉堂拜访上，不做成独立行动。他的"那个问题"与 Day 21 猎场版本互斥，先触发者生效
- 三组计数 `getClueGroups` / `hasAllClueGroups` / `isPositionLineComplete`，一律按 flag 前缀数，加一条碎片不用改计数逻辑
- `EndingSystem` 重写：五个结局改为 `ending1/2/3/4a/4b`，判定优先级按 GDD 10.1 与 brief 阶段五
- `composeEnding()` 按状态组装条件性文本：结局一的马厩屋顶、结局二与三的领主印象措辞、结局三与 4B 的 `admittedWantToStay` 分岔、4A 的埃莱娜是否到场、`tookHenkDeal` 追加段
- 尾声「路德维希的三天」只用于结局三、4A、4B，差别只在他三天里做了什么
- `tests/ClueSystem.test.ts`（22）与 `tests/EndingSystem.test.ts`（30）。全套 388 个测试

### Changed
- Day 21 猎场那棵树补上 GDD 5.5 指定的洛伦茨行动性信任 +1。不补他永远到不了 4，信任 4 那一段是死内容
- 结局判定不再读 `investigatedLedger + documentedStumps + wynterRestated` 这条阶段四的临时接线。`tests/EventSystem.test.ts` 中对应的一条断言随之更新为结局二
- 结局"高效的机器"删除，v2 的 `ending5` 拆为 4A 与 4B
- 领主印象 ≥ 1 在留任线下浮 2 点（73 = 冬季口粮 60 + 税 13，一点富余也没有）。作者定

### [DECISION NEEDED]
- 4A/4B 同时满足结局三条件时的「圣火节镜像段落」草稿里没有对应正文，已留 `festival_mirror` 空槽
- 4A 的 `tookHenkDeal` 追加段草稿里只写了 4B 与结局三的版本
- 格雷格与埃莱娜的行动性信任来源缺失，导致三条碎片在真实对局里拿不到，**结局 4B 不可达**。详见 `V3_PROGRESS.md` 阶段五遗留项

---

## [2026-07-28] — v3 阶段四（下半）：集市日至 Day 30

### Added
- 集市日完整结构（草稿 4.9）：`src/data/scenes/market.json` + `SceneSystem` 的集市函数。上午抵达（三个幕次变体）→ 公务员遭遇 → 下午排队与流言 → 交易 → 归程
- 公务员遭遇：Day 6 提莫西、Day 13 蒂埃里、Day 27 两人同场，各给一次公务员组判定
- Day 27 街口（草稿 4.9.4）：全游戏的主题落点，选 C 写入 `admittedWantToStay`，不给任何数值
- Day 15 拆为报告（日中）与实地（下午行动触发的连锁），`documentedStumps` 取代 `documentedSymbols`
- 狩猎季 Day 18 至 21 全部重写，新增营地夜宴与营地清晨收获两个事件
- Day 22 维特四档组装（草稿 4.11）。`FORCED_WEATHER` 让 Day 22 必为霜冻
- Day 30 磨岭夜访（草稿 4.13）：按亨克信任分档，信任不足有专门的通用分支
- `Choice.nextEvent` 现在也对自由行动生效：一个行动可以展开成一场戏

### Changed
- Day 23 来信改写为草稿 4.12 的三档加续签窗口。经纪人渠道改由 `brokerUnlocked` 把关，当天下午即开放，不再等到 Day 24
- Day 30 上午与晚间改写。晚间按粮食是否达留任线分档，未达线才出现磨岭那条路
- 集市流言改为进城时抽一次并记在当日 flag 上，交易过程中不再重抽
- 狩猎季窗口收到 Day 18 至 21，Day 22 回到庄园
- `EndingSystem` 的霍特曼链跟随证据改为 `documentedStumps` + `wynterRestated`（完整重写在阶段五）

### Fixed
- **事件分支正文此前从不显示**。`lastResult` 在有 `activeEvent` 时被 ScenePanel 藏起来，因此晚宴判定点的分支正文一句也看不到
- 事件的 `onEnterEffects` 现在能决定自己的选项是否出现；选项全被过滤掉的事件按叙述型处理，不再卡死

### Removed
- `day7.json`、`day22_hunt_traveler.json`、`day22_traveler_estate.json`（v2 版本）
- 晚间"翻查庄园旧档案"（林地符号调查链的最后一环）

### Tests
336 passed（新增 `MarketDay.test.ts` 27 项、`ForestBoundary.test.ts` 15 项、`HuntSeason.test.ts` 36 项、`Wynter.test.ts` 13 项、`Millridge.test.ts` 8 项）

### 需要作者补写
- **维特第二档的重述**（草稿 4.11）：需要 14 条碎片各一句压缩重述，草稿未写。当前第二档播放框架但没有重述段
- **Day 30 的三十天回顾**（草稿 4.13）：草稿标为"系统按玩家的实际行为组装"，但"在马厩待过多少个晚上"这类项目在现有行动里没有对应计数。当前播放前后两段，中间的清单留空

---

## [2026-07-28] — v3 阶段四（上半）：Day 0 至 Day 13

文本全部来自 `NARRATIVE_DRAFTS_v1.1.md` 第 04 节，逐字迁入，未改措辞。

### Added
- `src/data/opening.json` + `OpeningSystem.ts` + `OpeningSequence.tsx` — Day 0 抵达：担保书加四幕共 13 页。担保书是全游戏唯一一次文本输入，签名后名字留在文件上，再翻页
- `src/data/events/day4.json` — Day 4 添柴。写入 `met_lorenz` 与 `unlockForgeChapel`，炉堂在此之前不可访问，守夜规则由洛伦茨本人说出
- Day 7 棘墙晚宴四段连锁（`day7_dinner_arrival` / `_hartmann` / `_departure` / `_return`），取代 v2 的单场景版本
- `src/systems/NobleSystem.ts` — 贵族信任三次机会的第一次。得体计数、结算表、缺席罚则
- Day 8 / 11 / 13 三个回音事件，确定触发，不占时段，无选项
- `EventData.timing`（上午前 / 日中 / 入夜前 / 晚间）取代直接写 `phase`。只有晚间占时段
- `EventData.next` 与 `Choice.nextEvent` — 事件连锁。一次外出可以有多个判定点，时段只在链尾扣一次
- `Choice.resultText` — 事件分支正文，显示在行动结果的位置
- `EventData.variants` — 条件正文块（信息层、四档组装），选择逻辑在系统，文本仍在数据
- `getEffectiveTenantTrust()` — GDD 5.5 的"玛莎信任 ≥4 则佃户整体信任 +1，≤-4 则 -1"

### Changed
- Day 1 改写为草稿 4.2，不再重复介绍开场已经走过一遍的三个人，也不再吃掉它所介绍的那个上午
- Day 3 改写为草稿 4.3，两段正文加三条分支正文。事件位置从上午移到日中
- Day 10 请愿改写为草稿 4.6。信息层由玛莎信任 ≥2 或 `surveyedFields` 解锁；无信息时"先修三户"是盲选，写入 `petitionFairness: unfair`
- Day 12 审计改写为草稿 4.7。凯斯勒（提莫西）的判定给 `clue_ofc_timothy_nature`，未读账的代价是声望 -1 与 Day 13 的回音
- 下午"去炉堂见洛伦茨"改由 `unlockForgeChapel` 把关，不再挂在晚宴上；按附录六，下午不给碎片
- 现有事件的选项小字按 GDD 11.6 重做：判断类不给小字，只有真实的时段与资源花费保留

### Removed
- `src/data/events/day7.json`（v2 单场景晚宴）

### Tests
238 passed（新增 `OpeningSystem.test.ts` 10 项、`EventTiming.test.ts` 20 项、`DinnerAndEchoes.test.ts` 25 项）

---

## [2026-07-28] — v3 阶段 3.5：行动层

CC_BRIEF v1.1 附录一新插入的一块，位置在阶段三之后、阶段四之前。

### Fixed
- **粮食 80 上限改为受 `storageCleared` 控制**。此前无条件截断，优秀线 90 不可达，结局三与 4A/4B 全部够不着
- **阴雨天收割不再重复扣减**。`getHarvestYield()` 与选项生成两处只扣一次
- **收割效率梯度接上了**。`toolsRepaired` / `toolsAndStorage` / `fullyPrepared` 此前无人写入，基础产出永远是 3
- 金卢按 0.5 结算（GDD 5.4）。粮食 1.5/单位卖奇数必然产生小数，取整会破坏预算平衡

### Added
- `src/systems/EstateTaskSystem.ts` — 庄园事务七项（修农具、清理仓储、佃户会议、马厩屋顶、伴手礼赠玛格丽特/赠亨克、秋装）。清单是视图，点选仍是消耗时段的一次性行动
- `src/components/common/EstateTaskList.tsx` — 左侧常驻清单，显示花费、前置与状态
- `GameState.tenantTrust`（初始 -2，范围 -5 至 +5）。Day 10 请愿全修 +2 / 部分修 +1 / 拒绝 -1
- 巡视农田（Day 1-9）与巡视林地（Day 1-14）：限时一次性，无产出
- 采集蘑菇草药（计玛莎交谈）与果园采摘（佃户信任每次 +1，果园累计上限 +2，Day 15 后收益减半）
- 伴手礼与秋装集齐后每次得体判定初始 +1（`getDecorumBonus`）
- 草稿 3.5b 文本：办公室文书三变体、夜账三夜

### Changed
- 上午"处理办公室文书"从零效果改为与埃莱娜相处的场合，计一次有效交谈
- 晚间"夜间审查账目"从零效果改为三次累计，第三次给 `clue_mot_handwriting`
- 晚间炉堂按周四切换：周四是陪洛伦茨守夜（计交谈，首次额外行动性信任 +1），非周四是沉思（疲劳归零，不计信任）

### Tests
183 passed（新增 `EstateTaskSystem.test.ts` 28 项、`StorageCap.test.ts` 6 项）

---

## [2026-07-28] — v3 阶段三：可重复文本迁入

全部文本来自 `NARRATIVE_DRAFTS.md` 第 01、03 节与 4.9.2，逐字迁入，未改措辞。

### Added
- `src/data/dialogue/greetings.json` — 招呼语 48 条（4 名常驻 NPC × 6 档 × 2 变体）
- `src/data/scenes/weather_lines.json` — 天气插入句 25 条
- `src/data/scenes/action_results.json` — 行动结果文本 8 类 × 3 变体
- `src/data/scenes/ambient.json` — 闲笔 15 条
- `src/data/scenes/rumors.json` — 四层流言池，含集市排队的衔接段落
- `src/systems/SceneSystem.ts` — 场景分层组装、幕次判定、招呼语与结果文本取用、流言抽取
- `GameState.currentScene` 与 `GameState.lastResult`；`Choice.resultKind` / `resultVars`

### Changed
- `locations.json` 重构为 `label + act1/act2/act3`，补入第二、三幕各 18 条变体
- 按草稿 3.7 做了三处修正：厨房上午删去玛莎台词、炉堂晚间按已获碎片数切换两个版本、马厩把格雷格拆成可插拔的一句
- 场景文本改为分层组装：地点基底（按幕）+ 天气插入句 +（少量）闲笔
- 行动结果不再只进日志，改为在 ScenePanel 顶部单独成块显示（PlaytestFeedback 1.a）
- 收割与采伐的预估改为等级制"微薄 / 尚可 / 丰厚"，实际数值在结果文本中揭示（PlaytestFeedback 4.b）
- 交谈选项改为播放对应信任档位的招呼语
- 采伐现在累计本季额度并在选项上显示剩余
- 修复：`nextScene` 此前从未生效，场景永远显示"默认"。现按玩家所在地点取用

### Tests
147 passed（新增 `SceneSystem.test.ts` 31 项）

---

## [2026-07-28] — v3 阶段二：新增系统与变量

### Added
- `src/systems/RelationSystem.ts` — 信任分层（GDD 5.5）。交谈性信任每 3 次 +1、上限 +2；行动性信任仍为一次性、可推至 +5。两层相加后钳制在 -5 至 +5。附带六档信任档位与 `countTrustAtLeast`
- `src/systems/MarketSystem.ts` — 集市定价、单次运力上限、批量档位生成
- `src/systems/FlagRegistry.ts` — `unlockForgeChapel`、`tookHenkDeal`、`admittedWantToStay`、`met_timothy`、`met_thierry`、`millridgeDealSigned` 的声明与写入方注记
- `src/components/common/NameInput.tsx` — 全游戏唯一的文本输入组件，供 Day 0 担保书签名使用
- `src/utils/text.ts` — `{playerName}` 占位符替换
- `GameState` 新增 `playerName`、`conversations`、`nobleTrust`、`lordImpression`
- `Choice.advancesPhase` — 单个选项可自行决定是否消耗时段
- 粮食两级门槛常量与 `getGrainTier()`（留任线 75、优秀线 90）

### Changed
- **集市改为仅周六**（Day 6、13、20、27），交易量放开至单次 20 单位（粮食木材合计）。交易在同一下午内连续进行，"装车返程"才结束时段
- 集市不再被狩猎季屏蔽，Day 20 由玩家在赶集与狩猎之间二选一
- 疲劳：前往集市与前往猎场各 +1，集市交易当日 +1（不按笔计）。原猎场固定 +2 改为 +1
- 谷火神殿不再是可访问地点，洛伦茨改到庄园炉堂出现
- 庄园炉堂需 `unlockForgeChapel` 解锁（由阶段四的 Day 4 添柴事件写入）
- 和玛莎、格雷格、洛伦茨交谈改为计入交谈次数，不再直接给行动性信任
- Day 3 选项 A 现在真的消耗一个时段；选项 B 由声望 +1 改为声望 -1、领主印象 +1（GDD 5.6）
- StatusPanel 关系条改读有效信任（两层之和），新增"处境"区显示贵族信任与领主印象

### Tests
115 passed（新增 `RelationSystem.test.ts`、`MarketSystem.test.ts`、`ResourceSystem.test.ts`）

---

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
- EventSystem 测试尚未补充（CLAUDE.md 要求每个 system 有对应测试）

---

## [2026-06-11 续2] — Day 23 领主来信 + Day 30 结算场景

### Added
- `src/data/events/day23.json` — 领主来信（Day 23 晨，强制）：动态拼接信件段落；四项资源各三档文字（低/中/高）；信件结尾引入驻地经纪人渠道，解锁后续换货选项
- `src/data/events/day30_morning.json` — 第三十日（Day 30 晨，强制）：单选项叙事，标志最后一日开始
- `src/data/events/day30_evening.json` — 收季结算（Day 30 晚，强制，choices: null）：模板文字，由 processDay30 填入实际数值；summary 段落依据结局走向动态生成

### Changed
- `src/types/game.ts` — 新增 `ConditionalParagraph` 接口，扩展 `EventData` 加入 `letterOpening`、`letterParagraphs`、`letterClosing` 字段，支持信件组装机制
- `src/systems/EventSystem.ts` — 导入 day23、day30_morning、day30_evening；新增 `processDay23()` 按资源阈值组装信件文字；新增 `processDay30()` 替换 `{resource}` 占位符并生成 summary；`getFreeChoices()` 新增 Day 24-30 午后经纪人换货选项（两种：粮→金卢+扣木材、木→粮+扣金卢），需 `lordsLetterRead` flag 激活
- `src/App.tsx` — `ADVANCE_DAY_EVENT` 去除硬编码 Day 1 日志文字，改为用事件 title 作为通用日志，使 Day 30 晚间 choices:null 事件可正常触发结局流程

### Design decisions
- **Day 23 阈值**（数值后期可调）：粮食 <40 低 / 40-70 中 / >70 高；金卢 <10 低 / 10-25 中 / >25 高；木材 <5 低 / 5-12 中 / >12 高；声望 ≤0 低 / 1-5 中 / ≥6 高
- **经纪人换货比率**：粮→金（6粮+1木换4金，次优于集市 1.5/unit）；木→粮（2木+1金换7粮）。刻意偏低以保证集市仍是更优选择，经纪人仅作亡羊补牢用

---

## [2026-06-11 续] — 狩猎季弧线（Day 18–22）

### Added
- `src/data/events/day18.json` — 狩猎季开幕（强制，晨）：出席/婉拒/无视三选一；`huntingSeasonStarted` flag 由 onEnterEffects 激活
- `src/data/events/day18_hunt_arrival.json` — 猎场初印象（午，activationFlag: huntAttendedDay18）：结识Henk、Elke、陌生学者
- `src/data/events/day19_hunt_ride.json` — 林地边缘骑行（午，activationFlag: huntAttendedDay19）：与学者初次对话，触发 `travelerContactDay19`
- `src/data/events/day20_hunt_stag.json` — 停在林间的鹿（午，activationFlag: huntAttendedDay20）：社交测试，Elke透露Hartmann猎场行为
- `src/data/events/day20_hunt_overnight.json` — 营地夜宴（晚，强制，activationFlag: huntAttendedDay20）：留宿设置 `huntOvernightDay20`+`huntAttendedDay21`
- `src/data/events/day21_hunt_morning.json` — 营地清晨（晨，强制，activationFlag: huntOvernightDay20）：继续/返回选择，继续设 `huntAttendedDay21Continued`
- `src/data/events/day21_hunt_lorenz.json` — Lorenz在猎场（午，activationFlag: huntAttendedDay21Continued）：Lorenz透露Hartmann每年来此"核查"；若有 `documentedSymbols` 可触发符号确认
- `src/data/events/day22_hunt_traveler.json` — 旅人的问题（午，activationFlag: huntAttendedDay22）：Aldric在猎场出现；正确回答（需 `documentedSymbols`）→ `travelerDialogueCorrect`
- `src/data/events/day22_traveler_estate.json` — 庄园门口的旅人（晚，强制）：若未出席猎场显示完整遭遇；若已出席则由 `processDay22Estate()` 替换为归来后简短场景

### Changed
- `src/systems/EventSystem.ts` — 完整重构：
  - `getFixedEvent()` 加入 `activationFlag` 检查（flag 未设则返回 null）
  - 加入 `processDay22Estate()` 后处理器（B-i 旅人双路径逻辑）
  - `getFreeChoices()` 加入 Day 19–22 晨间猎场出席选项（疲劳 ×2）
  - 导入全部9个新事件文件
- `src/App.tsx` — 新增 `filterChoicesByFlags()` 函数，事件选项按 `requiresFlag` 过滤（未满足条件的选项不显示）

---

## [2026-06-14] — VALE-58: Market Day Trading System

### Added
- `src/data/config.ts` — market rate constants (`MARKET_GRAIN_SELL_IN/OUT`, `MARKET_TIMBER_SELL_IN/OUT`) mirroring NUMBERS.md (grain 1.5金卢/unit → 4 grain → 6金卢; timber 3金卢/unit → 3 timber → 9金卢)
- `src/systems/EventSystem.ts` — market logic:
  - Morning free choice `go_to_market` available on market days (Wed/Sat) when not in hunt season; sets `visitingMarketToday = day` flag; costs morning + afternoon (2-phase travel)
  - `getMarketAfternoonChoices()` helper: when afternoon and `visitingMarketToday === day`, replaces normal afternoon choices with three market options: sell grain, sell timber, browse only
  - First market transaction grants +1 renown (`marketFirstVisitDone` gate)
  - Choice disabled states and description text reflect current resource levels

### Design decisions
- 2-phase cost honored: morning sets flag → afternoon shows market-only choices (no harvest/NPC options that day)
- Hunt season gating: market choice hidden during Days 18-22 hunt arc (player is at the hunt grounds, not the estate)
- Rates vs broker: market timber 3金卢/unit vs broker 1金卢/unit; market grain 1.5金卢/unit vs broker ~0.67金卢/unit — significant incentive to plan around market days
- Buy-side (purchasing grain/supplies at market) deferred to Phase 4; sell-side covers the core use case

### Tests
- 74 existing tests all pass; market logic branches implicitly covered by the flag-based early-return path

---

## [2026-06-12] — 测试、Build 验证、GitHub Push、Jira 更新

### Added
- `tests/EventSystem.test.ts` — 74 个测试用例，覆盖所有后处理器和关键通关路径（见下方详细）

### Changed
- `README.md` — 全面重写为面向公开访客的游戏介绍，移除了 Phase 1 留下的"写给设计师"内部文档

### Validated
- `npm run build` 成功，产物 180 kB JS / 10 kB CSS，零 TypeScript 错误，可部署为纯静态页面

### Process notes
- 工作流确认：Claude Code 可通过 Atlassian MCP 直接访问 Jira（cloudId: `57874a9f-3175-476e-a48b-15e43ea5f539`，site: duke-gddi-studios.atlassian.net）。后续可在会话中直接读取 ticket 状态、mark Done，无需截图。
- Jira 更新策略：ticket 描述与实际实现存在出入时（如 VALE-26 原计划 Day 27，实际实现为 Day 23；VALE-34 原计划 9 个事件，实际 17 个），以"已完成更广覆盖"处理，mark Done；差距较大时另开新 ticket 修订。

### Jira tickets marked Done this session
- VALE-6: Vite static build feasibility
- VALE-15: Run production build and inspect static output
- VALE-25: Act 2 fixed-event design docs (Day 12, 15, 18)
- VALE-26: Act 3 fixed-event design docs (Day 22, 27→23, 30)
- VALE-34: Fixed-event scene & dialogue text (17 events implemented, exceeded original 9)
- VALE-38: Fixed-event trigger logic integration
- VALE-40: Ending-determination logic

### EventSystem test detail
- `getFixedEvent()` 基础查找、activationFlag 链（Day 18/20/21/22）
- `processDay12` 三路分支、`processDay22Estate` 双路径
- `processDay23` 信件组装、`processDay30` 占位符替换
- `getFreeChoices()` 晨/午/晚三相位全覆盖、经纪人渠道、猎场出席
- Hartmann 调查链和猎场过夜链关键路径验证

### Fixed
- 测试文件中 Day 15 事件相位错误（`'morning'` → `'afternoon'`）

---

## [2026-06-12] — EventSystem 测试 + 修复 Day 15 相位

### Added
- `tests/EventSystem.test.ts` — 74 个测试用例，覆盖：
  - `getFixedEvent()` 基础查找（正确 day/phase、null for 无匹配、null for 错误 phase）
  - `activationFlag` 逻辑（Day 18/20/21/22 猎场事件链）
  - `processDay12` 三路分支（investigatedLedger / reportedLedger / deferredLedger → 声望/禁用/惩罚）
  - `processDay22Estate` 双路径（huntAttendedDay22 → 简短归来场景；未出席 → 完整旅人遭遇）
  - `processDay23` 信件组装（grain/guldmark/timber/renown 各三档段落；开头/结尾正确拼接）
  - `processDay30` 占位符替换（{grain}/{guldmark}/{timber}/{renown}/{summary}；summary 依结局走向变化）
  - `getFreeChoices()` 晨/午/晚三相位（exhausted 禁用、flag 解锁、猎场出席 Day 19-22、经纪人 Day 24-30）
  - 关键通关路径验证（Hartmann 调查链；猎场过夜链）

### Fixed
- 测试文件中 Day 15 事件相位错误（`'morning'` → `'afternoon'`）；Day 15 事件本身是强制午后事件

---

*Format for future entries:*

## [Date] — Phase N: Description
### Added
- What was added
### Changed
- What was modified and why
### [DECISION NEEDED]
- Ambiguous items flagged for user review
