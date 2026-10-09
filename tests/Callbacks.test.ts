import { describe, it, expect } from 'vitest';
import { GameState, FlagMap, SeasonAction } from '../src/types/game';
import { createInitialState, gameReducer } from '../src/systems/GameEngine';
import { getEventById } from '../src/systems/EventSystem';
import { getTrust } from '../src/systems/RelationSystem';
import { getRetainFloor } from '../src/systems/EndingSystem';
import { ELENA_QUILTS_TRUST } from '../src/data/config';
import { PLANS, nextAction } from './helpers/simulation';
import { seededRng } from '../src/utils/rng';

// A sentence that points back at something the player did or saw in an earlier scene is only
// true for a player who did or saw it. `npm run audit -- --rule callback` lists the sentences
// that point back; this is where the ones that depend on what happened are held to it.
// The first three came from an outside review (2026-10), the Millridge one from the audit.

function fresh(flags: FlagMap = {}, over: Partial<GameState> = {}): GameState {
  const base = createInitialState(3);
  return { ...base, openingPage: null, activeEvent: null, flags: { ...base.flags, ...flags }, ...over };
}

describe('what 亨克 says about the dinner when the trust is not there', () => {
  const said = (flags: FlagMap): string => {
    const state = fresh({ rodeToMillridge: true, ...flags }, { day: 30, phase: 'evening' });
    return getEventById('day30_millridge', state)?.choices?.find(c => c.id === 'millridge_cash')?.resultText ?? '';
  };

  it('says "no answer" only to the one who put the proposal off', () => {
    const text = said({ attendedDinner: true, dinnerPick1: 'C' });
    expect(text).toContain('运木头的事');
    expect(text).toContain('您到今天也没有给我答复');
  });

  it('says what the player did to the one who answered at the table', () => {
    const accepted = said({ attendedDinner: true, dinnerPick1: 'A' });
    expect(accepted).toContain('您当场就应了');
    expect(accepted).not.toContain('没有给我答复');

    const refused = said({ attendedDinner: true, dinnerPick1: 'B' });
    expect(refused).toContain('您当着人回了我');
    expect(refused).not.toContain('没有给我答复');
  });

  it('does not mention a proposal to someone who never sat at the table', () => {
    const text = said({ attendedDinner: false });
    expect(text).not.toContain('运木头');
    expect(text).not.toContain('答复');
    expect(text).toContain('邀您打过一次猎');
    expect(text).toContain('还没到那个份上');
  });

  it('keeps the rest of his answer the same whichever it was', () => {
    for (const flags of [{ attendedDinner: true, dinnerPick1: 'A' }, { attendedDinner: true, dinnerPick1: 'C' }, {}] as FlagMap[]) {
      const text = said(flags);
      expect(text).toContain('一枚金卢');
      expect(text).toContain('夜里骑马回去当心');
    }
  });
});

// ── Claims held against whole seasons ──────────────────────────────────────

interface Claim {
  id: string;
  says: RegExp;
  /** True of the state the line is shown in. */
  holds: (s: GameState) => boolean;
}

const CLAIMS: Claim[] = [
  { id: 'carriage-thanks', says: /你不用觉得欠我什么/, holds: s => s.flags.banquetAnswer === 'C' },
  { id: 'quilts-at-dusk', says: /霜已经开始落在院子里那几床被子上/, holds: s => getTrust(s, 'elena') >= ELENA_QUILTS_TRUST },
  { id: 'dues-covered', says: /也够缴上今年的税/, holds: s => s.resources.grain >= getRetainFloor(s) },
  { id: 'henk-no-answer', says: /那件事您到今天也没有给我答复/, holds: s => !!s.flags.attendedDinner && s.flags.dinnerPick1 === 'C' },
  { id: 'henk-proposal', says: /跟您提过一次运木头的事/, holds: s => !!s.flags.attendedDinner },
  { id: 'henk-took-it', says: /那件事您当场就应了/, holds: s => !!s.flags.attendedDinner && s.flags.dinnerPick1 === 'A' },
  { id: 'henk-turned-down', says: /那件事您当着人回了我/, holds: s => !!s.flags.attendedDinner && s.flags.dinnerPick1 === 'B' },
  { id: 'stag-yesterday', says: /那头鹿之后，队伍今天走的是小东西/, holds: s => !!s.flags.huntAttendedDay20 },
  { id: 'word-at-the-fire', says: /你昨晚说的那句话，今天早上没有人提/, holds: s => ['A', 'B', 'C'].includes(String(s.flags.banquetAnswer)) },
];

/** What the screen shows after each step: the scene and the line of what just happened. */
function shown(s: GameState): string {
  return `${s.currentSceneText}\n${s.lastResult ?? ''}`;
}

describe('a line that points back is only shown when what it points back at happened', () => {
  const breaks: string[] = [];
  const exercised = new Map<string, number>();

  const check = (s: GameState, who: string) => {
    const text = shown(s);
    for (const claim of CLAIMS) {
      if (!claim.says.test(text)) continue;
      exercised.set(claim.id, (exercised.get(claim.id) ?? 0) + 1);
      if (!claim.holds(s)) breaks.push(`${claim.id} (${who}, Day ${s.day} ${s.phase})`);
    }
  };

  it('holds over the planned stewards and a clicker with no plan', () => {
    for (const plan of PLANS) {
      for (let seed = 1; seed <= 24; seed++) {
        const rng = seededRng('callbacks', plan.name, seed);
        let s = createInitialState(seed);
        for (let n = 0; !s.demoComplete && n < 4000; n++) {
          s = gameReducer(s, nextAction(plan, s, rng));
          check(s, `${plan.name} ${seed}`);
        }
      }
    }
    for (let seed = 1; seed <= 300; seed++) {
      const pick = seededRng('callbacks-click', seed);
      let s = createInitialState(seed);
      for (let n = 0; !s.demoComplete && n < 4000; n++) {
        let action: SeasonAction;
        if (s.openingPage !== null) action = s.playerName ? { type: 'SKIP_OPENING' } : { type: 'SET_PLAYER_NAME', name: '安' };
        else if (s.pendingAdvance) action = { type: 'COMMIT_ADVANCE' };
        else if (s.activeEvent && s.currentChoices.length === 0) action = { type: 'ADVANCE_DAY_EVENT' };
        else {
          const open = s.currentChoices.filter(c => !c.disabled);
          action = { type: 'MAKE_CHOICE', choiceId: open[Math.floor(pick() * open.length)].id };
        }
        s = gameReducer(s, action);
        check(s, `clicker ${seed}`);
      }
    }
    expect(breaks).toEqual([]);
  }, 120_000);

  it('was not vacuous: the seasons did reach the lines that are checked', () => {
    // The ones the seasons reach on their own. The quilts, the carriage and the accepted proposal are
    // too rare to count on in a sweep, and are held by their own tests (EventSystem, HuntSeason, above).
    for (const id of ['dues-covered', 'stag-yesterday', 'word-at-the-fire', 'henk-proposal']) {
      expect(exercised.get(id) ?? 0, id).toBeGreaterThan(0);
    }
  });
});
