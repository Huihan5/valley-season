import { useReducer, useEffect } from 'react';
import { GameState, Choice, ChoiceEffects, EventData, NpcId } from './types/game';
import { generateWeather } from './systems/WeatherSystem';
import { nextPhase, isDemoComplete } from './systems/TimeSystem';
import { applyDailyOperatingCost, clampResources } from './systems/ResourceSystem';
import { getFreeChoices, getFixedEvent, getEventById, getDayEndEffects } from './systems/EventSystem';
import { rollRandomEvent, getPendingRandomEvent, markEventDay } from './systems/RandomEventSystem';
import { determineEnding, getEndingData, composeEnding, EndingId } from './systems/EndingSystem';
import {
  adjustActionTrust, adjustNobleTrust, adjustLordImpression, adjustTenantTrust, recordConversation,
} from './systems/RelationSystem';
import { INITIAL_FLAGS } from './systems/FlagRegistry';
import { getOpeningPage, nextOpeningPage } from './systems/OpeningSystem';
import { composeScene, getActionResult, getGreeting } from './systems/SceneSystem';
import { INITIAL_RESOURCES, INITIAL_RELATIONSHIPS, TENANT_TRUST_INITIAL } from './data/config';
import { interpolate } from './utils/text';
import ScenePanel from './components/ScenePanel';
import StatusPanel from './components/StatusPanel';
import ChoicePanel from './components/ChoicePanel';
import NameInput from './components/common/NameInput';
import EstateTaskList from './components/common/EstateTaskList';
import OpeningSequence from './components/OpeningSequence';


type Action =
  | { type: 'MAKE_CHOICE'; choiceId: string }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'ADVANCE_OPENING' }
  | { type: 'ADVANCE_DAY_EVENT' };

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
      updatedRels[npc as NpcId] = adjustActionTrust(updatedRels[npc as NpcId] ?? 0, delta ?? 0);
    }
    next = { ...next, relationships: updatedRels };
  }

  if (effects.conversationWith) {
    next = { ...next, conversations: recordConversation(next.conversations, effects.conversationWith) };
  }

  if (effects.nobleTrust) {
    next = { ...next, nobleTrust: adjustNobleTrust(next.nobleTrust, effects.nobleTrust) };
  }

  if (effects.lordImpression) {
    next = { ...next, lordImpression: adjustLordImpression(next.lordImpression, effects.lordImpression) };
  }

  if (effects.tenantTrust) {
    next = { ...next, tenantTrust: adjustTenantTrust(next.tenantTrust, effects.tenantTrust) };
  }

  if (effects.flags) {
    next = { ...next, flags: { ...next.flags, ...effects.flags } };
  }

  next = { ...next, resources: clampResources(next.resources, next.flags) };
  return next;
}

function filterChoicesByFlags(choices: Choice[], flags: GameState['flags']): Choice[] {
  return choices.filter(c => !c.requiresFlag || flags[c.requiresFlag]);
}

function chainedEvent(state: GameState, id: string | undefined): EventData | null {
  return id ? getEventById(id, state) : null;
}

/** Put an event on screen: its own text, its own choices, its arrival effects. */
function enterEvent(state: GameState, event: EventData): GameState {
  const withEvent = {
    ...state,
    activeEvent: event,
    eventResolved: false,
    flags: markEventDay(state.flags, state.day),
  };
  const entered = applyEffects(withEvent, event.onEnterEffects ?? {});
  return {
    ...entered,
    currentSceneText: interpolate(event.sceneText, state),
    // Filtered against the flags the event itself just set: an event may decide
    // on arrival which of its choices exist at all.
    currentChoices: filterChoicesByFlags(event.choices ?? [], entered.flags),
  };
}

