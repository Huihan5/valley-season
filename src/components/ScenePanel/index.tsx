import { ReactNode } from 'react';
import { GameState, NpcId } from '../../types/game';
import { PHASE_LABELS, dayName, isHuntSeason } from '../../systems/TimeSystem';
import { getFatigueNote, getFatigueStatus } from '../../systems/FatigueSystem';
import DATA from '../../data';
import Gregor from '../../assets/portraits/Gregor.png';
import Martha from '../../assets/portraits/Martha.png';
import Elena from '../../assets/portraits/Elena.png';
import Lorenz from '../../assets/portraits/Lorenz.png';

const ui = DATA.ui;

// Only the four who live on the estate have portraits; the nobles are named without one.
const PORTRAITS: Partial<Record<NpcId, string>> = {
  gregor: Gregor, marta: Martha, elena: Elena, lorenz: Lorenz,
};
const NPC_NAMES: Record<NpcId, string> = ui.npc;

interface Props {
  state: GameState;
  onOpenSaves: () => void;
  onOpenJournal: () => void;
  onOpenCodex: () => void;
  /** The choices, rendered inline under the prose and scrolling with it (B). */
  children?: ReactNode;
}

export default function ScenePanel({ state, onOpenSaves, onOpenJournal, onOpenCodex, children }: Props) {
  const { day, phase, activeEvent, currentSceneText, lastResult } = state;
  // Overwork the player can see in the scene, not only as a bar in the panel (D7).
  const fatigueNote = getFatigueNote(state.fatigue);
  const spent = getFatigueStatus(state.fatigue) === 'exhausted';
  // Who is speaking, when what just happened was a greeting (P15).
  const speaker = state.lastSpeaker ?? null;
  // Day 18–21 the estate turns cooler and shorter-handed; the panel says so and
  // shifts its accent from the warm gold to frost while the hunt is on (D13).
  const huntSeason = isHuntSeason(state);

  return (
    <div className={`flex flex-col lg:h-full bg-bg-card border rounded-sm overflow-hidden transition-colors ${huntSeason ? 'border-frost/40' : 'border-game-border'}`}>
      {/* The season, pinned above everything while the duchy's hunt is open (D13). */}
      {huntSeason && (
        <div className="px-5 py-1.5 bg-frost/10 border-b border-frost/30 flex items-baseline gap-2">
          <span className="text-frost text-xs font-serif tracking-widest">{ui.scenePanel.huntSeason}</span>
          <span className="text-frost/70 text-[11px] font-serif italic truncate">{ui.scenePanel.huntSeasonSub}</span>
        </div>
      )}
      {/* Header */}
      <div className="px-5 py-3 border-b border-game-border flex items-center gap-3">
        <span className={`font-serif text-sm tracking-widest transition-colors ${huntSeason ? 'text-frost' : 'text-gold'}`}>
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
          onClick={onOpenCodex}
          className="ml-auto text-game-dim text-xs hover:text-cream transition-colors shrink-0"
        >
          {DATA.codex.open}
        </button>
        <button
          onClick={onOpenJournal}
          className="text-game-dim text-xs hover:text-cream transition-colors shrink-0"
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
      <div className="flex-1 lg:overflow-y-auto px-5 py-4 space-y-4">
        {/* The body telling on the player, in the scene itself (D7). Amber while
            merely tired; rust once spent, where 嘴唇发紫 landed. */}
        {fatigueNote && (
          <p className={`font-serif text-xs italic leading-relaxed max-w-[46rem] ${spent ? 'text-rust' : 'text-amber'}`}>
            {fatigueNote}
          </p>
        )}
        {/* What just happened stays on screen even when the next beat is an event:
            a chained scene's branch prose is the lead-in to the beat that follows. */}
        {lastResult && (
          <div className="border-l-2 border-gold-dim pl-4 max-w-[46rem]">
            {/* A face to the voice, when someone is speaking to you (P15). */}
            {speaker && (
              <div className="flex items-center gap-2 mb-2">
                {PORTRAITS[speaker] && (
                  <img
                    src={PORTRAITS[speaker]}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-gold-dim/40 shrink-0"
                  />
                )}
                <span className="text-gold-dim text-xs font-serif tracking-wider">{NPC_NAMES[speaker]}</span>
              </div>
            )}
            <p className="text-cream font-serif text-sm leading-relaxed whitespace-pre-line">
              {lastResult}
            </p>
          </div>
        )}
        <p className="text-game-text font-serif text-sm leading-relaxed whitespace-pre-line max-w-[46rem]">
          {currentSceneText}
        </p>

        {/* The choices sit right under the last paragraph and scroll with it (B):
            the player decides inside the reading, not on a panel below it. A short
            rule sets them apart without breaking the column. */}
        {children && (
          <div className="pt-2 border-t border-game-border/60 max-w-[46rem]">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
