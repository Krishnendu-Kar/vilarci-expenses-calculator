// Push notifications: the plain data parts (no native modules), so they can
// be unit-tested. Used by api/push, lib/push and PushContext.

export interface PushPrefs {
  expenses: boolean;
  payments: boolean;
  members: boolean;
  requests: boolean;
  reminders: boolean;
  news: boolean;
  mutedGroups: string[];
}

export type PushKind = Exclude<keyof PushPrefs, 'mutedGroups'>;
export const PUSH_KINDS: PushKind[] = ['expenses', 'payments', 'members', 'requests', 'reminders', 'news'];

export const DEFAULT_PREFS: PushPrefs = {
  expenses: true,
  payments: true,
  members: true,
  requests: true,
  reminders: true,
  news: true,
  mutedGroups: [],
};

/** The server's answer (or a saved copy) as prefs; defaults for anything missing. */
export function parsePrefs(raw: unknown): PushPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const flag = (k: PushKind) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : true);
  const muted = r.muted_groups ?? r.mutedGroups;
  return {
    expenses: flag('expenses'),
    payments: flag('payments'),
    members: flag('members'),
    requests: flag('requests'),
    reminders: flag('reminders'),
    news: flag('news'),
    mutedGroups: Array.isArray(muted) ? muted.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** What a tapped notification points at. */
export interface PushTarget {
  kind: string;
  uid?: string;
  groupId?: string;
}

export function pushTarget(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : undefined);
  const kind = str('kind');
  return kind ? { kind, uid: str('uid'), groupId: str('group_id') } : null;
}

/** Shown only if it's for the signed-in account (or carries no account, like news). */
export const forThisAccount = (t: PushTarget | null, userId: string | null | undefined) => !t?.uid || t.uid === userId;
