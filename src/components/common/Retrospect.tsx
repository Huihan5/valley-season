import { useState } from 'react';
import { EndingId } from '../../systems/EndingSystem';
import { CodexBrowser } from './CodexPanel';
import EndingList from './EndingList';
import DATA from '../../data';

const T = DATA.ui.retrospect;

type Page = 'codex' | 'endings';

interface Props {
  seen: EndingId[];
  onClose: () => void;
}

/**
 * 回望 (In Retrospect) — the title page's one way to look back: the 见闻 and the
 * endings this browser has reached, two pages of the same record. Both outlive any one
 * season, which is why neither sits inside a run; in a season the 见闻 opens alone
 * from the header, and the endings are not offered until a season is over.
 */
export default function Retrospect({ seen, onClose }: Props) {
  const [page, setPage] = useState<Page>('codex');

  return (
    <div
      className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-3xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-game-border flex items-center gap-4 flex-wrap">
          <span className="text-cream-dim text-xs tracking-wider">{T.heading}</span>
          <div className="flex gap-4">
            <PageTab label={DATA.codex.open} active={page === 'codex'} onClick={() => setPage('codex')} />
            <PageTab label={T.tabEndings} active={page === 'endings'} onClick={() => setPage('endings')} />
          </div>
          <button onClick={onClose} className="ml-auto text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>

        {page === 'codex' ? <CodexBrowser state={null} /> : <EndingList seen={seen} />}
      </div>
    </div>
  );
}

function PageTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-serif text-sm pb-0.5 border-b transition-colors ${
        active ? 'text-cream border-gold' : 'text-game-dim border-transparent hover:text-cream'
      }`}
    >
      {label}
    </button>
  );
}
