import { GameState, Choice, ChoiceEffects, EventData, NpcId, SeasonAction, TextPart } from '../types/game';
import { generateWeather } from './WeatherSystem';
import { nextPhase, isDemoComplete } from './TimeSystem';
import { applyDailyOperatingCost, clampResources, getInsolvencyEffects } from './ResourceSystem';
import {
  getFreeChoices, getFixedEvent, getEventById, getDayEndEffects, markUnaffordableChoices,
  hasMorningFixedEvent,
} from './EventSystem';
import { rollRandomEvent, getPendingRandomEvent, markEventDay } from './RandomEventSystem';
import { determineEnding, composeEnding, opensWithHandover } from './EndingSystem';
import {
  adjustActionTrust, adjustNobleTrust, adjustLordImpression, adjustTenantTrust, recordConversation,
} from './RelationSystem';
import { INITIAL_FLAGS } from './FlagRegistry';
import { composeSceneParts, getActionResultParts, getGreetingParts } from './SceneSystem';
import { instantOf, markKnown, partsText } from './SeenSystem';
import { nextOpeningPage } from './OpeningSystem';
import {
  INITIAL_RESOURCES, INITIAL_RELATIONSHIPS, TENANT_TRUST_INITIAL, FATIGUE_EXHAUSTED_THRESHOLD,
} from '../data/config';
import DATA from '../data';
import { interpolate } from '../utils/text';
import { createRng, hashParts } from '../utils/rng';

const lines = DATA.systemLines;

/**
 * Everything the reducer accepts. The season's own actions are recorded in
 * `history`; loading a save and starting over replace the season instead.
 */
export type GameAction =
  | SeasonAction
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'RESET'; seed: number };

/** The draws of one action. Nothing in the engine calls Math.random. */
type Rng = () => number;

function applyEffects(state: GameState, effects: ChoiceEffects): GameState {
  let next = { ...state };

  if (effects.grain) next = { ...next, resources: { ...next.resources, grain: next.resources.grain + effects.grain } };
  if (effects.guldmark) next = { ...next, resources: { ...next.resources, guldmark: next.resources.guldmark + effects.guldmark } };
  if (effects.timber) next = { ...next, resources: { ...next.resources, timber: next.resources.timber + effects.timber } };
  if (effects.renown) next = { ...next, resources: { ...next.resources, renown: next.resources.renown + effects.renown } };

  // Fatigue: -99 is the sentinel for "reset to 0"
  if (effects.fatigue !== undefined) {
    next = { ...next, fatigue: effects.fatigue === -99 ? 0 : Math.max(0, Math.min(FATIGUE_EXHAUSTED_THRESHOLD, next.fatigue + effects.fatigue)) };
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
    sceneParts: undefined,
    // Filtered against the flags the event itself just set: an event may decide
    // on arrival which of its choices exist at all. Then a paid choice the player
    // cannot cover is disabled rather than silently sold at a discount.
    currentChoices: markUnaffordableChoices(
      filterChoicesByFlags(event.choices ?? [], entered.flags),
      entered.resources,
    ),
  };
}

function buildStateForPhase(state: GameState, rng: Rng): GameState {
  // What was scheduled first, then whatever the day happened to bring.
  const event = getFixedEvent(state.day, state.phase, state) ?? getPendingRandomEvent(state);
  if (event && !state.flags[`event_done_${event.id}`]) {
    return enterEvent(state, event);
  }

  const free = { ...state, activeEvent: null, eventResolved: false };
  // The scene is compared with what the same places and people said the last time they
  // were on screen, so the panel can set back what the player has already read.
  const read = markKnown(
    composeSceneParts(free, free.currentScene, rng).map(p => ({ ...p, text: interpolate(p.text, state) })),
    state.seen,
    instantOf(state),
  );
  return {
    ...free,
    seen: read.seen,
    currentSceneText: partsText(read.parts),
    sceneParts: read.anyKnown ? read.parts : undefined,
    currentChoices: getFreeChoices(free),
  };
}

export function createInitialState(seed: number): GameState {
  const rng = createRng(hashParts(seed, 0));
  const day = 1;
  const phase = 'morning' as const;
  const weather = generateWeather(day, rng);
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
    lastSpeaker: null,
    activeEvent: null,
    eventResolved: false,
    log: [],
    demoComplete: false,
    endingId: null,
    seed,
    step: 0,
    history: [],
  };
  return buildStateForPhase(baseState as GameState, rng);
}

