import { Choice } from '../types/game';

/**
 * The colour-coded effect cue on a choice (PlaytestFeedback 2026-09 / D11, P7).
 * A player should be able to tell at a glance what an action spends and what it
 * brings in, without reading a line of microcopy — costs in rust, gains in gold.
 *
 * This reads the resources off `choice.effects` only. Trust and standing are left
 * to the microcopy and are never shown as numbers (D3); the exact grain/timber a
 * work action brings in stays hidden behind its tier word (the yield is a band,
 * not a promise — GDD 5.4 / PlaytestFeedback 4.b), so those gains are suppressed.
 */

export type ChipTone = 'cost' | 'gain';

export interface EffectChip {
  key: string;
  icon: string;
  /** '+' or '−' (a real minus glyph, not a hyphen). */
  sign: string;
  value: number;
  tone: ChipTone;
}

const ICONS: Record<string, string> = {
  grain: '🌾',
  timber: '🪵',
  guldmark: '🪙',
  renown: '⭐',
};

// Work actions whose yield is shown as a tier, not a number: their positive grain
// or timber must not be spelled out here or the estimate stops being an estimate.
const TIER_ESTIMATED = new Set(['harvest', 'fell_timber']);

/**
 * True when the choice's yield hides behind a tier word rather than a chip. The tier
 * word is then the only cue that the action pays at all, so the panel tints it to
 * read as a gain (D11 polish, 2026-09).
 */
export function hasEstimatedYield(choice: Choice): boolean {
  return choice.resultKind ? TIER_ESTIMATED.has(choice.resultKind) : false;
}

/**
 * The resource chips for a choice, in a fixed order. A judgment choice (no
 * microcopy) returns none — spelling out its effect would give the answer away
 * (GDD 11.6) — so callers should only chip choices that already carry a description.
 */
export function getEffectChips(choice: Choice): EffectChip[] {
  const e = choice.effects;
  if (!e) return [];
  const estimatedYield = hasEstimatedYield(choice);

  const chips: EffectChip[] = [];
  const push = (key: string, value: number | undefined, suppressGain = false) => {
    if (!value) return;
    if (value > 0 && suppressGain) return;
    chips.push({
      key,
      icon: ICONS[key],
      sign: value > 0 ? '+' : '−',
      value: Math.abs(value),
      tone: value > 0 ? 'gain' : 'cost',
    });
  };

  push('grain', e.grain, estimatedYield);
  push('timber', e.timber, estimatedYield);
  push('guldmark', e.guldmark);
  push('renown', e.renown);
  return chips;
}
