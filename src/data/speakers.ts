/**
 * Everyone whose spoken lines can carry a mark in the prose (see utils/speech.ts). Wider
 * than the six people the relationship system tracks: 提莫西, 蒂埃里, 维特 and the rest speak
 * without having a trust value. Names are in `ui.speakers`; a portrait, where there is
 * one, is picked up by the panel that draws it.
 */
export const SPEAKER_IDS = [
  'gregor', 'marta', 'elena', 'lorenz', 'henk', 'marguerite',
  'timothy', 'thierry', 'wynter', 'ludwig', 'duke', 'hartmann', 'wende',
] as const;

export type SpeakerId = typeof SPEAKER_IDS[number];

export function isSpeakerId(value: string): value is SpeakerId {
  return (SPEAKER_IDS as readonly string[]).includes(value);
}
