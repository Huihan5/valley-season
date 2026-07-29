import { Choice } from '../../types/game';
import DATA from '../../data';

const ui = DATA.ui;

interface Props {
  choices: Choice[];
  onChoice: (choiceId: string) => void;
  locked?: boolean;
}

export default function ChoicePanel({ choices, onChoice, locked = false }: Props) {
  // The box keeps its height whatever the day offers (PlaytestFeedback 2.g): a
  // market afternoon with nine choices must not push the record up the screen,
  // and a single 继续 must not let it drop. Overflow scrolls inside the box.
  const frame = 'bg-bg-card border border-game-border rounded-sm px-4 py-3 h-52 flex flex-col';

  if (choices.length === 0) {
    return (
      <div className={`${frame} items-center justify-center`}>
        <span className="text-game-dim text-sm italic">…</span>
      </div>
    );
  }

  return (
    <div className={frame}>
      <p className="text-cream-dim text-xs tracking-wider mb-3 shrink-0">{ui.choicePanel.heading}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-1 content-start">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => !locked && !choice.disabled && onChoice(choice.id)}
            disabled={locked || choice.disabled}
            className={`
              group text-left px-4 py-3 rounded-sm border transition-all
              ${choice.disabled || locked
                ? 'border-game-border bg-bg text-game-dim cursor-not-allowed opacity-50'
                : 'border-game-border bg-bg hover:bg-bg-hover hover:border-gold-dim cursor-pointer'
              }
            `}
          >
            <p className={`text-sm font-serif mb-0.5 ${choice.disabled || locked ? 'text-game-dim' : 'text-cream group-hover:text-gold'}`}>
              {choice.text}
            </p>
            {(() => {
              // Judgment choices carry no microcopy at all — no empty line either.
              const note = choice.disabled && choice.disabledReason
                ? choice.disabledReason
                : choice.description;
              return note ? <p className="text-xs text-game-dim leading-snug">{note}</p> : null;
            })()}
          </button>
        ))}
      </div>
    </div>
  );
}
