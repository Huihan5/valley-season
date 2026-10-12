// script-format.mjs — the readable "plot script" (剧情文本): every piece of Chinese story text
// laid out as one Markdown file, and the way back.
//
// The game reads src/data/zh/**; the script file is a view of it that a person can read straight
// through and edit. `render` writes the view, `parse` reads an edited view back as a list of
// string edits against src/data/zh, and the patcher in json-patch.mjs applies them without
// touching a byte of the JSON that did not change.
//
// What lives in the file: the opening pages, the scheduled events (in the order a season plays
// them), the random events, the investigation fragments, the five endings and the epilogue —
// scene text, variants, choice labels and results, titles, subtitles. What does not: flags,
// numbers, ids, journal log lines, and the repeatable text (locations, weather, greetings,
// rumours, codex, interface), which the text workbench (text-export / text-import) carries.
//
// Format, in short:
//   ## part                       (ignored on the way back)
//   ### n．when｜title            one unit; the line after it is `> ID the_id　｜ …`
//   plain paragraphs              the scene text; blank line between paragraphs
//   **名字**　“……”                 a spoken paragraph; the name stands for the {@id} mark
//   #### ◇ 变体｜name             a variant block
//   #### 选项｜label              a choice; `> 选项 the_id　｜ …` follows, then its result text
//   > …                           grey lines: mechanics for the reader, never read back

import fs from 'node:fs';
import path from 'node:path';

export const SCRIPT_DIR = '剧情文本';
export const SCRIPT_FILE = '河谷季_剧情文本_中文.md';

// ── the order a season plays them in ───────────────────────────────────────

const EVENT_ORDER = [
  'day1_arrival', 'day3_ledger', 'day4_hearth', 'day6_timothy',
  'day7_dinner_arrival', 'day7_dinner_hartmann', 'day7_dinner_departure', 'day7_dinner_return',
  'day8_echo', 'day10_petition', 'day11_echo', 'day12_audit', 'day12_officer', 'day13_echo', 'day13_thierry',
  'day15_forest_report', 'day15_stumps', 'day15_record',
  'day18_hunt_open', 'day18_hunt_arrival', 'day19_hunt_ride',
  'day20_hunt_stag', 'day20_hunt_overnight', 'day20_camp_banquet',
  'day21_hunt_morning', 'day21_camp_harvest', 'day21_hunt_lorenz',
  'day22_wynter', 'day23_lords_letter', 'day27_officers', 'day27_street_corner', 'day28_go_now',
  'day30_morning', 'day30_evening', 'day30_millridge',
  'ending_handover', 'office_folio', 'timber_restraint',
];

const FRAGMENT_TITLES = {
  gregor_intact: '格雷格 · 一', gregor_returned: '格雷格 · 二', gregor_condition: '格雷格 · 三',
  marta_summer: '玛莎 · 一', marta_lastwords: '玛莎 · 二',
  elena_papers: '埃莱娜 · 一', elena_burned: '埃莱娜 · 二',
  lorenz_question: '洛伦茨 · 一', lorenz_why: '洛伦茨 · 二', lorenz_already_told: '洛伦茨 · 三',
};

const ENDING_TITLES = {
  ending1: '结局一', ending2: '结局二', ending3: '结局三', ending4a: '结局 4A', ending4b: '结局 4B', epilogue: '尾声',
};

const TIMING = { dawn: '清晨', midday: '正午', dusk: '黄昏', evening: '夜晚' };
const PHASE = { morning: '上午', afternoon: '下午', evening: '晚间' };
const NPC = { gregor: '格雷格', marta: '玛莎', elena: '埃莱娜', marguerite: '玛格丽特', henk: '亨克', lorenz: '洛伦茨' };

// ── loading ────────────────────────────────────────────────────────────────

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

