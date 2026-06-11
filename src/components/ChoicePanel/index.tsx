import { Choice } from '../../types/game';

interface Props {
  choices: Choice[];
  onChoice: (choiceId: string) => void;
  locked?: boolean;
}

export default function ChoicePanel({ choices, onChoice, locked = false }: Props) {
  if (choices.length === 0) {
    return (
      <div className="bg-bg-card border border-game-border rounded-sm px-5 py-4 flex items-center justify-center">
        <span className="text-game-dim text-sm italic">…</span>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-game-border rounded-sm px-4 py-3">
      <p className="text-game-dim text-xs tracking-wider mb-3">— 选择 —</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
            <p className="text-xs text-game-dim leading-snug">
              {choice.disabled && choice.disabledReason
                ? choice.disabledReason
                : choice.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
