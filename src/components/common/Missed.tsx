import { useState } from 'react';
import { GameState } from '../../types/game';
import { getMissed } from '../../systems/MissedSystem';
import DATA from '../../data';

const T = DATA.endings.missed as unknown as { heading: string; codex: string };

interface Props {
  state: GameState;
  /** Open the codex, on an entry when the line is about a person. */
  onOpenCodex: (entryId?: string) => void;
}

/**
 * Under the ending, apart from it: a closed line that opens onto a few directions, each a
 * place, a person or an hour this season did not reach (plan 3.7). The ending keeps its own
 * close; whoever wants to know where else to look opens this. Nothing here says what was there.
 */
export default function Missed({ state, onOpenCodex }: Props) {
  const lines = getMissed(state);
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;

  return (
    <div className="max-w-[46rem]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="text-game-dim font-serif text-xs hover:text-cream transition-colors"
      >
        <span aria-hidden="true" className="inline-block w-3">{open ? '▾' : '▸'}</span>
        {T.heading}
      </button>

      {open && (
        <ul className="mt-2 ml-1 border-l border-game-border pl-4 space-y-1.5">
          {lines.map((line) => (
            <li key={line.id}>
              {line.codexEntry ? (
                <button
                  type="button"
                  onClick={() => onOpenCodex(line.codexEntry as string)}
                  title={DATA.ui.statusPanel.openCodex}
                  className="text-left text-game-dim font-serif text-xs italic leading-relaxed hover:text-cream transition-colors"
                >
                  {line.text}
                </button>
              ) : (
                <p className="text-game-dim font-serif text-xs italic leading-relaxed">{line.text}</p>
              )}
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onOpenCodex()}
              className="text-game-dim/70 font-serif text-[11px] hover:text-cream transition-colors"
            >
              {T.codex}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
