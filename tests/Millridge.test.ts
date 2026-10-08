import { describe, it, expect } from 'vitest';
import { GameState, EventData, NpcId } from '../src/types/game';
import { getEventById, getFixedEvent } from '../src/systems/EventSystem';
import { createInitialState, gameReducer } from '../src/systems/GameEngine';
import { getThings } from '../src/systems/InventorySystem';
import {
  GRAIN_RETAIN_THRESHOLD, MILLRIDGE_CASH, MILLRIDGE_TIMBER, MILLRIDGE_SPRING_SEED,
  ENDING2_GULDMARK, ENDING2_TIMBER, ENDING_TRUTH_GULDMARK, ENDING_TRUTH_TIMBER,
} from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(henk: number, grain = 60): GameState {
  return {
    day: 30,
    phase: 'evening',
    weather: 'frost',
    playerName: '',
    openingPage: null,
    resources: { grain, guldmark: 5, timber: 2, renown: 1 },
    fatigue: 0,
    relationships: { ...ZERO, henk },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
    flags: { rodeToMillridge: true },
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
  };
}

const night = (henk: number, grain = 60) =>
  getEventById('day30_millridge', makeState(henk, grain)) as EventData;
const choice = (henk: number, id: string, grain = 60) =>
  night(henk, grain).choices?.find(c => c.id === id);

describe('the ride itself is the cost', () => {
  it('is paid for going, not for what gets asked', () => {
    expect(night(0).sceneText).toContain('明天早上这一趟就会传遍整个河谷');
    expect(night(0).sceneText).toContain('而磨岭这个方向，尤其');
  });

  it('has 格雷格 ask nothing and look once', () => {
    expect(night(0).sceneText).toContain('就一眼，然后他低头去扣马肚带');
  });

  it('spends the evening — this is the last thing the player does', () => {
    expect(night(0).advancesPhase).toBe(true);
  });
});

describe('what he gives depends on where you actually stand with him', () => {
  it('covers the shortfall in cash at trust 2', () => {
    const cash = choice(2, 'millridge_cash');
    expect(cash?.effects?.guldmark).toBe(MILLRIDGE_CASH);
    expect(cash?.effects?.flags?.tookHenkDeal).toBe(true);
    expect(cash?.resultText).toContain('算我借您的');
  });

  it('fills the gap exactly, in goods, without being told the number', () => {
    const goods = choice(2, 'millridge_goods', 60);
    expect(goods?.effects?.grain).toBe(GRAIN_RETAIN_THRESHOLD - 60);
    expect(goods?.resultText).toContain('他也没有解释他的木头为什么多');
  });

  it('loads a whole cart at trust 4, and asks for nothing in return', () => {
    const all = choice(4, 'millridge_everything');
    expect(all?.effects?.grain).toBeGreaterThan(GRAIN_RETAIN_THRESHOLD - 60);
    expect(all?.effects?.timber).toBeGreaterThan(0);
    expect(all?.effects?.guldmark).toBeGreaterThan(0);
    expect(all?.resultText).toContain('以后总有用得上我的时候');
  });

  it('is the worst conversation in the game when the trust is not there', () => {
    for (const id of ['millridge_everything', 'millridge_cash', 'millridge_goods']) {
      const asked = choice(1, id);
      expect(asked?.effects?.flags?.tookHenkDeal, id).toBeUndefined();
      expect(asked?.effects?.guldmark, id).toBe(1);
      expect(asked?.resultText, id).toContain('我跟您还没到那个份上');
      expect(asked?.resultText, id).toContain('路上给马买点东西');
    }
  });

  it('lets the player leave with nothing, having paid to arrive', () => {
    const left = choice(4, 'millridge_nothing');
    expect(left?.effects?.grain).toBeUndefined();
    expect(left?.effects?.guldmark).toBeUndefined();
    expect(left?.effects?.flags).toBeUndefined();
    expect(left?.resultText).toContain('但那个笑今天晚上第一次显得不合身');
    expect(left?.resultText).toContain('整个河谷明天都会知道你去过');
  });
});

// ── The ride is anyone's to take, and what it buys is the player's to weigh ─────────

describe('a steward whose grain already clears the line can still ask', () => {
  it('has nothing to make up in grain, and is not charged for the gap that is not there', () => {
    const goods = choice(2, 'millridge_goods', GRAIN_RETAIN_THRESHOLD + 10);
    expect(goods?.effects?.grain ?? 0).toBe(0);
    expect(goods?.effects?.timber).toBe(MILLRIDGE_TIMBER);
    const all = choice(4, 'millridge_everything', GRAIN_RETAIN_THRESHOLD + 10);
    expect(all?.effects?.grain).toBe(MILLRIDGE_SPRING_SEED);
  });
});

/** Day 30 evening with the books and the trust given, the way the engine would put the player there. */
function atTheLedger(over: Partial<GameState>): GameState {
  const base = createInitialState(1);
  const state: GameState = {
    ...base,
    day: 30,
    phase: 'evening',
    openingPage: null,
    playerName: '安',
    ...over,
  };
  const event = getFixedEvent(30, 'evening', state)!;
  return {
    ...state,
    activeEvent: event,
    currentSceneText: event.sceneText,
    currentChoices: event.choices ?? [],
  };
}

