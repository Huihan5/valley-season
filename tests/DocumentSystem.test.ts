import { describe, it, expect } from 'vitest';
import { GameState } from '../src/types/game';
import { createInitialState } from '../src/systems/GameEngine';
import { getPapers, getThings } from '../src/systems/InventorySystem';
import { getDocument, DOCUMENT_IDS, DocBlock } from '../src/systems/DocumentSystem';
import shared from '../src/data/shared/deed.json';
import zhDocs from '../src/data/zh/documents.json';
import enDocs from '../src/data/en/documents.json';

/** A real opening state, with the steward's name and the clock the case needs. */
function at(over: Partial<GameState> = {}): GameState {
  const s = createInitialState(1);
  return { ...s, openingPage: null, playerName: '安', ...over };
}

const CJK = /[一-鿿]/;
const text = (blocks: DocBlock[]) => blocks.map(b => [b.old, b.common, b.fill, b.oldFill].filter(Boolean).join(' ')).join('\n');
const fieldOf = (blocks: DocBlock[], id: string) => blocks.find(b => b.id === id);

describe('which papers open', () => {
  it('marks the summary leaf and the deed, and nothing else in the satchel', () => {
    const s = at({ flags: { ...at().flags, huntingSeasonStarted: true, lordsLetterRead: true } });
    const readable = getPapers(s).filter(p => p.readable).map(p => p.id);
    expect(readable).toEqual(['guarantee', 'deed']);
    expect(getThings(s).some(t => t.readable)).toBe(false);
    expect([...DOCUMENT_IDS]).toEqual(['guarantee', 'deed']);
  });

  it('has a document for every paper it marks, and none for the others', () => {
    for (const id of DOCUMENT_IDS) expect(getDocument(at(), id), id).not.toBeNull();
    expect(getDocument(at(), 'ticket')).toBeNull();
  });
});

describe('the deed’s text, in both languages', () => {
  const ids = shared.blocks.map(b => b.id);

  it('has the Common Tongue under every clause id, in zh and en, and nothing extra', () => {
    for (const docs of [zhDocs, enDocs]) {
      expect(Object.keys(docs.deed).sort()).toEqual([...ids].sort());
    }
  });

  it('has no repeated ids in the structure', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps each block the same shape on both sides: a caption stays a caption, a field a field', () => {
    const deed = { zh: zhDocs.deed as Record<string, unknown>, en: enDocs.deed as Record<string, unknown> };
    for (const id of ids) {
      expect(typeof deed.zh[id], id).toBe(typeof deed.en[id]);
      if (typeof deed.zh[id] === 'object') {
        expect(Object.keys(deed.zh[id] as object).sort(), id).toEqual(['fill', 'label']);
        expect(Object.keys(deed.en[id] as object).sort(), id).toEqual(['fill', 'label']);
      }
    }
  });

  it('keeps the Old Tongue once, for both languages, and none of it is Chinese', () => {
    for (const b of shared.blocks) {
      const old = [(b as { old?: string }).old, (b as { oldFill?: string }).oldFill].filter(Boolean).join(' ');
      expect(CJK.test(old), b.id).toBe(false);
    }
    // The Common Tongue texts carry no Old Tongue words.
    expect(text(getDocument(at(), 'deed')!.blocks.map(b => ({ ...b, old: undefined, oldFill: undefined })))).not.toMatch(/Burgio|Handfesti/);
  });

  it('numbers the clauses of every article from one, with no gap', () => {
    const byArticle = new Map<string, string[]>();
    for (const b of shared.blocks as { id: string; k: string; n?: string }[]) {
      if (b.k !== 'clause') continue;
      const key = b.id.replace(/_[^_]+$/, '');
      byArticle.set(key, [...(byArticle.get(key) ?? []), b.n!]);
    }
    for (const [key, ns] of byArticle) {
      if (key === 'recitals') expect(ns, key).toEqual(['A', 'B', 'C']);
      else expect(ns, key).toEqual(ns.map((_, i) => String(i + 1)));
    }
    // Fifteen articles and five annexes, the numbers the summary leaf points at.
    const articles = [...byArticle.keys()].filter(k => k.startsWith('art'));
    expect(articles).toHaveLength(15);
  });

  it('keeps the numbers and dates that identify things the same in the Chinese as in the English', () => {
    // Chinese counts in words where the English counts in digits, so only the long numbers are
    // compared: the deed's number, the agent's, the survey year, the year of every date.
    const long = (s: string) => s.match(/d{3,}/g) ?? [];
    const flat = (v: unknown) => (typeof v === 'string' ? v : `${(v as { label: string }).label} ${(v as { fill: string }).fill}`);
    for (const id of ids) {
      const z = flat((zhDocs.deed as Record<string, unknown>)[id]);
      const e = flat((enDocs.deed as Record<string, unknown>)[id]);
      for (const n of long(e)) expect(z, `${id}: ${n}`).toContain(n);
    }
  });
});

