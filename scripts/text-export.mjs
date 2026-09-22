// text-export.mjs — flatten src/data/{zh,en}/**/*.json into a human-editable
// mirror under text-review/. Every prose string appears once, bilingual, with a
// stable key and a plain-language "where used" note. Identifier leaves (ids,
// flags, timing, pick-letters) are excluded so you only see real text.
//
// Round trip: edit the text between the 〖zh〗/〖en〗/〖end〗 markers, then run
// `npm run text:import` to fold your edits back into the JSON. See 文本编辑指南.md.
//
// Usage: npm run text:export      (regenerates text-review/ from src/data)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ZH = path.join(ROOT, 'src/data/zh');
const EN = path.join(ROOT, 'src/data/en');
const OUT = path.join(ROOT, 'text-review');

// Final key-names whose values are logic anchors, never prose. Excluded from the
// editable surface (they stay untouched in the JSON). Derived by scanning the
// data: these keys never hold CJK and always hold ascii identifiers.
const IDENT_KEYS = new Set([
  'id', 'next', 'nextScene', 'nextEvent', 'timing', 'phase', 'kind',
  'activationFlag', 'requiresFlag', 'dateLocale',
  'huntDay18Pick', 'timothyDay12', 'timothyDay6',
  'thierryDay13', 'thierryDay15', 'thierryDay19',
  'banquetAnswer', 'stagPick', 'petitionFairness',
  'dinnerPick1', 'dinnerPick2', 'dinnerPick3',
]);

const MARK = { zh: '〖zh〗', en: '〖en〗', end: '〖end〗' };

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// Flatten to an ordered list of { key, value } string leaves, skipping identifiers.
function flatten(obj) {
  const leaves = [];
  const rec = (v, keyPath, finalKey) => {
    if (typeof v === 'string') {
      if (IDENT_KEYS.has(finalKey)) return;
      leaves.push({ key: keyPath, value: v });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => rec(x, keyPath ? `${keyPath}.${i}` : String(i), finalKey));
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) rec(v[k], keyPath ? `${keyPath}.${k}` : k, k);
    }
  };
  rec(obj, '', '(root)');
  return leaves;
}

function getAtPath(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur[Number(p)] : cur[p];
  }
  return cur;
}

// Plain-language role for a key path — light heuristics, honest about what it is.
function roleOf(key) {
  const parts = key.split('.');
  const last = parts[parts.length - 1];
  const has = (k) => parts.includes(k);
  const idxAfter = (k) => {
    const i = parts.indexOf(k);
    return i >= 0 && parts[i + 1] != null ? parts[i + 1] : null;
  };
  if (last === 'title') return '标题 · title';
  if (last === 'subtitle') return '副标题 · subtitle';
  if (last === 'silhouette') return '未解锁时的剪影 · locked silhouette';
  if (last === 'heading') return '面板标题 · panel heading';
  if (last === 'sceneText') return '开场场景文字 · opening scene text';
  if (last === 'logEntry' || last === 'log') return '卷宗/日志记录 · journal log line';
  if (has('choices')) {
    const i = idxAfter('choices');
    if (last === 'text') return `选项 ${i} 的按钮文字 · choice ${i} button`;
    if (last === 'resultText') return `选项 ${i} 的结果文字 · choice ${i} result`;
    return `选项 ${i} · choice ${i} (${last})`;
  }
  if (has('variants')) return `场景变体（${idxAfter('variants')}） · scene variant`;
  if (has('layers')) return `见闻分层（${last}） · codex layer`;
  return key;
}

// A readable header for the whole file, from its top-level fields.
function fileTitle(rel, zhJson) {
  const j = zhJson || {};
  if (typeof j.day === 'number') {
    let s = `Day ${j.day}`;
    if (typeof j.timing === 'string') s += ` · ${j.timing}`;
    if (typeof j.title === 'string') s += ` · 「${j.title}」`;
    return s;
  }
  const base = rel.replace(/\.json$/, '');
  const named = {
    'ui': '界面文字 · UI chrome',
    'system_lines': '系统提示 · system lines',
    'actions': '行动结果文字 · action outcomes',
    'opening': '开场序章 · opening / prologue',
    'codex': '见闻 · the Compendium',
    'endings/endings': '五个结局脚本 · the five endings',
    'dialogue/greetings': 'NPC 招呼语（按信任阶） · greetings by trust tier',
    'dialogue/fragments': 'NPC 对话片段 · dialogue fragments',
    'scenes/locations': '地点描写 · location descriptions',
    'scenes/ambient': '环境氛围文字 · ambient lines',
    'scenes/market': '集市文字 · market',
    'scenes/rumors': '传闻 · rumors',
    'scenes/weather_lines': '天气描写 · weather lines',
    'scenes/action_results': '行动结果场景 · action result scenes',
  };
  return named[base] || base;
}

