import { Notice } from '../../types/game';
import Passage from '../ScenePanel/Passage';
import DATA from '../../data';

const T = DATA.ui.notice;

interface Props {
  notice: Notice;
  onClose: () => void;
}

/**
 * Something the season has done to the steward, set in front of the screen until it is read
 * (NoticeSystem). It has one way out, the button: there is nothing here to decide.
 */
export default function NoticeModal({ notice, onClose }: Props) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={notice.title}
      className="fixed inset-0 bg-bg/85 flex items-center justify-center z-[60] p-6"
    >
      <div className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-game-border">
          <span className="text-gold font-serif text-sm tracking-widest">{notice.title}</span>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <Passage
            text={notice.text}
            className="text-cream font-serif text-sm leading-relaxed whitespace-pre-line"
          />
        </div>
        <div className="px-5 py-3 border-t border-game-border flex justify-end">
          <button
            autoFocus
            onClick={onClose}
            className="px-8 py-2 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
          >
            {T.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
