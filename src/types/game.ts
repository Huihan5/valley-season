export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'frost' | 'fog';
export type DayPhase = 'morning' | 'afternoon' | 'evening';
export type NpcId = 'gregor' | 'marta' | 'elena' | 'marguerite' | 'henk' | 'lorenz';

export interface Resources {
  grain: number;
  guldmark: number;
  timber: number;
  renown: number;
}

export type RelationshipMap = Partial<Record<NpcId, number>>;
export type FlagMap = Record<string, boolean | string | number>;

export interface ChoiceEffects {
  grain?: number;
  guldmark?: number;
  timber?: number;
  renown?: number;
  fatigue?: number;
  /** Action trust — one-off, awarded for decisions rather than for talking. */
  relationships?: Partial<Record<NpcId, number>>;
  /** Conversational trust — counts one effective conversation with this NPC. */
  conversationWith?: NpcId;
  /**
   * Whose greeting to show without counting it. Seeing someone is not the same as
   * an effective conversation: 格雷格 will tell you where you stand and change
   * nothing by it, because he does not decide about people by talking to them.
   */
  greetingFrom?: NpcId;
  nobleTrust?: number;
  lordImpression?: number;
  tenantTrust?: number;
  flags?: FlagMap;
  nextScene?: string;
  logEntry?: string;
}

export interface Choice {
  id: string;
  text: string;
  /**
   * Mechanical microcopy — cost and effect, never narration (GDD 11.6). Judgment
   * choices inside events carry none: spelling out the effect gives the answer away.
   */
  description?: string;
  effects?: ChoiceEffects;
  requiresWeather?: WeatherType[];
  requiresFlag?: string;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Whether picking this choice consumes a phase. Free choices default to true,
   * event choices to the event's own setting (insert events cost nothing).
   */
  advancesPhase?: boolean;
  /** Key into action_results.json — the narrative shown after the action resolves. */
  resultKind?: string;
  /** Branch prose written for this one choice, shown once the event has resolved. */
  resultText?: string;
  /**
   * `resultText` again, split into the lines the difference hints compare (the market's
   * results). It joins to `resultText`, which stays for everything that wants only the words.
   */
  resultParts?: KeyedPart[];
  /** Continue the scene at this event instead of returning to the day. */
  nextEvent?: string;
  /** Placeholder values for that result text, e.g. the yield the player just brought in. */
  resultVars?: Record<string, string | number>;
}

/** A prompt for the game's only free-text input: the signature on the Day 0 guarantee letter. */
export interface TextInputSpec {
  target: 'playerName';
  label: string;
  placeholder: string;
  maxLength: number;
}

/**
 * One screen of the Day 0 opening. The letter page is where the player signs;
 * the rest are prose, grouped into the four acts of the journey.
 */
export interface OpeningPage {
  id: string;
  kind: 'letter' | 'scene';
  act: string;
  heading: string;
  text: string;
}

export interface DialogueLine {
  speaker: NpcId;
  text: string;
}

export interface ConditionalParagraph {
  condition: string;
  text: string;
}

/**
 * When in the day an event lands, in the drafts' own vocabulary (§04):
 * 上午前 before the morning is spent, 日中 between morning and afternoon,
 * 入夜前 between afternoon and evening, 晚间 inside the evening itself.
 * Only 晚间 costs the player a phase — the rest come to you, so they are free.
 */
export type EventTiming = 'dawn' | 'midday' | 'dusk' | 'evening';

export interface EventData {
  id: string;
  day: number;
  timing?: EventTiming;
  phase?: DayPhase;
  forced: boolean;
  title: string;
  sceneImage?: string;
  dialogue?: DialogueLine;
  sceneText: string;
  choices: Choice[] | null;
  onEnterEffects?: ChoiceEffects;
  activationFlag?: string;
  advancesPhase?: boolean;
  /**
   * The next beat of the same scene. A dinner is one outing but several
   * decisions; the phase is charged once, at the end of the chain.
   */
  next?: string;
  textInput?: TextInputSpec;
  /**
   * Prose blocks the event's processor chooses between — the information layer
   * a petition opens up, the tier a conversation lands in. Content stays here;
   * only the choosing lives in the system.
   */
  variants?: Record<string, string>;
  /**
   * Conditions on those variants, for the ones that only make sense on some days:
   * a rain that lets up needs rain to have fallen; an end-of-day summary belongs to
   * dusk, not midday. Variants without a rule fit anywhere the event does.
   */
  variantRules?: Record<string, { weather?: WeatherType[]; timing?: EventTiming }>;
  letterOpening?: string;
  letterParagraphs?: ConditionalParagraph[];
  letterClosing?: string;
}

