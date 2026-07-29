import { describe, it, expect } from 'vitest';
import { GameState, NpcId, FlagMap } from '../src/types/game';
import {
  determineEnding, composeEnding, getEndingData, getRetainFloor, meetsEnding3, EndingId,
} from '../src/systems/EndingSystem';
import {
  GRAIN_RETAIN_THRESHOLD, GRAIN_EXCELLENT_THRESHOLD, RETAIN_MARGIN,
} from '../src/data/config';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

/** Every group cleared, position line one short — the 4A shape. */
const CLUES_4A: FlagMap = {
  clue_pos_horses_intact: true, clue_pos_horse_returned: true, clue_pos_horse_condition: true,
  clue_mot_martha_summer: true, clue_mot_handwriting: true,
  clue_ofc_timothy_person: true, clue_ofc_timothy_nature: true, clue_ofc_thierry_range: true,
  clue_nob_marguerite: true,
};
const CLUES_4B: FlagMap = { ...CLUES_4A, clue_pos_locate: true };

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    day: 30,
    phase: 'evening',
    weather: 'frost',
    playerName: '安',
    openingPage: null,
    resources: { grain: 95, guldmark: 20, timber: 6, renown: 2 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: 0,
    flags: {},
    currentSceneText: '',
    currentScene: 'default',
    lastResult: null,
    currentChoices: [],
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
    ...over,
  };
}

/** 声望 8, 贵族信任 1, three people at trust 3 — the valley has decided about you. */
const valleyState = (over: Partial<GameState> = {}): GameState => makeState({
  resources: { grain: GRAIN_EXCELLENT_THRESHOLD, guldmark: 20, timber: 6, renown: 8 },
  nobleTrust: 1,
  relationships: { ...ZERO, gregor: 3, marta: 3, lorenz: 3 },
  ...over,
});

const text = (id: EndingId, state: GameState) => composeEnding(state, id);

// ── 判定 ────────────────────────────────────────────────────────────────────

describe('the 留任线 is the only thing that can end the season badly', () => {
  it('dismisses below 75', () => {
    expect(determineEnding(makeState({
      resources: { grain: GRAIN_RETAIN_THRESHOLD - 1, guldmark: 40, timber: 9, renown: 10 },
    }))).toBe('ending1');
  });

  it('keeps a steward the lord already thinks well of two units further down', () => {
    const short = { grain: GRAIN_RETAIN_THRESHOLD - RETAIN_MARGIN, guldmark: 5, timber: 1, renown: 0 };
    expect(determineEnding(makeState({ resources: short }))).toBe('ending1');
    expect(determineEnding(makeState({ resources: short, lordImpression: 1 }))).toBe('ending2');
    // 73 is rations plus tax and nothing else. One unit under that, nobody can help.
    expect(determineEnding(makeState({
      resources: { ...short, grain: short.grain - 1 }, lordImpression: 3,
    }))).toBe('ending1');
  });

  it('reads the floor off 领主印象, not off the goodwill of the moment', () => {
    expect(getRetainFloor(makeState())).toBe(GRAIN_RETAIN_THRESHOLD);
    expect(getRetainFloor(makeState({ lordImpression: 1 }))).toBe(73);
    expect(getRetainFloor(makeState({ lordImpression: 3 }))).toBe(73);
  });

  it('gives 称职的外来者 to everyone who cleared the line and nothing more', () => {
    expect(determineEnding(makeState({
      resources: { grain: 120, guldmark: 60, timber: 20, renown: 6 },
    }))).toBe('ending2');
  });
});

describe('the truth endings ask for the fragments, not for standing', () => {
  it('needs the 优秀线, all three groups, and a renown that is merely not negative', () => {
    expect(determineEnding(makeState({ flags: CLUES_4A }))).toBe('ending4a');
    expect(determineEnding(makeState({
      flags: CLUES_4A,
      resources: { grain: GRAIN_EXCELLENT_THRESHOLD - 1, guldmark: 20, timber: 6, renown: 2 },
    }))).toBe('ending2');
    expect(determineEnding(makeState({
      flags: CLUES_4A,
      resources: { grain: 95, guldmark: 20, timber: 6, renown: -1 },
    }))).toBe('ending2');
  });

  it('turns on the position line and on nothing else', () => {
    const rich = { grain: 130, guldmark: 80, timber: 30, renown: 10 };
    expect(determineEnding(makeState({ flags: CLUES_4A, resources: rich }))).toBe('ending4a');
    expect(determineEnding(makeState({ flags: CLUES_4B, resources: rich }))).toBe('ending4b');
    // Same evidence, a season scraped through: still 4B.
    expect(determineEnding(makeState({
      flags: CLUES_4B,
      resources: { grain: GRAIN_EXCELLENT_THRESHOLD, guldmark: 0, timber: 0, renown: 0 },
    }))).toBe('ending4b');
  });

  it('will not open on two groups out of three', () => {
    const { clue_nob_marguerite: _noNoble, ...twoGroups } = CLUES_4B;
    expect(determineEnding(makeState({ flags: twoGroups }))).toBe('ending2');
  });

  it('outranks 河谷的人 when both are true', () => {
    expect(determineEnding(valleyState())).toBe('ending3');
    expect(determineEnding(valleyState({ flags: CLUES_4B }))).toBe('ending4b');
  });
});

