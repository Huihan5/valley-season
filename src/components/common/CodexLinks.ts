import { createContext } from 'react';

/**
 * What a face or a name in the reading can open. Given a person's id it returns the function
 * that opens that person's page in the 见闻, or null when there is nothing to open: the codex has
 * no page for them (Timothy, Thierry, the duke), or the player does not hold the page yet. A
 * click never opens a layer that was not already open, so it gives nothing away.
 *
 * The context is provided once by App; outside it (the opening sequence, a test) there is no
 * link and a speaker is just a name.
 */
export type CodexLink = (who: string) => (() => void) | null;

export const CodexLinks = createContext<CodexLink | null>(null);
