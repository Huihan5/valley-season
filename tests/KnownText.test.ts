import { describe, it, expect } from 'vitest';
import { GameState, KeyedPart, SeasonAction } from '../src/types/game';
import { createInitialState, gameReducer, replaySeason } from '../src/systems/GameEngine';
import { instantOf, markKnown, partsText } from '../src/systems/SeenSystem';
import {
  getLocationBase, getLocationParts, getGreetingParts, getActionResultParts, composeSceneParts,
  getMarketArrival, getMarketArrivalParts, getMarketTradeResult, getMarketTradeResultParts,
  getMarketReturn, getMarketReturnParts,
} from '../src/systems/SceneSystem';
import { getFreeChoices } from '../src/systems/EventSystem';
import { seededRng } from '../src/utils/rng';

// Difference hints: prose the player has already read in this place, at this hour, in
// this state of the world is set back a step; what changed is left at full strength.

const rest = () => 0;

/** A day-and-phase to stand in, on top of a real opening state. */
function at(day: number, phase: GameState['phase'], over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), day, phase, openingPage: null, ...over };
}

/** Show a stretch of prose at a moment and say which of its parts came out known. */
function show(parts: KeyedPart[], seen: GameState['seen'], moment: GameState) {
  const read = markKnown(parts, seen, instantOf(moment));
  return { ...read, known: read.parts.filter(p => p.known).map(p => p.text) };
}

describe('comparing a line with what it said last time', () => {
  const line = (key: string): KeyedPart[] => [{ text: `the line (${key})`, slot: 's', key }];

  it('does not set back what is being read for the first time', () => {
    const first = markKnown(line('a'), undefined, 10);
    expect(first.anyKnown).toBe(false);
    expect(first.parts).toEqual([{ text: 'the line (a)' }]);
  });

  it('sets back the same state when it comes round again', () => {
    const first = markKnown(line('a'), undefined, 10);
    const again = markKnown(line('a'), first.seen, 13);
    expect(again.anyKnown).toBe(true);
    expect(again.parts).toEqual([{ text: 'the line (a)', known: true }]);
  });

  it('leaves a changed state at full strength, then compares with the new one', () => {
    const one = markKnown(line('a'), undefined, 10);
    const two = markKnown(line('b'), one.seen, 13);
    expect(two.anyKnown).toBe(false);
    // Going back to the earlier state is a change too: it is compared with the last one shown.
    expect(markKnown(line('a'), two.seen, 16).anyKnown).toBe(false);
    expect(markKnown(line('b'), two.seen, 16).anyKnown).toBe(true);
  });

  it('answers the same when the same moment is composed twice', () => {
    const first = markKnown(line('a'), undefined, 10);
    const gap = markKnown(line('b'), first.seen, 13);
    const redo = markKnown(line('b'), gap.seen, 13);
    expect(redo.parts).toEqual(gap.parts);
    // And the second time of asking leaves the record able to answer a third time.
    expect(markKnown(line('b'), redo.seen, 13).parts).toEqual(gap.parts);
    // Composing the first moment again is not "having read it before".
    const shown = markKnown(line('a'), undefined, 10);
    expect(markKnown(line('a'), shown.seen, 10).anyKnown).toBe(false);
  });

  it('never compares a random draw', () => {
    const draw: KeyedPart[] = [{ text: 'weather' }];
    const first = markKnown(draw, undefined, 10);
    expect(markKnown(draw, first.seen, 13).anyKnown).toBe(false);
  });

  it('keeps each slot to itself', () => {
    const two: KeyedPart[] = [
      { text: 'one', slot: 'x', key: '1' },
      { text: 'two', slot: 'y', key: '1' },
    ];
    const first = markKnown(two, undefined, 10);
    const next = markKnown([{ text: 'one', slot: 'x', key: '1' }, { text: 'two', slot: 'y', key: '2' }], first.seen, 13);
    expect(next.parts).toEqual([{ text: 'one', known: true }, { text: 'two' }]);
  });

  it('carries the paragraph breaks with the stretch before them and joins back to the text', () => {
    const parts: KeyedPart[] = [
      { text: 'base', slot: 'b', key: '1' },
      { text: '\n\n' },
      { text: 'weather' },
    ];
    const first = markKnown(parts, undefined, 10);
    const again = markKnown(parts, first.seen, 13);
    expect(again.parts).toEqual([{ text: 'base\n\n', known: true }, { text: 'weather' }]);
    expect(partsText(again.parts)).toBe('base\n\nweather');
  });

  it('numbers the moments of the season in order', () => {
    expect(instantOf({ day: 2, phase: 'morning' })).toBeGreaterThan(instantOf({ day: 1, phase: 'evening' }));
    expect(instantOf({ day: 5, phase: 'afternoon' })).toBeGreaterThan(instantOf({ day: 5, phase: 'morning' }));
  });
});

