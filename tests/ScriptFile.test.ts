import { describe, it, expect } from 'vitest';
// The plot script and the patcher are plain ESM scripts with no type declarations.
// @ts-ignore
import { renderScript, loadData, parseScript } from '../scripts/lib/script-format.mjs';
// @ts-ignore
import { patchJson } from '../scripts/lib/json-patch.mjs';

// 剧情文本/河谷季_剧情文本_中文.md: the Chinese story as one readable file, and the way back.
// These tests hold the two directions to each other, so a file that was exported can always be
// read again, and an edit to it comes back as exactly the strings that were edited.

const data = loadData();
const script: string = renderScript();

describe('the plot script', () => {
  it('reads back as exactly what was written: no edits, nothing it cannot place', () => {
    const { edits, issues } = parseScript(script, data);
    expect(issues).toEqual([]);
    expect(edits).toEqual([]);
  });

  it('has every scheduled event, every random event, every fragment and every ending in it', () => {
    const ids: string[] = [];
    for (const [rel, { json }] of data.files as Map<string, { json: any }>) {
      if (rel.startsWith('events/')) ids.push(json.id);
      if (rel === 'endings/endings.json') ids.push(...Object.values<any>(json).map(e => e.id));
      if (rel === 'dialogue/fragments.json') ids.push(...Object.keys(json));
      if (rel === 'opening.json') ids.push(...json.pages.map((p: any) => p.id));
    }
    expect(ids.length).toBeGreaterThan(60);
    for (const id of ids) expect(script, id).toContain(`> ID ${id}`);
  });

  it('writes a spoken line as the speaker’s name, and reads the name back as the mark', () => {
    expect(script).toContain('**提莫西**　“枫径的新管事。”');
    expect(script).not.toMatch(/\{@[a-z]+\}/);
  });

  it('takes a changed sentence, a changed spoken line, a changed choice and a changed title as four edits, and nothing else', () => {
    const edited = script
      .replace('你又坐了一个下午。', '你又坐了一个整下午。')
      .replace('**提莫西**　“枫径的新管事。”', '**提莫西**　“枫径的新管事，是吧。”')
      .replace('#### 选项｜写信告知男爵', '#### 选项｜写信告诉男爵')
      .replace('｜账本的裂缝', '｜账本里的裂缝');
    const { edits, issues } = parseScript(edited, data);
    expect(issues).toEqual([]);
    expect(edits.map((e: any) => `${e.file} ${e.key}`).sort()).toEqual([
      'events/day3.json choices.0.resultText',
      'events/day3.json choices.1.text',
      'events/day3.json title',
      'events/day6_timothy.json sceneText',
    ]);
    const spoken = edits.find((e: any) => e.file === 'events/day6_timothy.json');
    expect(spoken.new).toContain('{@timothy}“枫径的新管事，是吧。”');
  });

  it('does not take structure: an id that does not exist, or a variant taken out, is a note and not an edit', () => {
    const unknown = parseScript(script.replace('> ID day3_ledger', '> ID day3_nowhere'), data);
    expect(unknown.issues.some((i: string) => i.includes('day3_nowhere'))).toBe(true);

    const noVariant = parseScript(script.replace('#### ◇ 变体｜informed', '#### ◇ 变体｜somethingnew'), data);
    expect(noVariant.issues.some((i: string) => i.includes('somethingnew'))).toBe(true);
    expect(noVariant.issues.some((i: string) => i.includes('informed'))).toBe(true);
  });
});

describe('patching a JSON file one string at a time', () => {
  const raw = '{\n  "a": { "x": 1, "y": 2 },\n  "b": ["one", "two"],\n  "c": "three"\n}\n';

  it('changes the string and not a byte of anything else, inline objects included', () => {
    const out = patchJson(raw, new Map([['b.1', '二'], ['c', 'drei']]));
    expect(out).toBe('{\n  "a": { "x": 1, "y": 2 },\n  "b": ["one", "二"],\n  "c": "drei"\n}\n');
  });

  it('refuses a key that is not a string in the file', () => {
    expect(() => patchJson(raw, new Map([['a.x', 'no']]))).toThrow();
  });

  it('adds a sibling after a string, with the same indentation', () => {
    const out = patchJson('{\n  "v": {\n    "one": "1"\n  }\n}\n', new Map(), [{ after: 'v.one', key: 'two', value: '2' }]);
    expect(JSON.parse(out)).toEqual({ v: { one: '1', two: '2' } });
    expect(out).toContain('"one": "1",\n    "two": "2"');
  });
});
