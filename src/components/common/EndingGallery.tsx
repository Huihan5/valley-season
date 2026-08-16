import { ENDING_IDS, EndingId, getEndingData } from '../../systems/EndingSystem';
import DATA from '../../data';

const T = DATA.ui.gallery;

interface Props {
  seen: EndingId[];
  onClose: () => void;
}

/**
 * A record of the endings this browser has reached, kept outside the save so that
 * branching from a Day 27 slot builds the list up instead of overwriting it.
 *
 * Unlike the journal, this one does show what is missing. The five endings are a
 * stated fact of the design (GDD ch.10) rather than something the player is meant
 * to be uncertain about, and a gallery that hid its own length would not be a
 * reason to play the month again.
 */
export default function EndingGallery({ seen, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-game-border flex items-center justify-between">
          <span className="text-cream-dim text-xs tracking-wider">{T.heading}</span>
          <button onClick={onClose} className="text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {seen.length === 0 && (
            <p className="text-game-dim font-serif text-sm py-6 text-center">{T.empty}</p>
          )}
          {ENDING_IDS.map(id => {
            const found = seen.includes(id);
            const ending = getEndingData(id);
            return (
              <div
                key={id}
                className={`border rounded-sm px-4 py-3 ${
                  found ? 'border-gold-dim' : 'border-game-border'
                }`}
              >
                {found ? (
                  <>
                    <p className="text-gold font-serif text-sm">{ending.title}</p>
                    <p className="text-game-text text-xs mt-1 leading-relaxed">{ending.subtitle}</p>
                  </>
                ) : (
                  <p className="text-game-dim font-serif text-sm opacity-50">{T.unseen}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
