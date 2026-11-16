/**
 * The number that picks a choice from the keyboard. Quiet, and drawn only where a keyboard is
 * likely (`@media (pointer: fine)`, see `.key-badge` in index.css): never on a touch screen.
 */
export default function KeyBadge({ n, off = false }: { n: number; off?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`key-badge shrink-0 mt-0.5 w-5 h-5 rounded-sm border text-[11px] tabular-nums ${
        off ? 'border-game-border text-game-dim' : 'border-gold-dim/50 text-gold-dim group-hover:border-gold group-hover:text-gold'
      }`}
    >
      {n}
    </span>
  );
}
