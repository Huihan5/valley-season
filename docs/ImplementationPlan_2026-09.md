# 实现计划 · 2026-09

> **进度（2026-09-07）**：
> - ✅ **阶段一（机制/平衡）已完成**——1.1–1.6，已 commit（`3826aa7`）。
> - ✅ **阶段二（UI）已完成**：2.1 选项 chip+hover+按下、2.2 关系模糊化+佃户行、2.3 左栏可点+集市置顶、2.4 开场先输名+跳过、2.5 过劳可见、2.6 对话头像框、**2.7 D12 流言衔接 + D13 狩猎季 UI**、**三个打磨点**——均已浏览器验证（含计算色值：狩猎季霜蓝 `#7a9aaa`、收割/采伐档位词淡金 `#8a7440`、任务花费悬停锈红 `rgba(139,74,42,.9)`）。2.8（P27）作者延后。
> - ⬜ **阶段三（文本精简 D2）** 未开始 ← **下一步**。
> - 全库 528 测试绿，tsc 干净。
>
> 基于已确认的决定 **D1–D13**（见 `docs/playtest/PlaytestFeedback_2026-09.md`）。
>
> ---
> ## 🔖 恢复点（compact 之后从这里继续）
>
> **2026-10-10（最新，pre-compact 时的状态）：873 测试绿、`tsc` 干净、`npm run build` 与 `build:standalone` 通过。所有改动都在工作区，没有提交、没有推送：作者说"听完说可以我就提交"，他还没说。** 提交前先问一句。
> - 这一晚做了：第一批和第二批声音接进游戏（36 个 cue 有声音，`src/assets/audio/` 约 15 MB）、声音控件（`SoundControl`，赛季顶栏和标题页）、左栏三段和右栏紧凑资源、日程一行、回望按钮只在有东西可回望时显示、提莫西和蒂埃里的见闻页（我起草，作者要读）、炉堂石板脚步和两次夜路马蹄、鹿的三句"没走的路"（我起草，作者要读）、根目录整理（`docs/ImplementationPlan_2026-09.md`、`docs/playtest/`、`design-drafts/`）。每一件的来龙去脉在 CHANGELOG 的 `2026-10-10`、`2026-10-09，续二`、`2026-10-09，续`、`2026-10-09`。
> - **盲测包已重打**：`../valley-season-blind-playtest-2026-10-10/`（`_先读我.txt` 里有这一轮的更新说明和三个给测试者的问题）。单文件 HTML 21 MB，要压声音的办法见 CHANGELOG `2026-10-10`。
> - **等作者**：① 听声音（办公室和写字的声音是抬了约 25 dB 的轻录音，底噪可能明显；炉堂循环 10.5 秒；蟋蟀只给前 12 天；砧响"远处"的处理；各声音音量 `AUDIO_CUE_GAIN`），说可以就提交推送；② 读我起草的：提莫西、蒂埃里两页（中英）、鹿的三句（中英）、新的两页见闻开放规则，以及之前交代过的那一批（说话人标注、行囊、地点底文、27 句"没走到的地方"、声望六个词、Day 28/29 的霜）；③ 要不要压声音。**留着以后找**（`docs/SOUND_LIST.md` E 节）：集市环境声（还要先接"人在集市里"的状态）、雾、音乐。
> - 这台机器上的工具（都在会话的 scratchpad，不在项目里；会话没了就重建）：`ffmpeg-tools/`（ffmpeg-static）、`make-batch2.mjs`（切段、循环、对齐响度）、`loudness.mjs`、`import-library.mjs`、`make-code-zip.sh` + `make-zips.ps1`（盲测包；PowerShell 要加 `-ExecutionPolicy Bypass`）、`check-package.ps1`（核对压缩包；Git Bash 的 `tar` 读不了 zip）。
>
> **2026-10-09 晚（较早；862 测试绿、`tsc` 干净；仍在工作区，没有提交）：第二批声音做完并接上了，详见 CHANGELOG `2026-10-09，续`。** 36 个 cue 有文件；ffmpeg-static 装在 scratchpad（`ffmpeg-tools/`，不在项目里），切段、循环、响度的脚本在 scratchpad 的 `make-batch2.mjs`。门、脚步、动物、猫头鹰的原件作者已经拷回，我导入了（scratchpad 的 `import-library.mjs`），量了响度（`loudness.mjs`）、定了 `AUDIO_CUE_GAIN`，整季扫描测试（`CueSeason.test.ts`）看过频率；没用的下载和库文件夹都删了，`amb_market`、`amb_fog` 留着以后找（`docs/SOUND_LIST.md` E 节）。作者要听：蟋蟀只给前 12 天、`birds_day` 十月底是否太密、砧响"远处"的处理、各声音的音量（`AUDIO_CUE_GAIN`）、办公室和写字的声音是抬了 25 dB 的轻录音所以底噪可能明显、炉堂的循环只有 10.5 秒。都听过了再提交。
>
> **2026-10-09（较早；845 测试绿、`tsc` 干净；改动都在工作区，没有提交，等作者听过、验收）：**
> - 作者带来了另一个项目里的 CC0 声音（87 个 ogg），用上的 21 个已按 cue id 放进 `src/assets/audio/`（来源 `docs/SOUND_CREDITS.md`），没用上的已删；播放器认 `名字_01.ogg` 这样的多版本并轮流播放；室内下雨有单独的一层；夜里户外的蟋蟀只给前 12 天；伐木是斧头、收割是镰刀（`act_scythe` 还没文件）。
> - 作者选定了左右栏的新方案，已改：左栏分三段加金线、标签"花费时间"，右栏资源只留图标和读数（声望、佃户各占一行，"佃户态度：冷淡"），日程下面并成一行。
> - 根目录整理过：本文件就在 `docs/`，`PlaytestFeedback*.md` 在 `docs/playtest/`，生成的 `audit-report.md` 在 `design-drafts/`，Freesound 下载的落脚处是 `design-drafts/audio-inbox/`（不进 git）。详见 CHANGELOG 2026-10-09。
> - **声音控件已做**（`SoundControl`：赛季里在"见闻 行囊 存档"之后，标题页在"回望"旁边，静音开关加音量）；第一批七个声音都齐了（`phase_dusk.wav` 是作者下载的 ldezem 砧响经我处理，`ui_page_01–03` 是 Kenney 的 `bookFlip`）。**都还没提交，等作者听过。** 作者问单文件构建里的声音要不要压，我的意见是现在不压，等声音多了再说；itch 版本可以考虑用多文件构建。**还在等作者：** ① 听过之后的意见：砧响"远处"的处理（低通 2.5 kHz、峰值 0.5）、蟋蟀只给前 12 天、`birds_day` 在十月底会不会太密、各床的音量。② 第二批要不要做（金卢、粮食、木材、镰刀、门、脚步、动物……；作者的库里有的先用库里的）。③ 蟋蟀"前十二天"和 `birds_day` 在十月底是不是太密，等作者的耳朵。⑤ 门、脚步、牛羊马、猫头鹰已删，作者要用就先定它们在什么时刻响，再把原件拷回来（作者的原件在他的那个项目的 `audio/v1.0/`）。
>
> **最新（2026-10-08 夜；全库 839 测试绿、`tsc` 干净、`npm run build` 与 `build:standalone` 通过；全部已 commit 并 push，工作树干净，最后一次提交见 `git log`）**
>
> **夜间做的（CHANGELOG `续十一`）：**
> - 标题页的见闻与已见的结局合成一个"回望"（`Retrospect`，两页；赛季内见闻仍单独从中栏顶部开）。
> - 右栏"处境"取消（贵族信任、领主印象没有读数），佃户并进资源。**声望也改成词**：声名狼藉／口碑不佳／尚无声名／渐有名声／颇有名望／名闻河谷，台阶借用关系的六档，落在 −3／3／5 上（`tests/RelationSystem.test.ts` 钉着）。选项下面的小标记和秋装卡只写 ↑／↓，伐木超额写"损失大量声望"。**以后右栏和卡片不要再露声望、信任的数字**（作者的方向，对应 D3）。
> - 外部反馈核出的三处文字已修：第 21 天车里的谢意只在夜宴答"我还没想过"时出现；第 30 天晚上的被子随早晨同一条信任线；第 30 天粮食多一档"缴税还差一截"。中栏阅读区换场景时回到顶部。
> - `docs/SOUND_LIST.md`（作者去 Freesound 找声音的清单）；`docs/DEVELOPMENT_PLAN.md` 新增 3.8 回指审查、3.9 声音第一版、3.10 开发日志（只是记下，不急）。
>
> **下次来：作者说会带新的音频和新的文字。** 先照这个办：
> - **新文字**：作者在项目自己的 `text-review/` 里改（**不要先 `npm run text:export`**，会用 `src/data` 盖掉他们改的）→ `npm run text:import` → `npm test`（中英配对、标点、占位、说话人标记都在里面）。只改了中文的话英文我来补（全角标点、`“”`、英文弯引号；humanizer 过一遍；保留作者原句）。作者改了的句子如果指着前文，要在 `tests/Callbacks.test.ts` 的 `CLAIMS` 里有一条；有人说话的新段要在段首补 `{@id}`；只在某种条件下成立的随机句要补出现条件。导入之后再 `text:export` 让镜像和数据一致，CHANGELOG 记"作者改"，要发测试者就重打盲测包。可能一起来的还有他们读过我起草的那些（说话人标注、行囊、地点底文、"没走到的地方"27 句、声望六个词、Day 28/29 的霜、新写的几句）。
> - **新音频**：文件按 `docs/SOUND_LIST.md` 里的 id 命名放进 `src/assets/audio/`（作者给的是 Freesound 原名的话，先对一张"原名 → cue id"的表）；`docs/SOUND_CREDITS.md` 记文件名、标题、作者、链接、许可（CC BY 要署名，现在游戏里没有署名的画面，要和作者商量放哪儿）。**这台机器没有 ffmpeg**：要转码为 Opus 先问作者能不能装 `ffmpeg-static`（要下载二进制），或者请作者用 Audacity 导出 ogg／mp3；mp3 在循环接缝处有静音间隙，优先 ogg，仍有缝再考虑在播放器里换 Web Audio 的循环或交叉淡出。我听不见，音量平衡靠 `config.ts` 的 `AUDIO_*` 和各 cue 的 gain，让作者在浏览器里听。**第一次有声音之后就必须有静音／音量的控件**（现在没有），所以位置要先和作者定：局内放哪儿，音量面板怎样和"回望"一起放在标题页。第一批只放 7 个（约 1.5 MB），单文件构建会内联。`amb_market`、`amb_camp`、`amb_fog` 还没接状态。
>
> **之后又做了一轮（839 测试绿、`tsc` 干净、构建与单文件构建通过；已提交并推送，CHANGELOG `续十二`）：** ① 回指审查已做：`npm run audit -- --rule callback`，修了第 30 天磨岭亨克那句（按晚宴上的实际答复分四种）和第 27 天"比上次冷清"，`tests/Callbacks.test.ts` 的 `CLAIMS` 表守着，**以后新写回指前文的句子往表里加一条**；② 声音播放器骨架已做：`src/audio/`，声音文件放 `src/assets/audio/<cue id>.ogg` 就会响，现在没有文件所以静音；**还没有静音／音量的控件**；③ 正文里说话人的头像和名字点开见闻；④ 盲测问卷加了两题，盲测包 `…-2026-10-08` 已用当前工作区重打（`_先读我.txt` 重写）。
>
> **作者验收之后才轮到：** 右栏布局的界面示例（先做 2–3 个可比较的，**等作者说开始**）；局内静音按钮放哪儿、音量面板怎样和"回望"一起放在标题页；声音素材到了之后的转码与 `SOUND_CREDITS.md`。开发日志等作者把叙事更新完再写。
>
> 这一天做完了 `docs/DEVELOPMENT_PLAN.md` §2 的第 1–8 项；每一件的来龙去脉在 `docs/CHANGELOG.md` 的 2026-10-08 各条（`续` … `续十`），规则在 `docs/GDD_NEXT.md`，工作方式在记忆里。
>
> - **结局**：判定重排（粮食 <60 硬线 → 4B → 4A → 三 → 二 → 兜底一，库存线逐级降低）、磨岭求援对所有人开放、种子模拟（`npm run sim -- --seeds 200`）、4A/4B 前的"把整理出的判断交给蒂埃里"一键（`ending_handover`）。GDD_NEXT 10.1–10.4。
> - **玩家看得见的层**（都由现成的状态在显示时读出，没有新存档字段，重放安全）：
>   - 差异提示"读过的淡一档"（`SeenSystem`，GDD_NEXT 13.1）；
>   - 行囊：卷宗／文书／物品（`InventorySystem`）；
>   - 头像与说话人：段首 `{@id}`（`src/utils/speech.ts`、`Passage.tsx`），**新写有人说话的段落要补标记**；
>   - 点右栏人名进见闻（`CodexSystem.codexEntryOf`、`CodexPanel` 的 `focus`，不多开放任何层次）；
>   - 中栏底部短句（`BottomLineSystem`，5 句，条件在 `config.ts` 的 `BOTTOM_LINE_RULES`）；
>   - 结局之后折起来的"这一季没有走到的地方"（`MissedSystem`，27 句，事／人／地／岔路四类取三类，`endings/missed.json`；新标记 `visitedChapelNight`）。GDD_NEXT 10.5。
> - **文本审查**：`npm run audit` 列出"这句话什么时候成立"的疑点；随机句的出现条件在 `config.ts`（`AMBIENT_RULES` / `RESULT_RULES` / `WEATHER_LINE_RULES`，按句子位置记，`tests/LineRules.test.ts` 守着）；固定剧情日的天气写定（`FORCED_WEATHER`：Day 21、22、28、29、30 霜冻，Day 27 晴）。**新写的随机句如果只在某种条件下才成立，要补一条出现条件。**
> - **盲测包**：已刷新到 `../valley-season-blind-playtest-2026-10-08/`（`河谷季.html`、`valley-season-code.zip`、`valley-season-itch.zip`、`text-review.zip`、`design-reference/`、`_先读我.txt`），从 commit `9944622` 构建，**比现在旧**（没有回望、处境取消、声望的词、三处文字修复、滚动复位）；要发给测试者时重打；做法见记忆 `project-blind-playtest-package`（`design-reference` 与 `text-review.zip` 含剧透，不外发）。
> - **文本工作台镜像** `text-review/`（gitignore）已重新导出（1249 条），与 `src/data` 一致。**以后改了 `src/data` 里的文字，要在作者动镜像之前重新 `npm run text:export`，否则作者导入旧镜像会把新文字改回去。**
>
> **等作者读／改的（我起草的文字）：** 330 段说话人标注；行囊的名字（行囊／Satchel、物品／Belongings）和每件一句话（"册页里的干枯小枝"并不在玩家手里）；五段地点底文；"没有走到的地方"的 27 句（改走文本工作台 `endings/missed`）；Day 28、29 补的霜冻（作者没点名，可以撤，同时把 Day 30 那句"这几天每天都有霜"改轻）；界面小字"翻到见闻里的这一页"；声望的六个词、"回望"、第 30 天新增的"缴税还差一截"和窗外那句、伐木超额的英文。
>
> **下一步（以 `docs/DEVELOPMENT_PLAN.md` §2 为准）：** ⑧ 待做任务——右栏布局（作者要看可比较的界面示例，旧方案不实施）、场景图、itch 页面与截图（等 UI 与美术）。**不要自己动手做右栏，等作者说。** 另有一些留着的小项，在计划 3.1–3.7：点人物的其他入口（头像、说话人名、卷宗）；提莫西与蒂埃里没有见闻条目；七位没有肖像的人（亨克、玛格丽特、路德维希、维特、公爵、霍特曼、老文德）；开场序章没接说话人；"少了一句"（格雷格不在）没有提示；炉堂晚间那一句整句是一个槽位；第 20 天下午猎场上的鹿没有写"没走的路"；底部短句想再加就要新写环境观察（新写世界文字由作者定）。
>
> **要注意的几点：**
> - `docs/GDD_NEXT.md` 是设计权威（2026-10-07 接替 `GDD.md`，`CLAUDE.md`、`config.ts` 已指向它）；语言切换靠存档里的种子与操作历史重放整季（`src/systems/GameEngine.ts` 的 `replaySeason`），引擎内不能有 `Math.random`。
> - 改引擎或事件数据后跑 `tests/GameEngine.test.ts`（含中↔英重放）与 `tests/Simulation.test.ts`；新的玩家动作类型要加进 `SeasonAction`。
> - 模拟玩家按选项 id 排序，选项 id 变了会卡住（"nothing to choose"）。
> - 不要静默改作者写的世界与人物文字，改了要标出来（CHANGELOG 里单列"新增文字"）。
> - 作者说 `npm run lint` 因仓库没有 ESLint 配置跑不起来，不必理会。
> - 记忆（`~/.claude/projects/.../memory/`，`MEMORY.md` 是索引）：`project-dev-plan-2026-10`（计划与已定数值）、`project-difference-hints`、`project-inventory-satchel`、`project-speaker-marks`、`project-text-audit`、`project-bottom-lines-codex-click`、`project-missed-lines`、`project-simulation-tool`、`project-seeded-replay-engine`、`project-gdd-next-authority`、`project-text-workbench`、`project-blind-playtest-package`；工作方式：`feedback-patching-with-write-tool`（Bash 会吞双反斜杠，改文件用 Write／Edit 工具，ui.json 别用 JSON 往返）、`feedback-minor-zh-claude-writes`（零碎中文我写，作者主导大段）。
>
> ---
> **较早的恢复点（2026-09-21），保留供查：**
>
> **截至 2026-09-21（commit `0a3f22c`，全部已 push；全库 576 测试绿、tsc 干净、工作树干净）**
>
> 第二轮盲测六处 + 响应式已收尾（更早条目）。本轮做了**第三轮盲测反馈** + **roadmap B/C 前两项 + 声画接缝 + 离线交付**（详见 `docs/CHANGELOG.md` 顶部五条 2026-09-20 条目）：
> - ✅ **第三轮盲测（commit `8f9f295`）**：行动/任务卡**去数字化**——关系"奖励"用人话（`格雷格记着这份好` / `X领这份情`）、交谈计数改自然说法（`顺道和X搭上话`）、毁约伐木不显 −2、佃户会议门槛 `信任 ≥ N`→`信任未达`（保留资源/收割 tier/**声望**等功能性数字）；「无产出」两张卡改为说清用途（巡视农田置 `surveyedFields`、夜查账目第三夜出 `clue_mot_handwriting`）；每日选项 **tab → 分组堆叠**（`ChoicePanel`，空类别隐去）。**GDD 11.6 张力**：微文案"机械不叙事"对关系收益放宽（向 D3"关系不显数字"收敛），GDD 未改、待作者择机并入。
> - ✅ **日历（roadmap B，commit `ca11e04`）**：状态栏 30 天只读月历（`StatusPanel.CalendarSection` + `TimeSystem.daysUntilSeasonEnd`/`daysUntilNextMarket`）。当天金环、集市周六琥珀、过去淡出 +「距季末 N 天 / 下个集市 M 天后」。纯 day 号派生、结构上不剧透。
> - ✅ **见闻 = 跨周目档案（roadmap C，commit `ca11e04`）**：与调查卷宗分开、两种寿命（卷宗每局重置，见闻跨周目累积）。`CodexSystem`（持久化照 `CollectionSystem`，键 `valley-season:codex`，出 `GameState`）+ `CodexPanel` + 结构 `data/codex.ts` / 正文 `data/{zh,en}/codex.json`。解锁=本局触发（`fromStart`/`met`(复用 `isNpcKnown`：住户开局即识、洛伦茨与贵族凭 `unlockForgeChapel`/`attendedDinner`/`huntAttendedDay18` 旗标)/`trust`/`flag`）跨周目记住；人物三层 照面/底细/原型。缺口=**方案乙+精修**：silhouette 留计数灰槽、`hidden` 条（磨岭挂 `clue_mot_handwriting`）解锁前不显不计、已解锁人物深层就地上锁。局内+标题页两入口，浏览器实测。**⚠ 内容是占位草稿——等作者文档来替换 `codex.json`。** 详见 [[project-codex-design]]。
> - ✅ **声画数据接缝（SFX/VFX，commit `da25e6a`）**：`data/cues.ts`（cue 注册表 + 天气/场景→cue 映射）+ `CueSystem.resolveCues`（纯函数）。**无资源、无播放器、UI 未接**——只是接缝，日后点亮只改数据+播放器。共识：安静的游戏，声画只做 diegetic、克制。
> - ✅ **离线单文件构建 + 盲测包刷新（commit `d01f2f0`）**：`npm run build:standalone`（vite `--mode standalone` + `vite-plugin-singlefile`）出**一个自包含 `dist-standalone/index.html`**（全内联、`file://` 双击即玩、也能上静态托管）。盲测包**已改名 `../valley-season-blind-playtest-2026-09-20/`**：`河谷季.html`（双击玩）、`valley-season-code.zip`（源码 230 文件无剧透）、`valley-season-itch.zip`（itch 上传，index.html 在根）、`design-reference/`（私）、`_先读我.txt`（含 itch 部署步骤）。见 [[project-blind-playtest-package]]。
>
> **本轮新增（`60163b8` 之后，2026-09-21）：**
> - ✅ **第四轮盲测修复（`268bb54`）**：跨语言读档语言锁（存档元数据记 `locale`、不进 `GameState`；读档若语言不符先 `setLocale`（reload）+ `valley-season:resume` 一次性标记重开该槽；语言开关只在标题页故不破坏局内）；结局 4A `rites_open`「圣火节之后第三天」→「之前」（归火在前，对齐 `festival_mirror`）；磨岭见闻占位去剧透。`SaveSystem`+`App.openSlot`，`SaveSystem.test` +6，浏览器实测。
> - ✅ **见闻六人物正稿（`b84309e` → 精修 `08e5a12`）**：据作者私稿 `design-drafts/update0920/Project VALE`（Timothy 段=三段模板，正好对上 照面/底细/原型 三层）写 gregor/marta/elena/lorenz/marguerite/henk 三层 zh+en。**对照游戏文本订正两处占位硬伤**：Elena=女仆（非文书，day12）、Henk=磨岭男爵（非棘墙玛格丽特之夫，day18）。再按 `humanizer-zh`/humanizer 精修 + 贴原文（去自造比喻/暴力词）。
> - ✅ **中文标点规范（`08e5a12`）**：全库 43 zh 文件用全角中文标点 + 中文引号 “”，唯 codex 残留角括号「」→ 全换 “”（全库唯一异类已清）。**立为长期标准** → 记忆 `text-punctuation-standard`（zh 全角+“”、en 弯引号 ’、每次跑 humanizer、贴作者原文）。
> - ✅ **归火神学进 WORLDBOOK（`08e5a12`，作者批准）**：`docs/WORLDBOOK.md` 加「归火」（人生=锻造、死亡=交还圣火；火葬"接纳" vs 火刑"审判"；火刑留而不用=太神圣——**结局 4A + 洛伦茨底层**）+「身份证件」两节。
> - ✅ **itch 封面 `1800446`**（`src/assets/cover_valley_season.jpg`，未 import 不进 build）；**盲测包刷新+改名 `../valley-season-blind-playtest-2026-09-21/`**（三件套重建到 `08e5a12`、grep 体检无泄漏含新见闻文案；**惯例**：每次刷新此包=改名到当天日期 + 同步 `_先读我` 标题日期）。itch **Public 现为作者选择**（已核实包内无设计稿）。
>
> **本次会话续（compact 之后，2026-09-21，`3105a77`→`0a3f22c`）：**
> - ✅ **见闻世界知识三条精修（`3105a77`）**：`rational_feudalism`/`sacred_flame`/`valewisp_duchy` 按同一标准（humanizer-zh + 中文标点 + 贴 `Marigni：一个国家.docx`）中英成对精修——理性封建补"对上有义务对下有担保"、圣火补"锻造·淬炼·奉献·永恒"四概念 + 生铁→原矿、Valewisp 补"社交围着猎季与马匹转"并保留源文档 grounded 对比。`maplegate` 已紧扎根游戏正文、`millridge` 隐藏占位——两条不动。浏览器实测中英两版渲染、全角引号、弯撇号。**踩坑**：Edit 工具改中文引号时曾把结构引号/内层引号混成 ASCII/全角不一致弄坏 JSON，改用 Node 脚本以 `"`/`“”` 转义重写。
> - ✅ **README 刷新（`3105a77`）**：补中英双语 + 见闻 + 调查线 + `build:standalone` + 状态表；无剧透（README 随盲测包发出）。
> - ✅ **文本编辑工作台（`3960ee6`）+ zh-only 分工文档（`0a3f22c`）**：`scripts/text-export.mjs`/`text-import.mjs`（npm `text:export`/`text:import`）把 55 对 `src/data/{zh,en}` JSON（1414 段，排除逻辑锚点后 **1144 段**可编辑）摊平成 gitignore 的 `text-review/` 中英并排镜像，无损往返（空跑零 diff 已验证），import 跑 `Localization` 同源校验。指南 `文本编辑指南.md`（根，已 git）。**作者确认默认分工：只改中文，英文由我 import 前翻译+humanizer 润色**（注意 stale en 结构上仍能过测试，必须我来补，别指望 suite）。见 [[project-text-workbench]]。
>
> **开放线程 / 下一步：**
> - ⬜ **见闻**：11 条全部成第一版正稿（6 人物 + 3 世界知识 + maplegate + 隐藏 millridge）；作者或微调措辞。要改就走文本工作台（作者改中文、我补英文）。
> - ⬜ **roadmap C 余项**：Day22 线索提示（读 `getClueGroups`，别把"给予而非搜寻"摊平）、一键整日/缩短中段（只跳真空时段的窄版；动的是刚修稳的推进管线，要小心）；世界回应过往（后日谈+日常回调，与见闻同属"加厚故事层"）。
> - ⬜ **SFX/VFX**：接缝已就绪；真做时补资源 + 播放器 + 静音开关 + 自动播放限制处理（注意会撑大单文件体积）。作者的美术/方向取舍。
> - ⬜ **阶段三（D2 文本精简）仍未开始**——作者主导文字，我做打靶/工具/非文字减负；开始前确认幅度与优先顺序。
> - ⬜ **可选小打磨**：手机满宽状态栏留白偏大；tier3"贵族的"一句是否补守贵族线（作者待定）。
> - 记忆：`text-punctuation-standard`（zh 全角+“”、en 弯引号、跑 humanizer、贴原文）；**新增 `project-text-workbench`（text:export/import 往返 + 作者改中文我补英文的分工）**；`project-codex-design`（已更：11 条全成正稿 + 引号踩坑）、`project-blind-playtest-package`（路径 09-21 + 改名惯例 + Public 放宽）、设计哲学、roadmap（日历 SHIPPED）、版面 B、main-only、zh/en 成对。私稿 `神君侧影`=王室层，仅作 canon 参考、不进游戏/WORLDBOOK。
> ---
> 分两大阶段：**先修 playtest 暴露的问题（机制/平衡），再强化 UI**。不擅自扩范围、不动核心玩法。
> 文中 ★ = **仍需你拍板的小点**（已给默认建议）；⚑ = **要同步改 GDD ch.5**（改前会再找你确认）。
> 约定：所有平衡数字改 `src/data/config.ts`，且叙事文本 **zh/en 成对**改，不碰系统逻辑里的文字。

---

## 阶段一 · 修问题（机制 / 平衡）

### 1.1 集市上限 20 → 40（D9）
- 改 `config.ts`：`MARKET_TRANSPORT_CAP` 20 → 40。⚑
- 其余不动（周六开市、可反复卖多笔、"不想卖"收工都已有）。
- 影响：一次进城基本能把手头库存卖得差不多，缓解"只能小额卖"。

### 1.2 伐木提效（D8）
- 改 `systems/ResourceSystem.ts` 的 `getTimberYield`：基础 3，**巡视过林地 +1**（读 `flags.surveyedForest`）、**修过工具 +1**（读 `flags.toolsRepaired`），仍受疲劳 -1；两者可叠加（最高 3+1+1-累）。⚑
- 改 `data/*/actions.json`：
  - `fellTimber` 的预估行照常显示"档位"，但档位会随加成自然变高；
  - `surveyForest`、`repairTools` 的说明加一句"之后伐木更有效率"，让玩家知道这条路径存在。（zh/en 成对）
- 效果：伐木也有了"越准备越高效"，和收割对称；且复用了原本几乎没用的"巡视林地"。

### 1.3 经纪人：新增"买木材" + 软化汇率（D10）
- 改 `EventSystem.ts`（约 921–972 行的经纪人区块）：**新增一个 `broker_buy_timber` 选项**（用钱或粮换木材）。
- 改 `data/*/actions.json` 的 `broker`：加新选项文案；把现有三档"应急汇率"调得没那么亏。（zh/en 成对）
- 改 `config.ts`：经纪人各项兑换率。⚑
- ★ **待你拍板的数值**（默认建议）：
  - 买木材：**5 金卢 → 2 木材**（比集市买贵，但应急可得）；
  - 现有以木换钱 3木→3金 建议提到 **3木→4金**；以木换粮/以粮换钱同步小幅回调（少亏一点）。
  - 你可直接说"就按默认"或给我你想要的数。

### 1.4 被开除：`≤0`→`<0` + 一次性"前任管家救场"（D4）
- 改 `config.ts`/`ResourceSystem.ts` 的 `getInsolvencyEffects`：判定从 `<= 0` 改成 `< 0`。⚑
- 加**一次性救场**：破产后**第一次**将被开除时，不开除，改为 **+10 金卢**并给出明确警告；用 `flags.stewardRescueUsed` 记一次，之后不再触发。
- 新增一小段叙事（"发现前任管家留下的东西和一些笔记"，角色口吻，按 `STYLE_GUIDE`）：放 `data/*/system_lines.json` 或一个小事件 JSON。zh/en 成对。
- 改 `systems/FlagRegistry.ts`：加 `stewardRescueUsed`。
- 改 `App.tsx`：破产结算处接住"救场"分支（现在那里直接走开除）。

### 1.5 礼物/时装解锁时机 + 玛格丽特出场（P11）
- 现状：`EstateTaskSystem.ts` 里"送礼玛格丽特/亨克""秋装"从开局就可买，但此时玩家还不认识玛格丽特 → 困惑。
- 改 `EstateTaskSystem.ts`：给这几项加 `requires` 门槛，**在相关人物/贵族登场后才出现**（读对应登场 flag）。★ 确认用哪个登场点作为门槛（默认：贵族线开启后）。
- 若"玛格丽特出太晚"还想更早给个照面，属于叙事微调，并入阶段三或你补充。

### 1.6 Elena 对话→信任效率（P28）
- 现状：交谈每 3 次 +1、单靠聊天封顶 +2（全局规则，`config.ts`）。
- ★ 默认建议：**只对 Elena** 放宽（她是信息线关键），或把全局 `TALKS_PER_TRUST_POINT` 3→2。倾向前者，避免动到所有人。⚑ 你定方向我再落数。

> **阶段一收尾**：D8+D9+D10 叠加会明显放宽木材/收入，改完我会跑一遍完整流程看平衡，必要时回调，再向你汇报。

---

## 阶段二 · UI 强化

### 2.1 选项效果：悬停明细 + 数字上色 + 选中态（D1 / D11 / P7 / P9）
- 主改 `components/ChoicePanel/index.tsx`；可能加一个小工具把 `choice.effects` 转成"显示模型"（消耗/收益/模糊关系）。
- **数字上色**：消耗=锈红、收益=金/绿（用现有冷调 token，不用鲜艳红绿），并保留 +/− 或图标。
- **悬停**：平时简洁；悬停时弹出完整明细。关系类按 D3 用模糊词、不显数字。
- **选中/悬停态**：补一个更明显的高亮。
- ★ **一个协调点**：收割/伐木的按钮现在**故意只显示档位（微薄/尚可/丰厚）而不显精确数**（保留不确定性，点完才揭晓）。默认做法：**档位词照旧但给"收益色"**，精确数仍在结果里揭晓——既满足"一眼分辨增/减"，又不破坏原设计。你若想按钮上直接显数字，告诉我。

### 2.2 关系显示模糊化 + 补佃户信任（D3）
- 改 `components/StatusPanel/index.tsx`：把 NPC 关系的**数字/进度条换成模糊描述**（如 生疏／相熟／信赖）。
- **补上"佃户整体信任"**（现在完全没显示）——同样用模糊词。
- 加 `RelationSystem.ts` 一个 值→模糊词 的辅助；文案进 `data/*/ui.json`（zh/en）。

### 2.3 左侧栏 → 可点击操作区 + 集市日置顶（D5）
- 现状：一次性事务**同时**出现在左栏（不可点）和底部选项区（可点）。
- 改法：**左栏变成可点**（复用现成的 `getEstateTaskChoices`），并**从底部去掉这些重复项**（`EventSystem.ts:676` 不再 push 进 free choices）。分工变清爽：底部=每天的常规行动，左栏=一次性准备。
- 点击左栏仍走正常流程（照样花一个时段）——接到 `App.tsx` 的选择分发。
- **集市日**：把"前往集市"也置顶到左栏（周六显示），呼应 P12/P20。
- 交互结构改动较大，我会小步改、边改边验证。

### 2.4 开场：先输名字 → 再进文档 + 跳过按钮（D6）
- 改 `systems/OpeningSystem.ts` / `components/OpeningSequence.tsx` / `App.tsx`：
  - **先出名字输入**，再进聘书（信上预填好名字，不再在信上签名）；
  - 加一个**"跳过开场"**按钮，直接进第一天。

### 2.5 过劳可见（D7）
- ★ 默认建议（最小实现）：疲劳偏高时，在状态区/场景给一个**可见提示**（如疲劳条转深、加一句"你脸色发青、嘴唇发紫"式的状态线，呼应你笔记的原意），无需新美术。
- 若要做到"头像气色变化"，需要新的头像图，届时找你要图。你选哪种。

### 2.6 对话"在跟谁说话"头像框（P15）
- 现有 6 张头像资源没用在对话上。加一个**说话人头像+名字**的小框，出现在事件/对话时。
- 放 `ScenePanel` 或事件渲染处；数据用现有 `assets/portraits`。

### 2.7 集市 / 流言 / 狩猎季 / 经纪人 的呈现（P12 / P20 / P21 / P23 / P24）
- 集市日入口置顶（并入 2.3）；
- 流言给独立展示位（P21）；
- 狩猎季（Day18–22）给区别于日常的界面提示（P23）；
- 经纪人渠道在换货界面单独、清楚地成组列出（P24，配合 1.3）。
- 这几项偏"信息层级/一致性"，会用统一样式做。

### 2.8 微文案（P16 / P27）
- 反直觉选项补一句说明（如"腾出仓库"到底干嘛）；
- refine"账目上的工钱"等个别措辞。
- 纯 `data/*` 文案，zh/en 成对。

---

## 阶段三 · 文本精简（D2）
- 目标：收紧节奏、删冗余，但**不大幅**（你的口径）。
- 主要动 `data/en/**` 与 `data/zh/**` 里高文本量的部分（事件、开场、集市旁白）。
- **zh/en 必须成对改**（否则双语套件会不齐）。
- 建议**迭代进行**、放在最后，不阻塞前面的机制/UI 修复。
- P26（"很多 logical/narrative 上的事"）暂搁，等你后续测试补清单，这里预留位置。

---

## 要同步改 GDD 的清单（⚑，改前逐项跟你确认）
1. 集市上限 20→40（ch.5.4）
2. 伐木加成：巡视 +1 / 修工具 +1（ch.5.4）
3. 经纪人新增"买木材" + 汇率回调（ch.5.4）
4. 破产判定 `≤0`→`<0` + 一次性救场（ch.5）
5. Elena 交谈效率（若动全局规则，ch.5.5）

## 仍需你拍板的小点（都给了默认，可一句"按默认"）
- ★1.3 经纪人具体数值（买木材 5金→2木；以木换钱 3→4；其余少亏一点）
- ★1.5 礼物/时装用哪个登场点解锁（默认：贵族线开启后）
- ★1.6 Elena 效率：只对她放宽 or 全局（默认：只对她）
- ★2.1 收割/伐木按钮：保留档位+上色（默认）还是直接显数字
- ★2.5 过劳呈现：状态线（默认，无需美术）还是头像变化（需新图）

## 执行顺序
1. **阶段一**（1.1→1.6）：多为 config/系统小改，风险低、见效快，先做；收尾跑一遍看平衡。
2. **阶段二**（2.1→2.8）：UI，从"选项上色/悬停"和"关系模糊化"这类高频可见项做起，再到左栏改造、开场、头像框。
3. **阶段三**：文本精简，迭代收尾。
- 每完成一单元更新 `docs/CHANGELOG.md`；每次系统改动跑 `npm test`；可预览的改动用浏览器验证后再向你汇报。
