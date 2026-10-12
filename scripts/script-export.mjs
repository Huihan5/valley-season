// script-export.mjs — write the readable plot script (剧情文本/河谷季_剧情文本_中文.md) from
// src/data/zh. Run it after the game's text has changed so the file matches; run
// `npm run script:import` FIRST if the file has edits that have not been taken in yet, or this
// overwrites them.
//
// Usage: npm run script:export

import fs from 'node:fs';
import path from 'node:path';
import { renderScript, SCRIPT_DIR, SCRIPT_FILE } from './lib/script-format.mjs';

const root = process.cwd();
const target = path.join(root, SCRIPT_DIR, SCRIPT_FILE);
const text = renderScript(root);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, text, 'utf8');
const paragraphs = text.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>')).length;
console.log(`wrote ${path.relative(root, target)}: ${text.length} characters, ${paragraphs} paragraphs, ${(text.match(/^### /gm) || []).length} units`);
