import { TextPart } from '../../types/game';
import { SpeakerId, isSpeakerId } from '../../data/speakers';
import { hasSpeech, splitSpeech } from '../../utils/speech';
import DATA from '../../data';
import Gregor from '../../assets/portraits/Gregor.png';
import Martha from '../../assets/portraits/Martha.png';
import Elena from '../../assets/portraits/Elena.png';
import Lorenz from '../../assets/portraits/Lorenz.png';
import Thierry from '../../assets/portraits/Thierry.png';
import Timothy from '../../assets/portraits/Timothy.png';

/**
 * A face, where there is one. 亨克, the baroness, the duke and the rest are named without
 * one: a missing portrait shows the name alone, never somebody else's face.
 */
export const PORTRAITS: Partial<Record<SpeakerId, string>> = {
  gregor: Gregor, marta: Martha, elena: Elena, lorenz: Lorenz, thierry: Thierry, timothy: Timothy,
};

export const SPEAKER_NAMES: Record<SpeakerId, string> = DATA.ui.speakers;

/** The face and the name over a line: who is talking. `size` is a Tailwind square. */
export function Speaker({ id, size = 'w-8 h-8', className = '' }: { id: SpeakerId; size?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {PORTRAITS[id] && (
        <img
          src={PORTRAITS[id]}
          alt=""
          className={`${size} rounded-full object-cover border border-gold-dim/40 shrink-0`}
        />
      )}
      <span className="text-gold-dim text-xs font-serif tracking-wider">{SPEAKER_NAMES[id]}</span>
    </div>
  );
}

function Spans({ spans }: { spans: TextPart[] }) {
  return (
    <>
      {spans.map((p, i) => (
        p.known ? <span key={i} className="text-game-known">{p.text}</span> : <span key={i}>{p.text}</span>
      ))}
    </>
  );
}

interface Props {
  text: string;
  /** What the player has read here before, set back a step (difference hints). */
  parts?: TextPart[] | null;
  className: string;
  /**
   * Draw the speaker marks in the prose as faces and names. Off when the whole passage is
   * already under one speaker's header, which is the more general of the two.
   */
  speakers?: boolean;
}

/**
 * The prose of a scene or a result. Plain text is one paragraph block as it always was;
 * a passage with speaker marks (utils/speech.ts) is cut into paragraphs, and a marked line
 * gets its speaker's face and name over it when someone else, or no one, spoke the line
 * before. The parts only annotate the string, so a pair that does not join to it is stale
 * (an event has taken the screen since) and the plain string is shown instead.
 */
export default function Passage({ text, parts, className, speakers = true }: Props) {
  if (!hasSpeech(text)) {
    const joined = parts && parts.map(p => p.text).join('') === text;
    return <p className={className}>{joined && parts ? <Spans spans={parts} /> : text}</p>;
  }

  if (!speakers) {
    const spans = splitSpeech(text, parts).flatMap((block, i): TextPart[] =>
      (i > 0 ? [{ text: '\n\n' }, ...block.spans] : block.spans));
    return <p className={className}><Spans spans={spans} /></p>;
  }

  const blocks = splitSpeech(text, parts);
  // A speaker's face is shown where they start talking and not again until someone else has.
  // Narration in between does not end their turn; a spoken line without a mark (the player's
  // own) does.
  let talking: SpeakerId | null = null;
  return (
    <div>
      {blocks.map((block, i) => {
        const id = block.speaker && isSpeakerId(block.speaker) ? block.speaker : null;
        const opensTurn = id !== null && id !== talking;
        if (id) talking = id;
        else if (/^[“‘]/.test(block.spans[0]?.text ?? '')) talking = null;
        return (
          <div key={i} className={i > 0 ? 'mt-[1.625em]' : undefined}>
            {opensTurn && id && <Speaker id={id} size="w-7 h-7" className="mb-1.5" />}
            <p className={className}><Spans spans={block.spans} /></p>
          </div>
        );
      })}
    </div>
  );
}