function reduceSeason(state: GameState, action: SeasonAction, rng: Rng): GameState {
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
      let resultParts: TextPart[] | null = null;
      // Whoever the player went to see is the face on the result, however its text was
      // produced: a greeting, an action's own result, or a clue handed over. Taken from
      // the effects, not from the branch below — otherwise "lend a hand in the stable"
      // and the morning in the office, which both have results of their own, lose it.
      const speaker = (effects.conversationWith ?? effects.greetingFrom ?? null) as NpcId | null;
      // A result is read against what the same line said the last time one was shown. Each
      // action is its own moment, so it is the step that dates it: two sales in one afternoon
      // read the merchant's line twice, and the second time it is not news.
      const keyed = choice.resultParts
        ?? (choice.resultText ? null
          : choice.resultKind ? getActionResultParts(choice.resultKind, rng, choice.resultVars)
            : speaker ? getGreetingParts(next, speaker, rng) : null);
      if (keyed) {
        const read = markKnown(keyed, next.seen, (state.step ?? 0) + 1);
        result = partsText(read.parts);
        resultParts = read.anyKnown ? read.parts : null;
        next = { ...next, seen: read.seen };
      } else if (choice.resultText) {
        result = choice.resultText;
      }
      next = {
        ...next,
        lastResult: result,
        lastResultParts: resultParts,
        lastSpeaker: speaker,
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

        return commitAdvance(state, next, advancesPhase, rng);
      }

      // An action can open onto a scene — riding out to the north woods is one
      // action, but what you find there takes several beats to get through.
      const opened = chainedEvent(next, choice.nextEvent);
      if (opened) return enterEvent(next, opened);

      // Free choices cost a phase unless they are steps within one (market trades).
      return commitAdvance(state, next, choice.advancesPhase ?? true, rng);
    }

    case 'SET_PLAYER_NAME': {
      const name = action.name.trim();
      if (!name) return state;
      // During the opening the letter is still on screen — signing does not turn the page.
      if (state.openingPage !== null) return { ...state, playerName: name };
      return buildStateForPhase({ ...state, playerName: name }, rng);
    }

    case 'ADVANCE_OPENING': {
      if (state.openingPage === null) return state;
      return { ...state, openingPage: nextOpeningPage(state.openingPage) };
    }

    // Straight to Day 1. The first phase was built at init and does not read the
    // name (day1 has no {playerName}), so ending the opening early is all it takes.
    case 'SKIP_OPENING':
      return { ...state, openingPage: null };

    case 'ADVANCE_DAY_EVENT': {
      const eventId = state.activeEvent?.id;
      const doneFlag = `event_done_${eventId}`;
      // An event with no choices still obeys the phase rule: the ones that come to
      // you are free, and Day 1 leaves the player all three phases to spend.
      const advances = state.activeEvent?.advancesPhase ?? true;
      let next = { ...state, flags: { ...state.flags, [doneFlag]: true }, activeEvent: null };
      // Day 1 arrival gets a specific log entry; other narrative events log their title
      const logText = eventId === 'day1_arrival'
        ? lines.arrival
        : state.activeEvent?.title ?? lines.continue;
      next = {
        ...next,
        log: [...next.log, { day: state.day, phase: state.phase, text: logText }],
      };

      const chained = chainedEvent(next, state.activeEvent?.next);
      if (chained) return enterEvent(next, chained);

      return advances ? advancePhase(next, rng) : buildStateForPhase(next, rng);
    }

    // The 继续 after an evening action, deferred by commitAdvance: now turn the day.
    case 'COMMIT_ADVANCE':
      if (!state.pendingAdvance) return state;
      return advancePhase({ ...state, pendingAdvance: false }, rng);

    default:
      return state;
  }
}

/**
 * The one reducer. A season action runs against a generator seeded by (seed, step), so
 * the same action on the same state always draws the same numbers — and is recorded, so
 * the whole season can be run again from its seed (replaySeason).
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  // A save is a whole state, so loading one is not a merge — it is the season
  // the player left, put back exactly as it was.
  if (action.type === 'LOAD_STATE') return action.state;
  if (action.type === 'RESET') return createInitialState(action.seed);

  const step = (state.step ?? 0) + 1;
  const rng = createRng(hashParts(state.seed ?? 0, step));
  const next = reduceSeason(state, action, rng);
  if (next === state) return state; // refused: nothing happened, so nothing is recorded

  return {
    ...next,
    step,
    // A save from before recording started has no history to extend; adding one now
    // would pass off half a season as a whole one.
    history: state.history ? [...state.history, action] : undefined,
  };
}

/** The parts of a season that are rules and numbers, not words. */
function logicOf(state: GameState) {
  const { day, phase, weather, playerName, openingPage, resources, fatigue, relationships,
    conversations, nobleTrust, lordImpression, tenantTrust, flags, currentScene, pendingAdvance,
    demoComplete, endingId, step } = state;
  return JSON.stringify({
    day, phase, weather, playerName, openingPage, resources, fatigue, relationships, conversations,
    nobleTrust, lordImpression, tenantTrust, currentScene, pendingAdvance: !!pendingAdvance,
    demoComplete, endingId, step, eventId: state.activeEvent?.id ?? null,
    choiceIds: state.currentChoices.map(c => c.id),
    flags: Object.fromEntries(Object.entries(flags).sort(([a], [b]) => (a < b ? -1 : 1))),
  });
}

