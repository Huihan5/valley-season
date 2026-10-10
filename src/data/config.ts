// All numerical values mirror docs/GDD_NEXT.md ch.5 — never hardcode game balance elsewhere.
// (GDD v3 retired the standalone NUMBERS.md; ch.5 is the sole numerical authority.)
import { DayPhase, WeatherType } from '../types/game';

export const DEMO_MAX_DAYS = 30;

export const INITIAL_RESOURCES = {
  grain: 0,
  guldmark: 50,
  timber: 8,
  renown: 0,
} as const;

export const INITIAL_RELATIONSHIPS = {
  gregor: 0,
  marta: 0,
  elena: 0,
  marguerite: 0,
  henk: 0,
  lorenz: 0,
} as const;

// Grain yield per phase (units/phase) by preparation state
export const HARVEST_YIELD = {
  unprepared: 3,
  toolsRepaired: 5,
  toolsAndStorage: 6,
  fullyPrepared: 7,
} as const;

// Standing at or below this costs the harvest a point: unhappy tenants work slower
// (GDD_NEXT 5.4, 声望修正).
export const RENOWN_HARVEST_PENALTY_AT = -3;

// Weather modifier to harvest yield
export const WEATHER_HARVEST_MOD: Record<string, number> = {
  sunny: 1,
  cloudy: 0,
  rainy: -2,
  frost: 0,
  fog: 0,
};

// Timber per harvest phase
export const TIMBER_YIELD = 3;

// PlaytestFeedback 2026-09 (D8): felling gets a preparation path of its own, so it
// is no longer a flat 3 with no way to improve. Both bonuses reuse existing actions
// and stack: walking the woods scouts the best stands, a repaired tool set cuts faster.
// 巡视林地 is a one-off task that costs a phase and a point of fatigue, so what it buys
// has to be worth the walk: with the tools repaired a felling is 3 + 2 + 1 = 6, the same
// "heavy" tier the harvest reaches at its best.
export const TIMBER_SURVEY_BONUS = 2;  // after 巡视林地 (surveyedForest)
export const TIMBER_TOOLS_BONUS = 1;   // after 修工具 (toolsRepaired)

// Seasonal felling quota set by ducal decree (GDD ch.5.4). Exceeding it costs renown.
export const TIMBER_SEASON_QUOTA = 25;

// Daily guldmark operating cost (auto-deducted each morning)
export const DAILY_GULDMARK_COST = 2;

// ── 账上空了之后 (作者裁定 2026-07-29；GDD ch.5 只写到「破产」二字) ─────────
// 三级下滑。付不出钱先是外面知道，声望每天掉一点；声望不再是正的，住在这里的
// 人才开始走，佃户信任每天掉一点；两样都归零而账上仍然是空的，男爵不等期限。
export const INSOLVENCY_RENOWN_PER_DAY = -1;
export const INSOLVENCY_TENANT_PER_DAY = -1;
// PlaytestFeedback 2026-09 (D4): the line used to be ≤ 0, and 佃户整体信任 opens at -2,
// so a steward who ran out of money before earning any renown was dismissed on the
// spot — "一进去就死". The line is now strictly < 0 (getInsolvencyEffects compares with <),
// so standing at exactly 0 still buys the renown-spending grace day first.
export const INSOLVENCY_DISMISS_RENOWN = 0;
export const INSOLVENCY_DISMISS_TENANT = 0;
// A one-time reprieve the first time dismissal would fire: instead of the season
// ending, the player finds what the previous steward left behind — some coin and
// notes — worth this much, with a clear warning. Narrative in system_lines.stewardRescue.
export const STEWARD_RESCUE_GULDMARK = 10;

// Storage cap until the barn is cleared out; clearing lifts it entirely (GDD ch.5.4).
export const GRAIN_STORAGE_CAP_UNCLEARED = 80;

// ── 庄园事务 (GDD ch.5.4) ───────────────────────────────────────────────────
// One-off purchases. Each costs a phase as well as money, because a phase is the
// scarcer currency and the trade between them is the decision worth making.
export const REPAIR_TOOLS_COST = 15;
export const CLEAR_STORAGE_COST = 10;
export const REPAIR_STABLE_COST = { guldmark: 12, timber: 3 };
export const GIFT_COST = 5;          // 河谷城风尚伴手礼
export const ATTIRE_COST = 10;       // 瓦莱维斯普秋装

