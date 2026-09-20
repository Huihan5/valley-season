import { GameState, NpcId } from '../types/game';
import { getTrust, getKnownNpcs } from './RelationSystem';
import {
  CODEX_ENTRIES, CodexCategory, CodexCondition,
} from '../data/codex';
import { SaveStorage } from './SaveSystem';
import DATA from '../data';

/**
 * 见闻 — the cross-run codex. Persistence is modelled on CollectionSystem (the
 * endings gallery): a set of unlocked keys in its own localStorage entry, kept out
 * of GameState for the same reason the gallery is — it outlives the season, and
 * tying it to a save would make branching from a slot overwrite its own history.
 *
 * A key is an entry id (`gregor`) or an entry-plus-layer id (`gregor:inside`). What
 * a run currently satisfies is unioned with what past runs recorded, so a profile
 * fills in as you play and stays filled the next time you start a season.
 */

const KEY = 'valley-season:codex';
const T = DATA.codex;

interface EntryText {
  title: string;
  subtitle?: string;
  silhouette: string;
  text?: string;
  layers?: Record<string, string>;
}
const ENTRY_TEXT = T.entries as unknown as Record<string, EntryText>;
const LAYER_LABEL = T.layerLabels as unknown as Record<string, string>;
const CATEGORY_LABEL = T.categories as unknown as Record<CodexCategory, string>;

function defaultStorage(): SaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access alone can throw under some privacy settings.
    return null;
  }
}

const hasMet = (state: GameState, npc: NpcId): boolean => getKnownNpcs(state, [npc]).length > 0;

function conditionMet(state: GameState, c: CodexCondition): boolean {
  if (c.fromStart) return true;
  if (c.met) return hasMet(state, c.met);
  if (c.trust) return getTrust(state, c.trust.npc) >= c.trust.min;
  if (c.flag) return !!state.flags[c.flag];
  return false;
}

/** Every key the current run satisfies right now: entry ids and `id:layer` ids. */
export function currentUnlocks(state: GameState): string[] {
  const keys: string[] = [];
  for (const e of CODEX_ENTRIES) {
    if (conditionMet(state, e.unlock)) keys.push(e.id);
    for (const l of e.layers ?? []) {
      if (conditionMet(state, l.unlock)) keys.push(`${e.id}:${l.id}`);
    }
  }
  return keys;
}

/**
 * The always-on baseline — `fromStart` knowledge the player is taken to hold in any
 * season. Used between runs (title screen), where there is no state to read met/trust
 * against but the baseline world facts should still show.
 */
function baselineUnlocks(): string[] {
  const keys: string[] = [];
  for (const e of CODEX_ENTRIES) {
    if (e.unlock.fromStart) keys.push(e.id);
    for (const l of e.layers ?? []) {
      if (l.unlock.fromStart) keys.push(`${e.id}:${l.id}`);
    }
  }
  return keys;
}

export function readCodex(storage = defaultStorage()): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    // A hand-edited or half-written value costs the player their codex, not their game.
    return [];
  }
}

/** Idempotent: recording keys that are already in changes nothing and never shrinks the set. */
export function recordCodex(keys: string[], storage = defaultStorage()): void {
  if (!storage || keys.length === 0) return;
  const have = new Set(readCodex(storage));
  const before = have.size;
  for (const k of keys) have.add(k);
  if (have.size === before) return;
  try {
    storage.setItem(KEY, JSON.stringify([...have]));
  } catch {
    // A full quota should not take the panel down with it.
  }
}

export function clearCodex(storage = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to do — the record stays where it was.
  }
}

/**
 * What to show now: persisted (cross-run) ∪ satisfied this run. Between seasons there
 * is no run, so `state` is null and only the persisted set shows.
 */
export function unlockedKeys(state: GameState | null, storage = defaultStorage()): Set<string> {
  const persisted = readCodex(storage);
  const live = state ? currentUnlocks(state) : baselineUnlocks();
  return new Set([...persisted, ...live]);
}

// ── View model ───────────────────────────────────────────────────────────────

export interface CodexLayerView {
  id: string;
  label: string;
  text: string;
  locked: boolean;
}

export interface CodexEntryView {
  id: string;
  unlocked: boolean;
  /** The real name/title when unlocked, the silhouette line when still locked. */
  title: string;
  subtitle: string;
  /** A lore entry's single body, only when unlocked; people carry layers instead. */
  text: string | null;
  layers: CodexLayerView[];
}

export interface CodexCategoryView {
  id: CodexCategory;
  label: string;
  entries: CodexEntryView[];
  unlockedCount: number;
  total: number;
}

const CATEGORY_ORDER: CodexCategory[] = ['people', 'marigni', 'valewisp'];

/**
 * The whole panel, grouped by shelf. A `hidden` entry that is still locked is left
 * out entirely (and out of the count); a `silhouette` one keeps its slot so the
 * "3 / 6" can show there is more to find.
 */
export function getCodex(state: GameState | null, storage = defaultStorage()): CodexCategoryView[] {
  const unlocked = unlockedKeys(state, storage);

  return CATEGORY_ORDER.map((cat) => {
    const entries: CodexEntryView[] = [];

    for (const e of CODEX_ENTRIES) {
      if (e.category !== cat) continue;
      const isUnlocked = unlocked.has(e.id);
      if (e.reveal === 'hidden' && !isUnlocked) continue;

      const t = ENTRY_TEXT[e.id];
      entries.push({
        id: e.id,
        unlocked: isUnlocked,
        title: isUnlocked ? t.title : t.silhouette,
        subtitle: isUnlocked ? (t.subtitle ?? '') : '',
        text: isUnlocked && t.text ? t.text : null,
        layers: (e.layers ?? []).map((l) => ({
          id: l.id,
          label: LAYER_LABEL[l.id] ?? l.id,
          text: t.layers?.[l.id] ?? '',
          locked: !unlocked.has(`${e.id}:${l.id}`),
        })),
      });
    }

    return {
      id: cat,
      label: CATEGORY_LABEL[cat],
      entries,
      unlockedCount: entries.filter((e) => e.unlocked).length,
      total: entries.length,
    };
  });
}
