import type { Group } from '../types';
import { sanitizeGroups } from './migrate';

// Deleting a group moves it to the Bin. It can be restored for 30 days,
// then it's deleted for good (checked each time the app starts).

export interface BinItem {
  group: Group;
  binnedAt: number;
}

export const BIN_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

/** Whole days before it's deleted for good, at least 1 while it's still here. */
export function binDaysLeft(item: BinItem, now = Date.now()) {
  return Math.max(1, Math.ceil((item.binnedAt + BIN_DAYS * DAY_MS - now) / DAY_MS));
}

/** Drops anything that has been in the Bin for 30 days. */
export function purgeBin(bin: BinItem[], now = Date.now()): BinItem[] {
  const kept = bin.filter((b) => now - b.binnedAt < BIN_DAYS * DAY_MS);
  return kept.length === bin.length ? bin : kept;
}

/** The Bin as stored; broken entries are dropped. */
export function sanitizeBin(raw: unknown): BinItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BinItem[] = [];
  for (const item of raw) {
    const r = item as { group?: unknown; binnedAt?: unknown } | null;
    if (!r || typeof r.binnedAt !== 'number') continue;
    const [group] = sanitizeGroups([r.group]).groups;
    if (group && !out.some((b) => b.group.id === group.id)) out.push({ group, binnedAt: r.binnedAt });
  }
  return out;
}