// ── 佃户整体信任 (GDD ch.5.5) ───────────────────────────────────────────────
// Starts negative: three weeks with nobody answering requests is a low point,
// not hostility. A full repair at Day 10 alone brings it back to zero.
export const TENANT_TRUST_INITIAL = -2;
export const TENANT_TRUST_MIN = -5;
export const TENANT_TRUST_MAX = 5;
export const TENANT_MEETING_MIN_TRUST = 0;
// 玛莎 knows which of the five families is worst off; so does anyone who walked
// the fields. Either one opens the Day 10 petition's information layer.
export const PETITION_INFORMED_TRUST = 2;
export const ORCHARD_TENANT_TRUST_CAP = 2; // the orchard alone cannot carry it further
// 玛莎 at ±4 moves the whole household one point with her (GDD ch.5.5).
export const MARTA_TENANT_SWING = 4;

// ── 贵族信任的三次机会 (GDD ch.5.5) ─────────────────────────────────────────
// The judging is deliberately lenient: two 得体 out of three unlocks 玛格丽特's
// fragment, so a player is allowed to misread any one of the three occasions.
// Which answer counts as 得体 at the dinner — the drafts mark these in §4.5.
export const DINNER_DECORUM_ANSWERS: Record<string, string> = {
  dinnerPick1: 'C',
  dinnerPick2: 'C',
  dinnerPick3: 'B',
};
// Indexed by 得体 count, 0 through 3.
export const DINNER_SETTLEMENT = [
  { nobleTrust: 0, renown: -1 },
  { nobleTrust: 0, renown: 0 },
  { nobleTrust: 1, renown: 1 },
  { nobleTrust: 1, renown: 2 },
];
// Two 得体 out of three is what the manor hears about the next morning.
export const ECHO_DECOROUS_AT = 2;
// Staying home costs a point of standing and burns one of the three chances.
export const DINNER_ABSENT_RENOWN = -1;
export const DINNER_DAY = 7;

// The season runs to the 22nd officially, but the local field breaks up on the
// 21st and the duke's party rides on without them. Day 22 happens at the manor.
export const HUNT_FIRST_DAY = 18;
export const HUNT_LAST_DAY = 21;

// The hunt's opening is the third chance. Following 亨克, greeting 玛格丽特 and
// watching 蒂埃里 work are all 得体; only hiding at the edge of the camp is not.
export const HUNT_OPENING_DECOROUS = ['A', 'B', 'C'];
// 埃莱娜 only airs the winter quilts for a steward she expects to still be here.
export const ELENA_QUILTS_TRUST = 4;

// 磨岭 at night: what 亨克 is willing to do, by how far the player has got with him.
export const MILLRIDGE_TRUST: Record<string, number> = {
  millridge_everything: 4,
  millridge_cash: 2,
  millridge_goods: 2,
};
export const MILLRIDGE_CASH = 20;       // enough to clear the winter's margin
export const MILLRIDGE_TIMBER = 10;
export const MILLRIDGE_SPRING_SEED = 15; // what is left in the barn for the spring, once the winter is covered


// 维特 restates what the player already holds; how much of it he can put in
// order depends on how many pieces there are (drafts 4.11).
export const WYNTER_PARTIAL_ACCOUNT = 3; // he can tell the order is wrong
export const WYNTER_FULL_ACCOUNT = 6;    // he can lay the whole thing out
export const POSITION_LINE_COMPLETE = 4; // 格雷格 three plus 蒂埃里 cross-fix (4A/4B)
// What 维特 lists on Day 22 — the horse that came back, the worn shoe, the black mud, the
// plant in the mane — is all 格雷格's three; 蒂埃里's cross-fix does not exist until Day 27.
export const WYNTER_POSITION_KNOWN = 3;

// Fragments that need someone to have decided you are worth telling (GDD 5.5, 9.1).
export const LORENZ_FRAGMENT_TRUST = 3;
// 玛格丽特's clue opens on 贵族信任 + her own regard, taken together (GDD 5.5: she is
// the axis's gatekeeper, and the +2 dinner gift was written to reach this on its own).
export const MARGUERITE_FRAGMENT_TRUST = 2;
export const LORENZ_WHY_TRUST = 4;         // he explains why he broke his own rule

