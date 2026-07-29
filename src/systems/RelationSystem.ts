import { GameState, NpcId } from '../types/game';
import {
  RELATION_MIN,
  RELATION_MAX,
  TALKS_PER_TRUST_POINT,
  TALK_TRUST_CAP,
  NOBLE_TRUST_MIN,
  NOBLE_TRUST_MAX,
  LORD_IMPRESSION_MIN,
  LORD_IMPRESSION_MAX,
  TENANT_TRUST_MIN,
  TENANT_TRUST_MAX,
  MARTA_TENANT_SWING,
} from '../data/config';

/**
 * Trust comes in two layers (GDD ch.5.5).
 *
 * Conversational trust rewards visiting people at all, but caps early — a player
 * who only ever talks stalls at +2 and reaches no clue fragment. Action trust
 * comes from decisions and carries the rest of the way to +5.
 */

type TrustCounts = Record<NpcId, number>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Trust earned by decisions and deeds. */
export function getActionTrust(state: GameState, npc: NpcId): number {
  return state.relationships[npc] ?? 0;
}

/** Trust earned by showing up and talking, capped low on purpose. */
export function getTalkTrust(state: GameState, npc: NpcId): number {
  const talks = state.conversations[npc] ?? 0;
  return Math.min(TALK_TRUST_CAP, Math.floor(talks / TALKS_PER_TRUST_POINT));
}

/** What every threshold in the game reads: both layers, clamped to the -5..+5 range. */
export function getTrust(state: GameState, npc: NpcId): number {
  return clamp(getActionTrust(state, npc) + getTalkTrust(state, npc), RELATION_MIN, RELATION_MAX);
}

/** Records one effective conversation, returning the updated counts. */
export function recordConversation(counts: TrustCounts, npc: NpcId): TrustCounts {
  return { ...counts, [npc]: (counts[npc] ?? 0) + 1 };
}

/** How many more conversations before the talk layer yields another point. */
export function talksUntilNextPoint(state: GameState, npc: NpcId): number | null {
  if (getTalkTrust(state, npc) >= TALK_TRUST_CAP) return null;
  const talks = state.conversations[npc] ?? 0;
  return TALKS_PER_TRUST_POINT - (talks % TALKS_PER_TRUST_POINT);
}

export function adjustActionTrust(current: number, delta: number): number {
  return clamp(current + delta, RELATION_MIN, RELATION_MAX);
}

// ── 贵族信任 / 领主印象 ─────────────────────────────────────────────────────

export function adjustNobleTrust(current: number, delta: number): number {
  return clamp(current + delta, NOBLE_TRUST_MIN, NOBLE_TRUST_MAX);
}

export function adjustLordImpression(current: number, delta: number): number {
  return clamp(current + delta, LORD_IMPRESSION_MIN, LORD_IMPRESSION_MAX);
}

export function adjustTenantTrust(current: number, delta: number): number {
  return clamp(current + delta, TENANT_TRUST_MIN, TENANT_TRUST_MAX);
}

// ── 信任档位 ────────────────────────────────────────────────────────────────

export type TrustTier = 'estranged' | 'cold' | 'neutral' | 'accepted' | 'trusted' | 'embraced';

/** Six tiers, used to pick greetings and to gate the estate's clue fragments. */
export function getTrustTier(value: number): TrustTier {
  if (value <= -3) return 'estranged';
  if (value <= -1) return 'cold';
  if (value === 0) return 'neutral';
  if (value <= 2) return 'accepted';
  if (value <= 4) return 'trusted';
  return 'embraced';
}

export function getTrustTierFor(state: GameState, npc: NpcId): TrustTier {
  return getTrustTier(getTrust(state, npc));
}

/**
 * 佃户整体信任 as the tenants actually hold it. 玛莎 cooks for them and speaks
 * for them, so where she stands shifts the whole household by a point either
 * way (GDD 5.5). The stored value never moves; what she is worth is added here.
 */
export function getEffectiveTenantTrust(state: GameState): number {
  const marta = getTrust(state, 'marta');
  const martaShift = marta >= MARTA_TENANT_SWING ? 1 : marta <= -MARTA_TENANT_SWING ? -1 : 0;
  return clamp(state.tenantTrust + martaShift, TENANT_TRUST_MIN, TENANT_TRUST_MAX);
}

/**
 * Whether the player has met this person yet (PlaytestFeedback 2.h). A name in the
 * right-hand column before you have laid eyes on its owner is a list of people you
 * are expected to manage; the estate is supposed to arrive one person at a time.
 *
 * The three who live here are at the gate on Day 1. 洛伦茨 comes with the
 * forge-hall on Day 4. The two nobles are met at the Thorn Wall dinner, or in
 * hunt season if the dinner was skipped — or, failing both, by whatever gift or
 * errand first put their name on the ledger.
 */
const RESIDENTS: NpcId[] = ['gregor', 'marta', 'elena'];

const MET_BY_FLAG: Partial<Record<NpcId, string[]>> = {
  lorenz: ['unlockForgeChapel'],
  marguerite: ['attendedDinner', 'huntAttendedDay18'],
  henk: ['attendedDinner', 'huntAttendedDay18'],
};

export function isNpcKnown(state: GameState, npc: NpcId): boolean {
  if (RESIDENTS.includes(npc)) return true;
  if (MET_BY_FLAG[npc]?.some(flag => !!state.flags[flag])) return true;
  return (state.conversations[npc] ?? 0) > 0 || (state.relationships[npc] ?? 0) !== 0;
}

export function getKnownNpcs(state: GameState, order: NpcId[]): NpcId[] {
  return order.filter(npc => isNpcKnown(state, npc));
}

/** How many NPCs have reached at least this much trust — used by the ending check. */
export function countTrustAtLeast(state: GameState, threshold: number): number {
  return (Object.keys(state.relationships) as NpcId[])
    .filter(npc => getTrust(state, npc) >= threshold)
    .length;
}
