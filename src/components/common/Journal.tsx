import { useState } from 'react';
import { GameState } from '../../types/game';
import { getJournal, ClueGroupId } from '../../systems/JournalSystem';
import DATA from '../../data';
import mapUrl from '../../assets/map_valehold.png';

const T = DATA.ui.journal;

const GROUP_LABEL: Record<ClueGroupId, string> = {
  estate: T.groupEstate,
  officer: T.groupOfficer,
  noble: T.groupNoble,
};

interface Props {
  state: GameState;
  onClose: () => void;
}

/**
 * What the player is holding, in their own words — every line here is the one that
 * went into the record the evening the clue arrived (see JournalSystem).
 *
 * A group with nothing in it is not drawn at all. There are no totals and no empty
 * slots anywhere in this component, and that is the point: the player is meant to
 * know what they have and not what they are missing (GDD ch.9).
 */
export default function Journal({ state, onClose }: Props) {
  const [tab, setTab] = useState<'clues' | 'map'>('clues');
  const groups = getJournal(state).filter(group => group.entries.length > 0);

  return (
    <div
      className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-game-border flex items-center gap-4">
          <span className="text-cream-dim text-xs tracking-wider">{T.heading}</span>
          <div className="flex gap-3">
            <Tab label={T.tabClues} active={tab === 'clues'} onClick={() => setTab('clues')} />
            <Tab label={T.tabMap} active={tab === 'map'} onClick={() => setTab('map')} />
          </div>
          <button onClick={onClose} className="ml-auto text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {tab === 'clues' ? (
            groups.length === 0 ? (
              <p className="text-game-dim font-serif text-sm py-8 text-center">{T.empty}</p>
            ) : (
              <div className="space-y-6">
                {groups.map(group => (
                  <div key={group.id}>
                    <p className="text-cream-dim text-xs tracking-wider mb-2">
                      {GROUP_LABEL[group.id]}
                    </p>
                    <ul className="space-y-2.5">
                      {group.entries.map(entry => (
                        <li
                          key={entry.flag}
                          className="border-l-2 border-gold-dim pl-4 text-game-text font-serif text-sm leading-relaxed max-w-[46rem]"
                        >
                          {entry.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div>
              <img
                src={mapUrl}
                alt={T.mapAlt}
                className="w-full max-w-full rounded-sm border border-game-border"
              />
              <p className="text-game-dim text-xs mt-2 text-center">{T.mapCaption}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-serif text-xs pb-0.5 border-b transition-colors ${
        active ? 'text-cream border-gold' : 'text-game-dim border-transparent hover:text-cream'
      }`}
    >
      {label}
    </button>
  );
}
