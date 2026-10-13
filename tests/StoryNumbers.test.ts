import { describe, it, expect } from 'vitest';
import { FlagMap, GameState } from '../src/types/game';
import { createInitialState } from '../src/systems/GameEngine';
import { getFixedEvent } from '../src/systems/EventSystem';
import shared from '../src/data/shared/deed.json';
import zhDocs from '../src/data/zh/documents.json';
import enDocs from '../src/data/en/documents.json';
import zhStumps from '../src/data/zh/events/day15_stumps.json';
import enStumps from '../src/data/en/events/day15_stumps.json';
import zhRecord from '../src/data/zh/events/day15_record.json';
import enRecord from '../src/data/en/events/day15_record.json';
import zhDay23 from '../src/data/zh/events/day23.json';
import enDay23 from '../src/data/en/events/day23.json';
import zhEndings from '../src/data/zh/endings/endings.json';
import enEndings from '../src/data/en/endings/endings.json';
import zhInventory from '../src/data/zh/inventory.json';
import enInventory from '../src/data/en/inventory.json';

/**
 * This story leans on its numbers and its papers to be believed. These hold the places where
 * one scene quotes another: the figures Thierry reads off the stumps, the window a renewal
 * has to be lodged in, and what the page says about the wheat when the fields are empty.
 */

describe('the stumps', () => {
  const said = (event: { choices: { id: string; resultText?: string }[] }) =>
    event.choices.find(c => c.id === 'stumps_dont_know')!.resultText!;

  it('gives the three figures Thierry measured, which are the ones the record scene repeats', () => {
    expect(said(zhStumps)).toContain('我量的这三个，胸径是三十二、三十五、三十八');
    expect(said(enStumps)).toContain('thirty-two, thirty-five and thirty-eight at breast height');
    const record = (r: typeof zhRecord) => r.choices.find(c => c.id === 'record_stumps')!.resultText!;
    expect(record(zhRecord)).toContain('三十二、三十五、三十八');
    expect(record(enRecord as typeof zhRecord)).toContain('thirty-two, thirty-five, thirty-eight');
  });

  it('does not say the whole batch is over thirty and then that only four are', () => {
    // The figures are of the three he measured; the other eight he only looked at.
    expect(said(zhStumps)).not.toContain('之间');
    expect(said(enStumps)).not.toMatch(/between thirty-two and thirty-eight/);
    expect(said(zhStumps)).toContain('别的几棵我只看了断面，这十一棵里有四棵超了');
    expect(said(enStumps)).toContain('I only looked at the cut faces on the others. Four of these eleven are over');
  });
});

describe('renewing the guarantee', () => {
  const clause = shared.blocks.find(b => b.id === 'artxi_1')! as { old: string };

  it('lets a deed signed before the Term ends be lodged in the seven days after it, in the deed itself', () => {
    expect(zhDocs.deed.artxi_1).toContain('届满前已经签署的新担保书，也可在届满后七日内送交');
    expect(enDocs.deed.artxi_1).toContain('signed by the Guarantor before the Term ends may also be lodged within seven Days after it');
    // The Old Tongue is the text that binds; it has to say it too.
    expect(clause.old).toMatch(/Ef the Burgio thia niuwa Handfesti êr themu Ende thera Fristi têknit habit/);
    expect(clause.old).toMatch(/aftar themu Ende bibrâht werthan\.$/);
  });

  it('says the same to the steward in the Secretariat’s letter and in the satchel', () => {
    expect(zhDay23.variants.renewal).toContain('届满前已经签署者，可于届满后七日内补交');
    expect(enDay23.variants.renewal).toContain('one signed before expiry may be submitted within seven days after it');
    expect(zhInventory.papers.letter.line).toContain('届满前已签署的可在届满后七日内补交');
    expect(enInventory.papers.letter.line).toContain('one signed before expiry may be submitted within seven days after');
  });

  it('has the Baron say he signed it before the Term ended, in every version of his letter', () => {
    const zhLetters = [zhEndings.ending2.variants.lord_warm, zhEndings.ending2.variants.lord_plain, zhEndings.ending3.variants.letter];
    const enLetters = [enEndings.ending2.variants.lord_warm, enEndings.ending2.variants.lord_plain, enEndings.ending3.variants.letter];
    for (const l of zhLetters) expect(l).toContain('续签文件已于十月二十九日签署');
    for (const l of enLetters) expect(l).toContain('signed on the twenty-ninth of October');
    // And the Term ends on the thirtieth, per the letter that tells the steward so.
    expect(zhDay23.variants.renewal).toContain('十月三十日届满');
    expect(enDay23.variants.renewal).toContain('expires on the thirtieth of October');
    expect(29).toBeLessThan(30);
  });

  it('leaves the letter that arrives to a steward who was let go as it was: nothing was signed', () => {
    expect(zhEndings.ending1.text).toContain('担保人未提交续签文件');
  });
});

describe('the dawn of Day 28, with the wheat in or not', () => {
  const dawn = (flags: FlagMap): ReturnType<typeof getFixedEvent> => {
    const base = createInitialState(5);
    const state: GameState = {
      ...base, openingPage: null, day: 28, phase: 'morning', activeEvent: null,
      flags: { ...base.flags, clue_pos_locate: true, ...flags },
    };
    return getFixedEvent(28, 'morning', state);
  };

  it('says the wheat is not all in while there is wheat standing, and waits for the harvest', () => {
    const event = dawn({ fieldGrain: 40 })!;
    expect(event.sceneText).toContain('地里的麦子还没有收完');
    expect(event.choices!.find(c => c.id === 'day28_wait')!.text).toBe('秋收完再说');
    expect(event.choices!.find(c => c.id === 'day28_wait')!.resultText).toContain('今天的活在地里');
  });

  it('says it is all in when the fields are empty, and waits for the accounts', () => {
    const event = dawn({ fieldGrain: 0 })!;
    expect(event.sceneText).toContain('地里的麦子已经收完了');
    expect(event.sceneText).not.toContain('还没有收完');
    expect(event.choices!.find(c => c.id === 'day28_wait')!.text).toBe('账算完再说');
    expect(event.choices!.find(c => c.id === 'day28_wait')!.resultText).toContain('今天的活在桌上');
    expect(event.choices!.find(c => c.id === 'day28_wait')!.resultText).not.toContain('地里');
  });

  it('is the same morning either way: same first three paragraphs, same two choices, same effects', () => {
    const standing = dawn({ fieldGrain: 40 })!;
    const bare = dawn({ fieldGrain: 0 })!;
    const head = (t: string) => t.split('\n\n').slice(0, 3).join('\n\n');
    expect(head(bare.sceneText)).toBe(head(standing.sceneText));
    expect(bare.choices!.map(c => c.id)).toEqual(standing.choices!.map(c => c.id));
    expect(bare.choices!.map(c => c.effects)).toEqual(standing.choices!.map(c => c.effects));
  });
});
