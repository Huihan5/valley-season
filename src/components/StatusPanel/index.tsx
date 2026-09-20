import { GameState, NpcId } from '../../types/game';
import { WEATHER_LABELS, WEATHER_ICONS } from '../../systems/WeatherSystem';
import { getFatigueLabel, getFatigueEffect } from '../../systems/FatigueSystem';
import {
  getDayOfWeek, isMarketDay, daysUntilSeasonEnd, daysUntilNextMarket,
} from '../../systems/TimeSystem';
import {
  getTrust, getKnownNpcs, getTrustTier, getEffectiveTenantTrust, TrustTier,
} from '../../systems/RelationSystem';
import { getFieldGrain } from '../../systems/ResourceSystem';
import {
  GRAIN_EXCELLENT_THRESHOLD, NOBLE_TRUST_MAX, LORD_IMPRESSION_MAX, DAILY_GULDMARK_COST, TOTAL_DAYS,
} from '../../data/config';
import DATA from '../../data';
import { plural, fill } from '../../utils/text';

const ui = DATA.ui;

/** Section headings sit one step brighter than body dim (PlaytestFeedback 2.h.ii). */
const SECTION_LABEL = 'text-cream-dim text-xs tracking-wider mb-2';

const NPC_NAMES: Record<NpcId, string> = ui.npc;
const T = ui.statusPanel;
const CAL = ui.calendar;

/**
 * Relationships read as words, not numbers (PlaytestFeedback 2026-09 / D3): the exact
 * trust value is the game's business, and a "+3" turned the estate into a spreadsheet.
 * The six tiers come from RelationSystem so a threshold and its label never drift apart.
 */
const TIER_LABELS: Record<TrustTier, string> = ui.statusPanel.trustTiers;
const tierWord = (value: number): string => TIER_LABELS[getTrustTier(value)];
const tierColor = (value: number): string =>
  value > 0 ? 'text-gold-dim' : value < 0 ? 'text-rust' : 'text-game-dim';

/** English wants "1 unit" and "2 units"; Chinese wants 单位 either way. */
const units = (n: number) => plural(n, ui.resources.unitOne, ui.resources.unit);

interface Props {
  state: GameState;
}

function RelationBar({ value }: { value: number }) {
  const clamped = Math.max(-5, Math.min(5, value));
  const color = clamped >= 3 ? 'bg-gold' : clamped >= 1 ? 'bg-gold-dim' : clamped < 0 ? 'bg-rust' : 'bg-game-border';
  const width = `${((clamped + 5) / 10) * 100}%`;
  return (
    <div className="w-full h-1 bg-game-border rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width }} />
    </div>
  );
}

