// News from Vilarci (the bell on Home): our own messages, never group
// activity. Plain data helpers, so they can be unit-tested.

export type NewsKind = 'important' | 'update' | 'news';

export interface NewsItem {
  id: number;
  kind: NewsKind;
  title: string;
  body: string;
  /** An https link to open (the Play Store for an update, a page for more). */
  url?: string;
  /** When we posted it (ms). */
  at: number;
}

const KINDS: NewsKind[] = ['important', 'update', 'news'];

/** The server's list (or the saved copy): bad entries dropped, newest first. */
export function parseNews(raw: unknown): NewsItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NewsItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    const id = Number(x.id);
    const title = typeof x.title === 'string' ? x.title.trim() : '';
    const body = typeof x.body === 'string' ? x.body.trim() : '';
    if (!Number.isFinite(id) || id <= 0 || !title) continue;
    const url = typeof x.url === 'string' && /^https:\/\//i.test(x.url) ? x.url : undefined;
    out.push({
      id,
      kind: KINDS.includes(x.kind as NewsKind) ? (x.kind as NewsKind) : 'news',
      title,
      body,
      ...(url ? { url } : {}),
      at: Number(x.at) || 0,
    });
  }
  return out.sort((a, b) => b.id - a.id);
}

/** How many are newer than the last one you saw. */
export const unseenCount = (items: NewsItem[], seenId: number) => items.filter((n) => n.id > seenId).length;