/**
 * Run a season again from its seed and its recorded actions, in the language the game
 * is in now. Every line of text in a saved state was resolved in whatever language it was
 * written in; the numbers and flags do not depend on language, so replaying yields the
 * same season with its words in the current one — same weather, same random events, same
 * rumours, nothing charged twice.
 *
 * Returns null when the replay cannot be trusted: no history to replay (an older save),
 * an action that is refused this time, or an end state whose rules and numbers differ
 * from the original (the game was updated since). The caller then keeps the saved state.
 */
export function replaySeason(saved: GameState): GameState | null {
  if (saved.seed === undefined || !saved.history) return null;
  let replay = createInitialState(saved.seed);
  for (const action of saved.history) {
    const next = gameReducer(replay, action);
    if (next === replay) return null;
    replay = next;
  }
  return logicOf(replay) === logicOf(saved) ? replay : null;
}

/**
 * Turn the phase — but not before the player has read what just happened. An
 * action taken in the day's last phase advances into the next morning, and the
 * day-change reset inside advancePhase clears `lastResult`. When such an action
 * left something to read, defer: hold the scene on the result with a 继续 beat
 * (rendered from `pendingAdvance`), and COMMIT_ADVANCE turns the day on the click.
 */
function commitAdvance(prev: GameState, next: GameState, advances: boolean, rng: Rng): GameState {
  if (!advances) return buildStateForPhase(next, rng);
  if (nextPhase(prev.day, prev.phase).newDay && next.lastResult) {
    return { ...next, pendingAdvance: true };
  }
  return advancePhase(next, rng);
}

function advancePhase(state: GameState, rng: Rng): GameState {
  const { day: newDay, phase: newPhase, newDay: isDayChange } = nextPhase(state.day, state.phase);

  if (isDemoComplete(newDay)) {
    const endingId = determineEnding(state);

    // The truth endings open with something the player does. The ending is already
    // decided; it is composed once the single choice of that morning has been made, and
    // that choice goes into the history like any other, so a replay plays it again.
    if (opensWithHandover(endingId) && !state.flags.event_done_ending_handover) {
      const handover = getEventById('ending_handover', state);
      if (handover) {
        return enterEvent(
          { ...state, pendingAdvance: false, lastResult: null, lastResultParts: null, lastSpeaker: null },
          handover,
        );
      }
    }

    return {
      ...state,
      demoComplete: true,
      endingId,
      currentSceneText: composeEnding(state, endingId),
      sceneParts: undefined,
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

    const weather = generateWeather(newDay, rng);
    // A new day starts back at the manor, with yesterday's result cleared away.
    next = { ...next, weather, currentScene: 'default', lastResult: null, lastResultParts: null, lastSpeaker: null };
    next = { ...next, resources: applyDailyOperatingCost(next.resources) };
    next = { ...next, resources: clampResources(next.resources, next.flags) };

    // An empty account settles once a day, and it settles downward.
    const insolvency = getInsolvencyEffects(next.resources, next.tenantTrust, !!next.flags.stewardRescueUsed);
    if (insolvency) {
      next = applyEffects(next, {
        renown: insolvency.renown,
        tenantTrust: insolvency.tenantTrust,
        guldmark: insolvency.guldmark, // only set by the rescue; undefined is a no-op
        logEntry: insolvency.logEntry,
      });
      next = {
        ...next,
        log: [...next.log, { day: newDay, phase: 'morning', text: insolvency.logEntry }],
      };
      // The one-time reprieve (D4): coin found, warning given, and the season goes
      // on. It gets the morning's lead line so the player cannot miss the warning.
      if (insolvency.rescued) {
        next = {
          ...next,
          flags: { ...next.flags, stewardRescueUsed: true },
          lastResult: lines.stewardRescue,
        };
      }
      if (insolvency.dismissed) {
        const flags = { ...next.flags, dismissedEarly: true };
        const dismissed = { ...next, flags };
        return {
          ...dismissed,
          demoComplete: true,
          endingId: 'ending1',
          currentSceneText: composeEnding(dismissed, 'ending1'),
          sceneParts: undefined,
          currentChoices: [],
          activeEvent: null,
        };
      }
    }
    // Exhausted: the body gives out and the morning's own work is lost. But a
    // fixed dawn event still happens to the steward — the messenger comes whether
    // or not they slept in — so skip the morning only when nothing is scheduled to
    // play in it. Otherwise keep the morning and let the event fire (照播).
    if (next.fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) {
      next = { ...next, fatigue: 0 };
      if (!hasMorningFixedEvent(next)) {
        next = {
          ...next,
          phase: 'afternoon',
          log: [...next.log, { day: newDay, phase: 'morning', text: lines.exhaustedMorning }],
        };
      }
    }
  }

  // 上午行动结束后判定 (GDD ch.8.2). Exhaustion eats the morning without excusing
  // the day from having something happen in it, so the roll goes by the clock.
  if (next.phase === 'afternoon') {
    const rolled = rollRandomEvent(next, rng);
    if (rolled) next = { ...next, flags: { ...next.flags, ...rolled } };
  }

  return buildStateForPhase(next, rng);
}

