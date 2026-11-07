import { dateLocale, translate } from '../i18n';

export function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/** "27 Oct" */
export function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

/** Local YYYY-MM-DD (toISOString would shift across midnight in IST). */
export function toISODate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function todayISO() {
  return toISODate(new Date());
}

/** "2026-10-27" → local Date at midnight. */
export function fromISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Today", "Yesterday", "Sun, 25 Oct", or "25 Oct 2025" for other years. */
export function dayLabel(iso: string, now = new Date()) {
  if (iso === toISODate(now)) return translate('date.today');
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (iso === toISODate(y)) return translate('date.yesterday');
  const d = fromISODate(iso);
  return d.toLocaleDateString(dateLocale(), {
    weekday: d.getFullYear() === now.getFullYear() ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** "27 Oct 2026" */
export function longDate(iso: string) {
  return fromISODate(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-10" → "October 2026" */
export function monthLabel(month: string) {
  return fromISODate(`${month}-01`).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
}
