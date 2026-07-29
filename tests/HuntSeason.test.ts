import { describe, it, expect } from 'vitest';
import { GameState, EventData, FlagMap, NpcId } from '../src/types/game';
import { getFixedEvent, getFreeChoices, getEventById } from '../src/systems/EventSystem';

const ZERO: Record<NpcId, number> = { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 18,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 40, guldmark: 30, timber: 10, renown: 0 },
    fatigue: 0,
    relationships: { ...ZERO },
    conversations: { ...ZERO },
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

const inSeason = (extra: FlagMap = {}) => ({ huntingSeasonStarted: true, ...extra });

describe('the invitation', () => {
  const letter = getFixedEvent(18, 'morning', makeState()) as EventData;

  it('comes before the morning is spent, and only attending costs phases', () => {
    expect(letter.advancesPhase).toBe(false);
    const byId = (id: string) => letter.choices?.find(c => c.id === id);
    expect(byId('hunt_attend_day18')?.advancesPhase).toBe(true);
    expect(byId('hunt_decline_day18')?.advancesPhase).toBeUndefined();
  });

  it('lets 格雷格 puncture the selling point without calling anyone a liar', () => {
    expect(letter.sceneText).toContain('公爵殿下今年将莅临开幕');
    expect(letter.sceneText).toContain('殿下年年都来');
    expect(letter.sceneText).toContain('只是从来不到我们这边');
  });

  it('marks the year 霍特曼 stopped coming', () => {
    expect(letter.sceneText).toContain('第八年开始就找借口推掉了');
  });

  it('separates declining from not answering, and charges more for silence', () => {
    const declined = letter.choices?.find(c => c.id === 'hunt_decline_day18');
    const ignored = letter.choices?.find(c => c.id === 'hunt_no_response_day18');
    expect(declined?.effects?.relationships).toBeUndefined();
    expect(ignored?.effects?.relationships).toEqual({ henk: -1 });
    expect(declined?.effects?.renown).toBe(-1);
    expect(ignored?.effects?.renown).toBe(-1);
  });
});

describe('the opening is the third chance at 贵族信任', () => {
  const opening = (flags: FlagMap = {}) =>
    getFixedEvent(18, 'afternoon', makeState({
      phase: 'afternoon', flags: { huntAttendedDay18: true, ...flags },
    })) as EventData;

  it('shows the duke riding out, and nobody looking this way', () => {
    expect(opening().sceneText).toContain('从头到尾没有人向这边看过来');
  });

  it('pays for three of the four ways into the camp', () => {
    const trust = (id: string) => opening().choices?.find(c => c.id === id)?.effects?.nobleTrust;
    expect(trust('hunt18_henk')).toBe(1);
    expect(trust('hunt18_marguerite')).toBe(1);
    expect(trust('hunt18_thierry')).toBe(1);
    expect(trust('hunt18_edge')).toBeUndefined();
  });

  it('lets the coat and the gift carry even the player who hid at the edge', () => {
    const dressed = opening({ boughtGift: true, boughtAttire: true });
    expect(dressed.choices?.find(c => c.id === 'hunt18_edge')?.effects?.nobleTrust).toBe(1);
  });

  it('has 蒂埃里 introduce himself only to a player who has not met him', () => {
    const stranger = opening().choices?.find(c => c.id === 'hunt18_thierry');
    expect(stranger?.resultText).toContain('瓦朗。北区林务官');

    const known = opening({ met_thierry: true }).choices?.find(c => c.id === 'hunt18_thierry');
    expect(known?.resultText).toContain('别跟在最前面');
  });

  it('says why hiding is worse than staying home', () => {
    const edge = opening().choices?.find(c => c.id === 'hunt18_edge');
    expect(edge?.resultText).toContain('你是自己站到边上去的');
  });
});

describe('the season is decided one morning at a time', () => {
  const morningChoices = (day: number, flags: FlagMap = {}) =>
    getFreeChoices(makeState({ day, phase: 'morning', flags: inSeason(flags) })).map(c => c.id);

  it('offers the ride out on Day 19 through 21', () => {
    for (const day of [19, 20, 21]) {
      expect(morningChoices(day), String(day)).toContain(`attend_hunt_day${day}`);
    }
  });

  it('does not offer it on Day 22 — that day happens at the manor', () => {
    expect(morningChoices(22)).not.toContain('attend_hunt_day22');
  });

  it('leaves Day 20 as a real choice between the stag and a cart of timber', () => {
    const choices = morningChoices(20);
    expect(choices).toContain('attend_hunt_day20');
    expect(choices).toContain('go_to_market');
  });

  it('does not offer the same day twice', () => {
    expect(morningChoices(19, { huntAttendedDay19: true })).not.toContain('attend_hunt_day19');
  });
});