describe('河谷的人 is a test of standing, taken separately', () => {
  it('wants renown, one noble who vouches, and three people who mean it', () => {
    expect(meetsEnding3(valleyState())).toBe(true);
    expect(meetsEnding3(valleyState({ nobleTrust: 0 }))).toBe(false);
    expect(meetsEnding3(valleyState({
      resources: { grain: 90, guldmark: 20, timber: 6, renown: 7 },
    }))).toBe(false);
    expect(meetsEnding3(valleyState({
      relationships: { ...ZERO, gregor: 3, marta: 3 },
    }))).toBe(false);
  });

  it('counts talk trust toward those three', () => {
    expect(meetsEnding3(valleyState({
      relationships: { ...ZERO, gregor: 3, marta: 3, lorenz: 1 },
      conversations: { ...ZERO, lorenz: 6 },
    }))).toBe(true);
  });

  it('still needs the 优秀线 under it', () => {
    expect(determineEnding(valleyState({
      resources: { grain: 80, guldmark: 20, timber: 6, renown: 8 },
    }))).toBe('ending2');
  });
});

describe('all five endings are reachable', () => {
  it('reaches each one from a state a player could actually be in', () => {
    const reached = new Set([
      determineEnding(makeState({ resources: { grain: 40, guldmark: 2, timber: 0, renown: -2 } })),
      determineEnding(makeState({ resources: { grain: 82, guldmark: 18, timber: 4, renown: 3 } })),
      determineEnding(valleyState()),
      determineEnding(makeState({ flags: CLUES_4A })),
      determineEnding(makeState({ flags: CLUES_4B })),
    ]);
    expect([...reached].sort()).toEqual(
      ['ending1', 'ending2', 'ending3', 'ending4a', 'ending4b'],
    );
  });

  it('has a title and a subtitle for each, and no 高效的机器', () => {
    for (const id of ['ending1', 'ending2', 'ending3', 'ending4a', 'ending4b'] as EndingId[]) {
      const data = getEndingData(id);
      expect(data.title, id).toBeTruthy();
      expect(data.subtitle, id).toBeTruthy();
      expect(data.title).not.toBe('高效的机器');
    }
  });
});

// ── 条件性文本 ──────────────────────────────────────────────────────────────

describe('结局一 · the symmetry is 格雷格 at both ends of the same road', () => {
  it('has him say the one thing he has to say, if the roof was fixed', () => {
    const fired = makeState({ resources: { grain: 40, guldmark: 0, timber: 0, renown: 0 } });
    expect(text('ending1', fired)).toContain('路上小心');
    expect(text('ending1', fired)).not.toContain('屋顶今年不漏了');

    const repaired = { ...fired, flags: { repairedStableRoof: true } };
    expect(text('ending1', repaired)).toContain('屋顶今年不漏了');
    expect(text('ending1', repaired)).not.toContain('路上小心');
  });

  it('leaves 路德维希 out of it entirely', () => {
    const fired = makeState({ resources: { grain: 40, guldmark: 0, timber: 0, renown: 0 } });
    expect(text('ending1', fired)).not.toContain('他每年圣火节回来，住三天');
  });
});

describe('结局二 · the letter is the whole ending', () => {
  it('praises the numbers when the lord already believes them', () => {
    expect(text('ending2', makeState({ lordImpression: 1 }))).toContain('处理得当');
    expect(text('ending2', makeState())).toContain('随续签文件一并送交');
  });

  it('closes on the line about being told by post, with no epilogue after it', () => {
    const plain = text('ending2', makeState());
    expect(plain).toContain('你留下了，而通知你留下的是一封信');
    expect(plain).not.toContain('他每年圣火节回来，住三天');
  });
});

