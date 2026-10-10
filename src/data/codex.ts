import { NpcId } from '../types/game';

/**
 * 见闻 — the cross-run codex (round-3 feedback C · "thicken the story layer so
 * replay pays off"). Three shelves: the people, and the two rings of world
 * knowledge (the kingdom, the duchy). This is the CROSS-RUN half; the investigation
 * 卷宗 (JournalSystem) is the in-run half and resets every season.
 *
 * Structure only — every word lives in `data/<locale>/codex.json`, keyed by these
 * ids (CodexSystem.test asserts the two never drift). Unlock conditions live here
 * beside the ids, the way the numbers live in `config.ts`, so a threshold can never
 * be translated apart from the thing it gates.
 */
export type CodexCategory = 'people' | 'marigni' | 'valewisp';

/**
 * How a not-yet-unlocked entry shows itself (scheme 乙 + 精修):
 * - 'silhouette' — a greyed slot naming its shape but not its substance, counted in
 *   the "3 / 6" so the player can see there is more to find.
 * - 'hidden' — absent entirely until unlocked, and uncounted. For anything tied to
 *   the investigation, so a locked slot never pre-announces a thread the mystery is
 *   meant to reveal.
 */
export type CodexReveal = 'silhouette' | 'hidden';

/** Read against the current run's state; whatever it ever satisfied is then remembered across runs. */
export interface CodexCondition {
  fromStart?: boolean;
  met?: NpcId;
  trust?: { npc: NpcId; min: number };
  flag?: string;
  /** Any one of these will do (the two officers are met in more than one place). */
  any?: CodexCondition[];
}

export interface CodexLayerDef {
  id: string;
  unlock: CodexCondition;
}

export interface CodexEntryDef {
  id: string;
  category: CodexCategory;
  reveal: CodexReveal;
  unlock: CodexCondition;
  /**
   * Who the page is about, as the speaker id the reading uses, for a person the relations system
   * does not keep (the two officers). Absent for the six who are: the `met` of the unlock names them.
   */
  person?: string;
  /** People carry three layers (照面 / 底细 / 原型); lore entries carry none and use one body. */
  layers?: CodexLayerDef[];
}

/**
 * A person unlocks in three depths: meeting them opens 照面; trust opens 底细, then
 * 原型 — that last one is the "archetype in the setting" layer, deliberately the
 * deepest so it is what a second and third season are for.
 */
const personLayers = (npc: NpcId): CodexLayerDef[] => [
  { id: 'face', unlock: { met: npc } },
  { id: 'inside', unlock: { trust: { npc, min: 2 } } },
  { id: 'archetype', unlock: { trust: { npc, min: 4 } } },
];

export const CODEX_ENTRIES: CodexEntryDef[] = [
  // 人物 — the four of the household unlock by acquaintance and trust. The two nobles
  // are gated on `met` for now; tuning their trigger (a dinner/hunt flag) is a
  // content-pass detail once the author's doc lands.
  { id: 'gregor', category: 'people', reveal: 'silhouette', unlock: { met: 'gregor' }, layers: personLayers('gregor') },
  { id: 'marta', category: 'people', reveal: 'silhouette', unlock: { met: 'marta' }, layers: personLayers('marta') },
  { id: 'elena', category: 'people', reveal: 'silhouette', unlock: { met: 'elena' }, layers: personLayers('elena') },
  { id: 'lorenz', category: 'people', reveal: 'silhouette', unlock: { met: 'lorenz' }, layers: personLayers('lorenz') },
  { id: 'marguerite', category: 'people', reveal: 'silhouette', unlock: { met: 'marguerite' }, layers: personLayers('marguerite') },
  { id: 'henk', category: 'people', reveal: 'silhouette', unlock: { met: 'henk' }, layers: personLayers('henk') },

  // 公务员 — the two officers keep no trust (they are not in the relations list), so what opens their
  // pages is what the player has been through with them: meeting them (照面), a second working
  // conversation (底细), and the one that is only had in one of the two Day 27 talks (原型, so that it
  // is what a second and third season are for, like the rest).
  {
    id: 'timothy', category: 'people', reveal: 'silhouette', person: 'timothy',
    unlock: { any: [{ flag: 'met_timothy' }, { flag: 'timothyDay12' }] },
    layers: [
      { id: 'face', unlock: { any: [{ flag: 'met_timothy' }, { flag: 'timothyDay12' }] } },
      { id: 'inside', unlock: { flag: 'timothyDay12' } },
      { id: 'archetype', unlock: { flag: 'clue_ofc_timothy_declaration' } },
    ],
  },
  {
    id: 'thierry', category: 'people', reveal: 'silhouette', person: 'thierry',
    unlock: { flag: 'met_thierry' },
    layers: [
      { id: 'face', unlock: { flag: 'met_thierry' } },
      { id: 'inside', unlock: { any: [{ flag: 'thierryDay15' }, { flag: 'thierryDay19' }] } },
      { id: 'archetype', unlock: { flag: 'clue_pos_locate' } },
    ],
  },

  // 玛里尼 — the kingdom. Rational feudalism is baseline knowledge (you came here to
  // work inside it); the local faith you learn through the forge-keeper.
  { id: 'rational_feudalism', category: 'marigni', reveal: 'silhouette', unlock: { fromStart: true } },
  { id: 'sacred_flame', category: 'marigni', reveal: 'silhouette', unlock: { met: 'lorenz' } },

  // 瓦莱维斯普 — the duchy you were sent to, the estate you keep, and one entry that
  // stays hidden until the investigation turns it up (the 精修: plot-gated → 'hidden').
  { id: 'valewisp_duchy', category: 'valewisp', reveal: 'silhouette', unlock: { fromStart: true } },
  { id: 'maplegate', category: 'valewisp', reveal: 'silhouette', unlock: { met: 'marta' } },
  { id: 'millridge', category: 'valewisp', reveal: 'hidden', unlock: { flag: 'clue_mot_handwriting' } },
];