// The estate's own fragments, delivered by trust tier (drafts 2.1 to 2.3). Each
// line unlocks in order: nobody hands over the third thing before the first.
export const FRAGMENT_TRUST = {
  gregor_intact: 2,
  gregor_returned: 3,
  gregor_condition: 4,
  marta_summer: 2,
  marta_lastwords: 4,
  elena_papers: 3,
  elena_burned: 4,
} as const;

// ── 结局判定 (GDD ch.9.1 / 10.1, V3_BUILD_BRIEF 阶段五) ──────────────────────
// Three groups must all clear before the truth endings open at all.
export const CLUE_ESTATE_REQUIRED = 4;   // clue_pos_ + clue_mot_
export const CLUE_OFFICER_REQUIRED = 3;  // clue_ofc_
export const CLUE_NOBLE_REQUIRED = 1;    // clue_nob_
// Standing: 河谷的人 asks the most of it, the truth endings a middling amount, 称职的外来者 none.
export const ENDING_TRUTH_MIN_RENOWN = 3;
export const ENDING3_RENOWN = 5;
export const ENDING3_DEEP_TRUST = 3;      // 信任 ≥ 3 …
export const ENDING3_DEEP_TRUST_COUNT = 3; // … held by at least this many NPCs
// 领主印象 ≥ 1 buys one margin of error at the 留任线 (GDD 5.6). Two units down
// from 75 is 73, which is winter rations 60 plus the tax 13 and nothing spare.
export const LORD_IMPRESSION_MARGIN_MIN = 1;
export const RETAIN_MARGIN = 2;
// 埃莱娜 stays away from the rites unless she has decided about the player.
export const ELENA_RITES_TRUST = 4;

// ── 非资源行动 (GDD ch.5.4) ─────────────────────────────────────────────────
// The two surveys are one-shot and expire: their whole use is preparing for one event.
export const SURVEY_FIELDS_LAST_DAY = 9;   // prepares the Day 10 petition
export const FORAGE_YIELD_RANGE = [2, 3];  // 金卢
export const ORCHARD_YIELD_RANGE = [2, 5]; // 金卢
export const ORCHARD_FULL_YIELD_LAST_DAY = 15; // after this the fruit is on the ground
export const ORCHARD_LATE_YIELD_RATIO = 0.5;   // ... and what is left is worth this share

// Reviewing the ledger at night pays off only once it becomes a habit.
export const NIGHT_LEDGER_CLUE_AT = 3;

// 格雷格 counts, he does not listen. Three afternoons of his work, and the
// paperwork read twice, are the two routes GDD 5.5 assigns without a mechanism.
export const HORSE_CARE_TRUST_AT = 3;
export const OFFICE_FOLIO_AT = 2;
// Where he stops counting and starts talking about sixty years (drafts 3.5c).
export const TIMBER_RESTRAINT_AT = 20;
// Felling past the season's allowance is possible and expensive (GDD 5.4).
export const TIMBER_OVERRUN_RENOWN = -3;
// Taking the wood after telling him you would not: the point back, and one more.
export const TIMBER_BROKEN_PROMISE_TRUST = -2;
// What the woods look like, by units taken this season. Four bands, no advice.
export const FOREST_STATE_TIERS = [10, 15, 20];

// Grain lines (GDD ch.5.4 / 10.1). Three of them, each its own test:
//   below the 底线 nothing can save the season (a hard line, ahead of everything else);
//   the 留任线 is what 称职的外来者 asks, and is winter rations plus tax;
//   the 优秀线 is what 河谷的人 asks, and is the 留任线 plus seed for the spring.
export const GRAIN_DISMISS_THRESHOLD = 60;   // 底线：低于它直接解雇；真相结局也以它为粮食线
export const GRAIN_RETAIN_THRESHOLD = 75;    // 留任线：冬季口粮 60 + 税约 13
export const GRAIN_EXCELLENT_THRESHOLD = 90; // 优秀线：留任线 + 春播种子 15

