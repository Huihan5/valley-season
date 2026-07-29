import zh from './zh';
import en from './en';
import { getLocale } from './locale';

export type { Bundle } from './zh';

/**
 * Every word the game says, in the language it is currently being played in.
 *
 * Both bundles are imported rather than fetched: the whole text of the game is
 * around 90KB across two languages, which is less than one of the portraits, and
 * a static import means no system needs to become async to read a sentence.
 */
const DATA = getLocale() === 'en' ? en : zh;

export default DATA;
