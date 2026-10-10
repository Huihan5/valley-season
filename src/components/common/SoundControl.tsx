import { useEffect, useRef, useState } from 'react';
import DATA from '../../data';
import { getAudioSettings, setAudioSettings, playCue } from '../../audio';

const T = DATA.ui.sound;

const BUTTON = {
  // Sits with 见闻 / 行囊 / 存档 in a season's header.
  header: 'text-game-dim text-xs hover:text-cream transition-colors shrink-0',
  // Sits beside 回望 on the title page.
  title: 'px-4 py-2.5 border border-game-border text-game-text font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold-dim transition-all',
};

/**
 * The one place to turn the sound off or down: a mute switch and a volume slider, behind one
 * word. It reads and writes the player's settings (kept in the browser, not in a save), and it
 * is not drawn at all when the build has no sound to play.
 */
export default function SoundControl({ variant, wide = false }: { variant: keyof typeof BUTTON; wide?: boolean }) {
  const [settings, setSettings] = useState(getAudioSettings);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // The panel closes on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!settings) return null;

  const change = (next: { muted?: boolean; volume?: number }) => setSettings(setAudioSettings(next) ?? settings);
  // Let go of the slider and hear how loud that is.
  const hear = () => playCue('ui_tap');

  return (
    <div ref={root} className={`relative shrink-0 ${wide ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`${BUTTON[variant]} ${wide ? 'w-full' : ''}`}
      >
        {T.open}{settings.muted ? ` · ${T.off}` : ''}
      </button>
      {open && (
        <div
          role="group"
          aria-label={T.open}
          className="absolute right-0 top-full mt-2 z-30 w-52 space-y-3 rounded-sm border border-game-border bg-bg-card p-3 text-left shadow-lg shadow-black/40"
        >
          <label className="flex cursor-pointer items-center gap-2 font-serif text-xs text-game-text">
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={e => change({ muted: e.target.checked })}
              className="accent-gold"
            />
            {T.mute}
          </label>
          <label className="block text-xs text-game-dim">
            {T.volume}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.volume * 100)}
              onChange={e => change({ volume: Number(e.target.value) / 100, muted: false })}
              onPointerUp={hear}
              onKeyUp={hear}
              className="mt-1 block w-full accent-gold"
            />
          </label>
        </div>
      )}
    </div>
  );
}
