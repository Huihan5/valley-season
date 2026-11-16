import { Choice } from '../../types/game';
import {
  getEffectChips, hasEstimatedYield, getChoiceCategory, ChoiceCategory,
} from '../../systems/ChoicePreview';
import { MAX_NUMBERED } from '../../systems/KeySystem';
import KeyBadge from '../common/KeyBadge';
import { useMediaQuery } from '../common/useMediaQuery';
import DATA from '../../data';

const C = DATA.ui.choicePanel;

/**
 * UI direction B (narrative-first): the choices live inline under the prose and
 * scroll with it, in one of two shapes. A day's own actions are a compact,
 * categorised grid — 劳作 / 往来 / 休整, each card showing its time and cost — so a
 * player can find the thing they meant to do. An event's answers are a single
 * column of full sentences, because there the point is reading the difference
 * between them, not scanning a shelf. The reducer sees the same `Choice[]` either
 * way; only the presentation changes with the state.
 */

/** Estate tasks and the market trip already live in the left panel at desktop
 *  width, so their duplicates here are left out from `lg` up (they return below `lg`,
 *  where the sidebar is gone). They are not drawn at all at that width, not hidden by CSS:
 *  the keys 1–9 mean the nth numbered button on the page, and the badge must show that same n. */
const LG_UP = '(min-width: 1024px)';
const delegatedToSidebar = (id: string) => id.startsWith('task_') || id === 'go_to_market';

/** Costs read rust, gains read gold — the estate's own two colours (D11/P7). */
function EffectChips({ choice }: { choice: Choice }) {
  const chips = getEffectChips(choice);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
      {chips.map((c) => (
        <span
          key={c.key}
          className={`text-[11px] tabular-nums ${c.tone === 'gain' ? 'text-gold' : 'text-rust'}`}
        >
          <span aria-hidden="true">{c.icon}</span> {c.sign}{c.value}
        </span>
      ))}
    </div>
  );
}

/** The microcopy under a choice: a blocked reason, or the cost/description. Harvest
 *  and felling hide their yield behind a tier word, tinted to still read as a gain. */
function ChoiceNote({ choice, locked }: { choice: Choice; locked: boolean }) {
  const note = choice.disabled && choice.disabledReason ? choice.disabledReason : choice.description;
  if (!note) return null;
  const gainHint = !choice.disabled && !locked && hasEstimatedYield(choice);
  return <p className={`text-xs leading-snug ${gainHint ? 'text-gold-dim' : 'text-game-dim'}`}>{note}</p>;
}

const buttonClass = (off: boolean) => `group text-left rounded-sm border transition-all ${
  off
    ? 'border-game-border bg-bg text-game-dim cursor-not-allowed opacity-50'
    : 'border-game-border bg-bg hover:bg-bg-hover hover:border-gold hover:shadow-[inset_0_0_0_1px_rgba(196,163,90,0.35)] active:bg-bg-warm active:translate-y-px cursor-pointer'
}`;

interface Props {
  choices: Choice[];
  mode: 'daily' | 'event';
  onChoice: (choiceId: string) => void;
  locked?: boolean;
}

export default function ChoicePanel({ choices, mode, onChoice, locked = false }: Props) {
  if (choices.length === 0) {
    return <p className="text-game-dim text-sm italic">…</p>;
  }
  return mode === 'event'
    ? <EventChoices choices={choices} onChoice={onChoice} locked={locked} />
    : <DailyChoices choices={choices} onChoice={onChoice} locked={locked} />;
}

// ── Event: a column of full sentences ───────────────────────────────────────

function EventChoices({ choices, onChoice, locked }: Omit<Props, 'mode'> & { locked: boolean }) {
  return (
    <div>
      <p className="text-cream-dim text-xs tracking-wider mb-3">{C.eventHeading}</p>
      <div className="space-y-2 max-w-[46rem]">
        {choices.map((choice, i) => {
          const off = locked || !!choice.disabled;
          return (
            <button
              key={choice.id}
              onClick={() => !off && onChoice(choice.id)}
              disabled={off}
              data-hotkey-choice=""
              className={`${buttonClass(off)} w-full flex items-start gap-3 px-4 py-3`}
            >
              {i < MAX_NUMBERED && <KeyBadge n={i + 1} off={off} />}
              <span className="flex-1 min-w-0">
                <p className={`text-sm font-serif ${off ? 'text-game-dim' : 'text-cream group-hover:text-gold'}`}>
                  {choice.text}
                </p>
                <ChoiceNote choice={choice} locked={locked} />
                {!choice.disabled && choice.description ? <EffectChips choice={choice} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Daily: the categories stacked, each under its own label ──────────────────
// The player was clicking through tabs and forgetting a whole category was there;
// with the cards already grouped, showing all three at once (labor / social /
// rest) reads in one pass and suits the single reading column (P-round-3). Empty
// categories drop out so a phase only shows the labels it actually has.

const CATS: { key: ChoiceCategory; label: string }[] = [
  { key: 'labor', label: C.tabLabor },
  { key: 'social', label: C.tabSocial },
  { key: 'rest', label: C.tabRest },
];

function DailyChoices({ choices, onChoice, locked }: Omit<Props, 'mode'> & { locked: boolean }) {
  const sidebar = useMediaQuery(LG_UP);
  const byCat: Record<ChoiceCategory, Choice[]> = { labor: [], social: [], rest: [] };
  choices
    .filter((c) => !(sidebar && delegatedToSidebar(c.id)))
    .forEach((c) => byCat[getChoiceCategory(c)].push(c));
  // The number of a card is its place among the cards drawn, in the order they are drawn.
  const number = new Map<string, number>();
  CATS.forEach(({ key }) => byCat[key].forEach((c) => number.set(c.id, number.size + 1)));

  return (
    <div>
      <p className="text-cream-dim text-xs tracking-wider mb-3">{C.dailyHeading}</p>
      <div className="space-y-4 max-w-[46rem]">
        {CATS.map(({ key, label }) => {
          const group = byCat[key];
          if (group.length === 0) return null;
          return (
            <section key={key}>
              <p className="text-game-dim text-[11px] font-serif tracking-widest uppercase mb-1.5">{label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.map((choice) => {
                  const off = locked || !!choice.disabled;
                  const n = number.get(choice.id) as number;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => !off && onChoice(choice.id)}
                      disabled={off}
                      data-hotkey-choice=""
                      className={`${buttonClass(off)} px-4 py-3`}
                    >
                      <div className="flex items-start gap-2 mb-0.5">
                        {n <= MAX_NUMBERED && <KeyBadge n={n} off={off} />}
                        <p className={`text-sm font-serif ${off ? 'text-game-dim' : 'text-cream group-hover:text-gold'}`}>
                          {choice.text}
                        </p>
                      </div>
                      <ChoiceNote choice={choice} locked={locked} />
                      {!choice.disabled && choice.description ? <EffectChips choice={choice} /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
