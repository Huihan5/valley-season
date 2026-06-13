import { useReducer, useEffect } from 'react';
import { GameState, Choice, ChoiceEffects, NpcId } from './types/game';
import { generateWeather } from './systems/WeatherSystem';
import { nextPhase, isDemoComplete } from './systems/TimeSystem';
import { applyDailyOperatingCost, clampResources } from './systems/ResourceSystem';
import { getFreeChoices, getFixedEvent } from './systems/EventSystem';
import { determineEnding, getEndingData } from './systems/EndingSystem';
import { INITIAL_RESOURCES, INITIAL_RELATIONSHIPS, RELATION_MIN, RELATION_MAX } from './data/config';
import ScenePanel from './components/ScenePanel';
import StatusPanel from './components/StatusPanel';
import ChoicePanel from './components/ChoicePanel';

import locationsData from './data/scenes/locations.json';

type Action =
  | { type: 'MAKE_CHOICE'; choiceId: string }
  | { type: 'ADVANCE_DAY_EVENT' };

function getSceneText(state: Omit<GameState, 'currentSceneText' | 'currentChoices'>, sceneKey?: string): string {
  const key = sceneKey ?? 'default';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scenes = locationsData as any;
  return scenes[key]?.[state.phase] ?? scenes.default[state.phase];
}

function applyEffects(state: GameState, effects: ChoiceEffects): GameState {
  let next = { ...state };

  if (effects.grain) next = { ...next, resources: { ...next.resources, grain: next.resources.grain + effects.grain } };
  if (effects.guldmark) next = { ...next, resources: { ...next.resources, guldmark: next.resources.guldmark + effects.guldmark } };
  if (effects.timber) next = { ...next, resources: { ...next.resources, timber: next.resources.timber + effects.timber } };
  if (effects.renown) next = { ...next, resources: { ...next.resources, renown: next.resources.renown + effects.renown } };

  // Fatigue: -99 is the sentinel for "reset to 0"
  if (effects.fatigue !== undefined) {
    next = { ...next, fatigue: effects.fatigue === -99 ? 0 : Math.max(0, Math.min(5, next.fatigue + effects.fatigue)) };
  }

  if (effects.relationships) {
    const updatedRels = { ...next.relationships };
    for (const [npc, delta] of Object.entries(effects.relationships)) {
      const cur = updatedRels[npc as NpcId] ?? 0;
      updatedRels[npc as NpcId] = Math.max(RELATION_MIN, Math.min(RELATION_MAX, cur + (delta ?? 0)));
    }
    next = { ...next, relationships: updatedRels };
  }

  if (effects.flags) {
    next = { ...next, flags: { ...next.flags, ...effects.flags } };
  }

  next = { ...next, resources: clampResources(next.resources) };
  return next;
}

function filterChoicesByFlags(choices: Choice[], flags: GameState['flags']): Choice[] {
  return choices.filter(c => !c.requiresFlag || flags[c.requiresFlag]);
}

function buildStateForPhase(state: GameState): GameState {
  const event = getFixedEvent(state.day, state.phase, state);
  if (event && !state.flags[`event_done_${event.id}`]) {
    const withEvent = { ...state, activeEvent: event, eventResolved: false };
    const sceneText = event.sceneText;
    const choices: Choice[] = filterChoicesByFlags(event.choices ?? [], state.flags);
    return {
      ...applyEffects(withEvent, event.onEnterEffects ?? {}),
      currentSceneText: sceneText,
      currentChoices: choices,
    };
  }

  const choices = getFreeChoices(state);
  return {
    ...state,
    activeEvent: null,
    eventResolved: false,
    currentSceneText: getSceneText(state),
    currentChoices: choices,
  };
}