describe('the stag', () => {
  const stag = getFixedEvent(20, 'afternoon', makeState({
    day: 20, phase: 'afternoon', flags: { huntAttendedDay20: true },
  })) as EventData;

  it('is about 亨克 rather than about the deer', () => {
    expect(stag.sceneText).toContain('他不是要找人射鹿。他在找人说话。');
  });

  it('never says whether the shot landed', () => {
    const forward = stag.choices?.find(c => c.id === 'stag_step_forward');
    expect(forward?.resultText).toContain('那一枪打没打中，这一天里再也没有人提起');
    expect(forward?.effects?.relationships).toEqual({ henk: 1 });
  });

  it('gives 玛格丽特 the shape of 霍特曼 seven years, with no flag attached', () => {
    const ask = stag.choices?.find(c => c.id === 'stag_ask_marguerite');
    expect(ask?.resultText).toContain('退了七年');
    expect(ask?.resultText).toContain('力气会用完');
    expect(ask?.effects?.flags).toEqual({ stagPick: 'B' });
  });

  it('costs nothing to stand still, which is the point', () => {
    const still = stag.choices?.find(c => c.id === 'stag_stand_still');
    expect(still?.effects?.relationships).toBeUndefined();
    expect(still?.resultText).toContain('只是没有再看你');
  });
});

describe('staying the night (PlaytestFeedback 4.d)', () => {
  const dusk = getFixedEvent(20, 'evening', makeState({
    day: 20, phase: 'evening', flags: { huntAttendedDay20: true },
  })) as EventData;

  it('asks at 入夜前 and costs nothing to be asked', () => {
    expect(dusk.id).toBe('day20_hunt_overnight');
    expect(dusk.advancesPhase).toBe(false);
  });

  it('replaces the evening with the banquet rather than the manor', () => {
    const stay = dusk.choices?.find(c => c.id === 'overnight_stay');
    expect(stay?.nextEvent).toBe('day20_camp_banquet');
    const banquet = getEventById('day20_camp_banquet', makeState()) as EventData;
    expect(banquet.advancesPhase).toBe(true);
  });

  it('replaces the next morning too, and only for whoever slept there', () => {
    const camped = makeState({ day: 21, phase: 'morning', flags: { campOvernight: true } });
    expect(getFixedEvent(21, 'morning', camped)?.id).toBe('day21_hunt_morning');
    expect(getFixedEvent(21, 'morning', makeState({ day: 21, phase: 'morning' }))).toBeNull();
  });

  it('sends the player home to a kitchen that is still lit if they decline', () => {
    const leave = dusk.choices?.find(c => c.id === 'overnight_decline');
    expect(leave?.effects?.relationships).toEqual({ henk: -1 });
    expect(leave?.resultText).toContain('锅里还有');
    expect(leave?.nextEvent).toBeUndefined();
  });
});

describe('the banquet asks the question the wrong way round', () => {
  const banquet = getEventById('day20_camp_banquet', makeState()) as EventData;

  it('is asked loudly enough that other people stop talking', () => {
    expect(banquet.sceneText).toContain('你打算在这儿待多久？');
    expect(banquet.sceneText).toContain('周围有两三个人停下了说话');
  });

  it('rewards the answer that makes the player calculable', () => {
    const number = banquet.choices?.find(c => c.id === 'banquet_thirty_days');
    expect(number?.effects?.relationships).toEqual({ henk: 1 });
    expect(number?.resultText).toContain('我喜欢知道数字的人');
  });

  it('has 玛格丽特 step in when the question stops being polite', () => {
    const open = banquet.choices?.find(c => c.id === 'banquet_havent_thought');
    expect(open?.effects?.flags?.askedWhyStay).toBe(true);
    expect(open?.resultText).toContain('这个问题他不该在这儿问');
  });

  it('gives 领主印象 nothing for deferring to an absent baron', () => {
    const defer = banquet.choices?.find(c => c.id === 'banquet_up_to_baron');
    expect(defer?.effects?.lordImpression).toBeUndefined();
  });
});

