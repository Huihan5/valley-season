import { useEffect, useRef, useState } from 'react';
import { GameState } from '../../types/game';
import { calendarPoints, getReturnMornings, ReturnMorning, ReturnPointId } from '../../systems/ReturnSystem';
import { dayName } from '../../systems/TimeSystem';
import DATA from '../../data';
import { fill } from '../../utils/text';

const T = DATA.ui.returnPoints;
const FIRST_POINT_DAY = Math.min(...calendarPoints().map(p => p.day));

interface Props {
  /** The finished season. */
  state: GameState;
  /** Take up the season again at this morning. */
  onReturn: (state: GameState) => void;
}

/**
 * Under the ending, beside the missed lines and as quiet: a closed line that opens onto a few
 * mornings of this same season to go back to. Finding them replays the whole season, so it is
 * done once, the first time the line is opened, and not on every render; a season with nothing
 * to go back to shows the line until it is opened and then nothing.
 */
export default function ReturnPoints({ state, onReturn }: Props) {
  const [open, setOpen] = useState(false);
  const [mornings, setMornings] = useState<ReturnMorning[] | null>(null);
  const [asking, setAsking] = useState<ReturnPointId | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const listed = open && mornings !== null && mornings.length > 0;

  // Folded at the foot of the reading column, the list opens below what can be seen: bring it in
  // once it is drawn (not again when a morning is asked about).
  useEffect(() => {
    if (listed) list.current?.scrollIntoView?.({ block: 'nearest' });
  }, [listed]);

  // A season that cannot be walked back at all offers nothing, and says nothing either: no
  // history to replay, or an end that came before the first point's morning.
  if (!state.demoComplete || state.seed === undefined || !state.history) return null;
  if (state.day <= FIRST_POINT_DAY) return null;
  if (mornings !== null && mornings.length === 0) return null;

  const toggle = () => {
    if (!open && mornings === null) setMornings(getReturnMornings(state));
    setOpen(o => !o);
    setAsking(null);
  };

  return (
    <div className="max-w-[46rem]">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="text-game-dim font-serif text-xs hover:text-cream transition-colors"
      >
        <span aria-hidden="true" className="inline-block w-3">{open ? '▾' : '▸'}</span>
        {T.heading}
      </button>

      {open && mornings && mornings.length > 0 && (
        <ul ref={list} className="mt-2 ml-1 border-l border-game-border pl-4 space-y-1.5">
          <li>
            <p className="text-game-dim font-serif text-xs italic leading-relaxed">{T.note}</p>
          </li>
          {mornings.map((m) => (
            <li key={m.id}>
              {asking === m.id ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-cream-dim font-serif text-xs">{fill(T.confirm, { day: dayName(m.day) })}</span>
                  <button
                    type="button"
                    onClick={() => onReturn(m.state)}
                    className="text-gold-dim font-serif text-xs hover:text-gold transition-colors"
                  >
                    {T.yes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsking(null)}
                    className="text-game-dim font-serif text-xs hover:text-cream transition-colors"
                  >
                    {T.no}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsking(m.id)}
                  className="text-left text-game-dim font-serif text-xs leading-relaxed hover:text-cream transition-colors"
                >
                  {fill(T.point, { day: dayName(m.day), name: T.names[m.id] })}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
