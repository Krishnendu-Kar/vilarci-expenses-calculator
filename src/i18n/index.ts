import { en, type Dict, type Key } from './en';
import { hi } from './hi';
import { bn } from './bn';
import { ta } from './ta';

// App text in four languages. Lib code (reports, parser messages) calls
// translate() directly; screens use the hook in I18nContext so they re-render
// when the language changes.

export type Lang = 'en' | 'hi' | 'bn' | 'ta';
export type { Key };

/** Each language's name written in itself, for the language picker. */
export const LANGS: { code: Lang; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil' },
];

export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Dict> = { en, hi, bn, ta };

let current: Lang = 'en';

export function getLang() {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
}

export function isLang(v: unknown): v is Lang {
  return LANGS.some((l) => l.code === v);
}

// CLDR: Hindi and Bengali treat 0 like 1 ("0 खर्च"); English and Tamil don't.
function isOne(n: number, lang: Lang) {
  return n === 1 || ((lang === 'hi' || lang === 'bn') && n === 0);
}

/** The text for `key` before placeholders are filled; plurals pick by `count`. */
export function rawText(key: Key, count?: number): string {
  const entry = DICTS[current][key] ?? en[key];
  if (typeof entry === 'string') return entry;
  return isOne(count ?? 0, current) ? entry.one : entry.other;
}

/** "{name} pays {to}" + { name: 'A', to: 'B' } → "A pays B". */
export function translate(key: Key, params?: Params): string {
  const text = rawText(key, typeof params?.count === 'number' ? params.count : undefined);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Locale for dates in the current language. Western digits everywhere, to match amounts. */
export function dateLocale(): string {
  return { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN-u-nu-latn', ta: 'ta-IN' }[current];
}
