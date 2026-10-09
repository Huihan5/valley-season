/**
 * "When is this line true?" — a scan of the Chinese text for sentences whose claims the
 * place they can be shown in does not back up (GDD_NEXT 11.5; DEVELOPMENT_PLAN 3.4).
 *
 *   npm run audit                 the report, grouped by kind of claim
 *   npm run audit -- --rule time  only one kind (time, weather, relative, repeat, presence,
 *                                 dayend, knowledge, date, weekday, callback)
 *   npm run audit -- --out FILE   write the report to a file as well
 *
 * It does not decide anything. For every string it works out where the string can appear
 * (which phases, which weathers, which days; from the data's own structure for scenes and
 * events, and from simulated seasons for action results and greetings), then lists the
 * sentences that claim something the context does not guarantee: a rain on a line that
 * can come up on a dry day, "tonight" in a text that can show at noon. Each hit is a
 * question for a person, and most answers are "fine".
 */
import { writeFileSync } from 'node:fs';
import DATA from '../src/data';
import { createInitialState, gameReducer } from '../src/systems/GameEngine';
import { PLANS, nextAction } from '../tests/helpers/simulation';
import { seededRng } from '../src/utils/rng';
import { eventPhase } from '../src/systems/EventSystem';
import { getDayOfWeek } from '../src/systems/TimeSystem';
import {
  ACT_TWO_START, ACT_THREE_START, WEATHER_POOLS, FORCED_WEATHER, RANDOM_EVENT_WINDOWS,
  AMBIENT_RULES, RESULT_RULES, WEATHER_LINE_RULES, LineRule,
} from '../src/data/config';
import { DayPhase, EventData, GameState, SeasonAction, WeatherType } from '../src/types/game';

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const onlyRule = arg('rule');
const outFile = arg('out');

const PHASES: DayPhase[] = ['morning', 'afternoon', 'evening'];
const WEATHERS: WeatherType[] = ['sunny', 'cloudy', 'rainy', 'frost', 'fog'];

// ── Where a line can be shown ───────────────────────────────────────────────

interface Where {
  /** null: not known, so nothing about the time of day is checked. */
  phases: DayPhase[] | null;
  weathers: WeatherType[] | null;
  days: [number, number] | null;
}

interface Item {
  pool: string;
  path: string;
  text: string;
  where: Where;
  /** What an event needs before it plays (a flag, a variant), for reading a callback against. */
  gate?: string;
}

function weathersOn(from: number, to: number): WeatherType[] {
  const found = new Set<WeatherType>();
  for (let d = from; d <= to; d++) {
    if (FORCED_WEATHER[d]) { found.add(FORCED_WEATHER[d]); continue; }
    const pool = d <= 10 ? WEATHER_POOLS.early : d <= 20 ? WEATHER_POOLS.mid : WEATHER_POOLS.late;
    for (const [w, weight] of Object.entries(pool)) if (weight > 0) found.add(w as WeatherType);
  }
  return WEATHERS.filter(w => found.has(w));
}

/** Where a line can be drawn once its own rule (config.LineRules) is applied. */
function narrow(where: Where, rule: LineRule | undefined): Where {
  if (!rule) return where;
  const days: [number, number] | null = where.days
    ? [Math.max(where.days[0], rule.from ?? 1), Math.min(where.days[1], rule.to ?? 30)]
    : where.days;
  return {
    phases: where.phases ? where.phases.filter(p => !rule.phases || rule.phases.includes(p)) : rule.phases ?? null,
    weathers: where.weathers ? where.weathers.filter(w => !rule.weathers || rule.weathers.includes(w)) : rule.weathers ?? null,
    days,
  };
}

const ACT_DAYS: Record<1 | 2 | 3, [number, number]> = {
  1: [1, ACT_TWO_START - 1], 2: [ACT_TWO_START, ACT_THREE_START - 1], 3: [ACT_THREE_START, 30],
};

// ── What the simulated seasons show about the pools ─────────────────────────

interface Seen { phases: Set<DayPhase>; weathers: Set<WeatherType>; min: number; max: number }
const seenKinds = new Map<string, Seen>();
const seenTexts = new Map<string, Seen>();
const seenGreeting = new Map<string, Seen>();

