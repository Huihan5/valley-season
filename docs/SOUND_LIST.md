# 声音清单：要什么，用什么词去找

给作者在 Freesound 上自己找声音时用。每一行是一个"位置"：在游戏里用在哪、搜什么、要多长、要躲开什么。找到之后把文件和链接给我，我来转码、做循环、接进 `src/data/cues.ts`。

这份清单是工作文件，不是设计文档。声音的做法已经定了：**安静、写实、克制**，声音只是把原来就在的安静托得深一点，不加游戏式的"叮"。局内不放音乐。

## 先看这几条

- **许可**：Freesound 高级搜索里把 License 选 `Creative Commons 0`，这样免署名、可商用，不用担心。每个文件在页面右侧再看一眼许可。不要用 NC（非商用）。
- **时节**：游戏是十月一日到三十日。虫鸣要稀，鸟要少，霜天要静。避开夏天的蝉、蛙和热带的鸟。
- **世界**：圣火教是锻造，不是教会。**不要教堂钟、管风琴、唱诗**；日终那一声用砧响。也不要酒馆、鲁特琴、奇幻味的东西。
- **干净**：不要能听清的人话、现代车流、飞机、电器嗡嗡声。环境声里不要有突然的一声（狗叫、车过、关门）。
- **循环**：环境床要的是平稳。找 `loop` 标签的最好；没有的话，要比成品长（见各行"找多长"），我来找接缝。开头结尾带淡入淡出的，我接不平。
- **格式**：WAV、FLAC、MP3 都行，单声道够用。我转成合适的格式。
- **记录**：每个文件存下 Freesound 的链接、作者名和许可（截图也行）。后面我会写一份 `SOUND_CREDITS.md`，即使 CC0 不必署名，也留着。
- **筛选的小法子**：Duration 过滤到 30 秒到 3 分钟；加词 `ambience`、`field recording`、`loop`；按 Downloads 排序，先听前几个。

## A. 环境床（循环）

★ 是第一批试听要找的。

| id | 用在 | 搜索词 | 找多长 | 躲开 |
|---|---|---|---|---|
| ★ `amb_wind_cold` | 霜天（第 21、22、28、29、30 天必是）和有风的日子 | `cold wind` · `winter wind ambience` · `wind through bare trees` · `wind field low` | 60–120 秒 | 呼啸、风暴、口哨声（`howling`、`storm`） |
| ★ `amb_rain` | 雨天，院子里 | `light rain loop` · `rain on grass` · `drizzle ambience` · `steady rain outdoors` | 60–90 秒 | 雷、金属屋顶的雨、暴雨 |
| `amb_fields` | 农田，白天 | `countryside ambience` · `field wind grass` · `rural ambience distant birds` · `harvest field` | 60–90 秒 | 拖拉机、车流、蛙和蝉 |
| ★ `amb_woods` | 林地 | `forest ambience autumn` · `woodland leaves rustle` · `quiet forest birds distant` · `forest wind canopy` | 60–90 秒 | 夏天的虫鸣、`jungle` |
| `amb_office` | 办公室，夜里翻账 | `room tone quiet` · `old clock ticking` · `pendulum clock` · `wood stove quiet room` · `study ambience` | 40–60 秒（钟摆 20–30 秒也行） | 电子设备嗡鸣、`computer` |
| `amb_forge` | 炉堂（洛伦茨） | `forge ambience` · `blacksmith workshop ambience` · `furnace low rumble` · `bellows` · `stone hall room tone` | 60 秒 | 连续的锤击、磨削声、电动工具 |
| ★ `amb_kitchen` | 厨房（玛莎）；炉火的底子 | `kitchen ambience pot simmering` · `wood stove crackling` · `soup boiling pot` · `cast iron stove` | 60 秒 | 人声、水龙头、微波炉 |
| `amb_stable` | 马厩（格雷格） | `stable ambience horse` · `horse breathing` · `horse snort` · `hay rustle` · `horse stall` | 45–60 秒 | 嘶鸣、奔跑 |
| `amb_market` | 集市日（周六） | `market crowd murmur distant` · `medieval market ambience` · `crowd walla indistinct` · `cart wheels cobblestone` · `town square ambience` | 60 秒 | 听得懂的话、音乐、叫卖 |
| `amb_night` | 夜里的院子和田野 | `night ambience countryside quiet` · `night wind quiet` · `distant owl` · `quiet night field` | 60 秒 | 密集的蟋蟀（十月底该稀） |
| `amb_camp` | 第 20 天营地篝火 | `campfire crackling` · `bonfire outdoors` · `fire crackle night` · `fireplace crackle` | 60 秒 | 人声、烟花、煤气灶 |
| `amb_fog`（可选） | 雾天 | `fog ambience quiet` · `water drip slow` · `damp air room tone` | 40 秒 | 山洞那种大混响 |
| `amb_hall_night`（可选） | 夜里去炉堂 | `empty stone hall ambience` · `distant fire crackle echo` · `stone room tone` | 60 秒 | 管风琴、唱诗、钟 |

怎么叠：同一时刻最多一层"地方"、一层"天气"，再加偶发的点缀。晚上的户外把白天的地方床换成 `amb_night`；室内（办公室、厨房、马厩、炉堂）不管天气，只在窗边隐约有一点雨或风。

