import { GameState, NpcId } from '../../types/game';
import { WEATHER_LABELS, WEATHER_ICONS } from '../../systems/WeatherSystem';
import { getFatigueLabel, getFatigueEffect } from '../../systems/FatigueSystem';
import { getDayOfWeek, isMarketDay } from '../../systems/TimeSystem';
import { getTrust, getKnownNpcs } from '../../systems/RelationSystem';
import {
  GRAIN_EXCELLENT_THRESHOLD, NOBLE_TRUST_MAX, LORD_IMPRESSION_MAX, DAILY_GULDMARK_COST,
} from '../../data/config';

/** Section headings sit one step brighter than body dim (PlaytestFeedback 2.h.ii). */
const SECTION_LABEL = 'text-cream-dim text-xs tracking-wider mb-2';

const NPC_NAMES: Record<NpcId, string> = {
  gregor: '格雷格',
  marta: '玛莎',
  elena: '埃莱娜',
  marguerite: '玛格丽特男爵夫人',
  henk: '亨克男爵',
  lorenz: '洛伦茨匠师',
};

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
  const fatigueEffect = getFatigueEffect(fatigue);
  const marketDay = isMarketDay(day);

  return (
    <div className="flex flex-col h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">

      {/* Date & Weather */}
      <div className="px-4 py-3 border-b border-game-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-cream font-serif text-base">枫径庄园</span>
          <span className="text-game-dim text-xs">{getDayOfWeek(day)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{WEATHER_ICONS[weather]}</span>
          <span className="text-game-text text-sm">{WEATHER_LABELS[weather]}</span>
          {marketDay && (
            <span className="ml-auto text-xs text-amber border border-amber/40 rounded px-1.5 py-0.5">
              集市日
            </span>
          )}
        </div>
      </div>

      {/* Resources */}
      <div className="px-4 py-3 border-b border-game-border">
        <p className={SECTION_LABEL}>— 资源 —</p>
        <div className="space-y-2">
          <ResourceRow icon="🌾" label="粮食" value={resources.grain} unit="单位" target={GRAIN_EXCELLENT_THRESHOLD} />
          <ResourceRow icon="🪙" label="金卢" value={resources.guldmark} unit="" warnBelow={15} />
          <ResourceRow icon="🪵" label="木材" value={resources.timber} unit="单位" warnBelow={5} />
          <ResourceRow icon="⭐" label="声望" value={resources.renown} unit="" showSign />
        </div>
        {/* An empty purse used to pass in silence (PlaytestFeedback 4.a.iii). */}
        {resources.guldmark < DAILY_GULDMARK_COST && (
          <p className="text-rust text-xs mt-2 leading-snug">
            {resources.guldmark === 0 ? '账上已经空了。' : '账上不够明天的日常开销。'}
          </p>
        )}
      </div>

      {/* Fatigue */}
      <div className="px-4 py-3 border-b border-game-border">
        <p className={SECTION_LABEL}>— 状态 —</p>
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
        <p className={SECTION_LABEL}>— 处境 —</p>
        <div className="space-y-1.5">
          <PipRow label="贵族信任" value={nobleTrust} max={NOBLE_TRUST_MAX} />
          <PipRow label="领主印象" value={lordImpression} max={LORD_IMPRESSION_MAX} />
        </div>
      </div>

      {/* Relationships — only the people the player has actually met (2.h) */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <p className={SECTION_LABEL}>— 关系 —</p>
        <div className="space-y-2.5">
          {getKnownNpcs(state, Object.keys(NPC_NAMES) as NpcId[]).map((npc) => {
            const val = getTrust(state, npc);
            return (
              <div key={npc}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-game-text text-xs">{NPC_NAMES[npc]}</span>
                  <span className={`text-xs ${val > 0 ? 'text-gold-dim' : val < 0 ? 'text-rust' : 'text-game-dim'}`}>
                    {val > 0 ? `+${val}` : val}
                  </span>
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