// Every ending that keeps the steward also asks for real stock behind the grain (GDD 10.1):
// a steward who ground out the harvest and left nothing in the purse or the woodpile has
// not kept the estate in order. The lines step down with how much the ending is about
// the estate: 称职的外来者 is the estate in order and asks the most; 河谷的人 is the valley
// and asks less; the truth endings only ask that the estate was not left bare.
export const ENDING2_GULDMARK = 50;
export const ENDING2_TIMBER = 12;
export const ENDING3_GULDMARK = 20;
export const ENDING3_TIMBER = 5;
export const ENDING_TRUTH_GULDMARK = 10;
export const ENDING_TRUTH_TIMBER = 3;

// 全部耕地的理论总产出——地里立着的、还没收上来的粮食上限（GDD ch.5.4）。
// playtest 2026-09 定为 150（原 140）。收割从田里往仓里搬，霜冻日损耗的正是这批未收割的。
export const HARVESTABLE_TOTAL = 150;
// 霜冻日，未收割作物损失剩余量的比例（GDD ch.5.4，表 5.3「霜冻：未收割作物每日损失剩余量 ×10%」）。
export const FROST_LOSS_RATE = 0.1;

// Fatigue thresholds (see docs/GDD.md ch.5)
export const FATIGUE_TIRED_THRESHOLD = 3;
export const FATIGUE_EXHAUSTED_THRESHOLD = 5;

// Days whose weather is written rather than rolled.
export const FORCED_WEATHER: Record<number, WeatherType> = {
  21: 'frost', // the ride home from the hunt: 回程的路上有霜
  22: 'frost', // 维特 arrives on the day the wind turns (drafts 4.11)
  27: 'sunny', // the last market: the low sun and the strip of light on the wall at the street corner
  28: 'frost', // the last three mornings: 这几天每天都有霜 (Day 30), and the frost on the quilts that evening
  29: 'frost',
  30: 'frost',
};

// Weather probability pools by day range (day 1-10 only for demo)
export const WEATHER_POOLS: Record<string, Record<string, number>> = {
  early: {  // Day 1-10
    sunny: 40,
    cloudy: 35,
    rainy: 20,
    frost: 0,
    fog: 5,
  },
  mid: {    // Day 11-20
    sunny: 25,
    cloudy: 30,
    rainy: 30,
    frost: 10,
    fog: 5,
  },
  late: {   // Day 21-30
    sunny: 15,
    cloudy: 20,
    rainy: 35,
    frost: 25,
    fog: 5,
  },
};

// Relationship bounds
export const RELATION_MIN = -5;
export const RELATION_MAX = 5;

// Trust is layered (GDD ch.5.5): conversational trust caps low, action trust carries the rest.
export const TALKS_PER_TRUST_POINT = 3; // 每 3 次有效交谈 +1
export const TALK_TRUST_CAP = 2;        // 单靠交谈最高 +2
// PlaytestFeedback 2026-09 (P28): 埃莱娜 is the office/records line's keystone and
// talking her toward trust felt too slow. She alone earns a talk point every 2
// conversations; the cap (+2) is unchanged and everyone else keeps the default 3.
export const TALKS_PER_TRUST_POINT_BY_NPC: Record<string, number> = { elena: 2 };

// 贵族信任 (GDD ch.5.5) — three chances at +1 each: Day 7 dinner, boundary dispute, hunt season
export const NOBLE_TRUST_MIN = 0;
export const NOBLE_TRUST_MAX = 3;
export const NOBLE_TRUST_ENDING3_MIN = 1;  // 结局三的必要条件之一

// 领主印象 (GDD ch.5.6)
export const LORD_IMPRESSION_MIN = 0;
export const LORD_IMPRESSION_MAX = 3;

// Renown bounds
export const RENOWN_MIN = -10;
export const RENOWN_MAX = 10;

