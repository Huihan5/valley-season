import { GameState, Choice } from '../../types/game';
import { getEstateTasks } from '../../systems/EstateTaskSystem';
import DATA from '../../data';
import { fill } from '../../utils/text';

const ui = DATA.ui;

const T = ui.estateTaskList;

interface Props {
  state: GameState;
  /** Ids the player can act on right now (in the phase's choices, not disabled). */
  actionableIds: Set<string>;
  /** The market trip, when it is on offer today — pinned above the business (D5). */
  marketChoice?: Choice | null;
  onTake: (id: string) => void;
}

/**
 * The estate's one-off preparations, now the place they are taken from (D5): a task
 * that can be done right now is a button here, and the same entry no longer doubles
 * in the bottom choice list at desktop width. Blocked and finished ones stay as
 * reference. On a market day the trip is pinned at the top, because Saturday is the
 * one action a player most needs put in front of them (PlaytestFeedback P12/P20).
 *
 * Taking one still spends the phase — the click just dispatches the same choice the
 * bottom panel would have; the reducer resolves it exactly as before.
 */
export default function EstateTaskList({ state, actionableIds, marketChoice, onTake }: Props) {
  const tasks = getEstateTasks(state);
  const outstanding = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="flex flex-col h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b border-game-border flex items-baseline justify-between">
        <span className="text-gold-dim font-serif text-xs tracking-widest">{T.heading}</span>
        <span className="text-game-dim text-[10px]">{fill(T.outstanding, { n: outstanding })}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* Market day, pinned. */}
        {marketChoice && (
          <button
            onClick={() => !marketChoice.disabled && onTake(marketChoice.id)}
            disabled={marketChoice.disabled}
            className={`w-full text-left rounded-sm border px-2.5 py-2 mb-1 transition-all ${
              marketChoice.disabled
                ? 'border-game-border bg-bg text-game-dim cursor-not-allowed opacity-60'
                : 'border-amber/50 bg-bg hover:bg-bg-hover hover:border-amber cursor-pointer'
            }`}
          >
            <span className={`font-serif text-xs ${marketChoice.disabled ? 'text-game-dim' : 'text-amber'}`}>
              {marketChoice.text}
            </span>
            {marketChoice.disabled && marketChoice.disabledReason && (
              <span className="block text-[10px] text-rust/70 leading-snug mt-0.5">{marketChoice.disabledReason}</span>
            )}
          </button>
        )}

        {tasks.map((task) => {
          const takeable = task.status === 'available' && actionableIds.has(task.id);
          const body = (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[10px] leading-none ${task.status === 'done' ? 'text-gold-dim' : 'text-game-border'}`}>
                  {task.status === 'done' ? '✓' : '○'}
                </span>
                <span className={`font-serif text-xs ${
                  task.status === 'blocked' ? 'text-game-dim' : takeable ? 'text-cream' : 'text-game-text'
                }`}>
                  {task.label}
                </span>
              </div>
              <p className={`text-[10px] leading-snug pl-4 ${
                task.status === 'blocked' ? 'text-rust/70' : 'text-game-dim'
              }`}>
                {task.status === 'done' ? T.done
                  : task.status === 'blocked' ? task.blockedReason
                    : task.summary}
              </p>
            </>
          );

          return takeable ? (
            <button
              key={task.id}
              onClick={() => onTake(task.id)}
              className="w-full text-left rounded-sm px-1 py-1 -mx-1 hover:bg-bg-hover cursor-pointer transition-colors"
            >
              {body}
            </button>
          ) : (
            <div key={task.id} className={task.status === 'done' ? 'opacity-40 px-1' : 'px-1'}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