describe('the night ride changes how the season ends', () => {
  // Over the grain line, short of coin and wood: dismissed, unless the ride is taken and
  // Henk says yes. This is the antidote the ride is for.
  const books = { grain: 80, guldmark: ENDING2_GULDMARK - 15, timber: ENDING2_TIMBER - 7, renown: 1 };
  // Henk's "everything" is worth exactly what the competent line is missing here.
  expect(books.guldmark + MILLRIDGE_CASH).toBeGreaterThanOrEqual(ENDING2_GULDMARK);
  expect(books.timber + MILLRIDGE_TIMBER).toBeGreaterThanOrEqual(ENDING2_TIMBER);

  const ride = (henk: number, ask: string, over: Partial<GameState> = {}) => {
    let s = atTheLedger({
      resources: books, relationships: { ...ZERO, henk }, ...over,
    });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'day30_ride_millridge' });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: ask });
    if (s.pendingAdvance) s = gameReducer(s, { type: 'COMMIT_ADVANCE' });
    return s;
  };

  it('is dismissal without it', () => {
    let s = atTheLedger({ resources: books, relationships: { ...ZERO, henk: 4 } });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'day30_close_book' });
    if (s.pendingAdvance) s = gameReducer(s, { type: 'COMMIT_ADVANCE' });
    expect(s.demoComplete).toBe(true);
    expect(s.endingId).toBe('ending1');
  });

  it('turns a thin purse and woodpile into a competent season, for a steward Henk trusts', () => {
    const s = ride(4, 'millridge_everything');
    expect(s.demoComplete).toBe(true);
    expect(s.endingId).toBe('ending2');
    expect(s.resources.guldmark).toBeGreaterThanOrEqual(ENDING2_GULDMARK);
    expect(s.resources.timber).toBeGreaterThanOrEqual(ENDING2_TIMBER);
  });

  it('costs a point of standing, which is the trap in it', () => {
    const s = ride(4, 'millridge_everything');
    expect(s.resources.renown).toBe(books.renown - 1);
  });

  it('can cost the season it was meant to save, if the standing was exactly on a line', () => {
    // 4A at renown 3 is one point from losing the truth ending. The ride takes that point.
    const clues = {
      clue_pos_horses_intact: true, clue_pos_horse_returned: true, clue_pos_horse_condition: true,
      clue_mot_martha_summer: true, clue_mot_handwriting: true,
      clue_ofc_timothy_person: true, clue_ofc_timothy_nature: true, clue_ofc_thierry_range: true,
      clue_nob_marguerite: true,
    };
    const quiet = { grain: 70, guldmark: ENDING_TRUTH_GULDMARK, timber: ENDING_TRUTH_TIMBER, renown: 3 };
    let stay = atTheLedger({ resources: quiet, flags: { ...clues } });
    stay = gameReducer(stay, { type: 'MAKE_CHOICE', choiceId: 'day30_close_book' });
    if (stay.pendingAdvance) stay = gameReducer(stay, { type: 'COMMIT_ADVANCE' });
    // The truth waits for the player to take it to 蒂埃里 before the ending is written.
    expect(stay.activeEvent?.id).toBe('ending_handover');
    stay = gameReducer(stay, { type: 'MAKE_CHOICE', choiceId: 'hand_over_to_thierry' });
    expect(stay.endingId).toBe('ending4a');

    const rode = ride(4, 'millridge_nothing', { resources: quiet, flags: { ...clues } });
    expect(rode.endingId).not.toBe('ending4a');
    expect(rode.activeEvent).toBeNull();
  });

  it('gives a steward with no standing at Millridge a coin for the horse and nothing else', () => {
    const s = ride(1, 'millridge_everything');
    expect(s.endingId).toBe('ending1');
    expect(s.resources.guldmark).toBe(books.guldmark + 1);
  });
});

describe('what the player carries home from 磨岭', () => {
  const things = (s: GameState) => getThings(s).map(t => t.id);
  const ride = (henk: number, ask: string) => {
    let s = atTheLedger({
      resources: { grain: 80, guldmark: 30, timber: 5, renown: 1 },
      relationships: { ...ZERO, henk },
    });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: 'day30_ride_millridge' });
    s = gameReducer(s, { type: 'MAKE_CHOICE', choiceId: ask });
    if (s.pendingAdvance) s = gameReducer(s, { type: 'COMMIT_ADVANCE' });
    return s;
  };

  it('keeps the single coin that trust too short to help was given', () => {
    for (const id of ['millridge_everything', 'millridge_cash', 'millridge_goods']) {
      const s = ride(1, id);
      expect(s.flags.henkCoin, id).toBe(true);
      expect(things(s), id).toContain('coin');
      expect(things(s), id).not.toContain('purse');
    }
  });

  it('keeps the counted bag of the cash scene, and only that scene', () => {
    expect(things(ride(2, 'millridge_cash'))).toContain('purse');
    expect(things(ride(2, 'millridge_cash'))).not.toContain('coin');
    expect(things(ride(4, 'millridge_everything'))).not.toContain('purse');
    expect(things(ride(2, 'millridge_goods'))).not.toContain('purse');
  });

  it('keeps nothing from leaving empty-handed', () => {
    const s = ride(4, 'millridge_nothing');
    expect(things(s)).not.toContain('coin');
    expect(things(s)).not.toContain('purse');
  });
});
