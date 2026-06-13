// All numerical values mirror docs/NUMBERS.md — never hardcode game balance elsewhere.

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

// Daily guldmark operating cost (auto-deducted each morning)
export const DAILY_GULDMARK_COST = 2;

// Storage cap without clearing storage
export const GRAIN_STORAGE_CAP_UNCLEARED = 80;

// Fatigue thresholds (see docs/NUMBERS.md §5)
export const FATIGUE_TIRED_THRESHOLD = 3;
export const FATIGUE_EXHAUSTED_THRESHOLD = 5;

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

// Renown bounds
export const RENOWN_MIN = -10;
export const RENOWN_MAX = 10;

// Market exchange rates (sell side only; buy side TBD in Phase 4)
// Grain sell: 1.5金卢/unit → transaction unit = 4 grain → 6金卢
export const MARKET_GRAIN_SELL_IN = 4;   // grain consumed
export const MARKET_GRAIN_SELL_OUT = 6;  // guldmark received
// Timber sell: 3金卢/unit → transaction unit = 3 timber → 9金卢
export const MARKET_TIMBER_SELL_IN = 3;  // timber consumed
export const MARKET_TIMBER_SELL_OUT = 9; // guldmark received

// Day range for the full game
export const TOTAL_DAYS = 30;
