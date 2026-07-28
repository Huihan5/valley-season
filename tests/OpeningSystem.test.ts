import { describe, it, expect } from 'vitest';
import {
  OPENING_PAGES, getOpeningPage, nextOpeningPage, requiresSignature, signLetter,
} from '../src/systems/OpeningSystem';

describe('the opening as a sequence', () => {
  it('is the letter followed by the four acts of the journey', () => {
    expect(OPENING_PAGES[0].kind).toBe('letter');
    const acts = [...new Set(OPENING_PAGES.slice(1).map(p => p.act))];
    expect(acts).toEqual([
      '第一幕 · 铸都', '第二幕 · 河谷', '第三幕 · 枫径', '第四幕 · 庄园',
    ]);
  });

  it('carries all thirteen pages, each with prose', () => {
    expect(OPENING_PAGES.length).toBe(13);
    for (const page of OPENING_PAGES) {
      expect(page.text.length, page.id).toBeGreaterThan(100);
    }
  });

  it('runs to the end and then hands over to the season', () => {
    expect(nextOpeningPage(0)).toBe(1);
    expect(nextOpeningPage(OPENING_PAGES.length - 1)).toBeNull();
    expect(getOpeningPage(OPENING_PAGES.length)).toBeNull();
  });

  it('ends on the first night at the manor', () => {
    expect(OPENING_PAGES[OPENING_PAGES.length - 1].heading).toBe('第一夜');
    expect(getOpeningPage(12)?.text).toContain('这座庄园归你管三十天');
  });
});

describe('the signature', () => {
  it('is asked for on the letter and nowhere else', () => {
    expect(requiresSignature(OPENING_PAGES[0])).toBe(true);
    for (const page of OPENING_PAGES.slice(1)) {
      expect(requiresSignature(page), page.id).toBe(false);
    }
  });

  it('leaves the line blank until a name is given', () => {
    const letter = OPENING_PAGES[0].text;
    expect(letter).toContain('＿＿＿＿＿＿');
    expect(signLetter(letter, '')).toBe(letter);
  });

  it('writes the name onto the dotted line, and only there', () => {
    const signed = signLetter(OPENING_PAGES[0].text, '林越');
    expect(signed).toContain('被担保人签署：林越');
    expect(signed).not.toContain('＿＿＿＿＿＿');
    // The baron's own signature and both dates are untouched.
    expect(signed).toContain('担保人签署：冯·阿尔德　　日期：2018 年 9 月 27 日');
    expect(signed).toContain('日期：2018 年 9 月 25 日');
  });
});

describe('the letter says what the contract says', () => {
  const letter = OPENING_PAGES[0].text;

  it('names the pay in Guldmark at the corrected rate', () => {
    expect(letter).toContain('150 圣火金卢');
    expect(letter).not.toContain('4,000');
  });

  it('sets the term at thirty days with a renewal clause', () => {
    expect(letter).toContain('三十日整');
    expect(letter).toContain('届满未经续签');
  });

  it('is guaranteed by the baron in person', () => {
    expect(letter).toContain('男爵 路德维希·冯·阿尔德');
  });
});
