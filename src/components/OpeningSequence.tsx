import { FlagMap, OpeningPage } from '../types/game';
import {
  OPENING_PAGES, answeredChoice, isQuestion, openingBody, requiresSignature, signLetter,
} from '../systems/OpeningSystem';
import NameInput from './common/NameInput';
import DATA from '../data';

const ui = DATA.ui;

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
  /** What the season has written so far; a question page reads its answer back from here. */
  flags: FlagMap;
  onSign: (name: string) => void;
  onAnswer: (choiceId: string) => void;
  onAdvance: () => void;
  onSkip: () => void;
}

/**
 * Day 0. No status panel, no clock — the season has not started yet. The letter is framed
 * as a document; everything after it is read as prose, except the one place the Baron asks
 * a question, where the answer is the player's.
 */
export default function OpeningSequence({ page, index, playerName, flags, onSign, onAnswer, onAdvance, onSkip }: Props) {
  const isLetter = page.kind === 'letter';
  const unsigned = requiresSignature(page) && !playerName;
  const body = isLetter ? signLetter(page.text, playerName) : openingBody(page, flags);
  const asking = isQuestion(page) && !answeredChoice(page, flags);
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
        ) : asking ? (
          <div className="bg-bg-card border border-game-border rounded-sm px-4 py-3 space-y-2 relative">
            {page.choices!.map((choice, i) => (
              <button
                key={choice.id}
                onClick={() => onAnswer(choice.id)}
                className="group w-full text-left flex items-start gap-3 px-4 py-3 rounded-sm border border-game-border bg-bg hover:bg-bg-hover hover:border-gold hover:shadow-[inset_0_0_0_1px_rgba(196,163,90,0.35)] active:bg-bg-warm active:translate-y-px transition-all cursor-pointer"
              >
                <span className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-sm border border-gold-dim/50 text-gold-dim text-[11px] tabular-nums group-hover:border-gold group-hover:text-gold">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 text-sm font-serif text-cream group-hover:text-gold">
                  {choice.text}
                </span>
              </button>
            ))}
            <div className="flex justify-end pt-1">
              <button
                onClick={onSkip}
                className="text-game-dim text-xs hover:text-cream transition-colors"
              >
                {ui.opening.skip}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-bg-card border border-game-border rounded-sm px-4 py-3 flex items-center justify-center relative">
            <button
              onClick={onAdvance}
              className="px-8 py-2.5 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
            >
              {ui.app.continue}
            </button>
            {/* The way straight to Day 1, for a returning player (D6). */}
            <button
              onClick={onSkip}
              className="absolute right-4 text-game-dim text-xs hover:text-cream transition-colors"
            >
              {ui.opening.skip}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
