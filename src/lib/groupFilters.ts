import type { Group, GroupKind } from '../types';

/** How often each group was opened on this phone. Never exported or shared. */
export type Visits = Record<string, { count: number; last: number }>;

/**
 * Pin, archive and lock state per group, on this phone only (like visits).
 * pinUntil: null = pinned for good, a timestamp = pinned until then.
 * lockedAt: opening the group asks for the fingerprint or screen lock.
 */
export interface GroupPref {
  pinnedAt?: number;
  pinUntil?: number | null;
  archivedAt?: number;
  lockedAt?: number;
}
export type GroupPrefs = Record<string, GroupPref>;

export type GroupFilter = 'all' | GroupKind | 'visited' | 'archived';

const DAY_MS = 24 * 3600 * 1000;

export function isPinned(pref: GroupPref | undefined, now = Date.now()) {
  return pref?.pinnedAt != null && (pref.pinUntil == null || pref.pinUntil > now);
}

export function isArchived(pref: GroupPref | undefined) {
  return pref?.archivedAt != null;
}

export function isLocked(pref: GroupPref | undefined) {
  return pref?.lockedAt != null;
}

/** Days left on a timed pin (rounded up), or null for "always" / not pinned. */
export function pinDaysLeft(pref: GroupPref | undefined, now = Date.now()) {
  if (!isPinned(pref, now) || pref!.pinUntil == null) return null;
  return Math.max(1, Math.ceil((pref!.pinUntil - now) / DAY_MS));
}

/**
 * all / trip / hostel / other: pinned first (latest pin on top), then newest
 * activity. Archived groups only show under "archived".
 * visited: only groups opened at least once, most opened first.
 */
export function filterGroups(
  groups: Group[],
  filter: GroupFilter,
  visits: Visits,
  prefs: GroupPrefs = {},
  now = Date.now(),
): Group[] {
  if (filter === 'archived') {
    return groups
      .filter((g) => isArchived(prefs[g.id]))
      .sort((a, b) => (prefs[b.id].archivedAt ?? 0) - (prefs[a.id].archivedAt ?? 0));
  }
  const active = groups.filter((g) => !isArchived(prefs[g.id]));
  if (filter === 'visited') {
    return active
      .filter((g) => (visits[g.id]?.count ?? 0) > 0)
      .sort((a, b) => visits[b.id].count - visits[a.id].count || visits[b.id].last - visits[a.id].last);
  }
  const list = filter === 'all' ? active : active.filter((g) => g.kind === filter);
  const pinnedAt = (g: Group) => (isPinned(prefs[g.id], now) ? prefs[g.id].pinnedAt! : 0);
  return [...list].sort((a, b) => pinnedAt(b) - pinnedAt(a) || b.updatedAt - a.updatedAt);
}

/** Pins for `days` days, or for good when days is null. */
export function pin(prefs: GroupPrefs, groupId: string, days: number | null, now = Date.now()): GroupPrefs {
  const { archivedAt: _a, ...rest } = prefs[groupId] ?? {};
  return { ...prefs, [groupId]: { ...rest, pinnedAt: now, pinUntil: days == null ? null : now + days * DAY_MS } };
}

export function unpin(prefs: GroupPrefs, groupId: string): GroupPrefs {
  const { pinnedAt: _p, pinUntil: _u, ...rest } = prefs[groupId] ?? {};
  return tidy({ ...prefs, [groupId]: rest });
}

/** Archiving also unpins: an archived group is out of the way. A lock stays. */
export function archive(prefs: GroupPrefs, groupId: string, now = Date.now()): GroupPrefs {
  const lockedAt = prefs[groupId]?.lockedAt;
  return { ...prefs, [groupId]: { archivedAt: now, ...(lockedAt != null ? { lockedAt } : {}) } };
}

export function unarchive(prefs: GroupPrefs, groupId: string): GroupPrefs {
  const { archivedAt: _a, ...rest } = prefs[groupId] ?? {};
  return tidy({ ...prefs, [groupId]: rest });
}

export function lock(prefs: GroupPrefs, groupId: string, now = Date.now()): GroupPrefs {
  return { ...prefs, [groupId]: { ...prefs[groupId], lockedAt: now } };
}

export function unlock(prefs: GroupPrefs, groupId: string): GroupPrefs {
  const { lockedAt: _l, ...rest } = prefs[groupId] ?? {};
  return tidy({ ...prefs, [groupId]: rest });
}

/** Drops deleted groups and pins that have run out. */
export function prunePrefs(prefs: GroupPrefs, groups: Group[], now = Date.now()): GroupPrefs {
  const ids = new Set(groups.map((g) => g.id));
  const out: GroupPrefs = {};
  for (const [id, p] of Object.entries(prefs)) {
    if (!ids.has(id)) continue;
    const keep: GroupPref = isPinned(p, now) ? { pinnedAt: p.pinnedAt, pinUntil: p.pinUntil ?? null } : {};
    if (p.archivedAt != null) keep.archivedAt = p.archivedAt;
    if (p.lockedAt != null) keep.lockedAt = p.lockedAt;
    if (Object.keys(keep).length) out[id] = keep;
  }
  return out;
}

function tidy(prefs: GroupPrefs): GroupPrefs {
  return Object.fromEntries(Object.entries(prefs).filter(([, p]) => Object.keys(p).length > 0));
}

export function sanitizePrefs(raw: unknown): GroupPrefs {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: GroupPrefs = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as { pinnedAt?: unknown; pinUntil?: unknown; archivedAt?: unknown; lockedAt?: unknown } | null;
    if (!r || typeof r !== 'object') continue;
    const p: GroupPref = {};
    if (typeof r.pinnedAt === 'number') {
      p.pinnedAt = r.pinnedAt;
      p.pinUntil = typeof r.pinUntil === 'number' ? r.pinUntil : null;
    }
    if (typeof r.archivedAt === 'number') p.archivedAt = r.archivedAt;
    if (typeof r.lockedAt === 'number') p.lockedAt = r.lockedAt;
    if (Object.keys(p).length) out[id] = p;
  }
  return out;
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
