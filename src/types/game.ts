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
  relationships?: Partial<Record<NpcId, number>>;
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
  resources: Resources;
  fatigue: number;
  relationships: Record<NpcId, number>;
  flags: FlagMap;
  currentSceneText: string;
  currentChoices: Choice[];
  activeEvent: EventData | null;
  eventResolved: boolean;
  log: LogEntry[];
  demoComplete: boolean;
  endingId: string | null;
}