describe('the deed in the satchel', () => {
  it('puts the steward’s name on the party line and the signature lines, and never leaves the slot showing', () => {
    const view = getDocument(at(), 'deed')!;
    expect(fieldOf(view.blocks, 'parties_2')!.common).toContain('安');
    expect(fieldOf(view.blocks, 'sg_guaranteed_name')!.fill).toBe('安');
    expect(fieldOf(view.blocks, 'ad_name')!.fill).toBe('安');
    expect(text(view.blocks)).not.toContain('{playerName}');
  });

  it('draws a blank where the steward has not given a name', () => {
    const view = getDocument(at({ playerName: '' }), 'deed')!;
    expect(fieldOf(view.blocks, 'sg_guaranteed_name')!.fill).toBe('');
    expect(text(view.blocks)).not.toContain('{playerName}');
    expect(fieldOf(view.blocks, 'parties_2')!.common).toContain('＿＿＿＿＿＿＿＿');
  });

  it('carries the dates the guarantee was signed on, the same ones the summary leaf shows', () => {
    const blocks = getDocument(at(), 'deed')!.blocks;
    expect(fieldOf(blocks, 'sg_guaranteed_date')!.fill).toContain('9 月 25 日');
    expect(fieldOf(blocks, 'sg_guarantor_date')!.fill).toContain('9 月 27 日');
    expect(fieldOf(blocks, 'sg_secretariat_date')!.fill).toContain('9 月 28 日');
    expect(fieldOf(blocks, 'sg_ministry_date')!.fill).toContain('9 月 28 日');
    expect(fieldOf(blocks, 'ad_date')!.fill).toContain('9 月 28 日');
    const leaf = text(getDocument(at(), 'guarantee')!.blocks);
    expect(leaf).toContain('2018 年 9 月 27 日');
    expect(leaf).toContain('2018 年 9 月 28 日');
  });

  it('leaves the Secretariat’s registry blank until the Wednesday it was filled in, then fills it', () => {
    const ids = ['reg_arrival', 'reg_received', 'reg_officer', 'reg_term_end'];
    for (const day of [1, 2]) {
      const blocks = getDocument(at({ day }), 'deed')!.blocks;
      for (const id of ids) expect(fieldOf(blocks, id)!.fill, `${id} on day ${day}`).toBe('');
    }
    for (const day of [3, 4, 20]) {
      const blocks = getDocument(at({ day }), 'deed')!.blocks;
      for (const id of ids) expect(fieldOf(blocks, id)!.fill, `${id} on day ${day}`).toBeTruthy();
    }
    const blocks = getDocument(at({ day: 3 }), 'deed')!.blocks;
    expect(fieldOf(blocks, 'reg_arrival')!.fill).toContain('9 月 30 日');
    expect(fieldOf(blocks, 'reg_received')!.fill).toContain('10 月 3 日');
    expect(fieldOf(blocks, 'reg_officer')!.fill).toBe('T. K.');
    expect(fieldOf(blocks, 'reg_term_end')!.fill).toContain('10 月 30 日');
  });

  it('agrees with the first week of the season: arrival 30 September, received the Wednesday after', () => {
    // Day 1 is 1 October 2018, a Monday (GDD ch.5.2), so day 3 is the Wednesday.
    const received = new Date(Date.UTC(2018, 9, 3)).getUTCDay();
    expect(received).toBe(3);
  });

  it('opens with the Kingdom, the deed’s own title and the number, and ends on the annexes', () => {
    const blocks = getDocument(at(), 'deed')!.blocks;
    expect(blocks.slice(0, 4).map(b => b.id)).toEqual(['m_kingdom', 'm_title', 'm_number', 'm_original']);
    expect(blocks[blocks.length - 1].id).toBe('annex_e_lead');
    expect(blocks.some(b => b.old && /Handfesti/.test(b.old))).toBe(true);
  });
});

describe('the summary leaf in the satchel', () => {
  const leaf = (over: Partial<GameState> = {}) => getDocument(at(over), 'guarantee')!;

  it('is the opening’s page, with the steward’s name on the receipt line', () => {
    const blocks = leaf().blocks;
    expect(blocks[0].k).toBe('title');
    expect(blocks[0].common).toContain('临时居留及劳务担保书');
    expect(text(blocks)).toContain('被担保人签收：安');
    expect(text(blocks)).toContain('VS-18-0947');
    expect(leaf().bilingual).toBe(false);
  });

  it('leaves the line blank when no name was given, and ends on the seals', () => {
    const blocks = leaf({ playerName: '' }).blocks;
    expect(text(blocks)).toContain('被担保人签收：＿＿＿＿＿＿');
    expect(blocks[blocks.length - 1].k).toBe('note');
    expect(blocks[blocks.length - 1].common).toContain('圣火铸印');
  });

  it('sets each numbered clause under its own heading', () => {
    const headings = leaf().blocks.filter(b => b.k === 'heading').map(b => b.common);
    expect(headings).toHaveLength(6);
    expect(headings[0]).toBe('一、担保人');
    expect(headings[5]).toContain('签署');
  });

  it('points only at articles the deed has', () => {
    // 正本第二、三条 · 第四至六条 · 第七条 · 第八条 · 第十五条
    const value = (zh: string) => {
      const digit = '一二三四五六七八九'.split('');
      const d = (c: string) => digit.indexOf(c) + 1;
      const [before, after] = zh.split('十');
      if (!zh.includes('十')) return d(zh);
      return (before ? d(before) : 1) * 10 + (after ? d(after) : 0);
    };
    const cited = text(leaf().blocks).match(/正本第[^）)]+?条/g) ?? [];
    expect(cited.length).toBeGreaterThanOrEqual(5);
    const numbers = cited.flatMap(c => c.match(/[一二三四五六七八九十]+/g) ?? []).map(value);
    expect(Math.max(...numbers)).toBe(15);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
  });
});
