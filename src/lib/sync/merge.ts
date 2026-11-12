import type { Expense, Group, Member, OnlineInfo, Payment, Recurring } from '../../types';
import { expenseFrom, groupInfoFrom, memberFrom, paymentFrom, recurringFromRow, type GroupInfo, type Row } from './wire';

// Server rows going into a group. Each row is turned into an app object once,
// and the same object goes to the database and to the screen; the store
// tells changes apart by object, so nothing that came down is sent back.

/** What came down for one group. An item set to null was deleted. */
export interface Incoming {
  info?: GroupInfo;
  /** null: a guest added here that the server refused. */
  members: Map<string, Member | null>;
  expenses: Map<string, Expense | null>;
  payments: Map<string, Payment | null>;
  recurring: Map<string, Recurring | null>;
  /** A download from 0: only these local items stay (they wait in the outbox). */
  replace?: Set<string>;
  online?: Partial<OnlineInfo>;
}

export const emptyIncoming = (): Incoming => ({
  members: new Map(),
  expenses: new Map(),
  payments: new Map(),
  recurring: new Map(),
});

export type ItemTable = 'members' | 'expenses' | 'payments' | 'recurring';

/** Adds one server row (or a deletion) to `into`. False when it's broken and left out. */
export function take(into: Incoming, table: ItemTable | 'groups', row: Row | null, id: string): boolean {
  if (table === 'groups') {
    const info = row && groupInfoFrom(row);
    if (info) into.info = info;
    return !!info;
  }
  if (table === 'members') {
    if (!row) {
      into.members.set(id, null);
      return true;
    }
    const m = memberFrom(row);
    if (m) into.members.set(id, m);
    return !!m;
  }
  if (!row || row.deleted_at != null) {
    into[table].set(id, null);
    return true;
  }
  const item = table === 'expenses' ? expenseFrom(row) : table === 'payments' ? paymentFrom(row) : recurringFromRow(row);
  if (item) (into[table] as Map<string, typeof item>).set(id, item);
  return !!item;
}

function applyList<T extends { id: string }>(
  list: T[],
  changes: Map<string, T | null>,
  replace: Set<string> | undefined,
  newAtEnd = false,
): T[] {
  if (!changes.size && !replace) return list;
  const start = replace ? list.filter((x) => replace.has(x.id)) : list;
  const seen = new Set<string>();
  const kept = start.flatMap((x) => {
    if (!changes.has(x.id)) return [x];
    seen.add(x.id);
    const n = changes.get(x.id);
    return n ? [n] : [];
  });
  const added = [...changes].filter(([id, v]) => v && !seen.has(id)).map(([, v]) => v as T);
  // New items at the top, like one added here; new members at the end.
  return newAtEnd ? [...kept, ...added] : [...added, ...kept];
}

/** The group with what came down put in. The same group back when nothing changes. */
export function applyIncoming(g: Group, d: Incoming, now: number): Group {
  const members = applyList(g.members, d.members, d.replace, true);
  const expenses = applyList(g.expenses, d.expenses, d.replace);
  const payments = applyList(g.payments, d.payments, d.replace);
  const oldRecurring = g.recurring ?? [];
  const recurring = applyList(oldRecurring, d.recurring, d.replace);
  const online =
    g.online && (d.info || d.online)
      ? {
          ...g.online,
          ...(d.info ? { settings: d.info.settings } : {}),
          ...d.online,
        }
      : g.online;
  if (online && d.info) {
    if (d.info.deletedAt !== null) online.deletedAt = d.info.deletedAt;
    else delete online.deletedAt;
  }
  const name = d.info?.name ?? g.name;
  const kind = d.info?.kind ?? g.kind;
  const same =
    members === g.members &&
    expenses === g.expenses &&
    payments === g.payments &&
    recurring === oldRecurring &&
    name === g.name &&
    kind === g.kind &&
    JSON.stringify(online) === JSON.stringify(g.online);
  if (same) return g;
  const { recurring: _r, ...rest } = g;
  return {
    ...rest,
    name,
    kind,
    members,
    expenses,
    payments,
    ...(recurring.length ? { recurring } : {}),
    ...(online ? { online } : {}),
    updatedAt: now,
  };
}

function rebaseList<T extends { id: string }>(cur: T[], base: T[], next: T[]): T[] {
  if (cur === base) return next;
  if (base === next) return cur;
  const b = new Map(base.map((x) => [x.id, x]));
  const c = new Map(cur.map((x) => [x.id, x]));
  const n = new Set(next.map((x) => x.id));
  const out: T[] = [];
  for (const item of next) {
    const was = b.get(item.id);
    const mine = c.get(item.id);
    // Changed here while the sync ran (or deleted here): this phone's version stays.
    if (was && mine !== was) {
      if (mine) out.push(mine);
    } else out.push(item);
  }
  const addedHere = cur.filter((x) => !b.has(x.id) && !n.has(x.id));
  return [...addedHere, ...out];
}

/**
 * A sync worked from `base`, the group as saved, and made `next`. On the
 * screen the group may have changed meanwhile (`current`): keep those
 * changes, take everything else from `next`. They are saved next and go up
 * with the following sync.
 */
export function rebase(current: Group, base: Group, next: Group): Group {
  if (current === base) return next;
  const { recurring: _r, ...rest } = next;
  const recurring = rebaseList(current.recurring ?? [], base.recurring ?? [], next.recurring ?? []);
  return {
    ...rest,
    name: current.name !== base.name ? current.name : next.name,
    kind: current.kind !== base.kind ? current.kind : next.kind,
    members: rebaseList(current.members, base.members, next.members),
    expenses: rebaseList(current.expenses, base.expenses, next.expenses),
    payments: rebaseList(current.payments, base.payments, next.payments),
    ...(recurring.length ? { recurring } : {}),
    updatedAt: Math.max(current.updatedAt, next.updatedAt),
  };
}
