import type { GroupKind, Member } from '../types';

// The New group form, kept while it isn't created yet, so leaving the page
// (or the app) doesn't lose what was typed. One at a time, this phone only.

/** Where a new group is kept: on this phone, or online (shared by link). */
export type GroupWhere = 'local' | 'online';

export interface GroupDraft {
  name: string;
  kind: GroupKind;
  members: Member[];
  /** Which member is you. */
  meId: string | null;
  where: GroupWhere;
  savedAt: number;
}

const KINDS: GroupKind[] = ['trip', 'hostel', 'other'];

/** Worth keeping: a name typed, or someone added besides you. */
export function draftHasContent(d: Pick<GroupDraft, 'name' | 'members' | 'meId'>): boolean {
  return !!d.name.trim() || d.members.some((m) => m.id !== d.meId);
}

/** A draft from storage; null when there's none or it can't be used. */
export function parseGroupDraft(raw: string | null): GroupDraft | null {
  if (!raw) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof d !== 'object' || d === null) return null;
  const r = d as Record<string, unknown>;
  const members = Array.isArray(r.members)
    ? r.members.filter(
        (m): m is Member =>
          typeof m === 'object' && m !== null && typeof (m as Member).id === 'string' && typeof (m as Member).name === 'string',
      )
    : [];
  const draft: GroupDraft = {
    name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
    kind: KINDS.includes(r.kind as GroupKind) ? (r.kind as GroupKind) : 'trip',
    members: members.map((m) => ({ id: m.id, name: m.name.slice(0, 30) })),
    meId: typeof r.meId === 'string' ? r.meId : null,
    where: r.where === 'online' ? 'online' : 'local',
    savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
  };
  return draftHasContent(draft) ? draft : null;
}

/** Group ids waiting for internet to go online, from storage. */
export function parseOnlineQueue(raw: string | null): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : [];
  } catch {
    return [];
  }
}
