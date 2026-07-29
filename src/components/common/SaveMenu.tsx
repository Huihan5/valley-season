import { SaveSummary, ManualSlot, MANUAL_SLOTS } from '../../systems/SaveSystem';
import { formatMoment } from '../../systems/TimeSystem';
import ui from '../../data/ui.json';
import { fill } from '../../utils/text';

const T = ui.saveMenu;

interface Props {
  slots: (SaveSummary | null)[];
  /** False on the title screen: there is no season in progress to write down. */
  canSave: boolean;
  onSave: (slot: ManualSlot) => void;
  onLoad: (slot: ManualSlot) => void;
  onDelete: (slot: ManualSlot) => void;
  onClose: () => void;
}

function savedAtLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(T.dateLocale, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Three slots, on top of the autosave. The autosave carries the season forward on
 * its own; these exist so a run can be branched — stand on Day 27 and take the
 * other road, without playing the month again.
 */
export default function SaveMenu({ slots, canSave, onSave, onLoad, onDelete, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-game-border flex items-center justify-between">
          <span className="text-cream-dim text-xs tracking-wider">{T.heading}</span>
          <button onClick={onClose} className="text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>

        <div className="p-4 space-y-2">
          {MANUAL_SLOTS.map((slot, i) => {
            const summary = slots[i];
            return (
              <div
                key={slot}
                className="border border-game-border rounded-sm px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-serif text-sm">{T.slots[i]}</p>
                  <p className="text-game-dim text-xs mt-0.5 truncate">
                    {summary
                      ? fill(T.summary, {
                        moment: summary.finished ? T.finished : formatMoment(summary.day, summary.phase),
                        savedAt: savedAtLabel(summary.savedAt),
                      })
                      : T.empty}
                  </p>
                </div>

                {canSave && (
                  <button
                    onClick={() => onSave(slot)}
                    className="px-3 py-1.5 border border-gold-dim text-cream font-serif text-xs rounded-sm hover:bg-bg-hover hover:border-gold transition-all shrink-0"
                  >
                    {summary ? T.overwrite : T.save}
                  </button>
                )}
                <button
                  onClick={() => summary && onLoad(slot)}
                  disabled={!summary}
                  className={`px-3 py-1.5 border font-serif text-xs rounded-sm shrink-0 transition-all ${
                    summary
                      ? 'border-gold-dim text-cream hover:bg-bg-hover hover:border-gold'
                      : 'border-game-border text-game-dim opacity-40 cursor-not-allowed'
                  }`}
                >
                  {T.load}
                </button>
                <button
                  onClick={() => summary && onDelete(slot)}
                  disabled={!summary}
                  className={`text-xs shrink-0 ${
                    summary ? 'text-game-dim hover:text-rust' : 'text-game-dim opacity-30 cursor-not-allowed'
                  }`}
                >
                  {T.delete}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
