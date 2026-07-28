import { GameState } from '../types/game';
import endingsData from '../data/endings/endings.json';

export type EndingId = 'ending1' | 'ending2' | 'ending3' | 'ending4' | 'ending5';

export interface EndingData {
  id: string;
  title: string;
  subtitle: string;
  text: string;
}

// Priority order per docs/NUMBERS.md §6 — SUPERSEDED by GDD v3 ch.10.1, rewritten in Stage 5
export function determineEnding(state: GameState): EndingId {
  const { grain, guldmark, renown } = state.resources;
  const { flags, relationships } = state;

  const deepTrustCount = Object.values(relationships).filter(v => v >= 3).length;

  // 霍特曼 chain. v3 retired the woodland symbols and the night spent researching
  // them; the evidence is now the stumps and what 蒂埃里 measured on them. This
  // whole determination is rewritten in Stage 5 — see docs/V3_BUILD_BRIEF.md.
  const hartmannChainComplete = !!(
    flags.investigatedLedger &&
    flags.documentedStumps &&
    flags.wynterRestated
  );

  // 1 — 发现了什么的人
  if (hartmannChainComplete && grain >= 75) return 'ending5';

  // 2 — 被解雇 (primary condition)
  if (grain < 70 || (renown <= -5 && guldmark < 10)) return 'ending4';

  // 3 — 河谷的人
  if (renown >= 8 && deepTrustCount >= 3 && grain >= 75) return 'ending3';

  // 4 — 高效的机器
  if (grain >= 110 && guldmark >= 30 && renown <= 3) return 'ending2';

  // 5 — 称职的外来者
  if (grain >= 90 && guldmark >= 15) return 'ending1';

  // 6 — 被解雇 (fallback)
  return 'ending4';
}

export function getEndingData(id: EndingId): EndingData {
  return (endingsData as Record<string, EndingData>)[id];
}
