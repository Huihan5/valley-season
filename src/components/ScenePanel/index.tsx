import { GameState } from '../../types/game';
import { PHASE_LABELS, dayName } from '../../systems/TimeSystem';
import LogDrawer from './LogDrawer';
import DATA from '../../data';

const ui = DATA.ui;

interface Props {
  state: GameState;
  onOpenSaves: () => void;
  onOpenJournal: () => void;
}

export default function ScenePanel({ state, onOpenSaves, onOpenJournal }: Props) {
  const { day, phase, activeEvent, currentSceneText, lastResult, log } = state;

  return (
    <div className="flex flex-col h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-game-border flex items-center gap-3">
        <span className="text-gold font-serif text-sm tracking-widest">
          {dayName(day)}
        </span>
        <span className="text-game-dim text-xs">·</span>
        <span className="text-game-dim text-xs">{PHASE_LABELS[phase]}</span>
        {activeEvent && (
          <>
            <span className="text-game-dim text-xs">·</span>
            <span className="text-amber text-xs font-serif">{activeEvent.title}</span>
          </>
        )}
        <button
          onClick={onOpenJournal}
          className="ml-auto text-game-dim text-xs hover:text-cream transition-colors shrink-0"
        >
          {ui.scenePanel.journal}
        </button>
        <button
          onClick={onOpenSaves}
          className="text-game-dim text-xs hover:text-cream transition-colors shrink-0"
        >
          {ui.scenePanel.saves}
        </button>
      </div>

      {/* What just happened, then where you now are. The prose keeps a reading
          measure of its own rather than running the full width of the panel
          (PlaytestFeedback 2.a). */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* What just happened stays on screen even when the next beat is an event:
            a chained scene's branch prose is the lead-in to the beat that follows. */}
        {lastResult && (
          <div className="border-l-2 border-gold-dim pl-4 max-w-[46rem]">
            <p className="text-cream font-serif text-sm leading-relaxed whitespace-pre-line">
              {lastResult}
            </p>
          </div>
        )}
        <p className="text-game-text font-serif text-sm leading-relaxed whitespace-pre-line max-w-[46rem]">
          {currentSceneText}
        </p>
      </div>

      <LogDrawer log={log} />
    </div>
  );
}
