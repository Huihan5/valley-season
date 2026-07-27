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
  flags?: FlagMap;
  nextScene?: string;
  logEntry?: string;
}

export interface Choice {
  id: string;
  text: string;
  description: string;
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
}

/** A prompt for the game's only free-text input: the signature on the Day 0 guarantee letter. */
export interface TextInputSpec {
  target: 'playerName';
  label: string;
  placeholder: string;
  maxLength: number;
}

export interface DialogueLine {
  speaker: NpcId;
  text: string;
}

export interface ConditionalParagraph {
  condition: string;
  text: string;
}

export interface EventData {
  id: string;
  day: number;
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
  flags: FlagMap;
  currentSceneText: string;
  currentChoices: Choice[];
  activeEvent: EventData | null;
  eventResolved: boolean;
  log: LogEntry[];
  demoComplete: boolean;
  endingId: string | null;
}
