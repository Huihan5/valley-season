import { GameState } from '../../types/game';
import { getEstateTasks } from '../../systems/EstateTaskSystem';
import ui from '../../data/ui.json';
import { fill } from '../../utils/text';

const T = ui.estateTaskList;

interface Props {
  state: GameState;
}

/**
 * A standing view of the estate's one-off preparations. It is a reference, not a
 * shop — taking one of these is still an ordinary action in the phase's choice list,
 * because the phase it costs is the part worth deciding about.
 */
export default function EstateTaskList({ state }: Props) {
  const tasks = getEstateTasks(state);
  const outstanding = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="flex flex-col h-full bg-bg-card border border-game-border rounded-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b border-game-border flex items-baseline justify-between">
        <span className="text-gold-dim font-serif text-xs tracking-widest">{T.heading}</span>
        <span className="text-game-dim text-[10px]">{fill(T.outstanding, { n: outstanding })}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className={task.status === 'done' ? 'opacity-40' : undefined}>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-[10px] leading-none ${task.status === 'done' ? 'text-gold-dim' : 'text-game-border'}`}>
                {task.status === 'done' ? '✓' : '○'}
              </span>
              <span className={`font-serif text-xs ${
                task.status === 'blocked' ? 'text-game-dim' : 'text-game-text'
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
          </div>
        ))}
      </div>
    </div>
  );
}
