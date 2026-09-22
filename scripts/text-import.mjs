// text-import.mjs — fold edits from text-review/**/*.md back into
// src/data/{zh,en}/**/*.json. Only string values change; JSON structure, key
// order, and identifier leaves are left exactly as they were.
//
// It reports every changed string and runs the same checks Localization.test
// enforces (paired zh/en, matching placeholders, matching paragraph breaks,
// Chinese punctuation in zh, no CJK / curly apostrophes in en) so you catch
// slips before running the suite. Changes are still written even when a check
// warns — fix and re-import, or run `npm test` for the authoritative gate.
//
// Usage: npm run text:import

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ZH = path.join(ROOT, 'src/data/zh');
const EN = path.join(ROOT, 'src/data/en');
const OUT = path.join(ROOT, 'text-review');

const BLOCK = /<!--k:(.+?)-->[\s\S]*?〖zh〗\n([\s\S]*?)\n〖en〗\n([\s\S]*?)\n〖end〗/g;

function walkMd(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkMd(p));
    else if (e.name.endsWith('.md') && e.name !== 'INDEX.md') out.push(p);
  }
  return out;
}

function setAtPath(obj, key, val) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur = Array.isArray(cur) ? cur[Number(p)] : cur[p];
    if (cur == null) return false;
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (Number.isNaN(idx) || idx >= cur.length) return false;
    cur[idx] = val;
  } else {
    if (!(last in cur)) return false;
    cur[last] = val;
  }
  return true;
}

const placeholders = (s) => (s.match(/\{[^}]+\}/g) || []).sort();
const paraBreaks = (s) => (s.match(/\n\n/g) || []).length;
const sameMultiset = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function checkPair(rel, key, zh, en, warn) {
  const at = `${rel} › ${key}`;
  // paired: both non-empty (an empty en is only ok if zh is empty too)
  if (zh.trim() && !en.trim()) warn(`${at}: 英文为空 en is empty`);
  // placeholders must match
  const pz = placeholders(zh), pe = placeholders(en);
  if (!sameMultiset(pz, pe)) warn(`${at}: 占位符不一致 placeholders differ  zh=${JSON.stringify(pz)} en=${JSON.stringify(pe)}`);
  // paragraph-break parity
  if (paraBreaks(zh) !== paraBreaks(en)) warn(`${at}: 段落数不一致 paragraph breaks zh=${paraBreaks(zh)} en=${paraBreaks(en)}`);
  // zh punctuation
  if (zh.includes('「') || zh.includes('」')) warn(`${at}: zh 用了「」角括号，应改中文引号 “”`);
  if (/[一-鿿][,;:][一-鿿]/.test(zh)) warn(`${at}: zh 汉字间有半角标点，应用全角 ，；：`);
  if (/[一-鿿]"[^"]*"[一-鿿]?/.test(zh) && zh.includes('"')) warn(`${at}: zh 疑似直双引号 "，应用中文引号 “”`);
  // en
  if (/[一-鿿]/.test(en)) warn(`${at}: en 含中文字符 CJK in English`);
  if (/[A-Za-z]'[A-Za-z]/.test(en) || /[A-Za-z]'\b/.test(en)) warn(`${at}: en 用了直撇号 '，应用弯撇号 ’ (e.g. don’t, Marigni’s)`);
}

function main() {
  if (!fs.existsSync(OUT)) {
    console.error('text-review/ 不存在。先运行 npm run text:export'); process.exit(1);
  }
  const mdFiles = walkMd(OUT);
  let changed = 0, filesChanged = 0, unknown = 0;
  const warnings = [];
  const warn = (m) => warnings.push(m);
  const changeLog = [];

  for (const md of mdFiles) {
    const rel = path.relative(OUT, md).split(path.sep).join('/').replace(/\.md$/, '.json');
    const zhPath = path.join(ZH, rel), enPath = path.join(EN, rel);
    if (!fs.existsSync(zhPath)) { warn(`无源文件 no source json: ${rel} (skipped)`); continue; }
    const zhJson = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
    const enJson = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {};

    const text = fs.readFileSync(md, 'utf8');
    let m, fileTouched = false;
    while ((m = BLOCK.exec(text)) !== null) {
      const key = m[1].trim();
      const zhVal = m[2].replace(/^\n+|\n+$/g, '');
      const enVal = m[3].replace(/^\n+|\n+$/g, '');

      // find current values
      const curZh = getAtPath(zhJson, key);
      const curEn = getAtPath(enJson, key);
      if (curZh === undefined) { warn(`未知键 unknown key ${rel} › ${key} (skipped — 结构改动请改代码)`); unknown++; continue; }

      let touched = false;
      if (curZh !== zhVal) { if (!setAtPath(zhJson, key, zhVal)) { warn(`写入失败 ${rel} › ${key} (zh)`); } else { touched = true; } }
      if (curEn !== undefined && curEn !== enVal) { if (!setAtPath(enJson, key, enVal)) { warn(`写入失败 ${rel} › ${key} (en)`); } else { touched = true; } }

      if (touched) {
        changed++; fileTouched = true;
        changeLog.push(`${rel} › ${key}`);
        checkPair(rel, key, zhVal, enVal, warn);
      }
    }

    if (fileTouched) {
      filesChanged++;
      fs.writeFileSync(zhPath, JSON.stringify(zhJson, null, 2) + '\n', 'utf8');
      if (fs.existsSync(enPath)) fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2) + '\n', 'utf8');
    }
  }

  if (changeLog.length) {
    console.log(`更新 ${changed} 段文本，涉及 ${filesChanged} 个文件：`);
    changeLog.forEach((c) => console.log('  ✎ ' + c));
  } else {
    console.log('没有检测到改动 no changes detected.');
  }
  if (unknown) console.log(`\n${unknown} 个未知键被跳过（结构改动请改代码）。`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} 条提醒 (改动已写入，但请修正后重跑，或直接 npm test 确认)：`);
    warnings.forEach((w) => console.log('  - ' + w));
  } else if (changeLog.length) {
    console.log('\n✓ 基础校验通过。建议再跑一次 npm test 作最终确认。');
  }
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

main();