// ── 集市 (GDD ch.5.4) ───────────────────────────────────────────────────────
// v3: Saturdays only (Day 6 / 13 / 20 / 27), but quantity per trip is open up to
// the cart's capacity. The bottleneck moved from market frequency to felling phases.
// PlaytestFeedback 2026-09 (D9): a single 20-unit trip felt like it only let the
// player nibble at their stock, so the cart carries 40 now — enough to clear most
// of a season's stock in one Saturday, while a cap is still there.
export const MARKET_GRAIN_PRICE = 1.5;            // 金卢/unit
export const MARKET_TIMBER_PRICE = 3;             // 金卢/unit
export const MARKET_TIMBER_PRICE_MILLRIDGE = 4;   // after the 磨岭 agreement with 亨克
export const MARKET_TRANSPORT_CAP = 40;           // grain + timber combined, per trip (cart capacity)
export const MARKET_LOT_SIZES = [4, 10];          // fixed lots offered alongside a sell-max option

// ── 经纪人换货 (Day 23 来信后的下午起至 Day 30，领主来信后解锁) ──────────────────────────────────
// An emergency channel, always worse than the market. PlaytestFeedback 2026-09 (D10):
// previously every option consumed timber and none produced it, and the rates felt
// punishing day after day. Added a buy-timber channel, and eased the rates a little
// (still below the market so it stays a last resort, not a strategy). These used to
// be hard-coded in EventSystem; single-sourced here per the balance-numbers rule.
export const BROKER = {
  grainToGold:  { grain: 6, guldmark: 4 },   // was 6 grain + 1 timber → 4g (dropped the timber cost)
  timberToGold: { timber: 3, guldmark: 4 },  // was 3 timber → 3g (a coin more)
  timberToGrain: { timber: 2, grain: 8 },    // was 2 timber + 1g → 7 grain (dropped the coin, +1 grain)
  goldToTimber: { guldmark: 5, timber: 2 },  // new: buy timber in a pinch, dearer than the yard
} as const;

// ── 时段与疲劳消耗 (V3_BUILD_BRIEF 阶段二) ──────────────────────────────────
// 插入式事件不占时段；行动触发式占 1；外出式占 2（上午出发，下午抵达）。
export const PHASE_COST_ACTION = 1;
export const PHASE_COST_OUTING = 2;
export const OUTING_FATIGUE = 1;        // 前往集市 / 前往猎场
export const MARKET_TRADE_FATIGUE = 1;  // 集市交易本身，每日一次

// ── 三幕结构 (GDD ch.7) ─────────────────────────────────────────────────────
// Act one uses the location bases as written; acts two and three swap in variants
// that differ only by how far the season has moved, never by what has happened.
export const ACT_TWO_START = 11;
export const ACT_THREE_START = 23;

// ── 随机事件池 (GDD ch.8.2) ─────────────────────────────────────────────────
// 上午行动结束后判定一次，一天最多一个。三档概率互斥：当天本来就排了固定事件
// 就降到一成，连着两天什么都没发生就升到五成，其余按基础值。
export const RANDOM_EVENT_CHANCE = 0.3;
export const RANDOM_EVENT_CHANCE_WITH_FIXED = 0.1;
export const RANDOM_EVENT_CHANCE_QUIET = 0.5;
export const RANDOM_EVENT_QUIET_DAYS = 2;

// 每个事件自己的窗口（GDD ch.8.2，草稿 §06）。区间是一段日子，
// days 是这几天当中的某一天：第三幕那一天只可能落在这四天里。
export type RandomEventWindow = { from: number; to: number } | { days: number[] };
export const RANDOM_EVENT_WINDOWS: Record<string, RandomEventWindow> = {
  random_lost_ox: { from: 5, to: 17 },
  random_tool_pedlar: { from: 5, to: 20 },
  random_forge_city_merchant: { from: 11, to: 20 },
  random_well: { from: 8, to: 29 },
  random_quiet_day: { days: [24, 25, 28, 29] },
};

// ── 场景层 (GDD ch.13.1) ────────────────────────────────────────────────────
// 闲笔 stay rare on purpose: two or three a week, never a reward, never a lead.
export const AMBIENT_CHANCE = 0.18;

// ── 中栏底部短句 (DEVELOPMENT_PLAN 3.6) ───────────────────────────────────────
// One quiet line under the choices on an ordinary day: company, not a clue. Each hour of
// each day decides once, from the season's seed, whether it has one and which; it never
// changes on a reload, a language switch or a replay. Events and endings show none.
export const BOTTOM_LINE_CHANCE = 0.5;