export interface LogEntry {
  day: number;
  phase: DayPhase;
  text: string;
}

/**
 * What a player can do to a season. Every one of these is recorded in
 * `GameState.history`, and replaying them from the season's seed rebuilds the season.
 */
export type SeasonAction =
  | { type: 'MAKE_CHOICE'; choiceId: string }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'ADVANCE_OPENING' }
  | { type: 'SKIP_OPENING' }
  | { type: 'ADVANCE_DAY_EVENT' }
  | { type: 'COMMIT_ADVANCE' };

/**
 * A stretch of prose as the engine composed it. A part with a `slot` is a line whose
 * wording rests on a state of the world (the act, how far the trust has come, how bare
 * the woods are), and `key` names that state; a part without one is a random draw, which
 * differs from visit to visit by design and is never compared.
 */
export interface KeyedPart {
  text: string;
  slot?: string;
  key?: string;
}

/** Prose after the comparison: `known` when the player has already read this very thing here. */
export interface TextPart {
  text: string;
  known?: boolean;
}

/**
 * What a slot said the last time it was on screen. `at` is the day-and-phase it was shown
 * in; `before` is what it said before that, so that composing the same moment twice (a
 * market trade does not move the clock) gives the same answer both times.
 */
export interface SeenRecord {
  key: string;
  at: number;
  before: string | null;
}

export interface GameState {
  day: number;
  phase: DayPhase;
  weather: WeatherType;
  /** Signed by the player on the Day 0 guarantee letter; empty until then. */
  playerName: string;
  /** Which page of the Day 0 opening is showing; null once the season has begun. */
  openingPage: number | null;
  resources: Resources;
  fatigue: number;
  /** Action trust only. Effective trust adds the conversational layer — see RelationSystem. */
  relationships: Record<NpcId, number>;
  /** Count of effective conversations per NPC, feeding the conversational trust layer. */
  conversations: Record<NpcId, number>;
  /** 贵族信任 0-3. Social acceptance by the peerage; 玛格丽特 is the gatekeeper. */
  nobleTrust: number;
  /** 领主印象 0-3. Changes how 路德维希 speaks and buys one margin of error at the 留任线. */
  lordImpression: number;
  /** 佃户整体信任 -5..+5. Gates the tenant meeting, which is the only route to efficiency 7. */
  tenantTrust: number;
  flags: FlagMap;
  currentSceneText: string;
  /** Where the player currently is; drives which location base and 闲笔 pool is used. */
  currentScene: string;
  /** What just happened, shown above the scene until the next action replaces it. */
  lastResult: string | null;
  /**
   * Whose voice `lastResult` is, when it is a greeting — so the scene can show a
   * face and a name (PlaytestFeedback 2026-09 / P15). Null when what just happened
   * was not someone speaking to the player.
   */
  lastSpeaker?: NpcId | null;
  /**
   * `currentSceneText` and `lastResult` again, split where the player has read the
   * same thing here before (difference hints: the panel sets those stretches back). Set
   * only when something in the text is known; their text joins to the string they
   * annotate, and a panel that finds they do not has been handed a stale pair and shows
   * the plain string.
   */
  sceneParts?: TextPart[];
  lastResultParts?: TextPart[] | null;
  /** Per slot, what it said when last shown. Absent on saves from before the hints. */
  seen?: Record<string, SeenRecord>;
  currentChoices: Choice[];
  /**
   * An action taken in the last phase of a day advances straight into the next
   * morning, whose day-change reset clears `lastResult` before it can render. When
   * that action leaves something to read, the advance is deferred and this is set:
   * the scene holds on the result with a 继续 beat, and COMMIT_ADVANCE turns the day.
   */
  pendingAdvance?: boolean;
  activeEvent: EventData | null;
  eventResolved: boolean;
  log: LogEntry[];
  demoComplete: boolean;
  endingId: string | null;
  /**
   * The season's seed. Every random draw comes from it, so a season is a function of
   * (seed, history). Absent on saves from before seeding; those cannot be replayed.
   */
  seed?: number;
  /** Actions taken so far; the draws of action n come from (seed, n). */
  step?: number;
  /**
   * Everything the player did, in order. Every line of text in the state was resolved
   * in one language when it was built; replaying this under the other language rebuilds
   * the same season in the new one (GameEngine.replaySeason). Undefined on older saves.
   */
  history?: SeasonAction[];
}