describe('the places the player has been', () => {
  it('gives the same words as before, only in parts', () => {
    for (const place of ['default', 'office', 'fields', 'forest', 'stable', 'kitchen', 'forge_chapel']) {
      for (const day of [3, 14, 26]) {
        for (const phase of ['morning', 'afternoon', 'evening'] as const) {
          const s = at(day, phase);
          expect(partsText(getLocationParts(s, place)), `${place} ${day} ${phase}`)
            .toBe(getLocationBase(s, place));
        }
      }
    }
  });

  it('sets back a field already read this act, and not a field of the next act', () => {
    const seen = markKnown(getLocationParts(at(4, 'morning'), 'fields'), undefined, instantOf(at(4, 'morning'))).seen;
    expect(show(getLocationParts(at(8, 'morning'), 'fields'), seen, at(8, 'morning')).known)
      .toHaveLength(1);
    expect(show(getLocationParts(at(12, 'morning'), 'fields'), seen, at(12, 'morning')).known)
      .toHaveLength(0);
  });

  it('does not set back the morning field because the afternoon one was read', () => {
    const seen = markKnown(getLocationParts(at(4, 'afternoon'), 'fields'), undefined, instantOf(at(4, 'afternoon'))).seen;
    expect(show(getLocationParts(at(5, 'morning'), 'fields'), seen, at(5, 'morning')).known).toHaveLength(0);
  });

  it('sets back what has not changed in the stable and not the man who has just walked in', () => {
    const day = at(5, 'afternoon', { flags: { gregorAway: true } });
    const seen = markKnown(getLocationParts(day, 'stable'), undefined, instantOf(day)).seen;
    const next = at(6, 'afternoon');
    const shown = show(getLocationParts(next, 'stable'), seen, next);
    expect(shown.parts).toHaveLength(2);
    expect(shown.parts[0].known).toBe(true);
    expect(shown.parts[1].known).toBeUndefined();
    expect(shown.parts[1].text).toContain('马蹄铁');
  });

  it('lights the forge-hall evening once the question about 霍特曼 has been answered', () => {
    const quiet = at(6, 'evening', { flags: {} });
    const answered = at(7, 'evening', {
      flags: { clue_pos_horse_returned: true, clue_mot_martha_summer: true },
    });
    const seen = markKnown(getLocationParts(quiet, 'forge_chapel'), undefined, instantOf(quiet)).seen;
    const nextQuiet = at(8, 'evening', { flags: {} });
    expect(show(getLocationParts(nextQuiet, 'forge_chapel'), seen, nextQuiet).known).toHaveLength(1);
    const lit = show(getLocationParts(answered, 'forge_chapel'), seen, answered);
    expect(lit.known).toHaveLength(0);
    expect(lit.parts[0].text).not.toContain('霍特曼');
  });
});

