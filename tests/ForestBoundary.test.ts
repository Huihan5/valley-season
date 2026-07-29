import { describe, it, expect } from 'vitest';
import { GameState, EventData, FlagMap } from '../src/types/game';
import { getFixedEvent, getFreeChoices, getEventById } from '../src/systems/EventSystem';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 15,
    phase: 'afternoon',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 40, guldmark: 30, timber: 10, renown: 0 },
    fatigue: 0,
    relationships: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    conversations: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: -2,
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
    ...overrides,
  };
}

const report = (flags: FlagMap = {}) =>
  getFixedEvent(15, 'afternoon', makeState({ flags })) as EventData;
const site = (flags: FlagMap = {}) =>
  getEventById('day15_stumps', makeState({ flags })) as EventData;

describe('the report', () => {
  it('arrives from a tenant who cannot say what he saw', () => {
    expect(report().sceneText).toContain('“树倒了。”他说，“不是风倒的。”');
    expect(report().advancesPhase).toBe(false);
    expect(report().choices).toBeNull();
  });

  it('reads the old survey differently once 蒂埃里 has explained the stream', () => {
    expect(report().sceneText).toContain('卷宗里没有写');
    expect(report({ met_thierry: true }).sceneText).toContain('就是蒂埃里在集市上说的那条溪');
  });

  it('opens the afternoon ride out, and only after the message came', () => {
    const before = getFreeChoices(makeState()).map(c => c.id);
    expect(before).not.toContain('visit_boundary');

    const after = getFreeChoices(makeState({ flags: { forestReportReceived: true } }));
    const ride = after.find(c => c.id === 'visit_boundary');
    expect(ride?.description).toBe('1 时段');
    expect(ride?.nextEvent).toBe('day15_stumps');
  });

  it('does not offer the ride twice', () => {
    const done = getFreeChoices(makeState({
      flags: { forestReportReceived: true, visitedBoundary: true },
    }));
    expect(done.find(c => c.id === 'visit_boundary')).toBeUndefined();
  });
});

describe('what is actually in the north woods', () => {
  it('is eleven fresh stumps and a skid road, and no symbols anywhere', () => {
    const text = site().sceneText;
    expect(text).toContain('你数了一下，十一个');
    expect(text).toContain('集材道在树桩之间穿过');
    for (const retired of ['符号', '刻痕', '标记']) {
      expect(text, retired).not.toContain(retired);
    }
  });

  it('lets only a player who walked the woods date the cut', () => {
    expect(site().sceneText).not.toContain('这里没有树桩');
    expect(site({ surveyedForest: true }).sceneText)
      .toContain('所以这十一棵是在你到任之后砍的');
  });

  it('leaves the steward knowing he cannot read this', () => {
    expect(site().sceneText).toContain('你是一个管账的人');
  });

  it('has 蒂埃里 introduce himself, or not, depending on the market', () => {
    expect(site().sceneText).toContain('蒂埃里·瓦朗。北区林务官');
    expect(site({ met_thierry: true }).sceneText).toContain('我说过我一年有两百天在这片林子里');
    expect(site({ met_thierry: true }).sceneText).not.toContain('北区林务官');
  });
});

describe('the forester wants the opposite of what the inspector wants', () => {
  it('pays the fragment for admitting you cannot judge it', () => {
    const choices = site().choices ?? [];
    const paying = choices.filter(c => c.effects?.flags?.clue_ofc_thierry_declaration);
    expect(paying.map(c => c.id)).toEqual(['stumps_dont_know']);
  });

  it('gives the measured diameters against the declared ceiling', () => {
    const answer = site().choices?.find(c => c.id === 'stumps_dont_know');
    expect(answer?.resultText).toContain('胸径上限是三十');
    expect(answer?.resultText).toContain('这十一棵里有四棵超了');
    expect(answer?.resultText).toContain('但集材道不会走错方向');
  });

  it('turns him into a recipient of paperwork if the player pulls rank', () => {
    const answer = site().choices?.find(c => c.id === 'stumps_internal');
    expect(answer?.resultText).toContain('我就是公国');
  });

  it('warns rather than argues when the player jumps to a verdict', () => {
    const answer = site().choices?.find(c => c.id === 'stumps_accuse');
    expect(answer?.resultText).toContain('您现在没有证据');
  });

  it('runs on to the recording choice, which is what costs the phase', () => {
    expect(site().next).toBe('day15_record');
    expect(site().advancesPhase).toBe(false);
    expect(getEventById('day15_record', makeState())?.advancesPhase).toBe(true);
  });
});

describe('writing it down, or not', () => {
  const record = getEventById('day15_record', makeState()) as EventData;

  it('is the flag the investigation later depends on', () => {
    const wrote = record.choices?.find(c => c.id === 'record_stumps');
    expect(wrote?.effects?.flags?.documentedStumps).toBe(true);
  });

  it('costs nothing to write down, so the choice is about paying attention', () => {
    const wrote = record.choices?.find(c => c.id === 'record_stumps');
    expect(wrote?.effects?.guldmark).toBeUndefined();
    expect(wrote?.effects?.fatigue).toBeUndefined();
  });

  it('lets the numbers go soft in three days if the player trusts memory', () => {
    const remembered = record.choices?.find(c => c.id === 'record_remember');
    expect(remembered?.effects?.flags).toBeUndefined();
    expect(remembered?.resultText).toContain('三天之后你想不起来是三十八还是三十六');
  });
});