export default function StatusPanel({ state }: Props) {
  const { day, weather, resources, fatigue, nobleTrust, lordImpression } = state;
  const fieldGrain = getFieldGrain(state);
  const fatigueEffect = getFatigueEffect(fatigue);
  const marketDay = isMarketDay(day);

  return (
    <div className="flex flex-col lg:h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">

      {/* Date & Weather */}
      <div className="px-4 py-3 border-b border-game-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-cream font-serif text-base">{T.estate}</span>
          <span className="text-game-dim text-xs">{getDayOfWeek(day)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{WEATHER_ICONS[weather]}</span>
          <span className="text-game-text text-sm">{WEATHER_LABELS[weather]}</span>
          {marketDay && (
            <span className="ml-auto text-xs text-amber border border-amber/40 rounded px-1.5 py-0.5">
              {T.marketDay}
            </span>
          )}
        </div>
      </div>

      {/* Schedule — the season's deterministic cycle only: today, the market
          Saturdays (a timetable the duchy posts publicly), and how far off the end
          is. Nothing about what happens on a given day, so it cannot spoil. */}
      <CalendarSection day={day} />

      {/* Resources */}
      <div className="px-4 py-3 border-b border-game-border">
        <p className={SECTION_LABEL}>{T.resourcesHeading}</p>
        <div className="space-y-2">
          <ResourceRow icon="🌾" label={ui.resources.grain} value={resources.grain} unit={units(resources.grain)} target={GRAIN_EXCELLENT_THRESHOLD} />
          {/* The finite crop still standing — the clock behind the 抢收 (GDD 5.4). On a
              frost day it reads cold, because that is the night it starts to go. */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🌾</span>
              <span className="text-game-dim text-xs">{T.fieldGrain}</span>
            </div>
            {fieldGrain > 0 ? (
              <span className={`text-sm font-serif tabular-nums ${weather === 'frost' ? 'text-frost' : 'text-cream-dim'}`}>
                {fieldGrain}{` ${units(fieldGrain)}`}
              </span>
            ) : (
              <span className="text-game-dim text-xs">{T.fieldGrainCleared}</span>
            )}
          </div>
          <ResourceRow icon="🪙" label={ui.resources.guldmark} value={resources.guldmark} unit="" warnBelow={15} />
          <ResourceRow icon="🪵" label={ui.resources.timber} value={resources.timber} unit={units(resources.timber)} warnBelow={5} />
          <ResourceRow icon="⭐" label={ui.resources.renown} value={resources.renown} unit="" showSign />
        </div>
        {/* An empty purse used to pass in silence (PlaytestFeedback 4.a.iii). */}
        {resources.guldmark < DAILY_GULDMARK_COST && (
          <p className="text-rust text-xs mt-2 leading-snug">
            {resources.guldmark === 0 ? T.purseEmpty : T.purseLow}
          </p>
        )}
      </div>

      {/* Fatigue */}
      <div className="px-4 py-3 border-b border-game-border">
        <p className={SECTION_LABEL}>{T.statusHeading}</p>
        <div className="flex items-center justify-between">
          <span className="text-game-text text-sm">{getFatigueLabel(fatigue)}</span>
          <span className="text-game-dim text-xs">{fatigue}/5</span>
        </div>
        <div className="mt-1 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < fatigue ? 'bg-rust' : 'bg-game-border'}`}
            />
          ))}
        </div>
        {fatigueEffect && (
          <p className="text-rust text-xs mt-1">{fatigueEffect}</p>
        )}
      </div>

      {/* Standing: the two axes that are not renown */}
      <div className="px-4 py-3 border-b border-game-border">
        <p className={SECTION_LABEL}>{T.standingHeading}</p>
        <div className="space-y-1.5">
          {/* 佃户整体信任 had no readout at all before (D3). It reads as a word, like
              the individual relationships — never the raw number. */}
          <div className="flex items-center justify-between">
            <span className="text-game-dim text-xs">{T.tenants}</span>
            <span className={`text-xs ${tierColor(getEffectiveTenantTrust(state))}`}>
              {tierWord(getEffectiveTenantTrust(state))}
            </span>
          </div>
          <PipRow label={T.nobleTrust} value={nobleTrust} max={NOBLE_TRUST_MAX} />
          <PipRow label={T.lordImpression} value={lordImpression} max={LORD_IMPRESSION_MAX} />
        </div>
      </div>

      {/* Relationships — only the people the player has actually met (2.h) */}
      <div className="px-4 py-3 flex-1 lg:overflow-y-auto">
        <p className={SECTION_LABEL}>{T.relationsHeading}</p>
        <div className="space-y-2.5">
          {getKnownNpcs(state, Object.keys(NPC_NAMES) as NpcId[]).map((npc) => {
            const val = getTrust(state, npc);
            return (
              <div key={npc}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-game-text text-xs">{NPC_NAMES[npc]}</span>
                  <span className={`text-xs ${tierColor(val)}`}>{tierWord(val)}</span>
                </div>
                <RelationBar value={val} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A month at a glance. Day 1 is a Monday, so the 30 days drop straight into a
 * Monday-first 7-wide grid with no leading blanks. Today is ringed; days gone by
 * fade; the market Saturdays carry the amber the rest of the panel gives the market.
 * Everything here is a pure function of the day number — no event data reaches it.
 */
function CalendarSection({ day }: { day: number }) {
  const left = daysUntilSeasonEnd(day);
  const toMarket = daysUntilNextMarket(day);
  const daysLeftLine = left === 0
    ? CAL.lastDay
    : fill(plural(left, CAL.daysLeftOne, CAL.daysLeft), { n: left });
  const marketLine = toMarket === null
    ? CAL.noMoreMarket
    : toMarket === 0
      ? CAL.marketToday
      : fill(plural(toMarket, CAL.nextMarketOne, CAL.nextMarket), { n: toMarket });

  return (
    <div className="px-4 py-3 border-b border-game-border">
      <p className={SECTION_LABEL}>{CAL.heading}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {CAL.weekdayShort.slice(1).map((w, i) => (
          <span key={i} className={`text-center text-[10px] ${i === 5 ? 'text-amber/70' : 'text-game-dim/70'}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => {
          const d = i + 1;
          if (d > TOTAL_DAYS) return <span key={i} aria-hidden="true" />;
          const today = d === day;
          const tone = today
            ? 'bg-gold/15 text-gold border-gold'
            : d < day
              ? 'text-game-dim/40 border-transparent'
              : isMarketDay(d)
                ? 'text-amber border-transparent'
                : 'text-cream-dim border-transparent';
          return (
            <span
              key={i}
              aria-current={today ? 'date' : undefined}
              className={`text-center text-[10px] tabular-nums leading-none py-1 rounded-sm border ${tone}`}
            >
              {d}
            </span>
          );
        })}
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-game-dim text-xs">{daysLeftLine}</p>
        <p className="text-amber/80 text-xs">{marketLine}</p>
      </div>
    </div>
  );
}

function PipRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-game-dim text-xs">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${i < value ? 'bg-gold-dim' : 'bg-game-border'}`}
          />
        ))}
      </div>
    </div>
  );
}

interface ResourceRowProps {
  icon: string;
  label: string;
  value: number;
  unit: string;
  target?: number;
  warnBelow?: number;
  showSign?: boolean;
}

function ResourceRow({ icon, label, value, unit, target, warnBelow, showSign }: ResourceRowProps) {
  const isLow = warnBelow !== undefined && value < warnBelow;
  const isGood = target !== undefined && value >= target;
  const color = isGood ? 'text-gold' : isLow ? 'text-rust' : 'text-cream';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-game-dim text-xs">{label}</span>
      </div>
      <span className={`text-sm font-serif ${color}`}>
        {showSign && value > 0 ? '+' : ''}{value}{unit && ` ${unit}`}
      </span>
    </div>
  );
}
