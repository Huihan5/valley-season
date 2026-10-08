import { describe, it, expect } from 'vitest';
import { hasSpeech, splitSpeech, stripSpeech } from '../src/utils/speech';
import { SPEAKER_IDS, isSpeakerId } from '../src/data/speakers';
import zhUi from '../src/data/zh/ui.json';
import enUi from '../src/data/en/ui.json';

describe('speaker marks in the prose', () => {
  const scene = '他站在门口。\n\n{@thierry}“行。”蒂埃里说。\n\n“您呢？”\n\n{@timothy}“第五年。”提莫西说。';

  it('finds a passage that has any', () => {
    expect(hasSpeech(scene)).toBe(true);
    expect(hasSpeech('他站在门口。\n\n“行。”')).toBe(false);
    // A brace in the middle of a line is not a mark.
    expect(hasSpeech('他说“{@thierry}”')).toBe(false);
  });

  it('strips them and leaves the words', () => {
    expect(stripSpeech(scene)).toBe('他站在门口。\n\n“行。”蒂埃里说。\n\n“您呢？”\n\n“第五年。”提莫西说。');
    expect(stripSpeech('没有标记。')).toBe('没有标记。');
  });

  it('cuts a passage into paragraphs with their speakers', () => {
    const blocks = splitSpeech(scene);
    expect(blocks.map(b => b.speaker)).toEqual([null, 'thierry', null, 'timothy']);
    expect(blocks[1].spans).toEqual([{ text: '“行。”蒂埃里说。' }]);
    expect(blocks.map(b => b.spans.map(s => s.text).join('')).join('\n\n')).toBe(stripSpeech(scene));
  });

  it('keeps the stretches the difference hints have set back', () => {
    const text = '{@gregor}“这把顺手。”\n\n第二天它挂在门边。';
    const parts = [{ text: '{@gregor}“这把顺手。”\n\n', known: true }, { text: '第二天它挂在门边。' }];
    const blocks = splitSpeech(text, parts);
    expect(blocks[0]).toEqual({ speaker: 'gregor', spans: [{ text: '“这把顺手。”', known: true }] });
    expect(blocks[1]).toEqual({ speaker: null, spans: [{ text: '第二天它挂在门边。' }] });
  });

  it('falls back to the plain string when the parts are stale', () => {
    const blocks = splitSpeech('{@gregor}“好。”', [{ text: '别的文字', known: true }]);
    expect(blocks).toEqual([{ speaker: 'gregor', spans: [{ text: '“好。”' }] }]);
  });

  it('leaves a passage without marks as paragraphs of plain spans', () => {
    expect(splitSpeech('一段。\n\n二段。').map(b => b.speaker)).toEqual([null, null]);
  });
});

describe('the people who can speak', () => {
  it('have a name in both languages', () => {
    for (const id of SPEAKER_IDS) {
      expect((zhUi.speakers as Record<string, string>)[id], id).toBeTruthy();
      expect((enUi.speakers as Record<string, string>)[id], id).toBeTruthy();
    }
    expect(Object.keys(zhUi.speakers).sort()).toEqual([...SPEAKER_IDS].sort());
    expect(Object.keys(enUi.speakers).sort()).toEqual([...SPEAKER_IDS].sort());
  });

  it('include everyone the relationship system tracks', () => {
    for (const id of Object.keys(zhUi.npc)) expect(isSpeakerId(id), id).toBe(true);
  });
});