describe('the people who greet the player', () => {
  it('keys a greeting by how far the trust has come, not by which line was drawn', () => {
    const neutral = at(5, 'afternoon');
    const a = getGreetingParts(neutral, 'marta', rest)[0];
    const b = getGreetingParts(neutral, 'marta', () => 0.999999)[0];
    expect(a.text).not.toBe(b.text);
    expect(a.key).toBe(b.key);
    expect(a.slot).toBe('greeting:marta');
  });

  it('sets back the same tier of greeting, and not a warmer one', () => {
    const cool = at(5, 'afternoon');
    const warm = at(9, 'afternoon', { relationships: { ...cool.relationships, marta: 5 } });
    const seen = markKnown(getGreetingParts(cool, 'marta', rest), undefined, instantOf(cool)).seen;
    expect(show(getGreetingParts(at(7, 'afternoon'), 'marta', () => 0.999999), seen, at(7, 'afternoon')).known)
      .toHaveLength(1);
    expect(show(getGreetingParts(warm, 'marta', rest), seen, warm).known).toHaveLength(0);
  });

  it('keeps two people apart', () => {
    const day = at(5, 'afternoon');
    const seen = markKnown(getGreetingParts(day, 'marta', rest), undefined, instantOf(day)).seen;
    const next = at(6, 'afternoon');
    expect(show(getGreetingParts(next, 'gregor', rest), seen, next).known).toHaveLength(0);
  });
});

describe('what the felling leaves behind', () => {
  const felling = (tier: number) => getActionResultParts(`fell_timber_${tier}`, rest, { n: 4, r: 11 });

  it('keeps the words, and keys only the state of the woods', () => {
    const parts = felling(1);
    expect(parts.filter(p => p.slot)).toHaveLength(1);
    expect(parts.find(p => p.slot)?.slot).toBe('forest');
    expect(partsText(parts)).toContain('4 单位');
  });

  it('sets back the woods as they were, and lights the band that is new', () => {
    const d1 = at(8, 'afternoon');
    const seen = markKnown(felling(1), undefined, instantOf(d1)).seen;
    const d2 = at(9, 'afternoon');
    const same = show(felling(1), seen, d2);
    expect(same.known).toHaveLength(1);
    expect(same.known[0]).toContain('树桩还新');
    // The line about the felling itself is a draw and stays as it is.
    expect(same.parts.some(p => !p.known && p.text.includes('4 单位'))).toBe(true);
    expect(show(felling(2), seen, d2).known).toHaveLength(0);
  });

  it('reads the same band whether the player felled or walked', () => {
    const d1 = at(8, 'afternoon');
    const seen = markKnown(felling(2), undefined, instantOf(d1)).seen;
    const walk = getActionResultParts('survey_forest_2', rest);
    expect(show(walk, seen, at(9, 'afternoon')).known).toHaveLength(1);
  });

  it('gives an action with no state behind it as it always did', () => {
    expect(getActionResultParts('harvest', rest, { n: 12 }).every(p => !p.slot)).toBe(true);
    expect(getActionResultParts('no_such_action', rest)).toEqual([]);
  });
});

