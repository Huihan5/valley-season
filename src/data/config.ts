// All numerical values mirror docs/GDD.md ch.5 — never hardcode game balance elsewhere.
// (GDD v3 retired the standalone NUMBERS.md; ch.5 is the sole numerical authority.)
import { WeatherType } from '../types/game';

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
  lena: 0,
  elke: 0,
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

// Seasonal felling quota set by ducal decree (GDD ch.5.4). Exceeding it costs renown.
export const TIMBER_SEASON_QUOTA = 25;

// Daily guldmark operating cost (auto-deducted each morning)
export const DAILY_GULDMARK_COST = 2;

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
export const LENA_QUILTS_TRUST = 4;

// 磨岭 at night: what 亨克 is willing to do, by how far the player has got with him.
export const MILLRIDGE_TRUST: Record<string, number> = {
  millridge_everything: 4,
  millridge_cash: 2,
  millridge_goods: 2,
};
export const MILLRIDGE_CASH = 20;       // enough to clear the winter's margin
export const MILLRIDGE_TIMBER = 10;
export const MILLRIDGE_SPRING_SEED = 15; // 优秀线 minus 留任线: seed for the spring

// The chancery calls the season "如常" only if both the grain and the cash are there.
export const LETTER_GOOD_GULDMARK = 15;

// 维特 restates what the player already holds; how much of it he can put in
// order depends on how many pieces there are (drafts 4.11).
export const WYNTER_PARTIAL_ACCOUNT = 3; // he can tell the order is wrong
export const WYNTER_FULL_ACCOUNT = 6;    // he can lay the whole thing out
export const POSITION_LINE_COMPLETE = 4; // 格雷格 three plus 蒂埃里 cross-fix

// Fragments that need someone to have decided you are worth telling (GDD 5.5, 9.1).
export const LORENZ_FRAGMENT_TRUST = 3;
export const MARGUERITE_FRAGMENT_TRUST = 2;

// ── 非资源行动 (GDD ch.5.4) ─────────────────────────────────────────────────
// The two surveys are one-shot and expire: their whole use is preparing for one event.
export const SURVEY_FIELDS_LAST_DAY = 9;   // prepares the Day 10 petition
export const SURVEY_FOREST_LAST_DAY = 14;  // prepares the Day 15 boundary
export const FORAGE_YIELD_RANGE = [2, 3];  // 金卢
export const ORCHARD_YIELD_RANGE = [2, 5]; // 金卢
export const ORCHARD_FULL_YIELD_LAST_DAY = 15; // after this the fruit is on the ground

// Reviewing the ledger at night pays off only once it becomes a habit.
export const NIGHT_LEDGER_CLUE_AT = 3;

// Two-tier grain thresholds (GDD ch.5.4 / 10.1).
// Below 留任线 → dismissed. 留任线 to 优秀线 → ending 2 at best. 优秀线 and above → ending 3 / 4A / 4B eligible.
export const GRAIN_RETAIN_THRESHOLD = 75;    // 留任线：冬季口粮 60 + 税约 13
export const GRAIN_EXCELLENT_THRESHOLD = 90; // 优秀线：留任线 + 春播种子 15

// Fatigue thresholds (see docs/GDD.md ch.5)
export const FATIGUE_TIRED_THRESHOLD = 3;
export const FATIGUE_EXHAUSTED_THRESHOLD = 5;

// Days whose weather is written rather than rolled.
export const FORCED_WEATHER: Record<number, WeatherType> = {
  22: 'frost', // 维特 arrives on the day the wind turns (drafts 4.11)
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

// 贵族信任 (GDD ch.5.5) — three chances at +1 each: Day 7 dinner, boundary dispute, hunt season
export const NOBLE_TRUST_MIN = 0;
export const NOBLE_TRUST_MAX = 3;
export const NOBLE_TRUST_ENDING3_MIN = 1;  // 结局三的必要条件之一
export const NOBLE_TRUST_CLUE_MIN = 2;     // 狩猎季结算时解锁玛格丽特的碎片

// 领主印象 (GDD ch.5.6)
export const LORD_IMPRESSION_MIN = 0;
export const LORD_IMPRESSION_MAX = 3;

// Renown bounds
export const RENOWN_MIN = -10;
export const RENOWN_MAX = 10;

// ── 集市 (GDD ch.5.4) ───────────────────────────────────────────────────────
// v3: Saturdays only (Day 6 / 13 / 20 / 27), but quantity per trip is open up to
// the cart's capacity. The bottleneck moved from market frequency to felling phases.
export const MARKET_GRAIN_PRICE = 1.5;            // 金卢/unit
export const MARKET_TIMBER_PRICE = 3;             // 金卢/unit
export const MARKET_TIMBER_PRICE_MILLRIDGE = 4;   // after the 磨岭 agreement with 亨克
export const MARKET_TRANSPORT_CAP = 20;           // grain + timber combined, per trip (cart capacity)
export const MARKET_LOT_SIZES = [4, 10];          // fixed lots offered alongside a sell-max option

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

// ── 场景层 (GDD ch.13.1) ────────────────────────────────────────────────────
// 闲笔 stay rare on purpose: two or three a week, never a reward, never a lead.
export const AMBIENT_CHANCE = 0.18;
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
