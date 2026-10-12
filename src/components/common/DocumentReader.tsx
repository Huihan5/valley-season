import { useState } from 'react';
import { GameState } from '../../types/game';
import { DocBlock, getDocument } from '../../systems/DocumentSystem';
import DATA from '../../data';

const T = DATA.ui.inventory;

interface Props {
  state: GameState;
  /** The satchel item being read, which is also the document's id. */
  id: string;
  title: string;
  onBack: () => void;
}

/**
 * A paper from the satchel, open. The deed is set the way its source is: each clause in the
 * Old Tongue, which binds, with the Common Tongue under it, which does not; the Old Tongue
 * can be put away. The summary leaf is the opening's page and has no second language.
 * Everything here is layout. What the paper says is the DocumentSystem's and the data's.
 */
export default function DocumentReader({ state, id, title, onBack }: Props) {
  const [both, setBoth] = useState(true);
  const doc = getDocument(state, id);
  if (!doc) return null;
  const showOld = doc.bilingual && both;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-4">
        <button onClick={onBack} className="text-game-dim text-xs hover:text-cream">
          ← {T.back}
        </button>
        <span className="text-cream-dim text-xs tracking-wider">{title}</span>
        {doc.bilingual && (
          <div className="ml-auto flex gap-3">
            <Mode label={T.modeBoth} active={both} onClick={() => setBoth(true)} />
            <Mode label={T.modeCommon} active={!both} onClick={() => setBoth(false)} />
          </div>
        )}
      </div>

      <article className="mx-auto max-w-[44rem] border border-game-border bg-bg px-5 sm:px-8 py-6 font-serif">
        {doc.blocks.map(block => (
          <Block key={block.id} b={block} showOld={showOld} />
        ))}
      </article>
    </div>
  );
}

function Lines({ text, className }: { text: string; className: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className={`block ${className}`}>{line}</span>
      ))}
    </>
  );
}

const OLD = 'italic text-game-dim leading-relaxed';

function Block({ b, showOld }: { b: DocBlock; showOld: boolean }) {
  const old = showOld && b.old ? b.old : null;

  switch (b.k) {
    case 'masthead':
      return (
        <div className="text-center mt-1">
          {old && <Lines text={old} className={`${OLD} text-xs tracking-[0.25em]`} />}
          <Lines text={b.common} className="text-cream text-sm tracking-[0.25em]" />
        </div>
      );
    case 'title':
      return (
        <div className="text-center mt-4">
          {old && <Lines text={old} className={`${OLD} text-sm`} />}
          <Lines text={b.common} className="text-cream text-xl leading-snug" />
        </div>
      );
    case 'masthead_small':
      return (
        <div className="text-center mt-3">
          {old && <Lines text={old} className={`${OLD} text-xs tracking-widest`} />}
          <Lines text={b.common} className="text-cream-dim text-xs tracking-widest" />
        </div>
      );
    case 'note':
      return (
        <div className="text-center mt-4 max-w-[34rem] mx-auto">
          {old && <Lines text={old} className={`${OLD} text-xs`} />}
          <Lines text={b.common} className="text-cream-dim text-xs leading-relaxed" />
        </div>
      );
    case 'legend': {
      // First line is the binding text's caption, second the reference text's.
      const [binding, reference] = b.common.split('\n');
      return (
        <div className="mt-6 flex justify-between gap-4 text-[0.65rem] tracking-wider text-gold-dim">
          <span>{showOld ? binding : ''}</span>
          <span className="text-right">{reference}</span>
        </div>
      );
    }
    case 'heading':
      return (
        <div className="mt-8 pb-1 border-b border-game-border">
          {old && <Lines text={old} className={`${OLD} text-xs tracking-wider`} />}
          <Lines text={b.common} className="text-cream-dim text-sm tracking-wider" />
        </div>
      );
    case 'lead':
      return (
        <div className="mt-4">
          {old && <Lines text={old} className={`${OLD} text-sm`} />}
          <Lines text={b.common} className="text-cream-dim text-sm italic leading-relaxed" />
        </div>
      );
    case 'clause':
      return (
        <div className="mt-3 grid grid-cols-[1.75rem_1fr]">
          <span className="text-game-dim text-sm">{b.n}</span>
          <div>
            {old && <Lines text={old} className={`${OLD} text-[0.8rem]`} />}
            <Lines text={b.common} className="text-cream text-sm leading-relaxed" />
          </div>
        </div>
      );
    case 'party':
      return (
        <div className="mt-6">
          {old && <Lines text={old} className={`${OLD} text-xs`} />}
          <Lines text={b.common} className="text-cream text-sm leading-relaxed" />
        </div>
      );
    case 'field':
      return (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <div className="min-w-[8rem]">
            {old && <Lines text={old} className={`${OLD} text-xs`} />}
            <Lines text={b.common} className="text-cream-dim text-sm" />
          </div>
          <div className="flex-1 min-w-[10rem] border-b border-game-border pb-0.5 min-h-[1.5rem]">
            {b.fill && <Lines text={b.fill} className="text-cream text-sm" />}
            {old && b.oldFill && <Lines text={b.oldFill} className={`${OLD} text-xs`} />}
          </div>
        </div>
      );
    case 'seal':
      return (
        <div className="mt-1 text-right">
          {old && <Lines text={old} className={`${OLD} text-xs`} />}
          <Lines text={b.common} className="text-game-dim text-xs" />
        </div>
      );
    default:
      return (
        <div className="mt-3">
          <Lines text={b.common} className="text-cream text-sm leading-relaxed" />
        </div>
      );
  }
}

function Mode({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-serif text-xs pb-0.5 border-b transition-colors ${
        active ? 'text-cream border-gold' : 'text-game-dim border-transparent hover:text-cream'
      }`}
    >
      {label}
    </button>
  );
}