describe('the market', () => {
  const marketState = (day: number, flags: GameState['flags'] = {}) =>
    at(day, 'morning', { flags: { visitingMarketToday: day, ...flags } });

  it('gives the arrival, the sales and the ride home the same words as before, in parts', () => {
    const s = marketState(13, { marketFirstVisitDone: true });
    expect(partsText(getMarketArrivalParts(s))).toBe(getMarketArrival(s));
    expect(partsText(getMarketTradeResultParts('market_timber', s))).toBe(getMarketTradeResult('market_timber', s));
    for (const sold of [true, false]) {
      expect(partsText(getMarketReturnParts(sold))).toBe(getMarketReturn(sold));
    }
  });

  it('carries the parts on the choices that show them, joining to their text', () => {
    const go = getFreeChoices(at(13, 'morning')).find(c => c.id === 'go_to_market');
    expect(go?.resultParts?.length).toBeGreaterThan(0);
    expect(partsText(go?.resultParts ?? [])).toBe(go?.resultText);
    const afternoon = getFreeChoices(at(13, 'afternoon', { flags: { visitingMarketToday: 13 } }));
    for (const id of ['market_finish']) {
      const c = afternoon.find(x => x.id === id);
      expect(partsText(c?.resultParts ?? []), id).toBe(c?.resultText);
    }
  });

  it('sets the ride in back at the second market of the same act, but not the first of the next', () => {
    const first = markKnown(getMarketArrivalParts(marketState(13)), undefined, 10);
    expect(first.anyKnown).toBe(false);
    const second = show(getMarketArrivalParts(marketState(20)), first.seen, at(20, 'morning'));
    // Same act: the stalls and the closing line are what they were.
    expect(second.known.length).toBeGreaterThan(0);
    const third = markKnown(getMarketArrivalParts(marketState(27)), first.seen, 30);
    // A new act: the goods are new and read as new; the closing line is still the closing line.
    expect(third.parts.find(p => !p.known)?.text).toContain('圣火节');
  });

  it('reads the whole arrival as a repeat when the next market is in the same act', () => {
    const first = markKnown(getMarketArrivalParts(marketState(13)), undefined, 10);
    const second = markKnown(getMarketArrivalParts(marketState(20)), first.seen, 11);
    expect(second.parts.every(p => p.known)).toBe(true);
    expect(partsText(second.parts)).toBe(getMarketArrival(marketState(20)));
  });

  it('keeps the merchant who recognises you apart from the one who does not', () => {
    const stranger = getMarketArrivalParts(marketState(27, {}));
    const regular = getMarketArrivalParts(marketState(27, { marketFirstVisitDone: true }));
    const key = (parts: KeyedPart[]) => parts.find(p => p.slot?.endsWith(':recognition'))?.key;
    expect(key(stranger)).toBe('unknown');
    expect(key(regular)).toBe('known');
    expect(key(getMarketArrivalParts(marketState(13)))).toBeUndefined();
  });

  it('reads the second sale of an afternoon as a repeat, since the merchant says the same thing', () => {
    const grain = getMarketTradeResultParts('market_grain', marketState(13));
    const one = markKnown(grain, undefined, 7);
    const two = markKnown(grain, one.seen, 8);
    expect(one.anyKnown).toBe(false);
    expect(two.anyKnown).toBe(true);
  });

  it('lights the timber price when the Millridge agreement has changed it', () => {
    const plain = getMarketTradeResultParts('market_timber', marketState(13));
    const deal = getMarketTradeResultParts('market_timber', marketState(20, { millridgeDealSigned: true }));
    const seen = markKnown(plain, undefined, 7).seen;
    const next = markKnown(deal, seen, 8);
    const price = next.parts.filter(p => !p.known).map(p => p.text).join('');
    expect(price).toContain(partsText(deal.filter(p => p.slot === 'market:timberPrice')));
    expect(next.parts.some(p => p.known)).toBe(true);
  });

  it('goes through the real engine: the first market reads plain, the second sets back what it repeats', () => {
    let s = at(13, 'morning', { openingPage: null });
    s = { ...s, currentChoices: getFreeChoices(s) };
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'go_to_market' });
    expect(s.lastResultParts ?? null).toBeNull();
    expect(s.lastResult).toBeTruthy();

    // The last market of the month: a new act, so the stalls are new, and the closing line is not.
    const { visitingMarketToday: _left, ...flags } = s.flags;
    let again: GameState = { ...s, day: 27, phase: 'morning', flags, currentScene: 'default', pendingAdvance: false };
    again = { ...again, currentChoices: getFreeChoices(again) };
    again = gameReducer(again, { type: 'MAKE_CHOICE', choiceId: 'go_to_market' });
    expect(again.lastResultParts).toBeTruthy();
    expect(partsText(again.lastResultParts ?? [])).toBe(again.lastResult);
    expect(again.lastResultParts?.some(p => p.known)).toBe(true);
    expect(again.lastResultParts?.some(p => !p.known)).toBe(true);
  });
});

