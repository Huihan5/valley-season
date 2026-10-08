import { useState } from 'react';
import { GameState } from '../../types/game';
import { InventoryItem, InventoryTab, getPapers, getThings } from '../../systems/InventorySystem';
import Journal from './Journal';
import DATA from '../../data';

const T = DATA.ui.inventory;

interface Props {
  state: GameState;
  onClose: () => void;
}

/**
 * The satchel: one place for everything the steward is holding. The 卷宗 (the evidence)
 * is one of its three tabs, beside the papers and the small things people have handed
 * over. Like the file, it shows what the player has and never what they lack.
 */
export default function Inventory({ state, onClose }: Props) {
  const [tab, setTab] = useState<InventoryTab>('dossier');

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
            <Tab label={T.tabDossier} active={tab === 'dossier'} onClick={() => setTab('dossier')} />
            <Tab label={T.tabPapers} active={tab === 'papers'} onClick={() => setTab('papers')} />
            <Tab label={T.tabThings} active={tab === 'things'} onClick={() => setTab('things')} />
          </div>
          <button onClick={onClose} className="ml-auto text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {tab === 'dossier' && <Journal state={state} />}
          {tab === 'papers' && <Items items={getPapers(state)} />}
          {tab === 'things' && <Items items={getThings(state)} />}
        </div>
      </div>
    </div>
  );
}

function Items({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-game-dim font-serif text-sm py-8 text-center">{T.empty}</p>;
  }
  return (
    <ul className="space-y-4">
      {items.map(item => (
        <li key={item.id} className="border-l-2 border-gold-dim pl-4 font-serif max-w-[46rem]">
          <p className="text-cream text-sm">{item.name}</p>
          <p className="text-game-dim text-sm leading-relaxed mt-0.5">{item.line}</p>
        </li>
      ))}
    </ul>
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
