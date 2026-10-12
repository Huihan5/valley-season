import { Choice, FlagMap, OpeningPage } from '../types/game';
import DATA from '../data';

const openingData = DATA.opening;

export const OPENING_PAGES = (openingData.pages ?? []) as OpeningPage[];

/** The blank the player signs on: six full-width underscores in the Chinese letter, six plain ones in the English. */
const SIGNATURE_BLANK = /＿{6}|_{6}/;

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

/** Whether the page ends on a question the player answers (the Baron's, on the second page of Forgehold). */
export function isQuestion(page: OpeningPage | null): boolean {
  return page?.kind === 'question' && !!page.choices?.length;
}

/**
 * The answer already given on a question page, read back off the flags it wrote, so the page
 * needs no state of its own: a loaded save, a replay and a change of language all find it.
 */
export function answeredChoice(page: OpeningPage | null, flags: FlagMap): Choice | null {
  if (!isQuestion(page)) return null;
  return page!.choices!.find(choice => {
    const written = Object.entries(choice.effects?.flags ?? {});
    return written.length > 0 && written.every(([key, value]) => flags[key] === value);
  }) ?? null;
}

/**
 * What the page says. A question page says its question until it is answered; then it says
 * the answer, and goes on.
 */
export function openingBody(page: OpeningPage, flags: FlagMap): string {
  const answer = answeredChoice(page, flags);
  if (!answer) return page.text;
  return [page.text, answer.resultText, page.variants?.after_answer].filter(Boolean).join('\n\n');
}
