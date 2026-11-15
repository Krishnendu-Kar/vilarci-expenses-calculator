import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '../i18n/I18nContext';
import { loadSetting, saveSetting } from '../lib/storage';
import { fetchNews } from '../lib/api/news';
import { parseNews, unseenCount, type NewsItem } from '../lib/newsData';

// News from Vilarci (the bell on Home): our own messages, read by everyone,
// signed in or not. Asked for on opening, coming back (at most every 10
// minutes) and when a news push arrives; the last list is kept for offline.

const EVERY_MS = 10 * 60 * 1000;

interface NewsValue {
  items: NewsItem[];
  unseen: number;
  /** Ask the server now (or only if it's been a while). */
  refresh: (force?: boolean) => Promise<void>;
  /** You've read them: the dot goes. */
  markSeen: () => void;
}

const NewsContext = createContext<NewsValue>({ items: [], unseen: 0, refresh: async () => {}, markSeen: () => {} });

export function NewsProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [seenId, setSeenId] = useState(Number.MAX_SAFE_INTEGER); // no dot until the saved one is read
  const lastFetch = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < EVERY_MS) return;
    lastFetch.current = Date.now();
    try {
      const next = await fetchNews(langRef.current);
      setItems(next);
      void saveSetting('newsCache', JSON.stringify(next)).catch(() => {});
    } catch {
      // Offline, or the server doesn't have news yet: the saved list stays.
      lastFetch.current = 0;
    }
  }, []);

  useEffect(() => {
    Promise.all([loadSetting('newsCache').catch(() => null), loadSetting('newsSeen').catch(() => null)]).then(([raw, seen]) => {
      try {
        if (raw) setItems((cur) => (cur.length ? cur : parseNews(JSON.parse(raw))));
      } catch {
        // A broken copy: the server's comes next.
      }
      setSeenId(Number(seen) || 0);
    });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    return () => sub.remove();
  }, [refresh]);

  // On start and in a new language.
  useEffect(() => {
    void refresh(true);
  }, [lang, refresh]);

  const markSeen = useCallback(() => {
    const top = items[0]?.id ?? 0;
    if (top <= seenId && seenId !== Number.MAX_SAFE_INTEGER) return;
    setSeenId(top);
    void saveSetting('newsSeen', String(top)).catch(() => {});
  }, [items, seenId]);

  const value = useMemo(
    () => ({ items, unseen: unseenCount(items, seenId), refresh, markSeen }),
    [items, seenId, refresh, markSeen],
  );
  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export const useNews = () => useContext(NewsContext);
