import { OpeningPage } from '../types/game';
import { OPENING_PAGES, requiresSignature, signLetter } from '../systems/OpeningSystem';
import NameInput from './common/NameInput';
import ui from '../data/ui.json';

const SIGNATURE_SPEC = {
  target: 'playerName' as const,
  label: ui.opening.signatureLabel,
  placeholder: ui.opening.signaturePrompt,
  maxLength: 12,
};

interface Props {
  page: OpeningPage;
  index: number;
  playerName: string;
  onSign: (name: string) => void;
  onAdvance: () => void;
}

/**
 * Day 0. No status panel, no choices, no clock — the season has not started yet.
 * The letter is framed as a document; everything after it is read as prose.
 */
export default function OpeningSequence({ page, index, playerName, onSign, onAdvance }: Props) {
  const isLetter = page.kind === 'letter';
  const unsigned = requiresSignature(page) && !playerName;
  const body = isLetter ? signLetter(page.text, playerName) : page.text;
  const [title, ...rest] = body.split('\n\n');

  return (
    <div className="h-screen bg-bg text-game-text flex flex-col items-center overflow-hidden p-3 gap-3">
      <div className="w-full max-w-2xl flex-1 flex flex-col min-h-0 bg-bg-card border border-game-border rounded-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-game-border flex items-baseline gap-3">
          <span className="text-gold font-serif text-sm tracking-widest">{page.act}</span>
          {page.heading && (
            <>
              <span className="text-game-dim text-xs">·</span>
              <span className="text-amber text-xs font-serif">{page.heading}</span>
            </>
          )}
          <span className="text-game-dim text-xs ml-auto tracking-wider">
            {index + 1} / {OPENING_PAGES.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLetter ? (
            <div className="border border-gold-dim/40 rounded-sm px-5 py-5 space-y-3">
              <p className="text-gold font-serif text-sm tracking-widest text-center">{title}</p>
              {rest.map((para, i) => (
                <p key={i} className="text-game-text font-serif text-xs leading-relaxed whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-game-text font-serif text-sm leading-loose whitespace-pre-line">
              {body}
            </p>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl">
        {unsigned ? (
          <NameInput spec={SIGNATURE_SPEC} onSubmit={onSign} />
        ) : (
          <div className="bg-bg-card border border-game-border rounded-sm px-4 py-3 flex justify-center">
            <button
              onClick={onAdvance}
              className="px-8 py-2.5 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
            >
              {ui.app.continue}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
