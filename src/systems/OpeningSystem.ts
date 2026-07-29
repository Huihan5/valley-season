import { OpeningPage } from '../types/game';
import DATA from '../data';

const openingData = DATA.opening;

export const OPENING_PAGES = (openingData.pages ?? []) as OpeningPage[];

/** The blank the player signs on. */
const SIGNATURE_BLANK = '＿＿＿＿＿＿';

export function getOpeningPage(index: number): OpeningPage | null {
  return OPENING_PAGES[index] ?? null;
}

/**
 * The next page, or null when the opening is over and the season starts.
 */
export function nextOpeningPage(index: number): number | null {
  const next = index + 1;
  return next < OPENING_PAGES.length ? next : null;
}

/** The letter cannot be turned past until it has been signed. */
export function requiresSignature(page: OpeningPage | null): boolean {
  return page?.kind === 'letter';
}

/**
 * Puts the player's name on the dotted line. The letter is stored as it was
 * drafted, blank and all, and the name goes in only when it has been given.
 */
export function signLetter(text: string, playerName: string): string {
  return playerName ? text.replace(SIGNATURE_BLANK, playerName) : text;
}