/** A line that fits only some places, hours, weather and days, keyed by its id in scenes/bottom_lines.json. */
export interface BottomLineRule extends LineRule {
  /** `state.currentScene` values it may be shown in. */
  scenes: string[];
}

// Some lines in the random pools are only true at some hours, in some weather, or from a
// certain day: a rain that starts halfway through the reaping, "到傍晚清点" in a morning's
// work. The text stays as written and the draw only takes lines that fit the moment. The
// key is the line's position in its pool (the same in zh and en); a line with no entry fits
// anywhere. tests/LineRules.test.ts checks the positions still point at the lines meant.
export interface LineRule {
  phases?: DayPhase[];
  weathers?: WeatherType[];
  /** First and last day it can be drawn. */
  from?: number;
  to?: number;
}
export type LineRules = Record<string, Record<number, LineRule>>;

const DAYTIME: DayPhase[] = ['morning', 'afternoon'];

/** scenes/ambient.json, by place. */
export const AMBIENT_RULES: LineRules = {
  fields: {
    0: { phases: DAYTIME, to: 22 },        // 割麦的时候有人在唱：第三幕田里已经没有麦
    2: { phases: ['morning'], from: 11 },  // 早上霜化：霜从第 11 天起才会下
  },
  forest: {
    0: { phases: DAYTIME },                // 倒木上的蘑菇：天黑后你只到林地边缘
    1: { phases: DAYTIME },                // 林子深处的鹿
  },
  stable: {
    1: { phases: ['evening'] },            // 夜里进马厩
  },
  kitchen: {
    0: { phases: DAYTIME },                // 玛莎教女孩切东西
  },
  default: {
    0: { from: 11 },                       // 枫叶下得像下雪：落叶要到第二幕
    1: { phases: ['afternoon'] },          // 埃莱娜晒被子
    2: { phases: ['evening'] },            // 傍晚没有风的时候
  },
};

/** scenes/bottom_lines.json, by id. A line with no entry here is never shown. */
export const BOTTOM_LINE_RULES: Record<string, BottomLineRule> = {
  // 厨房窗上的水汽：厨房里，哪个时段都有。
  kitchen_window: { scenes: ['kitchen'] },
  // 风从坡上下来：林地里，白天，天气安静的时候；下雨时林子里先是雨声。
  wind_slope: { scenes: ['forest'], phases: DAYTIME, weathers: ['sunny', 'cloudy', 'frost'] },
  // 枫叶下得像下雪：庭院里，白天；落叶要到第二幕才多起来。
  maple_snow: { scenes: ['default'], phases: DAYTIME, from: 11 },
  // 傍晚没有风，烟直着上去：庭院里，晚间，天气安静（雨天、雾天不说）。
  chimney_smoke: { scenes: ['default'], phases: ['evening'], weathers: ['sunny', 'cloudy', 'frost'] },
  // 早上霜化，田里冒白气：农田里，上午，霜从第 11 天起才有；下雨的早晨田里不冒。
  frost_steam: { scenes: ['fields'], phases: ['morning'], weathers: ['sunny', 'cloudy', 'frost'], from: 11 },
};

/** scenes/action_results.json, by action. */
export const RESULT_RULES: LineRules = {
  harvest: {
    0: { phases: ['morning'] },            // 到中午的时候手上已经磨出了印子
    1: { phases: ['afternoon'] },          // 到傍晚清点
    2: { weathers: ['rainy'] },            // 割到一半下起了毛毛雨
  },
  fell_timber: {
    2: { phases: ['afternoon'] },          // 收工的时候天已经暗了
  },
  forage: {
    1: { phases: ['morning'] },            // 你采了一上午
    2: { from: 15 },                       // 这个季节快过去了
  },
  orchard: {
    0: { phases: ['morning'] },            // 摘了一整个上午
  },
  survey_forest: {
    1: { weathers: ['fog'] },              // 林子里今天有雾
  },
};

