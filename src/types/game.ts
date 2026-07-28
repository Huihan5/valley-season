export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'frost' | 'fog';
export type DayPhase = 'morning' | 'afternoon' | 'evening';
export type NpcId = 'gregor' | 'marta' | 'lena' | 'elke' | 'henk' | 'lorenz';

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
  textInput?: TextInputSpec;
  letterOpening?: string;
  letterParagraphs?: ConditionalParagraph[];
  letterClosing?: string;
}

export interface LogEntry {
  day: number;
  phase: DayPhase;
  text: string;
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
  currentChoices: Choice[];
  activeEvent: EventData | null;
  eventResolved: boolean;
  log: LogEntry[];
  demoComplete: boolean;
  endingId: string | null;
}