/** Every zh JSON file, raw and parsed, the speaker table, and an id → object index. */
export function loadData(root = process.cwd()) {
  const zh = path.join(root, 'src/data/zh');
  const files = new Map();
  for (const f of walk(zh)) {
    const rel = path.relative(zh, f).split(path.sep).join('/');
    const raw = fs.readFileSync(f, 'utf8');
    files.set(rel, { raw, json: JSON.parse(raw), full: f });
  }
  const speakers = files.get('ui.json').json.speakers;
  const nameToId = Object.fromEntries(Object.entries(speakers).map(([id, n]) => [n, id]));

  const byId = new Map();
  for (const [rel, { json }] of files) {
    const visit = (o, p) => {
      if (!o || typeof o !== 'object') return;
      if (!Array.isArray(o) && typeof o.id === 'string' && !byId.has(o.id)) byId.set(o.id, { file: rel, obj: o, path: p });
      if (Array.isArray(o)) o.forEach((x, i) => visit(x, p ? `${p}.${i}` : String(i)));
      else for (const k of Object.keys(o)) visit(o[k], p ? `${p}.${k}` : k);
    };
    visit(json, '');
    if (rel === 'dialogue/fragments.json') for (const k of Object.keys(json)) if (!byId.has(k)) byId.set(k, { file: rel, obj: json[k], path: k });
  }
  return { files, speakers, nameToId, byId };
}

// ── rendering ──────────────────────────────────────────────────────────────