/** scenes/weather_lines.json, by weather. */
export const WEATHER_LINE_RULES: LineRules = {
  sunny: { 1: { phases: DAYTIME } },       // 到了下午，被晒过的石头摸上去还是温的
  rainy: { 0: { phases: ['afternoon', 'evening'] } }, // 雨下了一整天
  frost: {
    0: { phases: ['morning'] },            // 早上出门，草上有一层白
    2: { phases: ['morning'] },            // 水槽边缘结了一圈薄冰，中午才化
  },
  fog: { 4: { phases: ['morning'] } },     // 雾要到中午才散
};
// The forge-hall's evening line poses a question about 霍特曼; past this many clues
// the player already knows the answer, so the line switches to its settled version.
export const CHAPEL_INFORMED_CLUE_COUNT = 2;
export const MARKET_RUMOURS_MIN = 2;
export const MARKET_RUMOURS_MAX = 3;

// Tiered estimates replace exact numbers on action buttons (PlaytestFeedback 4.b).
// The real figure is revealed in the result text afterwards.
export const YIELD_TIER_MEAGRE_MAX = 3;  // ≤ this reads 微薄
export const YIELD_TIER_FAIR_MAX = 5;    // ≤ this reads 尚可, above reads 丰厚

// Day range for the full game
export const TOTAL_DAYS = 30;

// ── 结局之后：这一季没有走到的地方 (DEVELOPMENT_PLAN 3.7) ──────────────────────
// A closed line under the ending: up to this many directions, each naming a person, a place
// or an hour the season did not reach, never what was there. The lines are picked from the
// ones that are true of this run, one from each kind in turn, so a run that missed a lot
// does not read three of the same sort.
export const MISSED_LINES_MAX = 3;
// "集市的周六你大多留在了庄园": the four market Saturdays, and at most this many were visited.
export const MISSED_MARKET_VISITS_FEW = 1;

// ── 声音 (DEVELOPMENT_PLAN 3.9) ───────────────────────────────────────────────
// Quiet by design: a bed deepens the silence, it never leads. None of this is heard until a
// sound file is dropped into src/assets/audio/ under a cue's id (docs/SOUND_LIST.md).
export const AUDIO_DEFAULT_VOLUME = 0.6;        // master, 0 to 1; the author's mute/volume panel is still to be placed
export const AUDIO_BED_GAIN = 0.7;              // a bed sits under the master
export const AUDIO_ONE_SHOT_GAIN = 0.9;         // a single sound a little above the beds
export const AUDIO_FADE_MS = 2500;              // a bed comes in and goes out over this long
export const AUDIO_INDOOR_WEATHER_GAIN = 0.35;  // the rain or wind heard from inside a room
export const AUDIO_ONE_SHOT_GAP_MS = 350;       // the same one-shot is not repeated inside this
export const AUDIO_STAGGER_MS = 700;            // when one step earns two sounds, the second comes this much later
export const AUDIO_NIGHT_BED_LAST_DAY = 12;     // the night bed (crickets) is for the first nights only; the valley goes quiet after
export const AUDIO_CAMP_NIGHT_DAY = 20;         // the night at the hunters' camp (and the morning after) has the camp's fire
export const AUDIO_TOUCH_MIN_MS = 30000;        // a sound that comes now and then (the owl) comes no sooner than this after the last…
export const AUDIO_TOUCH_MAX_MS = 90000;        // …and no later than this
/**
 * Where each sound sits against the others (1 = as it is, no more: an element's volume cannot
 * go over 1). Set from measured loudness (EBU R128): a bed toward about -22 LUFS, a single sound
 * toward about -26 (the footsteps are already quieter than that, so they stay at 1). The ear is
 * the author's, so these are the first guess.
 */
export const AUDIO_CUE_GAIN: Record<string, number> = {
  amb_rain: 0.5, amb_rain_inside: 0.85, amb_wind_cold: 0.8, amb_fields: 0.5, amb_night: 0.5,
  phase_dawn: 0.35, act_axe: 0.6, act_scythe: 0.8, ui_page: 0.55,
  res_coin: 0.6, res_grain: 0.4, res_timber: 0.45,
  ui_seal: 0.8, evt_horn: 0.8, evt_hooves: 0.8, evt_stag: 0.8,
  evt_door_open: 0.58, evt_door_close: 0.38, evt_door_heavy_open: 0.88, evt_door_heavy_close: 0.84,
  evt_steps_stone: 0.5, evt_horse: 0.55, evt_livestock: 0.25, evt_owl: 0.21,
};
