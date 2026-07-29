import { SaveSummary } from '../systems/SaveSystem';
import { formatMoment } from '../systems/TimeSystem';
import ui from '../data/ui.json';

const T = ui.titleScreen;

interface Props {
  /** The autosave, if the browser is holding one. */
  auto: SaveSummary | null;
  hasManualSaves: boolean;
  onNew: () => void;
  onContinue: () => void;
  onOpenSaves: () => void;
}

/**
 * The way in. Until now the game opened straight onto the guarantee letter, which
 * left nowhere to put "continue" — and nowhere to put the language switch the
 * bilingual build will need (PlaytestFeedback 3.a). Both live here.
 */
export default function TitleScreen({ auto, hasManualSaves, onNew, onContinue, onOpenSaves }: Props) {
  const resumable = auto && !auto.finished;

  return (
    <div className="h-screen bg-bg text-game-text flex flex-col items-center justify-center gap-10 p-6">
      <div className="text-center space-y-3">
        <h1 className="text-gold font-serif text-4xl tracking-[0.3em]">{T.title}</h1>
        <div className="w-24 h-px bg-gold-dim mx-auto" />
        <p className="text-cream-dim font-serif text-xs tracking-[0.35em]">{T.titleRoman}</p>
        <p className="text-game-dim text-xs pt-2">{T.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 w-64">
        {resumable && (
          <button
            onClick={onContinue}
            className="px-6 py-3 bg-gold-dim border border-gold text-bg font-serif text-base rounded-sm hover:bg-gold transition-all"
          >
            {T.continue}
            <span className="block text-xs opacity-80 mt-0.5">
              {formatMoment(auto.day, auto.phase)}
            </span>
          </button>
        )}

        <button
          onClick={onNew}
          className="px-6 py-3 border border-gold-dim text-cream font-serif text-base rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
        >
          {T.newSeason}
        </button>

        {hasManualSaves && (
          <button
            onClick={onOpenSaves}
            className="px-6 py-2.5 border border-game-border text-game-text font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold-dim transition-all"
          >
            {T.loadSave}
          </button>
        )}
      </div>
    </div>
  );
}