function esc(s) { return s; } // content is written verbatim (real newlines preserved)

function renderFile(rel, zhJson, enJson) {
  const leaves = flatten(zhJson);
  const relBase = rel.replace(/\.json$/, '');
  const lines = [];
  lines.push(`# ${relBase}`);
  lines.push(`> ${fileTitle(rel, zhJson)}`);
  lines.push(`>`);
  lines.push(`> 源文件 source: \`src/data/zh/${rel}\` + \`src/data/en/${rel}\``);
  lines.push(`> 共 ${leaves.length} 段文本 · edit between the 〖zh〗/〖en〗/〖end〗 markers, then \`npm run text:import\``);
  lines.push('');
  let missingEn = 0;
  for (const { key, value } of leaves) {
    const enVal = getAtPath(enJson, key);
    if (enVal === undefined) missingEn++;
    lines.push('---');
    lines.push(`<!--k:${key}-->`);
    lines.push(`### \`${key}\``);
    lines.push(`_${roleOf(key)}_`);
    lines.push('');
    lines.push(MARK.zh);
    lines.push(esc(value));
    lines.push(MARK.en);
    lines.push(enVal === undefined ? '' : esc(String(enVal)));
    lines.push(MARK.end);
    lines.push('');
  }
  return { text: lines.join('\n'), count: leaves.length, missingEn };
}

function main() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const files = walk(ZH).map((p) => path.relative(ZH, p).split(path.sep).join('/')).sort();
  const index = [];
  let grandTotal = 0;
  let warnings = [];

  for (const rel of files) {
    const zhJson = JSON.parse(fs.readFileSync(path.join(ZH, rel), 'utf8'));
    const enPath = path.join(EN, rel);
    const enJson = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {};
    if (!fs.existsSync(enPath)) warnings.push(`en 缺文件 missing: ${rel}`);

    const { text, count, missingEn } = renderFile(rel, zhJson, enJson);
    if (missingEn) warnings.push(`${rel}: ${missingEn} 段缺英文 en value(s)`);

    const outPath = path.join(OUT, rel.replace(/\.json$/, '.md'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text, 'utf8');
    grandTotal += count;
    index.push({ rel, count, title: fileTitle(rel, zhJson) });
  }

  // INDEX.md — the navigational entry inside the working folder.
  const idx = [];
  idx.push('# text-review · 文本索引 INDEX');
  idx.push('');
  idx.push(`本文件夹是 \`src/data\` 里全部文本的可编辑镜像，共 **${grandTotal}** 段（${files.length} 个文件）。`);
  idx.push('自动生成，请勿手改本 INDEX。改文本请打开下面对应的 \`.md\`，改完运行 `npm run text:import`。');
  idx.push('用法见仓库根目录的 **`文本编辑指南.md`**。');
  idx.push('');
  const groups = {};
  for (const r of index) {
    const g = r.rel.includes('/') ? r.rel.split('/')[0] : '(root)';
    (groups[g] ??= []).push(r);
  }
  const order = ['(root)', 'opening', 'dialogue', 'scenes', 'events', 'endings'];
  const gkeys = Object.keys(groups).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  for (const g of gkeys) {
    idx.push(`## ${g}`);
    idx.push('');
    idx.push('| 文件 file | 段数 | 内容 what it is |');
    idx.push('|---|---:|---|');
    for (const r of groups[g].sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }))) {
      const link = r.rel.replace(/\.json$/, '.md');
      idx.push(`| [${r.rel}](${link}) | ${r.count} | ${r.title} |`);
    }
    idx.push('');
  }
  fs.writeFileSync(path.join(OUT, 'INDEX.md'), idx.join('\n'), 'utf8');

  console.log(`exported ${grandTotal} strings across ${files.length} files → text-review/`);
  if (warnings.length) { console.log('\nwarnings:'); warnings.forEach((w) => console.log('  - ' + w)); }
  console.log('\nopen text-review/INDEX.md to browse. edit, then: npm run text:import');
}

main();
