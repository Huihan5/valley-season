import { useState } from 'react';
import { TextInputSpec } from '../../types/game';
import ui from '../../data/ui.json';

interface Props {
  spec: TextInputSpec;
  onSubmit: (value: string) => void;
}

/**
 * The game's only free-text field: the signature line on the Day 0 guarantee letter.
 * Styled as a ruled line rather than a form control — you are signing, not filling in.
 */
export default function NameInput({ spec, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
      className="bg-bg-card border border-game-border rounded-sm px-4 py-3 h-52 flex flex-col justify-center"
    >
      <p className="text-cream-dim text-xs tracking-wider mb-3">— {spec.label} —</p>
      <div className="flex items-end gap-3">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={spec.maxLength}
          placeholder={spec.placeholder}
          className="flex-1 bg-transparent border-b border-gold-dim text-cream font-serif text-base
                     px-1 py-1.5 outline-none focus:border-gold placeholder:text-game-dim/60"
        />
        <button
          type="submit"
          disabled={!trimmed}
          className={`px-6 py-2 border font-serif text-sm rounded-sm transition-all shrink-0
            ${trimmed
              ? 'border-gold-dim text-cream hover:bg-bg-hover hover:border-gold cursor-pointer'
              : 'border-game-border text-game-dim cursor-not-allowed opacity-50'
            }`}
        >
          {ui.opening.sign}
        </button>
      </div>
    </form>
  );
}