function guard(text, where) {
  for (const line of text.split('\n')) {
    if (/^(#|>|`|---|[-*+] |\d+[.)] )/.test(line) || line.includes('`')) {
      throw new Error(`${where}: a line would be read as Markdown structure: ${line.slice(0, 40)}`);
    }
  }
  if (/\*\*/.test(text.replace(/^\*\*[^*]+\*\*/, ''))) throw new Error(`${where}: stray ** in text: ${text.slice(0, 40)}`);
}

function paras(str, data, where) {
  return str.split('\n\n').map((p) => {
    const m = p.match(/^\{@([a-z_]+)\}([\s\S]*)$/);
    let t = p;
    if (m) {
      const name = data.speakers[m[1]];
      if (!name) throw new Error(`${where}: unknown speaker ${m[1]}`);
      t = `**${name}**　${m[2]}`;
    }
    guard(t, where);
    return t;
  }).join('\n\n');
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

function effectsNote(effects) {
  const fx = effects ?? {};
  const out = [];
  if (fx.grain) out.push(`粮食 ${signed(fx.grain)}`);
  if (fx.guldmark) out.push(`金卢 ${signed(fx.guldmark)}`);
  if (fx.timber) out.push(`木材 ${signed(fx.timber)}`);
  if (fx.renown) out.push(`声望 ${signed(fx.renown)}`);
  if (fx.fatigue) out.push(`疲劳 ${fx.fatigue === -99 ? '清零' : signed(fx.fatigue)}`);
  for (const [npc, d] of Object.entries(fx.relationships ?? {})) out.push(`${NPC[npc] ?? npc}关系 ${signed(d)}`);
  if (fx.nobleTrust) out.push(`贵族信任 ${signed(fx.nobleTrust)}`);
  if (fx.lordImpression) out.push(`领主印象 ${signed(fx.lordImpression)}`);
  if (fx.tenantTrust) out.push(`佃户信任 ${signed(fx.tenantTrust)}`);
  if (fx.conversationWith) out.push(`与${NPC[fx.conversationWith] ?? fx.conversationWith}交谈`);
  for (const [k, v] of Object.entries(fx.flags ?? {})) out.push(v === true ? `旗标 ${k}` : `旗标 ${k}=${v}`);
  if (fx.nextScene) out.push(`下一场景 ${fx.nextScene}`);
  if (fx.endsSeason) out.push(`结束这一季 → ${fx.endsSeason}`);
  return out;
}

const bar = (items) => items.filter(Boolean).join('　｜　');

function eventUnit(ev, n, data) {
  const when = ev.day > 0
    ? `第 ${ev.day} 日 · ${TIMING[ev.timing] ?? PHASE[ev.phase] ?? '时段不定'}`
    : '按条件触发';
  const meta = bar([
    `ID ${ev.id}`,
    ev.activationFlag ? `触发旗标 ${ev.activationFlag}` : '',
    ev.next ? `接续事件 ${ev.next}` : '',
    ev.advancesPhase ? 'advancesPhase true' : '',
    ...effectsNote(ev.onEnterEffects).length ? [`进入时写入 ${effectsNote(ev.onEnterEffects).join('、')}`] : [],
  ]);
  const out = [`### ${n}．${when}｜${ev.title}`, `> ${meta}`, ''];
  out.push(paras(ev.sceneText, data, ev.id), '');
  out.push(...variantsAndChoices(ev, data));
  return out;
}

/** The variant blocks and the choices (with their results) of an event or of a question page. */
function variantsAndChoices(ev, data) {
  const out = [];
  for (const [name, text] of Object.entries(ev.variants ?? {})) {
    out.push(`#### ◇ 变体｜${name}`, '', paras(text, data, `${ev.id}.${name}`), '');
  }
  for (const c of ev.choices ?? []) {
    guard(c.text, `${ev.id}.${c.id}`);
    out.push(`#### 选项｜${c.text}`);
    out.push(`> ${bar([`选项 ${c.id}`, c.description ? `副标 ${c.description}` : '', c.requiresFlag ? `需要旗标 ${c.requiresFlag}` : '', ...(effectsNote(c.effects).length ? [effectsNote(c.effects).join('、')] : []), c.nextEvent ? `下一事件 ${c.nextEvent}` : ''])}`, '');
    if (c.resultText) out.push(paras(c.resultText, data, `${ev.id}.${c.id}`), '');
  }
  return out;
}

function endingUnit(e, n, data) {
  const out = [`### ${n}．${ENDING_TITLES[e.id] ?? e.id}｜${e.title}`, `> ID ${e.id}`, ''];
  if (e.subtitle) { guard(e.subtitle, `${e.id}.subtitle`); out.push(`副标题：${e.subtitle}`, ''); }
  out.push(paras(e.text, data, e.id), '');
  for (const [name, text] of Object.entries(e.variants ?? {})) {
    out.push(`#### ◇ 变体｜${name}`, '', paras(text, data, `${e.id}.${name}`), '');
  }
  return out;
}

const HEADER = `# 河谷季 · 剧情文本（中文）

这份文件装着游戏里目前的全部中文剧情：开场、剧情事件、随机事件、调查碎片、五个结局和尾声。它是从 \`src/data/zh\` 导出的一份**可以从头读到尾的稿子**；游戏真正读的是 \`src/data\`，这份是它的一个镜像。

**怎么用**
- **改字**：直接改正文——段落、选项文字、事件标题、结局的标题和副标题。灰色的、以 \`>\` 开头的行（事件 ID、旗标、数值）是机制，不是文字，别改；机制要改，直接告诉我。
- **对白**：段首的粗体名字加一个全角空格，就是这一段谁在说；游戏里会显示他的头像和名字。新写一段别人说的话，照这个格式写名字。玩家自己说的话、旁白、没有名单里的人，不加名字。
- **改完告诉我**：我会先看一遍哪些地方变了，没问题就并进游戏，英文由我来补。
- **加段落没问题，加选项、加分支、改旗标或数值不行**：这些是改规则，在这个文件里写了也不会生效，告诉我。
- 这份文件是某一时刻的快照。我改了游戏里的字之后会重新导出，所以请**先把你的改动交给我，再让我重新导出**，不要在旧快照上改了一半又让它被覆盖。
- 不在这里的：日志句（每个选项后面记进日志的那句）、场景和天气的重复文字、招呼语、传闻、见闻、界面文字、行囊——那些在 \`text-review/\`（文本编辑指南里有说明）。

---
`;

/** The whole script, as one string. */
export function renderScript(root = process.cwd()) {
  const data = loadData(root);
  const get = (rel) => data.files.get(rel).json;
  const out = [HEADER];

  // 一 开场
  out.push('## 一　开场', '');
  get('opening.json').pages.forEach((page, i) => {
    const name = [page.act, page.heading].filter(Boolean).join(' · ');
    const kind = page.kind === 'letter' ? '文书' : page.kind === 'question' ? '问答' : '场景';
    out.push(`### ${i + 1}．${name}`, `> ${bar([`ID ${page.id}`, `类型 ${kind}`])}`, '');
    out.push(paras(page.text, data, page.id), '');
    out.push(...variantsAndChoices(page, data));
  });

  // 二 主线事件, in the order a season plays them; anything not named above follows by day
  const events = new Map();
  for (const [rel, { json }] of data.files) {
    if (rel.startsWith('events/') && !rel.startsWith('events/random/')) events.set(json.id, json);
  }
  const named = EVENT_ORDER.filter((id) => events.has(id));
  const rest = [...events.values()].filter((e) => !EVENT_ORDER.includes(e.id)).sort((a, b) => a.day - b.day).map((e) => e.id);
  out.push('## 二　主线事件', '');
  [...named, ...rest].forEach((id, i) => out.push(...eventUnit(events.get(id), i + 1, data)));

  // 三 随机事件
  out.push('## 三　随机事件', '');
  [...data.files].filter(([rel]) => rel.startsWith('events/random/')).forEach(([, { json }], i) => {
    out.push(...eventUnit({ ...json, day: 0 }, i + 1, data));
  });

  // 四 调查碎片
  out.push('## 四　调查碎片', '');
  let n = 0;
  for (const [id, frag] of Object.entries(get('dialogue/fragments.json'))) {
    n++;
    if (frag.label) guard(frag.label, id);
    out.push(`### ${n}．${FRAGMENT_TITLES[id] ?? id}${frag.label ? '｜' + frag.label : ''}`, `> ID ${id}`, '', paras(frag.text, data, id), '');
  }

  // 五 结局与尾声
  out.push('## 五　结局与尾声', '');
  Object.values(get('endings/endings.json')).forEach((e, i) => out.push(...endingUnit(e, i + 1, data)));

  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

// ── reading it back ────────────────────────────────────────────────────────

function fromMarkdown(text, data) {
  const m = text.match(/^\*\*([^*]+)\*\*　?([\s\S]*)$/);
  if (m && data.nameToId[m[1]]) return `{@${data.nameToId[m[1]]}}${m[2]}`;
  const d = text.match(/^([^“”"　\n]{1,14})　\s*(?=[“"‘（(])/);
  if (d && data.nameToId[d[1].trim()]) return `{@${data.nameToId[d[1].trim()]}}${text.slice(d[0].length)}`;
  return text;
}

/**
 * Read an edited script and say what it changes. Returns { edits, issues }: `edits` is a list of
 * { file, key, old, new, id } — one string in src/data/zh each — and `issues` is everything the
 * file says that the data cannot take (an id that does not exist, a variant or a choice that
 * was added or removed), which is structure, not text.
 */
export function parseScript(md, data) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('### ')) { cur = { heading: line.slice(4), lines: [] }; sections.push(cur); continue; }
    if (line.startsWith('## ') || line.startsWith('# ')) { cur = null; continue; }
    if (cur) cur.lines.push(line);
  }

  const edits = [];
  const issues = [];

  for (const s of sections) {
    let id = null;
    const scene = [];
    const variants = {};
    const choices = [];
    let target = { k: 'scene' };
    let curChoice = null;
    let block = [];
    const flush = () => {
      if (!block.length) return;
      const para = fromMarkdown(block.join('\n'), data);
      block = [];
      if (target.k === 'scene') scene.push(para);
      else if (target.k === 'variant') variants[target.name].push(para);
      else curChoice.paras.push(para);
    };
    for (const line of s.lines) {
      if (line.trim() === '') { flush(); continue; }
      if (line.startsWith('> ')) {
        flush();
        const a = line.match(/^> ID\s+(\S+)/);
        if (a) id = a[1];
        const c = line.match(/^> 选项\s+(\S+)/);
        if (c && curChoice) curChoice.id = c[1];
        continue;
      }
      if (line.startsWith('#### ')) {
        flush();
        const h = line.slice(5);
        if (h.startsWith('选项｜')) {
          curChoice = { label: h.slice(3).trim(), id: null, paras: [] };
          choices.push(curChoice);
          target = { k: 'choice' };
        } else if (h.startsWith('◇ 变体｜')) {
          const name = h.slice(5).trim();
          variants[name] = [];
          target = { k: 'variant', name };
        }
        continue;
      }
      block.push(line);
    }
    flush();

    const where = s.heading.slice(0, 30);
    if (!id) { issues.push(`「${where}」没有找到 ID 行（> ID …），这一段没有读`); continue; }
    const hit = data.byId.get(id);
    if (!hit) { issues.push(`「${where}」的 ID ${id} 在游戏数据里不存在，这一段没有读`); continue; }
    const { file, obj, path: base } = hit;
    const at = (key) => (base ? `${base}.${key}` : key);
    const leaf = (key, oldV, newV, why) => {
      if (oldV === undefined) { issues.push(`${id}：数据里没有“${why}”这一项，写在文件里也进不去`); return; }
      if (oldV !== newV) edits.push({ file, key: at(key), old: oldV, new: newV, id, why });
    };

    // the heading's title, after the bar
    const bar = s.heading.indexOf('｜');
    if (bar >= 0) {
      const title = s.heading.slice(bar + 1).trim();
      const field = obj.label !== undefined ? 'label' : 'title';
      if (obj[field] !== undefined) leaf(field, obj[field], title, '标题');
    }

    const isEnding = file === 'endings/endings.json';
    const isFragment = file === 'dialogue/fragments.json';
    const isOpening = file === 'opening.json';
    let body = scene.slice();
    if (isEnding && obj.subtitle) {
      const first = body[0] ?? '';
      if (first.startsWith('副标题：')) { leaf('subtitle', obj.subtitle, first.slice(4).trim(), '副标题'); body = body.slice(1); }
      else issues.push(`${id}：缺少“副标题：”这一行`);
    }
    const mainKey = obj.sceneText !== undefined ? 'sceneText' : 'text';
    if (isEnding || isFragment || isOpening || obj.sceneText !== undefined) leaf(mainKey, obj[mainKey], body.join('\n\n'), '正文');

    for (const [name, ps] of Object.entries(variants)) {
      if (obj.variants?.[name] === undefined) { issues.push(`${id}：变体 ${name} 在数据里不存在（新增变体要走规则）`); continue; }
      leaf(`variants.${name}`, obj.variants[name], ps.join('\n\n'), `变体 ${name}`);
    }
    for (const name of Object.keys(obj.variants ?? {})) if (!(name in variants)) issues.push(`${id}：数据里的变体 ${name} 在文件里不见了（删除变体要走规则）`);

    const dataChoices = obj.choices ?? [];
    for (const c of choices) {
      const idx = dataChoices.findIndex((x) => x.id === c.id);
      if (idx < 0) { issues.push(`${id}：选项 ${c.id ?? '（没有 id）'} 在数据里不存在（新增选项要走规则）`); continue; }
      leaf(`choices.${idx}.text`, dataChoices[idx].text, c.label, `选项文字 ${c.id}`);
      if (c.paras.length) leaf(`choices.${idx}.resultText`, dataChoices[idx].resultText, c.paras.join('\n\n'), `选项结果 ${c.id}`);
      else if (dataChoices[idx].resultText) issues.push(`${id}：选项 ${c.id} 在数据里有结果文字，文件里被清空了，这一项没有改`);
    }
    for (const c of dataChoices) if (!choices.some((x) => x.id === c.id)) issues.push(`${id}：数据里的选项 ${c.id} 在文件里不见了（删除选项要走规则）`);
  }
  return { edits, issues };
}

/** Things the house standard (docs: 文本编辑指南) would complain about in a changed Chinese string. */
export function lintZh(text) {
  const out = [];
  if (/[「」]/.test(text)) out.push('用了「」，应用中文引号 “”');
  if (/[一-鿿][,;:][一-鿿]/.test(text)) out.push('汉字之间有半角标点');
  if (/[一-鿿]"[^"]*"/.test(text)) out.push('疑似直引号 "');
  return out;
}