## B. 点缀（单次，稀疏）

| id | 用在 | 搜索词 | 找多长 | 躲开 |
|---|---|---|---|---|
| ★ `phase_dusk` | 一天结束时远处一声**砧响** | `anvil strike single` · `anvil ring` · `blacksmith hammer anvil one hit` · `anvil resonance` | 2–4 秒（带自然衰减） | 连续敲击、剑、电子的"叮" |
| `phase_dawn` | 早晨开始，一两声 | `rooster distant` · `morning birds short` · `crow caw distant` | 3–6 秒 | 一群鸟的大合唱 |
| ★ `ui_page` | 打开见闻、行囊、回望；翻页 | `book page turn single` · `heavy book page` · `old book page flip` | 0.5–1 秒，2–3 条 | 电子翻页音 |
| ★ `ui_tap` | 点选项的极轻一声 | `wood tap soft` · `pen tap desk` · `wooden click soft` | 0.1–0.3 秒，2 条 | `UI click` 一类电子音 |
| `res_grain` | 粮食入仓 | `sack drop grain` · `burlap sack thud` · `grain pour sack` | 1–2 秒，2–3 条 | 人声 |
| `res_coin` | 付金卢 | `coins pouch small` · `few coins wood table` · `coin purse jingle soft` | 1–2 秒，3 条 | 老虎机、一大把硬币、收银机 |
| `res_timber` | 木材进出 | `wood plank drop` · `log stack` · `timber thud` | 1–2 秒，2 条 | 电锯 |
| `act_axe` | 伐木 | `axe chop wood single` · `chopping wood` · `hatchet log` | 1–2 秒，3 条 | 电锯 |
| `act_scythe` | 收割 | `scythe cutting grass` · `sickle wheat` · `reaping` | 2–4 秒，2 条 | 割草机 |
| `evt_horn` | 狩猎号角（第 18–21 天），近一条远一条 | `hunting horn` · `natural horn call` · `horn call medieval` | 3–5 秒 | 军号、战争号角（太史诗） |
| `evt_hooves` | 骑马、马车 | `horse walk dirt road` · `horse trot gravel` · `hooves cobblestone` · `carriage wheels road` | 5–10 秒 | 奔驰 |
| `evt_paper` | 写信、翻账本 | `quill writing` · `pen scratch paper` · `parchment page` · `ledger page turn` | 2–5 秒，2 条 | 打字、圆珠笔 |
| `evt_door` | 门、门闩、马厩的门 | `wooden door creak` · `door latch old` · `heavy wooden door open close` | 1–3 秒，2 条 | 现代门锁 |
| `evt_steps_frost` | 霜天走路 | `footsteps frost grass` · `footsteps frozen ground` · `crunchy footsteps slow` | 4–6 秒 | 跑步 |
| `ui_seal`（可选） | 存档、签名 | `wax seal stamp` · `stamp paper wood` | 0.5–1 秒 | 橡皮章的塑料声 |
| `evt_stag`（可选） | 第 20 天下午的鹿 | `deer call distant` · `deer snort` · `stag roar` | 2–4 秒 | 吼得太凶 |

## C. 音乐（可选，只在三处）

标题页、第 30 天夜晚、结局。Freesound 上成品音乐不多，且质量参差；这几段也可以去 itch.io 的 CC0 音乐区或 OpenGameArt 找。

| id | 用在 | 搜索词 | 找多长 | 躲开 |
|---|---|---|---|---|
| `mus_title` | 标题页，循环 | `solo cello drone` · `sustained strings cold` · `sparse piano slow` · `minimal ambient piano` · `bowed harmonics` | 60–120 秒 | 鼓点、明显的旋律、凯尔特笛、奇幻管弦 |
| `mus_end` | 结局，可以不循环 | 同上 | 40–90 秒 | 同上 |

## D. 数量与优先级

- **第一批（带 ★ 的 7 个）**：`amb_wind_cold`、`amb_rain`、`amb_woods`、`amb_kitchen`、`phase_dusk`、`ui_page`、`ui_tap`。转成 Opus 单声道约 1.5 MB，先让你在游戏里听一遍，再决定扩不扩。
- **全量**：约 13 个环境床加 15 个点缀，转码后约 5–6 MB。单文件 HTML 把音频内联会再涨三分之一，所以全量大概只给 itch 的 zip 版用独立文件，单文件版放第一批。
- 找不到合适的可以空着，一个没有的位置就是没有声音，不影响别的。

## E. 留着以后找（作者说有心情再找）

- **`amb_market`（集市日的人声）**：2026-10-09 在 Freesound 的 CC0 里搜过，只有非洲、西班牙的集市，有叫卖和喇叭，不合。真要做，还要先把"人在集市里"接成一个状态（现在没有这个状态，`cues.ts` 里只登记了名字）。搜索词见上面 A 表。
- **`amb_fog`（雾天）**：2026-10-09 搜不到 CC0。`vfx_fog` 的画面已经有了，没有声音也能过。
- **音乐 `mus_title`、`mus_end`**：还没搜（见 C）。
- **`amb_hall_night`** 取消了：夜里的炉堂沿用 `amb_forge`，音量压到一半（`AMBIENT_AT_NIGHT_GAIN`）。
