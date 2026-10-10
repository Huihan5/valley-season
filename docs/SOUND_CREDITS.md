# 声音的来源与许可

这批声音都是作者另一个项目（与河谷季相关）里在用的文件，作者 2026-10-09 确认**全部为 CC0**（不需署名）。当初从哪里下载、原作者是谁，这里没有记录；原件在作者的那个项目里（`audio/v1.0/`）。以后新加的声音，在下面补文件名、标题、作者、链接和许可（CC BY 要署名，而游戏里目前没有署名的画面）。

| 游戏里的文件（`src/assets/audio/`） | 原文件（`audio/v1.0/`） | 许可 |
|---|---|---|
| `amb_wind_cold.ogg` | `Ambience/wind_light.ogg` | CC0 |
| `amb_rain.ogg` | `Ambience/rain_outside.ogg` | CC0 |
| `amb_rain_inside.ogg` | `Ambience/rain_inside.ogg` | CC0 |
| `amb_kitchen.ogg` | `Ambience/hearth.ogg` | CC0 |
| `amb_woods.ogg` | `Ambience/leaves.ogg` | CC0 |
| `amb_fields.ogg` | `Ambience/birds_day.ogg` | CC0 |
| `amb_night.ogg` | `Ambience/night_crickets.ogg` | CC0 |
| `phase_dawn_01.ogg` … `phase_dawn_07.ogg` | `OneShots/bird_01.ogg` … `bird_07.ogg` | CC0 |
| `act_axe_01.ogg` … `act_axe_03.ogg` | `OneShots/chop_01.ogg` … `chop_03.ogg` | CC0 |
| `ui_tap.ogg` | `UI/click.ogg` | CC0 |
| `evt_door_open_01–02.ogg` | `Doors/plank_open_01–02.ogg` | CC0 |
| `evt_door_close_01–04.ogg` | `Doors/plank_close_01–04.ogg` | CC0 |
| `evt_door_heavy_open_01–03.ogg` | `Doors/heavy_open_01–03.ogg` | CC0 |
| `evt_door_heavy_close_01–03.ogg` | `Doors/heavy_close_01–03.ogg` | CC0 |
| `evt_steps_grass_01–05.ogg` | `Footsteps/step_grass_01–05.ogg` | CC0 |
| `evt_steps_leaves_01–04.ogg` | `Footsteps/step_leaves_01–04.ogg` | CC0 |
| `evt_steps_dirt_01–04.ogg` | `Footsteps/step_dirt_01–04.ogg` | CC0 |
| `evt_horse_01–03.ogg` | `OneShots/horse_01–03.ogg` | CC0 |
| `evt_livestock_01–08.ogg` | `OneShots/sheep_01–04.ogg` 和 `cow_01–04.ogg` 交替（羊、牛、羊、牛……） | CC0 |
| `evt_owl_01–03.ogg` | `OneShots/owl_01–03.ogg` | CC0 |

## 另外找来的

