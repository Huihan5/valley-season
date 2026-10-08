import { useEffect, useRef, useState, RefObject } from 'react';
import { GameState } from '../../types/game';
import { getCodex, codexCategoryOf, CodexEntryView } from '../../systems/CodexSystem';
import { CodexCategory } from '../../data/codex';
import DATA from '../../data';
import { fill } from '../../utils/text';

const T = DATA.codex;

interface Props {
  /** The current run, or null between seasons (title screen) — then only the
   *  cross-run record shows. */
  state: GameState | null;
  /** An entry to open on (a name was clicked elsewhere): its shelf is shown, the page
   *  scrolls to it and its rule is lit. Opens nothing that was not already unlocked. */
  focus?: string;
  onClose: () => void;
}

/**
 * 见闻 — the cross-run codex (round-3 feedback C). People and world knowledge that
 * accumulate across seasons. Locked entries keep their slot as a silhouette and are
 * counted in the "3 / 6", so the panel advertises that there is more to find — the
 * opposite of the investigation 卷宗, which hides what you do not have. A profile's
 * deeper layers stay locked in place until their trust is reached (scheme 乙 + 精修).
 */
export default function CodexPanel({ state, focus, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-gold-dim rounded-sm w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-game-border flex items-center gap-4">
          <span className="text-cream-dim text-xs tracking-wider">{T.heading}</span>
          <button onClick={onClose} className="ml-auto text-game-dim text-xs hover:text-cream">
            {T.close}
          </button>
        </div>
        <CodexBrowser state={state} focus={focus} />
      </div>
    </div>
  );
}

/**
 * The shelves and what is on them, without a frame: the strip of categories and the
 * page under it. The in-season panel and 回望 on the title page both put it inside
 * their own frame, so the two cannot drift apart.
 */
export function CodexBrowser({ state, focus }: { state: GameState | null; focus?: string }) {
  const cats = getCodex(state);
  const [active, setActive] = useState<CodexCategory>(
    (focus && codexCategoryOf(focus)) || cats[0]?.id || 'people',
  );
  const cat = cats.find((c) => c.id === active) ?? cats[0];
  const focused = useRef<HTMLDivElement>(null);

  // Bring the clicked entry into view once, on opening. Optional-called because a test
  // renderer has no layout to scroll.
  useEffect(() => {
    focused.current?.scrollIntoView?.({ block: 'start' });
  }, []);

  return (
    <>
      <div className="px-5 py-2 border-b border-game-border flex gap-4 flex-wrap">
        {cats.map((c) => (
          <Tab
            key={c.id}
            label={c.label}
            count={fill(T.count, { unlocked: c.unlockedCount, total: c.total })}
            active={c.id === active}
            onClick={() => setActive(c.id)}
          />
        ))}
      </div>

      <div className="overflow-y-auto px-5 py-4 flex-1">
        {!cat || cat.entries.length === 0 ? (
          <p className="text-game-dim font-serif text-sm py-8 text-center">{T.empty}</p>
        ) : (
          <div className="space-y-5">
            {cat.entries.map((e) => (
              <Entry
                key={e.id}
                entry={e}
                focused={e.id === focus}
                anchor={e.id === focus ? focused : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** People carry layers; lore entries do not — that is what tells a locked slot's tag apart. */
function Entry({
  entry, focused, anchor,
}: { entry: CodexEntryView; focused: boolean; anchor?: RefObject<HTMLDivElement> }) {
  const isPerson = entry.layers.length > 0;

  if (!entry.unlocked) {
    return (
      <div ref={anchor} className="border-l-2 border-game-border pl-4 py-1 opacity-60">
        <span className="text-game-dim font-serif text-sm">{entry.title}</span>
        <span className="ml-2 text-game-dim/60 text-[11px] tracking-wider align-baseline">
          {isPerson ? T.lockedPerson : T.lockedLore}
        </span>
      </div>
    );
  }

  return (
    <div ref={anchor} className={`border-l-2 pl-4 ${focused ? 'border-gold' : 'border-gold-dim'}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-cream font-serif text-base">{entry.title}</span>
        {entry.subtitle && <span className="text-game-dim text-xs">{entry.subtitle}</span>}
      </div>

      {entry.text && (
        <p className="text-game-text font-serif text-sm leading-relaxed whitespace-pre-line max-w-[46rem]">
          {entry.text}
        </p>
      )}

      {entry.layers.length > 0 && (
        <div className="space-y-2.5 mt-1">
          {entry.layers.map((l) => (
            <div key={l.id}>
              <p className="text-cream-dim text-[11px] tracking-widest uppercase mb-0.5">{l.label}</p>
              {l.locked ? (
                <p className="text-game-dim/60 font-serif text-xs italic">{T.layerLocked}</p>
              ) : (
                <p className="text-game-text font-serif text-sm leading-relaxed whitespace-pre-line max-w-[46rem]">
                  {l.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  label, count, active, onClick,
}: { label: string; count: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-serif text-xs pb-0.5 border-b transition-colors ${
        active ? 'text-cream border-gold' : 'text-game-dim border-transparent hover:text-cream'
      }`}
    >
      {label} <span className="text-game-dim/70 tabular-nums">{count}</span>
    </button>
  );
}
