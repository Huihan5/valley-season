import NameInput from './NameInput';
import DATA from '../../data';

const ui = DATA.ui;

/**
 * The name is taken before the documents, not signed on top of them
 * (PlaytestFeedback 2026-09 / D6): you sign the guarantee first, and then read the
 * letter that already bears your name. Day 0 — no clock, no panels.
 */
export default function NameEntry({ onSubmit }: { onSubmit: (name: string) => void }) {
  return (
    <div className="h-screen bg-bg text-game-text flex flex-col items-center justify-center overflow-hidden p-3 gap-5">
      <div className="w-full max-w-md text-center space-y-2">
        <p className="text-gold font-serif text-2xl tracking-widest">{ui.titleScreen.title}</p>
        <p className="text-game-dim text-sm">{ui.opening.namePrompt}</p>
      </div>
      <div className="w-full max-w-md">
        <NameInput
          spec={{
            target: 'playerName',
            label: ui.opening.signatureLabel,
            placeholder: ui.opening.signaturePrompt,
            maxLength: 12,
          }}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