describe('the market queue', () => {
  it('compares the framing of the queue and not the rumours in it', () => {
    const day = at(6, 'afternoon', { currentScene: 'market', flags: { visitingMarketToday: 6, marketRumours_day6: '0,1' } });
    const parts = composeSceneParts(day, 'market', rest);
    expect(parts.filter(p => p.slot).map(p => p.slot)).toEqual(['market:intro', 'market:lead']);
    expect(parts.filter(p => !p.slot && p.text.trim()).length).toBeGreaterThanOrEqual(2);
  });
});

// ── In a whole season ───────────────────────────────────────────────────────

function nextAction(s: GameState, pick: () => number): SeasonAction {
  if (s.openingPage !== null) {
    return s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
  }
  if (s.pendingAdvance) return { type: 'COMMIT_ADVANCE' };
  if (s.activeEvent && s.currentChoices.length === 0) return { type: 'ADVANCE_DAY_EVENT' };
  const open = s.currentChoices.filter(c => !c.disabled);
  return { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
}

function season(seed: number, bot: number) {
  const pick = seededRng('bot', bot);
  let s = createInitialState(seed);
  const states = [s];
  while (!s.demoComplete && states.length < 4000) {
    s = gameReducer(s, nextAction(s, pick));
    states.push(s);
  }
  return states;
}

describe('across a played season', () => {
  const SEASONS: [number, number][] = [[1, 1], [20181030, 7], [987654321, 42]];

  it('only ever annotates the text on screen, never changes it', () => {
    for (const [seed, bot] of SEASONS) {
      for (const s of season(seed, bot)) {
        if (s.sceneParts) {
          expect(partsText(s.sceneParts)).toBe(s.currentSceneText);
          expect(s.sceneParts.some(p => p.known)).toBe(true);
        }
        if (s.lastResultParts) {
          expect(partsText(s.lastResultParts)).toBe(s.lastResult);
          expect(s.lastResultParts.some(p => p.known)).toBe(true);
        }
      }
    }
  });

  it('sets back what has been read, and the first time through is plain', () => {
    const states = season(1, 1);
    const withKnown = states.filter(s => s.sceneParts);
    expect(withKnown.length).toBeGreaterThan(5);
    // Nothing has been read yet in the opening morning of the season.
    expect(states.slice(0, 3).every(s => !s.sceneParts)).toBe(true);
  });

  it('leaves the numbers and the words of the season exactly as without the hints', () => {
    // The hints annotate; the text, the choices and the numbers of two seasons played the
    // same way match whether or not anyone looks at the parts.
    const a = season(20181030, 7);
    const b = season(20181030, 7);
    expect(a.map(s => s.currentSceneText)).toEqual(b.map(s => s.currentSceneText));
  });

  it('comes back identical from a save, and from a replay', () => {
    for (const [seed, bot] of SEASONS) {
      const states = season(seed, bot);
      const mid = states[Math.floor(states.length / 2)];
      const saved: GameState = JSON.parse(JSON.stringify(mid));
      const replayed = replaySeason(saved);
      expect(replayed).not.toBeNull();
      expect(replayed?.seen).toEqual(mid.seen);
      expect(replayed?.sceneParts).toEqual(mid.sceneParts);
      expect(replayed?.lastResultParts ?? null).toEqual(mid.lastResultParts ?? null);
    }
  });

  it('plays on from a save made before the hints', () => {
    const states = season(1, 1);
    const old = { ...states[Math.floor(states.length / 3)] } as Partial<GameState>;
    delete old.seen;
    delete old.sceneParts;
    delete old.lastResultParts;
    const resumed = gameReducer(old as GameState, nextAction(old as GameState, seededRng('bot', 9)));
    expect(resumed.step).toBe((old.step ?? 0) + 1);
    expect(resumed.currentSceneText).toBeTruthy();
  });
});
