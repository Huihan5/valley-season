export type Locale = 'zh' | 'en';

export const LOCALES: Locale[] = ['zh', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh';

/** Shown on the language switch. Each name is written in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

const KEY = 'valley-season:locale';

/**
 * Which language the game is in.
 *
 * Deliberately not part of `GameState`: it is a setting on the shell, not a fact
 * about the season. Putting it in the save would lock a run to one language and
 * cost a `SAVE_VERSION` bump for something the save has no opinion about.
 *
 * Read once at module load, so everything downstream can keep its static imports.
 * Under vitest there is no `localStorage` and this falls through to Chinese.
 */
export function getLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(KEY);
    return LOCALES.includes(stored as Locale) ? (stored as Locale) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Writes the choice and reloads, because the text is wired in at module load.
 * A reload is honest here — the season is on the autosave, so nothing is lost.
 */
export function setLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(KEY, locale);
  } catch {
    // A browser that refuses storage still gets the reload; it just forgets after.
  }
  window.location.reload();
}
