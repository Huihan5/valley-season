import { GameState } from '../types/game';
import DATA from '../data';
import SHARED from '../data/shared/deed.json';
import { OPENING_PAGES, signLetter } from './OpeningSystem';

/**
 * The papers in the satchel that open: what the steward can read in full.
 *
 * Two of them, and they are the two the guarantee really is. The summary leaf is what the
 * steward signed for in the opening; the deed is the full text behind it, the Old Tongue
 * Original with the Common Tongue text beside it (VS-18-0947, GDD_NEXT 2.2.3). Neither is
 * state of its own. The leaf is the opening's own page, read back with the steward's name on
 * the line, so changing the page changes the paper. The deed is assembled here from two
 * places: `data/shared/deed.json` holds the Old Tongue and the order of the clauses once for
 * both languages (an invented language has no translation), and each language's
 * `documents.json` holds its Common Tongue text under the same ids.
 *
 * The one thing in the deed that moves is the registry at the foot of the signature pages:
 * the Secretariat fills it in when the papers reach its desk (the Wednesday of the first week),
 * so before that day it stands blank, as a form does.
 */

export type DocBlockKind =
  | 'masthead' | 'title' | 'masthead_small' | 'note' | 'legend'
  | 'heading' | 'lead' | 'clause' | 'party' | 'field' | 'seal'
  | 'para';

export interface DocBlock {
  id: string;
  k: DocBlockKind;
  /** Clause number or recital letter, for the gutter. */
  n?: string;
  /** The Old Tongue. Present only where the document has one. */
  old?: string;
  /** The Common Tongue; for a field, its label. Lines are separated by \n. */
  common: string;
  /** A field's value in the Common Tongue and in the Old; empty draws the blank line. */
  fill?: string;
  oldFill?: string;
}

export interface DocumentView {
  id: string;
  /** True where blocks carry an Old Tongue line, so the reader can offer to hide it. */
  bilingual: boolean;
  blocks: DocBlock[];
}

/** A clause or caption is a string; a field is its label and what has been written on it. */
type CommonText = string | { label: string; fill: string };

interface SharedBlock {
  id: string;
  k: string;
  n?: string;
  old?: string;
  oldFill?: string;
  /** The first day the entry has been made. */
  from?: number;
}

const DEED_BLOCKS = SHARED.blocks as SharedBlock[];
const DEED_COMMON = DATA.documents.deed as Record<string, CommonText>;
const OLD_BLANK = '________';

/** `{playerName}` where the name goes; the line stays blank until the steward has given one. */
function slot(text: string, state: GameState, blank: string): string {
  return text.replace(/\{playerName\}/g, state.playerName || blank);
}

function fillOf(value: string | undefined, state: GameState): string {
  if (!value) return '';
  return value === '{playerName}' ? state.playerName : value;
}

function deedView(state: GameState): DocumentView {
  const blocks = DEED_BLOCKS.map((b): DocBlock => {
    const common = DEED_COMMON[b.id];
    const kind = b.k as DocBlockKind;
    if (typeof common === 'string') {
      return {
        id: b.id,
        k: kind,
        ...(b.n ? { n: b.n } : {}),
        ...(b.old ? { old: slot(b.old, state, OLD_BLANK) } : {}),
        common: slot(common, state, DATA.ui.inventory.blank),
      };
    }
    const entered = !b.from || state.day >= b.from;
    return {
      id: b.id,
      k: kind,
      ...(b.old ? { old: b.old } : {}),
      common: common.label,
      fill: entered ? fillOf(common.fill, state) : '',
      oldFill: entered ? fillOf(b.oldFill, state) : '',
    };
  });
  return { id: 'deed', bilingual: true, blocks };
}

/** "一、担保人" in the Chinese leaf, "I. Guarantor" in the English one. */
const SECTION_HEAD = /^([一二三四五六七八九十]+、|[IVX]+\.\s)/;

/**
 * The leaf is the opening's first page, signed. Its shape is read off the text, not
 * configured: the title first, the seals last, a numbered heading above each clause.
 */
function leafView(state: GameState): DocumentView {
  const page = OPENING_PAGES.find(p => p.kind === 'letter');
  const paras = signLetter(page?.text ?? '', state.playerName).split('\n\n').filter(Boolean);
  const blocks: DocBlock[] = [];
  let inClauses = false;
  paras.forEach((para, i) => {
    const lines = para.split('\n');
    const id = `leaf_${i}`;
    if (i === 0) {
      blocks.push({ id, k: 'title', common: para });
    } else if (i === paras.length - 1) {
      blocks.push({ id, k: 'note', common: para });
    } else if (SECTION_HEAD.test(lines[0])) {
      inClauses = true;
      blocks.push({ id: `${id}_head`, k: 'heading', common: lines[0] });
      if (lines.length > 1) blocks.push({ id, k: 'para', common: lines.slice(1).join('\n') });
    } else if (!inClauses && para.length < 100) {
      blocks.push({ id, k: 'note', common: para });
    } else {
      blocks.push({ id, k: 'para', common: para });
    }
  });
  return { id: 'guarantee', bilingual: false, blocks };
}

/** The ids of the papers that open, so the satchel can mark them and a test can check each one. */
export const DOCUMENT_IDS: readonly string[] = ['guarantee', 'deed'];

export function isReadable(id: string): boolean {
  return DOCUMENT_IDS.includes(id);
}

export function getDocument(state: GameState, id: string): DocumentView | null {
  if (id === 'deed') return deedView(state);
  if (id === 'guarantee') return leafView(state);
  return null;
}