function note(map: Map<string, Seen>, key: string, s: GameState) {
  const got = map.get(key) ?? { phases: new Set(), weathers: new Set(), min: 99, max: 0 };
  got.phases.add(s.phase); got.weathers.add(s.weather);
  got.min = Math.min(got.min, s.day); got.max = Math.max(got.max, s.day);
  map.set(key, got);
}

function observe(s: GameState) {
  if (s.activeEvent || s.openingPage !== null) return;
  for (const c of s.currentChoices) {
    if (c.resultKind) note(seenKinds, c.resultKind.replace(/_\d+$/, ''), s);
    if (c.resultText) note(seenTexts, c.resultText, s);
    const who = c.effects?.conversationWith ?? c.effects?.greetingFrom;
    if (who && !c.resultText && !c.resultKind) note(seenGreeting, who, s);
  }
}

function simulate() {
  const seeds = 60;
  for (const plan of PLANS) {
    for (let seed = 1; seed <= seeds; seed++) {
      const rng = seededRng('audit', plan.name, seed);
      let s = createInitialState(seed);
      let n = 0;
      while (!s.demoComplete && n++ < 4000) { observe(s); s = gameReducer(s, nextAction(plan, s, rng)); }
    }
  }
  // And a clicker with no plan, which wanders to the corners the planned ones skip.
  for (let seed = 1; seed <= 80; seed++) {
    const pick = seededRng('audit-click', seed);
    let s = createInitialState(seed);
    let n = 0;
    while (!s.demoComplete && n++ < 4000) {
      observe(s);
      let action: SeasonAction;
      if (s.openingPage !== null) action = s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
      else if (s.pendingAdvance) action = { type: 'COMMIT_ADVANCE' };
      else if (s.activeEvent && s.currentChoices.length === 0) action = { type: 'ADVANCE_DAY_EVENT' };
      else {
        const open = s.currentChoices.filter(c => !c.disabled);
        action = { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
      }
      s = gameReducer(s, action);
    }
  }
}

function whereOf(seen: Seen | undefined): Where {
  if (!seen) return { phases: null, weathers: null, days: null };
  return { phases: PHASES.filter(p => seen.phases.has(p)), weathers: WEATHERS.filter(w => seen.weathers.has(w)), days: [seen.min, seen.max] };
}

// ── The corpus ──────────────────────────────────────────────────────────────

const corpus: Item[] = [];
const add = (pool: string, path: string, text: unknown, where: Where, gate?: string) => {
  if (typeof text === 'string' && text.trim()) corpus.push({ pool, path, text, where, gate });
};

/** The conditions written on an event itself, as a short note for the report. */
function gateOf(e: EventData, variant?: string): string {
  const bits: string[] = [];
  if (e.activationFlag) bits.push(`needs flag ${e.activationFlag}`);
  if (variant) bits.push(`variant ${variant}`);
  return bits.join('; ');
}

function strings(node: unknown, trail: string, visit: (trail: string, text: string) => void, skip: Set<string>) {
  if (typeof node === 'string') visit(trail, node);
  else if (Array.isArray(node)) node.forEach((n, i) => strings(n, `${trail}[${i}]`, visit, skip));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!skip.has(k) && !k.startsWith('_')) strings(v, trail ? `${trail}.${k}` : k, visit, skip);
    }
  }
}

const EVENT_SKIP = new Set([
  'id', 'activationFlag', 'requiresFlag', 'next', 'nextEvent', 'nextScene', 'timing', 'phase', 'resultKind',
  'flags', 'effects', 'variantRules', 'resultVars', 'textInput', 'logEntry', 'log', 'title', 'forced',
]);

