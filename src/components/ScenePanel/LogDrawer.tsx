import { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../../types/game';
import { PHASE_LABELS, dayName } from '../../systems/TimeSystem';
import DATA from '../../data';
import { fill } from '../../utils/text';

const ui = DATA.ui;

/**
 * The record, which used to show the last four lines and let everything older
 * fall off the bottom (PlaytestFeedback 2.g.i). Collapsed it is one line tall and
 * stays put; opened it lifts over the scene and holds the whole season, scrolled
 * to the end, because the thing a player wants is usually the thing just before
 * the thing they are looking at.
 */
export default function LogDrawer({ log }: { log: LogEntry[] }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Opened, or opened and then lived through another phase: the newest line is
  // the one worth being on.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, log.length]);

  if (log.length === 0) return null;

  const shown = open ? log : log.slice(-2);

  return (
    <div className="border-t border-game-border shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-2 hover:bg-bg-hover transition-colors"
      >
        <span className="text-cream-dim text-xs tracking-wider">{ui.logDrawer.heading}</span>
        <span className="text-game-dim text-xs">
          {open ? ui.logDrawer.collapse : fill(ui.logDrawer.expand, { n: log.length })}
        </span>
      </button>
      <div
        ref={listRef}
        className={`px-5 pb-3 space-y-1 ${open ? 'max-h-64 overflow-y-auto' : ''}`}
      >
        {shown.map((entry, i) => (
          <p key={open ? i : log.length - shown.length + i} className="text-game-dim text-xs font-serif">
            <span className="text-gold-dim">
              {dayName(entry.day)} {PHASE_LABELS[entry.phase]}
            </span>
            {'　'}
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}