describe('结局三 · the difference is whether the player has admitted it', () => {
  it('runs the feast either way and splits on admittedWantToStay', () => {
    const quiet = text('ending3', valleyState());
    expect(quiet).toContain('圣火节在十一月的第一个星期');
    expect(quiet).toContain('觉得这一天很长，而且不想它结束');
    expect(quiet).not.toContain('还有七年十一个月');

    const said = text('ending3', valleyState({ flags: { admittedWantToStay: true } }));
    expect(said).toContain('我想要个身份');
    expect(said).toContain('还有七年十一个月');
  });

  it('adds 玛格丽特 to the letter and 亨克 to the end of the night', () => {
    expect(text('ending3', valleyState())).toContain('她极少提及任何人');
    expect(text('ending3', valleyState())).not.toContain('西边的储藏间');
    expect(text('ending3', valleyState({ flags: { tookHenkDeal: true } })))
      .toContain('西边的储藏间');
  });

  it('ends with 路德维希 at the head of the table', () => {
    const full = text('ending3', valleyState());
    expect(full).toContain('他在长桌的主位上坐了那顿饭');
    expect(full).toContain('冬天就要来了');
  });
});

describe('结局 4A · what the player sees is all of it second-hand', () => {
  it('gives the twelve kilometres and keeps the player away from the hollow', () => {
    const found = text('ending4a', makeState({ flags: CLUES_4A }));
    expect(found).toContain('直线不到十二公里');
    expect(found).toContain('您不用过去');
  });

  it('has 埃莱娜 stay away unless she has decided about the player', () => {
    const distant = text('ending4a', makeState({ flags: CLUES_4A }));
    expect(distant).toContain('埃莱娜没有来');

    const present = text('ending4a', makeState({
      flags: CLUES_4A, relationships: { ...ZERO, elena: 4 },
    }));
    expect(present).toContain('站在人群最外面');
    expect(present).not.toContain('埃莱娜没有来');
  });

  it('sends 路德维希 to the narrow table in the hall', () => {
    const found = text('ending4a', makeState({ flags: CLUES_4A }));
    expect(found).toContain('我以为那不是我该问的事');
    expect(found).toContain('三天里他去了两次门厅那张窄桌');
  });
});

describe('结局 4B · he is alive, and he asks the question himself', () => {
  it('carries the question and splits on whether the player can answer it', () => {
    const base = makeState({ flags: CLUES_4B });
    expect(text('ending4b', base)).toContain('您为什么要留下来？');
    expect(text('ending4b', base)).toContain('你说得很乱');

    const said = makeState({ flags: { ...CLUES_4B, admittedWantToStay: true } });
    expect(text('ending4b', said)).toContain('但这一次你说得比那一次长');
    expect(text('ending4b', said)).not.toContain('你说得很乱');
  });

  it('keeps the line the whole ending is built on', () => {
    expect(text('ending4b', makeState({ flags: CLUES_4B })))
      .toContain('等着的东西来了，你也已经不是当初等它的那个人了');
  });

  it('puts the two of them on the same page only if the player took the deal', () => {
    expect(text('ending4b', makeState({ flags: CLUES_4B }))).not.toContain('你把那一页翻过去了');
    expect(text('ending4b', makeState({ flags: { ...CLUES_4B, tookHenkDeal: true } })))
      .toContain('你把那一页翻过去了');
  });

  it('ends on 路德维希 going upstairs three times', () => {
    const found = text('ending4b', makeState({ flags: CLUES_4B }));
    expect(found).toContain('现在还来得及');
    expect(found).toContain('他上楼三次');
  });
});

describe('the epilogue belongs to the endings where the player is still here', () => {
  it('plays for three, 4A and 4B, and never for one or two', () => {
    const opening = '他每年圣火节回来，住三天';
    expect(text('ending3', valleyState())).toContain(opening);
    expect(text('ending4a', makeState({ flags: CLUES_4A }))).toContain(opening);
    expect(text('ending4b', makeState({ flags: CLUES_4B }))).toContain(opening);
    expect(text('ending1', makeState({ resources: { grain: 40, guldmark: 0, timber: 0, renown: 0 } })))
      .not.toContain(opening);
    expect(text('ending2', makeState())).not.toContain(opening);
  });

  it('changes only what he does with the three days', () => {
    expect(text('ending3', valleyState())).toContain('他吃得很少，但他坐到了最后');
    expect(text('ending4a', makeState({ flags: CLUES_4A }))).toContain('只翻了几页就合上了');
    expect(text('ending4b', makeState({ flags: CLUES_4B }))).toContain('第三次待了一个多小时');
  });

  it('always closes on the empty avenue', () => {
    for (const [id, state] of [
      ['ending3', valleyState()],
      ['ending4a', makeState({ flags: CLUES_4A })],
      ['ending4b', makeState({ flags: CLUES_4B })],
    ] as [EndingId, GameState][]) {
      expect(text(id, state), id).toContain('冬天就要来了');
    }
  });
});