function buildCorpus() {
  // Scene bases: the data says exactly where each one is shown.
  const locations = DATA.scenes.locations as unknown as Record<string, Record<string, unknown>>;
  for (const [place, entry] of Object.entries(locations)) {
    for (const act of [1, 2, 3] as const) {
      const byPhase = entry[`act${act}`] as Record<DayPhase, string>;
      for (const phase of PHASES) {
        add('base', `scenes/locations ${place}.act${act}.${phase}`, byPhase[phase],
          { phases: [phase], weathers: weathersOn(...ACT_DAYS[act]), days: ACT_DAYS[act] });
      }
    }
    const here = entry.gregorPresent as Record<DayPhase, string> | undefined;
    if (here) for (const phase of PHASES) {
      add('base-cond', `scenes/locations ${place}.gregorPresent.${phase}`, here[phase], { phases: [phase], weathers: weathersOn(1, 30), days: [1, 30] });
    }
    if (entry.eveningInformed) {
      add('base', `scenes/locations ${place}.eveningInformed`, entry.eveningInformed, { phases: ['evening'], weathers: weathersOn(...ACT_DAYS[1]), days: ACT_DAYS[1] });
    }
  }

  // Weather lines carry the weather; they can come on any day the weather can.
  const wlines = DATA.scenes.weatherLines as unknown as Record<string, string[]>;
  for (const [w, lines] of Object.entries(wlines)) {
    const days: [number, number] = w === 'frost' ? [11, 30] : [1, 30];
    lines.forEach((t, i) => add('weather', `scenes/weather_lines ${w}[${i}]`, t, narrow({ phases: PHASES, weathers: [w as WeatherType], days }, WEATHER_LINE_RULES[w]?.[i])));
  }

  // 闲笔 play only on a quiet day in calm weather.
  const ambient = DATA.scenes.ambient as unknown as Record<string, string[]>;
  for (const [scene, lines] of Object.entries(ambient)) {
    lines.forEach((t, i) => add('ambient', `scenes/ambient ${scene}[${i}]`, t, narrow({ phases: PHASES, weathers: ['sunny', 'cloudy'], days: [1, 30] }, AMBIENT_RULES[scene]?.[i])));
  }

  // Action results: where the actions are offered is what the simulated seasons saw.
  const results = DATA.scenes.actionResults as unknown as Record<string, string[]>;
  for (const [kind, lines] of Object.entries(results)) {
    const base = kind.replace(/^(stable_help)_third$/, '$1');
    const seen = seenKinds.get(kind) ?? seenKinds.get(base) ?? seenKinds.get(kind.replace(/_\d+$/, ''));
    lines.forEach((t, i) => add('result', `scenes/action_results ${kind}[${i}]`, t, narrow(whereOf(seen), RESULT_RULES[base]?.[i])));
  }

  // Greetings: after a talk, whenever the talk is offered.
  const greetings = DATA.dialogue.greetings as unknown as Record<string, Record<string, string[]>>;
  for (const [npc, tiers] of Object.entries(greetings)) {
    for (const [tier, lines] of Object.entries(tiers)) {
      lines.forEach((t, i) => add('greeting', `dialogue/greetings ${npc}.${tier}[${i}]`, t, whereOf(seenGreeting.get(npc))));
    }
  }

  // Clue conversations: their texts are the result text of a choice, so the seasons saw them.
  const fragments = DATA.dialogue.fragments as unknown as Record<string, { text: string }>;
  for (const [key, f] of Object.entries(fragments)) {
    add('fragment', `dialogue/fragments ${key}`, f.text, whereOf(seenTexts.get(f.text)));
  }

  // Market.
  const market = DATA.scenes.market as unknown as Record<string, unknown>;
  const marketDays: [number, number] = [6, 27];
  for (const [key, v] of Object.entries(market)) {
    if (key.startsWith('_')) continue;
    strings(v, key, (trail, t) => {
      const afternoon = /^(sell|return|nothing)/.test(trail);
      const act = /act1/.test(trail) ? ACT_DAYS[1] : /act2/.test(trail) ? ACT_DAYS[2] : /act3|act3/.test(trail) ? ACT_DAYS[3] : marketDays;
      add('market', `scenes/market ${trail}`, t, { phases: [afternoon ? 'afternoon' : 'morning'], weathers: weathersOn(...act), days: act });
    }, new Set());
  }
  const rumors = DATA.scenes.rumors as unknown as Record<string, unknown>;
  strings(rumors, '', (trail, t) => add('rumor', `scenes/rumors ${trail}`, t, { phases: ['afternoon'], weathers: weathersOn(6, 27), days: [6, 27] }), new Set());

  // Fixed events: the day and the time of day are written on them. Chained scenes
  // inherit the day from whoever starts them, and say nothing about the hour.
  const events = Object.values(DATA.events) as unknown as EventData[];
  const dayOf = new Map<string, number>();
  for (const e of events) if (e.day > 0) dayOf.set(e.id, e.day);
  for (let pass = 0; pass < 4; pass++) {
    for (const e of events) {
      const kids = [e.next, ...(e.choices ?? []).map(c => c?.nextEvent)].filter(Boolean) as string[];
      for (const k of kids) if (!dayOf.has(k) && dayOf.has(e.id)) dayOf.set(k, dayOf.get(e.id)!);
    }
  }
  const TIMING: Record<string, DayPhase> = { dawn: 'morning', midday: 'afternoon', dusk: 'evening', evening: 'evening' };
  for (const e of events) {
    const day = dayOf.get(e.id) ?? null;
    const phase = eventPhase(e);
    const rules = e.variantRules ?? {};
    strings(e, '', (trail, text) => {
      const m = trail.match(/^variants\.([^.\[]+)/);
      const rule = m ? rules[m[1]] : undefined;
      const ph = rule?.timing ? [TIMING[rule.timing]] : phase ? [phase] : null;
      const w = rule?.weather ? rule.weather : day ? weathersOn(day, day) : null;
      add('event', `events/${e.id} ${trail}`, text, { phases: ph, weathers: w, days: day ? [day, day] : null }, gateOf(e, m?.[1]));
    }, EVENT_SKIP);
  }
  const random = Object.values(DATA.randomEvents) as unknown as EventData[];
  for (const e of random) {
    const window = RANDOM_EVENT_WINDOWS[e.id] as { from?: number; to?: number; days?: number[] } | undefined;
    const days: [number, number] | null = window ? (window.days ? [Math.min(...window.days), Math.max(...window.days)] : [window.from ?? 1, window.to ?? 30]) : null;
    const rules = e.variantRules ?? {};
    strings(e, '', (trail, text) => {
      const m = trail.match(/^variants\.([^.\[]+)/);
      const rule = m ? rules[m[1]] : undefined;
      const ph = rule?.timing ? [TIMING[rule.timing]] : e.timing ? [TIMING[e.timing]] : null;
      const w = rule?.weather ? rule.weather : days ? weathersOn(...days) : null;
      add('random', `events/random/${e.id} ${trail}`, text, { phases: ph, weathers: w, days }, gateOf(e, m?.[1]));
    }, EVENT_SKIP);
  }

  // Endings: the last morning and after.
  strings(DATA.endings, '', (trail, text) => add('ending', `endings ${trail}`, text, { phases: null, weathers: null, days: [30, 30] }), new Set());
}

// ── The claims ──────────────────────────────────────────────────────────────

const NOT_NOW = '(?<![昨明前后每那一次某上比和跟]|这个|那个|整个|一整个|一个|第二天|当天)';

const CLAIMS = {
  morning: new RegExp(`${NOT_NOW}(清晨|早晨|早上|上午|一早|大清早|晨雾|晨光|早饭)`, 'g'),
  afternoon: new RegExp(`${NOT_NOW}(午后|下午|午饭之后|午饭后|午间|晌午)`, 'g'),
  evening: new RegExp(`${NOT_NOW}(傍晚|黄昏|晚上|夜里|夜晚|入夜|天黑|暮色|日落|落日|夜深|深夜|晚饭|今晚|黑下来|掌灯|点灯)`, 'g'),
};

const WEATHER_CLAIMS: { weather: WeatherType; ok: WeatherType[]; re: RegExp; label: string }[] = [
  { weather: 'rainy', ok: ['rainy'], re: /下雨|雨(?!后|过|停)|淋湿/g, label: '雨' },
  { weather: 'frost', ok: ['frost'], re: /霜|结冰|冰碴|冻住|冻硬/g, label: '霜/冰' },
  { weather: 'fog', ok: ['fog'], re: /雾/g, label: '雾' },
  { weather: 'sunny', ok: ['sunny', 'cloudy', 'frost'], re: /阳光|太阳|日头|日光|光斑|晴/g, label: '日光' },
  { weather: 'cloudy', ok: ['cloudy', 'rainy', 'fog', 'frost'], re: /阴天|云层|阴沉|乌云|阴云/g, label: '云' },
];

const RELATIVE = /昨天|昨日|昨晚|昨夜|前天|明天|明日|明早|后天|上个月|上周|上星期|上次|上回|前几天|几天前|这个月|今年|去年|刚才|那天|三天|两天|一周|下个月/g;
const REPEAT = /第一次|第二次|第三次|头一回|初次|终于|又一次|再一次|又来|又是|仍然|依旧|照旧|和上次|像上次|跟上次|老样子|不是第一次|还是那/g;
const PRESENCE = /格雷格|玛莎|埃莱娜|洛伦茨|提莫西|蒂埃里|亨克|老文德|霍特曼|路德维希|佃户们?|匠师/g;
const DAYEND = /这一天(已经|就|也)?(结束|过去|完了|没有)|一天到此|没有别的事|没什么(别的)?(可做|要做)|该休息了|收工了|该睡了|歇下了|熄了灯|入睡|睡着了/g;
const KNOWLEDGE = /你(已经|早就|一直|早已)(知道|明白|清楚)|你(还)?记得|你想起|你之前|你上次|你曾经|你说过|你答应过/g;
// A sentence that points back at something that happened in an earlier scene. Whether the thing
// happened is what the reader of the report has to settle, against the gate printed with it.
const CALLBACK = /昨天|昨日|昨晚|昨夜|前天|前几天|几天前|今早|今晨|今天早上|那天|那晚|那一晚|那一天|上回|上次|上一次|早些时候|刚才|方才|你说过|你答应过|你们说好|那件事|那封信|那次|那张纸|还记得|你曾经|你已经(?!知道)/g;
const WEEKDAY = /(周|星期|礼拜)[一二三四五六日天]/g;
const DATE = /十月[一二三四五六七八九十]+[日号]|[一二三四五六七八九十两]+天(后|之后|前|以后|内)|还有[一二三四五六七八九十两]+天|(第[一二三四五六七八九十]+)天/g;

interface Hit { rule: string; item: Item; sentence: string; why: string }
const hits: Hit[] = [];

function sentencesWith(text: string, re: RegExp): { sentence: string; match: string }[] {
  const out: { sentence: string; match: string }[] = [];
  for (const raw of text.split(/(?<=[。！？])|\n+/)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    re.lastIndex = 0;
    const m = re.exec(sentence);
    if (m) out.push({ sentence, match: m[0] });
  }
  return out;
}

const hit = (rule: string, item: Item, sentence: string, why: string) => hits.push({ rule, item, sentence, why });

function scan() {
  for (const item of corpus) {
    const { where, text, pool } = item;

    // Time of day.
    if (where.phases && !['ending'].includes(pool)) {
      for (const [phase, re] of Object.entries(CLAIMS) as [DayPhase, RegExp][]) {
        const stray = where.phases.filter(p => p !== phase);
        if (stray.length === 0) continue;
        for (const { sentence, match } of sentencesWith(text, re)) {
          hit('time', item, sentence, `claims ${phase} (${match}), can show in ${where.phases.join('/')}`);
        }
      }
    }

    // Weather.
    if (where.weathers) {
      for (const claim of WEATHER_CLAIMS) {
        const stray = where.weathers.filter(w => !claim.ok.includes(w));
        if (stray.length === 0) continue;
        for (const { sentence, match } of sentencesWith(text, claim.re)) {
          hit('weather', item, sentence, `${claim.label} (${match}), can show in ${stray.join('/')}`);
        }
      }
    }

    const repeating = ['base', 'weather', 'ambient', 'result', 'greeting', 'base-cond'].includes(pool);
    if (repeating) {
      for (const { sentence, match } of sentencesWith(text, RELATIVE)) hit('relative', item, sentence, `a point in time (${match}) in a line that repeats`);
      for (const { sentence, match } of sentencesWith(text, REPEAT)) hit('repeat', item, sentence, `first/again wording (${match}) in a line that repeats`);
      if (pool !== 'greeting') for (const { sentence, match } of sentencesWith(text, PRESENCE)) hit('presence', item, sentence, `names someone (${match}) with no condition on being there`);
    }
    if (['base', 'ambient', 'weather', 'result', 'base-cond'].includes(pool) || (pool === 'event' && where.phases && !where.phases.includes('evening'))) {
      for (const { sentence, match } of sentencesWith(text, DAYEND)) hit('dayend', item, sentence, `calls the day over (${match}) while the player can still act`);
    }
    if (pool !== 'ending') {
      for (const { sentence, match } of sentencesWith(text, KNOWLEDGE)) hit('knowledge', item, sentence, `assumes what the player knows or did (${match})`);
    }
    if (['event', 'random', 'ending', 'fragment'].includes(pool)) {
      for (const { sentence, match } of sentencesWith(text, CALLBACK)) {
        hit('callback', item, sentence, `points back (${match})${item.gate ? `; gate: ${item.gate}` : '; no gate on the event'}`);
      }
    }
    if (['event', 'random', 'fragment'].includes(pool) && where.days) {
      for (const { sentence, match } of sentencesWith(text, WEEKDAY)) {
        const day = where.days[0];
        hit('weekday', item, sentence, `names a weekday (${match}); Day ${day} is a ${getDayOfWeek(day)}`);
      }
    }
    if (['event', 'random', 'ending', 'fragment'].includes(pool)) {
      for (const { sentence, match } of sentencesWith(text, DATE)) hit('date', item, sentence, `a date or a count of days (${match}); the event is on day ${where.days ? where.days[0] : '?'}`);
    }
  }
}

// ── The report ──────────────────────────────────────────────────────────────

function report(): string {
  const lines: string[] = [];
  const rules = ['time', 'weather', 'relative', 'repeat', 'presence', 'dayend', 'knowledge', 'date', 'weekday', 'callback'];
  const titles: Record<string, string> = {
    time: '时间：句子说了上午／下午／晚上，但它也可能在别的时段出现',
    weather: '天气：句子写了雨／霜／雾／日光，但它也可能在别的天气出现',
    relative: '相对时间：重复出现的句子里有"昨天／上个月／上次"',
    repeat: '首次与重复：重复出现的句子里有"第一次／终于／又"',
    presence: '在场：不带条件的句子点了名，某个人在场',
    dayend: '预支：玩家还能行动时句子宣告一天结束',
    knowledge: '已知：句子假定玩家知道或做过某件事',
    date: '日期与天数：事件里的日期和"N 天"，要对日历',
    weekday: '星期：句子点了星期几，要对日历（Day 6 是周六，Day 1 是周一）',
    callback: '回指：句子指向前面发生过的事（昨天、今早、那次……），要核对前提在每条路径上是否成立',
  };
  lines.push(`# 文本审查报告（"这句话什么时候成立"）\n`);
  lines.push(`扫描 ${corpus.length} 段文字，${hits.length} 处待看。每一条是一个问题，不是结论：多数回答是"没问题"。\n`);
  for (const rule of rules) {
    if (onlyRule && onlyRule !== rule) continue;
    const mine = hits.filter(h => h.rule === rule);
    lines.push(`\n## ${titles[rule]}（${mine.length}）\n`);
    const byPool = new Map<string, Hit[]>();
    for (const h of mine) byPool.set(h.item.pool, [...(byPool.get(h.item.pool) ?? []), h]);
    for (const [pool, list] of byPool) {
      lines.push(`\n### ${pool}（${list.length}）\n`);
      for (const h of list) {
        const w = h.item.where;
        const ctx = `${w.phases ? w.phases.join('/') : '时段不明'} · ${w.weathers ? w.weathers.join('/') : '天气不明'} · ${w.days ? `Day ${w.days[0]}${w.days[1] !== w.days[0] ? `–${w.days[1]}` : ''}` : '日期不明'}`;
        lines.push(`- \`${h.item.path}\`  [${ctx}]\n  ${h.why}\n  “${h.sentence.length > 90 ? h.sentence.slice(0, 90) + '…' : h.sentence}”`);
      }
    }
  }
  return lines.join('\n');
}

simulate();
buildCorpus();
scan();
const text = report();
console.log(text);
if (outFile) writeFileSync(outFile, text + '\n');
