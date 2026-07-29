import { GameState, Choice, NpcId } from '../types/game';
import {
  REPAIR_TOOLS_COST,
  CLEAR_STORAGE_COST,
  REPAIR_STABLE_COST,
  GIFT_COST,
  ATTIRE_COST,
  TENANT_MEETING_MIN_TRUST,
  HARVEST_YIELD,
} from '../data/config';
import actions from '../data/actions.json';
import { fill } from '../utils/text';
import { getEffectiveTenantTrust } from './RelationSystem';

const TEXT = actions.estateTasks;

/**
 * 庄园事务 — the one-off preparations from GDD ch.5.4.
 *
 * These are shown as a standing checklist so the player can weigh them without
 * hunting through the phase's choices, but taking one is still an ordinary action
 * that spends the phase. A phase is the scarcer currency; hiding that behind a
 * shop screen would remove the only trade worth making.
 *
 * All are one-off, so nothing here recurs and the time system needs no new rules.
 */

export type TaskStatus = 'available' | 'done' | 'blocked';

export interface EstateTask {
  id: string;
  label: string;
  /** Mechanical microcopy only — cost and effect, never a narrated sentence (GDD 11.6). */
  summary: string;
  status: TaskStatus;
  /** Why it cannot be taken yet; only set when blocked. */
  blockedReason?: string;
  guldmark: number;
  timber: number;
  doneFlag: string;
  /** Set when the task names a recipient, e.g. who the gift goes to. */
  recipient?: NpcId;
}

interface TaskSpec {
  id: string;
  label: string;
  effect: string;
  guldmark: number;
  timber?: number;
  doneFlag: string;
  recipient?: NpcId;
  /** Extra condition beyond affording it. */
  requires?: (state: GameState) => string | null;
}

const SPECS: TaskSpec[] = [
  {
    id: 'task_repair_tools',
    label: TEXT.repairTools.label,
    effect: fill(TEXT.repairTools.effect, {
      from: HARVEST_YIELD.unprepared,
      to: HARVEST_YIELD.toolsRepaired,
    }),
    guldmark: REPAIR_TOOLS_COST,
    doneFlag: 'toolsRepaired',
  },
  {
    id: 'task_clear_storage',
    label: TEXT.clearStorage.label,
    effect: fill(TEXT.clearStorage.effect, {
      from: HARVEST_YIELD.toolsRepaired,
      to: HARVEST_YIELD.toolsAndStorage,
    }),
    guldmark: CLEAR_STORAGE_COST,
    doneFlag: 'storageCleared',
    requires: (s) => (s.flags.toolsRepaired ? null : TEXT.clearStorage.needsTools),
  },
  {
    id: 'task_tenant_meeting',
    label: TEXT.tenantMeeting.label,
    effect: fill(TEXT.tenantMeeting.effect, {
      from: HARVEST_YIELD.toolsAndStorage,
      to: HARVEST_YIELD.fullyPrepared,
    }),
    guldmark: 0,
    doneFlag: 'fullyPrepared',
    requires: (s) => {
      if (!s.flags.storageCleared) return TEXT.tenantMeeting.needsStorage;
      if (getEffectiveTenantTrust(s) < TENANT_MEETING_MIN_TRUST) {
        return fill(TEXT.tenantMeeting.needsTrust, { n: TENANT_MEETING_MIN_TRUST });
      }
      return null;
    },
  },
  {
    id: 'task_repair_stable',
    label: TEXT.repairStable.label,
    effect: TEXT.repairStable.effect,
    guldmark: REPAIR_STABLE_COST.guldmark,
    timber: REPAIR_STABLE_COST.timber,
    doneFlag: 'repairedStableRoof',
  },
  {
    id: 'task_gift_marguerite',
    label: TEXT.giftMarguerite.label,
    effect: TEXT.giftMarguerite.effect,
    guldmark: GIFT_COST,
    doneFlag: 'boughtGift',
    recipient: 'marguerite',
  },
  {
    id: 'task_gift_henk',
    label: TEXT.giftHenk.label,
    effect: TEXT.giftHenk.effect,
    guldmark: GIFT_COST,
    doneFlag: 'boughtGift',
    recipient: 'henk',
  },
  {
    id: 'task_attire',
    label: TEXT.attire.label,
    effect: TEXT.attire.effect,
    guldmark: ATTIRE_COST,
    doneFlag: 'boughtAttire',
  },
];

const REPAIR_TASKS = new Set(['task_repair_tools', 'task_clear_storage', 'task_repair_stable']);

function describe(spec: TaskSpec): string {
  const parts = [actions.common.onePhase];
  if (spec.guldmark) parts.push(fill(TEXT.costGuldmark, { n: spec.guldmark }));
  if (spec.timber) parts.push(fill(TEXT.costTimber, { n: spec.timber }));
  parts.push(spec.effect);
  return parts.join(' · ');
}

export function getEstateTasks(state: GameState): EstateTask[] {
  return SPECS.map((spec) => {
    const timber = spec.timber ?? 0;
    let status: TaskStatus = 'available';
    let blockedReason: string | undefined;

    if (state.flags[spec.doneFlag]) {
      status = 'done';
    } else {
      const gate = spec.requires?.(state) ?? null;
      if (gate) {
        status = 'blocked';
        blockedReason = gate;
      } else if (state.resources.guldmark < spec.guldmark) {
        status = 'blocked';
        blockedReason = fill(TEXT.shortGuldmark, { n: spec.guldmark });
      } else if (state.resources.timber < timber) {
        status = 'blocked';
        blockedReason = fill(TEXT.shortTimber, { n: timber });
      }
    }

    return {
      id: spec.id,
      label: spec.label,
      summary: describe(spec),
      status,
      blockedReason,
      guldmark: spec.guldmark,
      timber,
      doneFlag: spec.doneFlag,
      recipient: spec.recipient,
    };
  });
}

/** The tasks a player can actually take right now, as ordinary phase-consuming choices. */
export function getEstateTaskChoices(state: GameState): Choice[] {
  return getEstateTasks(state)
    .filter((task) => task.status !== 'done')
    .map((task) => ({
      id: task.id,
      text: task.label,
      description: task.status === 'blocked' ? task.blockedReason ?? '' : task.summary,
      disabled: task.status === 'blocked',
      disabledReason: task.blockedReason,
      effects: {
        guldmark: task.guldmark ? -task.guldmark : undefined,
        timber: task.timber ? -task.timber : undefined,
        ...(task.recipient ? { relationships: { [task.recipient]: 1 } } : {}),
        ...(task.id === 'task_attire' ? { renown: 1 } : {}),
        ...(task.id === 'task_repair_stable' ? { relationships: { gregor: 1 } } : {}),
        flags: { [task.doneFlag]: true },
        logEntry: fill(TEXT.log, { label: task.label, summary: task.summary }),
      },
      // The three physical repairs share the 维修 result text; the two purchases do not.
      ...(REPAIR_TASKS.has(task.id)
        ? { resultKind: 'repair', resultVars: { item: task.label } }
        : {}),
    }));
}

/**
 * Holding both the gift and the attire raises the floor on every 得体 check that
 * follows — the Day 7 dinner settlement and the hunt-season noble-trust judgments.
 */
export function getDecorumBonus(state: GameState): number {
  return state.flags.boughtGift && state.flags.boughtAttire ? 1 : 0;
}
