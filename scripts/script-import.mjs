// script-import.mjs — read the plot script (剧情文本/河谷季_剧情文本_中文.md), say what it changes
// in the game's Chinese text, and with --write put those changes into src/data/zh.
//
// Without --write it only reports: nothing is touched. With --write only the strings that
// changed are replaced, in place — every other byte of the JSON stays as it was, so the diff
// shows the words and nothing else. English is not touched; the list at the end is what needs
// translating again.
//
// Usage: npm run script:import            (report)
//        npm run script:import -- --write (take the changes in)
//        npm run script:import -- path/to/other.md

import fs from 'node:fs';
import path from 'node:path';
import { loadData, parseScript, lintZh, SCRIPT_DIR, SCRIPT_FILE } from './lib/script-format.mjs';
import { patchJson } from './lib/json-patch.mjs';

const root = process.cwd();
const write = process.argv.includes('--write');
const argFile = process.argv.slice(2).find((a) => !a.startsWith('--'));
const file = argFile ? path.resolve(argFile) : path.join(root, SCRIPT_DIR, SCRIPT_FILE);
if (!fs.existsSync(file)) { console.error(`没有找到 ${file}。先运行 npm run script:export。`); process.exit(1); }

const data = loadData(root);
const { edits, issues } = parseScript(fs.readFileSync(file, 'utf8'), data);

const clip = (s, n = 46) => s.replace(/\n+/g, ' ⏎ ').slice(0, n);
const paraCount = (s) => s.split('\n\n').length;

if (!edits.length) console.log('剧情文本和游戏里的中文一模一样：没有差异。');
else {
  console.log(`${edits.length} 处文字和游戏里不一样：\n`);
  for (const e of edits) {
    console.log(`✎ ${e.file} › ${e.key}   （${e.why}；${paraCount(e.old)} 段 → ${paraCount(e.new)} 段）`);
    const a = e.old.split('\n\n'), b = e.new.split('\n\n');
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 2; i++) {
      if (a[i] === b[i]) continue;
      console.log(`    − ${clip(a[i] ?? '（无）')}`);
      console.log(`    + ${clip(b[i] ?? '（无）')}`);
      shown++;
    }
    for (const problem of lintZh(e.new)) console.log(`    ⚠ ${problem}`);
  }
}
if (issues.length) {
  console.log(`\n⚠ ${issues.length} 条提醒（这些是结构，不是文字，没有读进去）：`);
  for (const i of issues) console.log(`  - ${i}`);
}

if (!write) {
  if (edits.length) console.log('\n这是预览，没有改任何文件。确认之后加 --write 才会写进 src/data/zh。');
  process.exit(0);
}
if (!edits.length) process.exit(0);

const byFile = new Map();
for (const e of edits) {
  if (!byFile.has(e.file)) byFile.set(e.file, new Map());
  byFile.get(e.file).set(e.key, e.new);
}
for (const [rel, map] of byFile) {
  const { raw, full } = data.files.get(rel);
  const out = patchJson(raw, map);
  JSON.parse(out); // must still be valid
  fs.writeFileSync(full, out, 'utf8');
}
console.log(`\n已写进 ${byFile.size} 个文件、${edits.length} 处。英文还是旧的，下面这些要重新翻：`);
for (const e of edits) console.log(`  · ${e.file} › ${e.key}（${paraCount(e.old)} → ${paraCount(e.new)} 段）`);
console.log('\n接下来：npm test；英文补完之后 npm run script:export 让稿子和游戏对齐；npm run text:export 刷新 text-review/。');
