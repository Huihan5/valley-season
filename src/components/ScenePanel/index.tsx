import { GameState } from '../../types/game';
import { PHASE_LABELS } from '../../systems/TimeSystem';
import { DAY_NAMES } from '../../systems/TimeSystem';

interface Props {
  state: GameState;
}

export default function ScenePanel({ state }: Props) {
  const { day, phase, activeEvent, currentSceneText, log } = state;

  return (
    <div className="flex flex-col h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-game-border flex items-center gap-3">
        <span className="text-gold font-serif text-sm tracking-widest">
          {DAY_NAMES[day] ?? `第${day}日`}
        </span>
        <span className="text-game-dim text-xs">·</span>
        <span className="text-game-dim text-xs">{PHASE_LABELS[phase]}</span>
        {activeEvent && (
          <>
            <span className="text-game-dim text-xs">·</span>
            <span className="text-amber text-xs font-serif">{activeEvent.title}</span>
          </>
        )}
      </div>

      {/* Main scene text */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-game-text font-serif text-sm leading-relaxed whitespace-pre-line">
          {currentSceneText}
        </p>
      </div>

      {/* Log — last 4 entries */}
      {log.length > 0 && (
        <div className="border-t border-game-border px-5 py-3 space-y-1">
          <p className="text-game-dim text-xs tracking-wider mb-2">— 记录 —</p>
          {log.slice(-4).map((entry, i) => (
            <p key={i} className="text-game-dim text-xs font-serif">
              <span className="text-gold-dim">{DAY_NAMES[entry.day] ?? `第${entry.day}日`} {PHASE_LABELS[entry.phase]}</span>
              {'　'}
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
