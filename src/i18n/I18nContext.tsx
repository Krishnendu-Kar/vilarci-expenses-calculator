import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLang, isLang, rawText, setLang, translate, type Key, type Lang } from './index';
import { loadSetting, saveSetting } from '../lib/storage';

type RichParams = Record<string, React.ReactNode>;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof translate;
  /** Like t, but placeholders can be elements, e.g. bold names inside a sentence. */
  tr: (key: Key, params: RichParams) => React.ReactNode[];
  ready: boolean;
}

function translateRich(key: Key, params: RichParams): React.ReactNode[] {
  const count = typeof params.count === 'number' ? params.count : undefined;
  return rawText(key, count)
    .split(/(\{\w+\})/g)
    .filter(Boolean)
    .map((part, i) => {
      const m = /^\{(\w+)\}$/.exec(part);
      return m && m[1] in params ? <React.Fragment key={i}>{params[m[1]]}</React.Fragment> : part;
    });
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => {},
  t: translate,
  tr: translateRich,
  ready: true,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSetting('language')
      .then((v) => {
        if (isLang(v)) {
          setLang(v);
          setLangState(v);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const change = useCallback((l: Lang) => {
    // The module-level language changes first, so lib text built during the
    // re-render (reports, dates) is already in the new language.
    setLang(l);
    setLangState(l);
    saveSetting('language', l).catch(() => {});
  }, []);

  // New function identities per language, so memoised screens notice the change.
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: change,
      t: (key, params) => translate(key, params),
      tr: (key, params) => translateRich(key, params),
      ready,
    }),
    [lang, change, ready],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