| 游戏里的文件 | 来源 | 作者 | 许可 | 做了什么 |
|---|---|---|---|---|
| `phase_dusk.wav` | [Freesound 386129 · Anvil - Lokomo 125 kg - Hammer on 6mm steel 1 time](https://freesound.org/people/ldezem/sounds/386129/)，上传于 2017-03-29 | ldezem | CC0 | 作者下载（WAV，96 kHz、24 位、立体声、3 秒）；我转成单声道、48 kHz、16 位，加一道 2.5 kHz 的低通让它像远处，峰值压到 0.5，最后 0.4 秒淡出。原件在 `design-drafts/audio-inbox/` |
| `ui_page_01.ogg` … `ui_page_03.ogg` | [Kenney · RPG Audio](https://kenney.nl/assets/rpg-audio) 的 `bookFlip1.ogg`、`bookFlip2.ogg`、`bookFlip3.ogg` | Kenney Vleugels（kenney.nl） | CC0（包内 License.txt 为 Creative Commons Zero） | 原样复制；包 964,837 字节，2026-10-09 下载 |

### 第二批（2026-10-09 晚，都是 CC0，Freesound 的由作者下载，放在 `design-drafts/audio-inbox/`；我用 ffmpeg 切段、做循环、对齐响度）

| 游戏里的文件 | 来源 | 作者 | 做了什么 |
|---|---|---|---|
| `act_scythe_01–02.ogg` | [Freesound 81721 · Sickle Wheat](https://freesound.org/people/silencyo/sounds/81721/)（AIFF，17 秒，单声道） | silencyo | 取 3.4 秒、6.4 秒处各 3 秒 |
| `evt_horn.ogg`、`evt_horn_far.ogg` | [Freesound 69206 · Hunt Horn](https://freesound.org/people/Countrychap999/sounds/69206/)（MP3，8.8 秒，猎狐会现场） | Countrychap999 | 近的原样；远的低通 2.2 kHz、加两道轻回声、压低 8 dB |
| `evt_hooves.ogg` | [Freesound 159498 · sfx-horse-steps-1](https://freesound.org/people/davilca/sounds/159498/)（真马走在土路上） | davilca | 取前 8 秒，淡出 |
| `evt_paper_01–02.ogg` | [Freesound 507864 · Quill and Parchment](https://freesound.org/people/Nickh69/sounds/507864/)（54 秒） | Nickh69 | 取 24 秒、33 秒处各 3 秒；原件很轻（约 −55 dB），抬了约 25 dB，底噪也一起抬了 |
| `ui_seal.ogg` | [Freesound 759526 · Wax seal](https://freesound.org/people/Cerise_Virtuelle/sounds/759526/)（1.3 秒） | Cerise_Virtuelle | 原样（金属印压在 Blu Tack 上，不是真蜡） |
| `evt_stag.ogg` | [Freesound 407631 · Bellowing deer](https://freesound.org/people/IchBinChrist/sounds/407631/)（MP3，16.8 秒） | IchBinChrist | 取 10–14 秒那一声吼 |
| `amb_office.ogg` | [Freesound 211192 · small clock in room](https://freesound.org/people/Yuval/sounds/211192/)（60 秒，立体声） | Yuval | 0.4 秒等功率交叉淡化做成循环（59.6 秒）；原件很轻，抬了约 26 dB |
| `amb_forge.ogg` | [Freesound 386149 · Forge – Coal burning with fan on short](https://freesound.org/people/ldezem/sounds/386149/)（12 秒，96 kHz） | ldezem | 1.5 秒交叉淡化做成 10.5 秒的循环，单声道 |
| `amb_stable.ogg` | [Freesound 223358 · Horse being brushed… eating](https://freesound.org/people/ldezem/sounds/223358/)（5 分钟） | ldezem | 取前 60 秒（程序挑的"最平稳的一段"正好是开头），2 秒交叉淡化，58 秒的循环，单声道 |
| `amb_camp.ogg` | [Freesound 660298 · Campfire deer camp – adding kindling – med wind](https://freesound.org/people/Ambient-X/sounds/660298/)（60 秒） | Ambient-X | 2 秒交叉淡化，58 秒的循环；中途有一声添细柴的噼啪 |
| `res_coin_01–02.ogg` | [Kenney · RPG Audio](https://kenney.nl/assets/rpg-audio) 的 `handleCoins`、`handleCoins2` | Kenney Vleugels | 原样 |
| `res_grain_01–03.ogg` | [Kenney · Impact Sounds](https://kenney.nl/assets/impact-sounds) 的 `impactSoft_heavy_000–002` | Kenney Vleugels | 原样（包 800,850 字节，License.txt 为 CC0） |
| `res_timber_01–03.ogg` | 同上的 `impactWood_heavy_000–002` | Kenney Vleugels | 原样 |
| `evt_steps_stone_01–05.ogg` | 同上的 `footstep_concrete_000–004`（炉堂石板上的脚步） | Kenney Vleugels | 原样 |

收件箱里还有下载了但没用上的：hadescolossus 的割草（705228）、leo153 的马车（497693）、HECKFRICKER 的篝火（729396）、Lydmakeren 的马厩（510915）。

没有用上、已删掉的（原件仍在作者的项目里）：`Doors/` 的 `gate_*`、`hatch_*`，`Footsteps/` 的 `step_dirt_bsb_*`、`step_stone_*`、`step_wood_*`，`Ambience/wind_strong.ogg`；Freesound 下载了但没用的：割草（705228）、马车（497693）、另一条篝火（729396）、另一条马厩（510915）。