function buildStateForPhase(state: GameState): GameState {
  // What was scheduled first, then whatever the day happened to bring.
  const event = getFixedEvent(state.day, state.phase, state) ?? getPendingRandomEvent(state);
  if (event && !state.flags[`event_done_${event.id}`]) {
    return enterEvent(state, event);
  }

  const free = { ...state, activeEvent: null, eventResolved: false };
  return {
    ...free,
    currentSceneText: interpolate(composeScene(free, free.currentScene, Math.random), state),
    currentChoices: getFreeChoices(free),
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
    playerName: '',
    openingPage: 0,
    resources: { ...INITIAL_RESOURCES },
    fatigue: 0,
    relationships: { ...INITIAL_RELATIONSHIPS },
    conversations: { gregor: 0, marta: 0, elena: 0, marguerite: 0, henk: 0, lorenz: 0 },
    nobleTrust: 0,
    lordImpression: 0,
    tenantTrust: TENANT_TRUST_INITIAL,
    flags: { ...INITIAL_FLAGS },
    currentScene: 'default',
    lastResult: null,
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

      // What the player sees happened: an action's result text, or the greeting of
      // whoever they went to see. Trust is read after the visit is recorded.
      let result: string | null = null;
      if (choice.resultText) {
        result = choice.resultText;
      } else if (choice.resultKind) {
        result = getActionResult(choice.resultKind, Math.random, choice.resultVars);
      } else if (effects.conversationWith || effects.greetingFrom) {
        const npc = (effects.conversationWith ?? effects.greetingFrom) as NpcId;
        result = getGreeting(next, npc, Math.random);
      }
      next = {
        ...next,
        lastResult: result,
        currentScene: effects.nextScene ?? next.currentScene,
      };

      const logEntry = interpolate(effects.logEntry ?? choice.text, next);
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
        // Insert events cost nothing; a choice may still charge a phase for itself.
        const advancesPhase = choice.advancesPhase ?? state.activeEvent.advancesPhase ?? false;
        next = { ...next, flags: { ...next.flags, [doneFlag]: true }, activeEvent: null };

        // A chained scene keeps going: the phase is charged once, at the end.
        const chained = chainedEvent(next, choice.nextEvent ?? state.activeEvent.next);
        if (chained) return enterEvent(next, chained);

        return advancesPhase ? advancePhase(next) : buildStateForPhase(next);
      }

      // An action can open onto a scene — riding out to the north woods is one
      // action, but what you find there takes several beats to get through.
      const opened = chainedEvent(next, choice.nextEvent);
      if (opened) return enterEvent(next, opened);

      // Free choices cost a phase unless they are steps within one (market trades).
      return (choice.advancesPhase ?? true) ? advancePhase(next) : buildStateForPhase(next);
    }

    case 'SET_PLAYER_NAME': {
      const name = action.name.trim();
      if (!name) return state;
      // During the opening the letter is still on screen — signing does not turn the page.
      if (state.openingPage !== null) return { ...state, playerName: name };
      return buildStateForPhase({ ...state, playerName: name });
    }

    case 'ADVANCE_OPENING': {
      if (state.openingPage === null) return state;
      return { ...state, openingPage: nextOpeningPage(state.openingPage) };
    }

    case 'ADVANCE_DAY_EVENT': {
      const eventId = state.activeEvent?.id;
      const doneFlag = `event_done_${eventId}`;
      // An event with no choices still obeys the phase rule: the ones that come to
      // you are free, and Day 1 leaves the player all three phases to spend.
      const advances = state.activeEvent?.advancesPhase ?? true;
      let next = { ...state, flags: { ...state.flags, [doneFlag]: true }, activeEvent: null };
      // Day 1 arrival gets a specific log entry; other narrative events log their title
      const logText = eventId === 'day1_arrival'
        ? '你到达了枫径庄园。'
        : state.activeEvent?.title ?? '继续。';
      next = {
        ...next,
        log: [...next.log, { day: state.day, phase: state.phase, text: logText }],
      };

      const chained = chainedEvent(next, state.activeEvent?.next);
      if (chained) return enterEvent(next, chained);

      return advances ? advancePhase(next) : buildStateForPhase(next);
    }

    default:
      return state;
  }
}

function advancePhase(state: GameState): GameState {
  const { day: newDay, phase: newPhase, newDay: isDayChange } = nextPhase(state.day, state.phase);

  if (isDemoComplete(newDay)) {
    const endingId = determineEnding(state);
    return {
      ...state,
      demoComplete: true,
      endingId,
      currentSceneText: composeEnding(state, endingId),
      currentChoices: [],
    };
  }

  let next: GameState = { ...state, day: newDay, phase: newPhase };

  if (isDayChange) {
    // Some days present a bill on their way out — see getDayEndEffects.
    const closing = getDayEndEffects(state);
    if (closing) {
      const closed = applyEffects(state, closing);
      next = {
        ...next,
        resources: closed.resources,
        flags: closed.flags,
        log: [...next.log, { day: state.day, phase: 'evening', text: closing.logEntry ?? '' }],
      };
    }

    const weather = generateWeather(newDay);
    // A new day starts back at the manor, with yesterday's result cleared away.
    next = { ...next, weather, currentScene: 'default', lastResult: null };
    next = { ...next, resources: applyDailyOperatingCost(next.resources) };
    next = { ...next, resources: clampResources(next.resources, next.flags) };
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

  // 上午行动结束后判定 (GDD ch.8.2). Exhaustion eats the morning without excusing
  // the day from having something happen in it, so the roll goes by the clock.
  if (next.phase === 'afternoon') {
    const rolled = rollRandomEvent(next, Math.random);
    if (rolled) next = { ...next, flags: { ...next.flags, ...rolled } };
  }

  return buildStateForPhase(next);
}


export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  // An event with nothing to decide gets a "继续" — either because it never had
  // choices, or because none of them apply to this playthrough.
  const isNarrativeOnly = state.activeEvent !== null && state.currentChoices.length === 0;

  // An event may ask for the signature before its choices become available.
  const pendingInput = state.activeEvent?.textInput && !state.playerName
    ? state.activeEvent.textInput
    : null;

  useEffect(() => {
    document.title = `河谷季 · 第${state.day}日`;
  }, [state.day]);

  const openingPage = state.openingPage === null ? null : getOpeningPage(state.openingPage);
  if (openingPage) {
    return (
      <OpeningSequence
        page={openingPage}
        index={state.openingPage as number}
        playerName={state.playerName}
        onSign={(name) => dispatch({ type: 'SET_PLAYER_NAME', name })}
        onAdvance={() => dispatch({ type: 'ADVANCE_OPENING' })}
      />
    );
  }

  return (
    <div className="h-screen bg-bg text-game-text flex flex-col overflow-hidden p-3 gap-3">
      {/* Main content: scene (left) + status (right) */}
      <div className="flex flex-1 gap-3 min-h-0">
        <div className="w-48 shrink-0 hidden lg:block">
          <EstateTaskList state={state} />
        </div>
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
            <span className="text-gold font-serif text-sm">{getEndingData(state.endingId as EndingId).title}</span>
            <span className="text-game-text/60 text-xs ml-3">{getEndingData(state.endingId as EndingId).subtitle}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
          >
            重新开始
          </button>
        </div>
      ) : pendingInput ? (
        <NameInput
          spec={pendingInput}
          onSubmit={(name) => dispatch({ type: 'SET_PLAYER_NAME', name })}
        />
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
