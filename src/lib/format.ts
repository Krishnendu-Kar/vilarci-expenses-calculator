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
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
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
  if (iso === toISODate(now)) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (iso === toISODate(y)) return 'Yesterday';
  const d = fromISODate(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: d.getFullYear() === now.getFullYear() ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** "27 Oct 2026" */
export function longDate(iso: string) {
  return fromISODate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