function createInitialState(): GameState {
  const day = 1;
  const phase = 'morning' as const;
  const weather = generateWeather(day);
  const baseState: Omit<GameState, 'currentSceneText' | 'currentChoices'> = {
    day,
    phase,
    weather,
    resources: { ...INITIAL_RESOURCES },
    fatigue: 0,
    relationships: { ...INITIAL_RELATIONSHIPS },
    flags: {},
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
  };
  return buildStateForPhase(baseState as GameState);
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'MAKE_CHOICE': {
      const choices = state.currentChoices;
      const choice = choices.find((c) => c.id === action.choiceId);
      if (!choice || choice.disabled) return state;

      const effects = choice.effects ?? {};
      let next = applyEffects(state, effects);

      const logEntry = effects.logEntry ?? choice.text;
      next = {
        ...next,
        log: [...next.log, { day: state.day, phase: state.phase, text: logEntry }],
      };

      // If this was a forced event choice, mark event done and advance
      if (state.activeEvent && !state.activeEvent.choices) {
        // No choices (Day 1 narrative) — shouldn't reach here
        return next;
      }

      if (state.activeEvent) {
        const doneFlag = `event_done_${state.activeEvent.id}`;
        const advancesPhase = state.activeEvent.advancesPhase ?? false;
        next = { ...next, flags: { ...next.flags, [doneFlag]: true }, activeEvent: null };
        return advancesPhase ? advancePhase(next) : buildStateForPhase(next);
      }

      // Free choice: advance phase
      return advancePhase(next);
    }

    case 'ADVANCE_DAY_EVENT': {
      const eventId = state.activeEvent?.id;
      const doneFlag = `event_done_${eventId}`;
      let next = { ...state, flags: { ...state.flags, [doneFlag]: true }, activeEvent: null };
      // Day 1 arrival gets a specific log entry; other narrative events log their title
      const logText = eventId === 'day1_arrival'
        ? '你到达了枫径庄园。'
        : state.activeEvent?.title ?? '继续。';
      next = {
        ...next,
        log: [...next.log, { day: state.day, phase: state.phase, text: logText }],
      };
      return advancePhase(next);
    }

    default:
      return state;
  }
}

function advancePhase(state: GameState): GameState {
  const { day: newDay, phase: newPhase, newDay: isDayChange } = nextPhase(state.day, state.phase);

  if (isDemoComplete(newDay)) {
    const endingId = determineEnding(state);
    const ending = getEndingData(endingId);
    return {
      ...state,
      demoComplete: true,
      endingId,
      currentSceneText: ending.text,
      currentChoices: [],
    };
  }

  let next: GameState = { ...state, day: newDay, phase: newPhase };

  if (isDayChange) {
    const weather = generateWeather(newDay);
    next = { ...next, weather };
    next = { ...next, resources: applyDailyOperatingCost(next.resources) };
    next = { ...next, resources: clampResources(next.resources) };
    // Exhausted: forced rest morning
    if (next.fatigue >= 5) {
      next = {
        ...next,
        fatigue: 0,
        log: [...next.log, { day: newDay, phase: 'morning', text: '你过于疲惫，整个上午都无法工作。' }],
      };
      next = { ...next, phase: 'afternoon' };
    }
  }

  return buildStateForPhase(next);
}


export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  // Day 1 has no choices — auto-show "continue" logic via ADVANCE_DAY_EVENT
  const isNarrativeOnly = state.activeEvent !== null && state.activeEvent.choices === null;

  useEffect(() => {
    document.title = `河谷季 · 第${state.day}日`;
  }, [state.day]);

  return (
    <div className="h-screen bg-bg text-game-text flex flex-col overflow-hidden p-3 gap-3">
      {/* Main content: scene (left) + status (right) */}
      <div className="flex flex-1 gap-3 min-h-0">
        <div className="flex-1 min-w-0">
          <ScenePanel state={state} />
        </div>
        <div className="w-64 shrink-0">
          <StatusPanel state={state} />
        </div>
      </div>

      {/* Choice panel (bottom) */}
      {state.demoComplete && state.endingId ? (
        <div className="bg-bg-card border border-gold-dim rounded-sm px-5 py-3 flex items-center justify-between">
          <div>
            <span className="text-gold font-serif text-sm">{getEndingData(state.endingId as Parameters<typeof getEndingData>[0]).title}</span>
            <span className="text-game-text/60 text-xs ml-3">{getEndingData(state.endingId as Parameters<typeof getEndingData>[0]).subtitle}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
          >
            重新开始
          </button>
        </div>
      ) : isNarrativeOnly ? (
        <div className="bg-bg-card border border-game-border rounded-sm px-4 py-3 flex justify-center">
          <button
            onClick={() => dispatch({ type: 'ADVANCE_DAY_EVENT' })}
            className="px-8 py-2.5 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
          >
            继续 →
          </button>
        </div>
      ) : (
        <div key={`${state.day}-${state.phase}`} className="choices-enter">
          <ChoicePanel
            choices={state.currentChoices}
            onChoice={(id) => dispatch({ type: 'MAKE_CHOICE', choiceId: id })}
          />
        </div>
      )}
    </div>
  );
}
