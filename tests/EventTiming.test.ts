import { describe, it, expect } from 'vitest';
import { GameState, EventData } from '../src/types/game';
import { getFixedEvent, getFreeChoices, eventPhase, eventAdvancesPhase } from '../src/systems/EventSystem';
import day1 from '../src/data/events/day1.json';
import day3 from '../src/data/events/day3.json';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    phase: 'morning',
    weather: 'sunny',
    playerName: '',
    openingPage: null,
    resources: { grain: 0, guldmark: 50, timber: 8, renown: 0 },
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

const at = (timing: string) => ({ id: 't', day: 1, forced: true, title: '', sceneText: '', choices: null, timing } as unknown as EventData);

describe('the four timings map onto the three phases', () => {
  it('puts 上午前 at the head of the morning and 日中 at the head of the afternoon', () => {
    expect(eventPhase(at('dawn'))).toBe('morning');
    expect(eventPhase(at('midday'))).toBe('afternoon');
  });

  it('puts both 入夜前 and 晚间 in the evening, and tells them apart by cost', () => {
    expect(eventPhase(at('dusk'))).toBe('evening');
    expect(eventPhase(at('evening'))).toBe('evening');
    expect(eventAdvancesPhase(at('dusk'))).toBe(false);
    expect(eventAdvancesPhase(at('evening'))).toBe(true);
  });

  it('charges a phase only for the one the player spends the evening on', () => {
    for (const timing of ['dawn', 'midday', 'dusk']) {
      expect(eventAdvancesPhase(at(timing)), timing).toBe(false);
    }
  });

  it('leaves events that never declared a timing exactly as they were', () => {
    const legacy = { id: 'x', day: 9, phase: 'evening', advancesPhase: true } as unknown as EventData;
    expect(eventPhase(legacy)).toBe('evening');
    expect(eventAdvancesPhase(legacy)).toBe(true);
  });
});

describe('Day 1 · 第一个早晨', () => {
  it('plays before the morning is spent and costs nothing', () => {
    expect(day1.timing).toBe('dawn');
    const event = getFixedEvent(1, 'morning', makeState());
    expect(event?.id).toBe('day1_arrival');
    expect(event?.advancesPhase).toBe(false);
  });

  it('hands the player a manor that has been waiting three weeks', () => {
    expect(day1.sceneText).toContain('你意识到他们在等你开口');
    expect(day1.sceneText).toContain('今天是十月一日。你有三十天。');
  });

  it('no longer re-introduces people the opening has already introduced', () => {
    for (const line of ['厨娘玛莎', '马夫格雷格', '女仆埃莱娜']) {
      expect(day1.sceneText, line).not.toContain(line);
    }
  });

  it('carries no dash used as a pause (brief hard rule 五)', () => {
    expect(day1.sceneText).not.toContain('—');
  });
});

describe('Day 3 · 账本的裂缝', () => {
  const event = getFixedEvent(3, 'afternoon', makeState({ day: 3 })) as EventData;

  it('turns on the fact that 霍特曼 was recording, not hiding', () => {
    expect(event.sceneText).toContain('一个想遮掩的人不会记得这么清楚');
    expect(event.sceneText).toContain('他在给什么人留一份底');
  });

  it('keeps the steward off the estate books', () => {
    expect(event.sceneText).toContain('你的报酬不在这本账上');
    expect(event.sceneText).toContain('那本账你看不到');
  });

  it('gives every branch its own prose', () => {
    for (const choice of event.choices ?? []) {
      expect(choice.resultText, choice.id).toBeTruthy();
    }
  });

  it('points the investigation at 磨岭 and nowhere else', () => {
    const investigate = event.choices?.find(c => c.id === 'investigate');
    expect(investigate?.resultText).toContain('那份契约是磨岭的');
  });

  it('states the phase cost but never the effect (GDD 11.6)', () => {
    const byId = (id: string) => event.choices?.find(c => c.id === id);
    expect(byId('investigate')?.description).toBe('1 时段');
    expect(byId('report')?.description).toBeUndefined();
    expect(byId('defer')?.description).toBeUndefined();
  });

  it('still trades renown for the lord\'s regard when the letter goes out', () => {
    const report = byIdOf(event, 'report');
    expect(report?.effects?.renown).toBe(-1);
    expect(report?.effects?.lordImpression).toBe(1);
  });

  it('drops the v2 tax-inspector countdown and the missing 5 金卢', () => {
    expect(day3.sceneText).not.toContain('凯斯勒');
    expect(day3.sceneText).not.toContain('杂项维护费');
  });
});

function byIdOf(event: EventData, id: string) {
  return event.choices?.find(c => c.id === id);
}

describe('Day 4 · 添柴', () => {
  const event = getFixedEvent(4, 'afternoon', makeState({ day: 4, phase: 'afternoon' })) as EventData;

  it('is the one who walks you into the forge-hall, and costs nothing', () => {
    expect(event.id).toBe('day4_hearth');
    expect(event.advancesPhase).toBe(false);
    expect(event.choices).toBeNull();
  });

  it('opens the room and records that you have met him', () => {
    expect(event.onEnterEffects?.flags).toEqual({ met_lorenz: true, unlockForgeChapel: true });
  });

  it('lets him tell the player about Thursday in his own words', () => {
    expect(event.sceneText).toContain('每周四晚上我在这儿守夜');
    expect(event.sceneText).toContain('也可以不来');
  });

  it('keeps the sacred institutional: someone comes and feeds the fire', () => {
    expect(event.sceneText).toContain('就是让炉子知道换人了');
  });

  it('gates the forge-hall until he has opened it', () => {
    const before = getFreeChoices(makeState({ day: 3, phase: 'evening' })).map(c => c.id);
    expect(before).not.toContain('visit_chapel');
    const after = getFreeChoices(makeState({
      day: 4, phase: 'evening', flags: { unlockForgeChapel: true },
    })).map(c => c.id);
    expect(after).toContain('visit_chapel');
  });
});