describe('the camp morning', () => {
  const camp = getFixedEvent(21, 'morning', makeState({
    day: 21, phase: 'morning', flags: { campOvernight: true },
  })) as EventData;

  it('spends the morning either way — the ride home takes two hours', () => {
    expect(camp.advancesPhase).toBe(true);
    expect(camp.choices?.find(c => c.id === 'camp_return')?.effects?.relationships).toBeUndefined();
  });

  it('turns the day bag into either cash or a kitchen that runs late', () => {
    const harvest = getEventById('day21_camp_harvest', makeState()) as EventData;
    const sold = harvest.choices?.find(c => c.id === 'harvest_sell');
    const carried = harvest.choices?.find(c => c.id === 'harvest_carry_home');
    expect(sold?.effects?.guldmark).toBeGreaterThan(0);
    expect(carried?.effects?.relationships).toEqual({ marta: 1 });
    expect(carried?.effects?.tenantTrust).toBe(1);
    expect(carried?.resultText).toContain('第二天中午佃户们吃的东西和平时不一样');
  });
});

describe('the tree, and what people decide to tell you', () => {
  const tree = (flags: FlagMap = {}, trust: Partial<Record<NpcId, number>> = {}, noble = 0) =>
    getFixedEvent(21, 'afternoon', makeState({
      day: 21, phase: 'afternoon', nobleTrust: noble,
      relationships: { ...ZERO, ...trust },
      flags: { huntAttendedDay21: true, ...flags },
    })) as EventData;

  it('explains the oak without a shred of mysticism', () => {
    expect(tree().sceneText).toContain('圣火节的引火柴从这儿取');
    expect(tree().sceneText).toContain('因为上一代人从这儿取。”他说，“这就是唯一的理由');
    for (const retired of ['符号', '刻痕']) {
      expect(tree().sceneText, retired).not.toContain(retired);
    }
  });

  it('withholds the question 霍特曼 asked until 洛伦茨 trusts the listener', () => {
    expect(tree().sceneText).not.toContain('是不是错得越多');
    expect(tree({}, { lorenz: 3 }).sceneText).toContain('是不是错得越多');
    expect(tree({}, { lorenz: 3 }).onEnterEffects?.flags?.clue_mot_lorenz_question).toBe(true);
  });

  it('does not replay the revelation to someone who already has it', () => {
    const again = tree({ clue_mot_lorenz_question: true }, { lorenz: 3 });
    expect(again.sceneText).toContain('这一年我想了很多次');
    expect(again.sceneText).not.toContain('是不是错得越多');
  });

  it('gives 玛格丽特 fragment in the carriage, at 贵族信任 2', () => {
    expect(tree().sceneText).not.toContain('这就是那个问题');
    const carriage = tree({}, {}, 2);
    expect(carriage.sceneText).toContain('他是个好管家');
    expect(carriage.sceneText).toContain('这就是那个问题');
    expect(carriage.onEnterEffects?.flags?.clue_nob_marguerite).toBe(true);
  });

  it('does not hand out the carriage twice', () => {
    const held = tree({ clue_nob_marguerite: true }, {}, 3);
    expect(held.sceneText).not.toContain('上来坐一会儿');
  });
});

describe('Day 19 in the saddle', () => {
  const ride = (flags: FlagMap = {}) =>
    getFixedEvent(19, 'afternoon', makeState({
      day: 19, phase: 'afternoon', flags: { huntAttendedDay19: true, ...flags },
    })) as EventData;

  it('pays the range fragment for asking what he cannot reach', () => {
    const ask = ride().choices?.find(c => c.id === 'ride_ask_range');
    expect(ask?.effects?.flags?.clue_ofc_thierry_range).toBe(true);
    expect(ask?.resultText).toContain('有几处旧的护林点');
  });

  it('tells the three places apart for a player who already asked once', () => {
    const again = ride({ clue_ofc_thierry_range: true })
      .choices?.find(c => c.id === 'ride_ask_range');
    expect(again?.resultText).toContain('您问这个问得很细');
    expect(again?.resultText).toContain('石底');
  });

  it('shows he has things he will not say in front of 磨岭', () => {
    const road = ride().choices?.find(c => c.id === 'ride_mention_road');
    expect(road?.resultText).toContain('林子里我可以说。这儿不行');
  });

  it('slips in the sentence about next year without pausing on it', () => {
    const measured = ride().choices?.find(c => c.id === 'ride_ask_measure');
    expect(measured?.resultText).toContain('明年您要是还在');
  });
});
