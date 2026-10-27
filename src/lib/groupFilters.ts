import type { Group, GroupKind } from '../types';

/** How often each group was opened on this phone. Never exported or shared. */
export type Visits = Record<string, { count: number; last: number }>;

export type GroupFilter = 'all' | GroupKind | 'visited';

/**
 * all / trip / hostel / other: newest activity first.
 * visited: only groups opened at least once, most opened first.
 */
export function filterGroups(groups: Group[], filter: GroupFilter, visits: Visits): Group[] {
  if (filter === 'visited') {
    return groups
      .filter((g) => (visits[g.id]?.count ?? 0) > 0)
      .sort((a, b) => visits[b.id].count - visits[a.id].count || visits[b.id].last - visits[a.id].last);
  }
  const list = filter === 'all' ? groups : groups.filter((g) => g.kind === filter);
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addVisit(visits: Visits, groupId: string, now = Date.now()): Visits {
  return { ...visits, [groupId]: { count: (visits[groupId]?.count ?? 0) + 1, last: now } };
}

/** Drops counts for groups that no longer exist. */
export function pruneVisits(visits: Visits, groups: Group[]): Visits {
  const ids = new Set(groups.map((g) => g.id));
  return Object.fromEntries(Object.entries(visits).filter(([id]) => ids.has(id)));
}

/** Accepts whatever was stored; anything malformed is ignored. */
export function sanitizeVisits(raw: unknown): Visits {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Visits = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as { count?: unknown; last?: unknown } | null;
    if (r && Number.isInteger(r.count) && (r.count as number) > 0 && typeof r.last === 'number') {
      out[id] = { count: r.count as number, last: r.last };
    }
  }
  return out;
}
