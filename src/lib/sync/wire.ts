import type { CategoryKey, Expense, Group, GroupKind, GroupSettings, Member, Payment, Recurring, Role, SplitMode } from '../../types';
import { expenseShares } from '../split';
import type { SyncTable } from '../db/rows';

// The app's objects ↔ the server's rows (supabase/migrations/…_sync.sql).
// Money lists travel as [[member id, value], …] in order: the order decides
// who gets a leftover paisa, so it must survive the trip both ways.

/** A row as the server sends it: its columns, by name. */
export type Row = Record<string, unknown>;

type Pair = [string, number | null];

/** One upload (§9.2): the item's data, or `deleted`. */
export interface Change {
  table: SyncTable;
  group_id: string;
  id: string;
  updated_at: number;
  data?: Row;
  deleted?: true;
}

export interface ChangeResult {
  table: SyncTable;
  group_id: string;
  id: string;
  status: 'applied' | 'rejected';
  seq?: number | null;
  /** not_member, not_allowed, older, invalid, group_full, group_deleted, no_group. */
  reason?: string;
  detail?: string | null;
  /** The server's copy, which replaces the phone's; null: it has none. */
  current?: Row | null;
}

/** What changed in one group after the phone's bookmark (§9.3). */
export interface Page {
  group_id: string;
  cursor: number;
  more: boolean;
  /** From 0: the phone's copy is replaced, not added to. */
  full: boolean;
  group: Row | null;
  members: Row[];
  expenses: Row[];
  payments: Row[];
  recurring: Row[];
  events: Row[];
  join_requests: Row[];
}

/** One of your groups on the server. none: you have no place in it (or it's gone). */
export interface Membership {
  id: string;
  status: 'active' | 'left' | 'removed' | 'none';
  role?: Role;
  last_seq?: number;
  deleted_at?: number | null;
}

export interface SyncResponse {
  server_now: number;
  results: ChangeResult[];
  groups: Membership[];
  changes: Page[];
}

// ---- to the server ----

function moneyData(e: Expense | Recurring) {
  return {
    split_mode: e.splitMode,
    payers: Object.entries(e.payers),
    splits: e.splitAmong.map((id): Pair => [id, e.splitMode === 'equal' ? null : (e.splitValues?.[id] ?? null)]),
  };
}

export function expenseData(e: Expense): Row {
  const shares = expenseShares(e);
  return {
    title: e.title,
    amount: e.amount,
    category: e.category,
    date: e.date,
    month: e.month ?? null,
    ...moneyData(e),
    owed: e.splitAmong.map((id) => [id, shares[id] ?? 0]),
    note: e.note ?? null,
    recurring_id: e.recurringId ?? null,
    pinned_at: e.pinnedAt ?? null,
    archived_at: e.archivedAt ?? null,
    created_at: e.createdAt,
  };
}

export const paymentData = (p: Payment): Row => ({ from_id: p.from, to_id: p.to, amount: p.amount, created_at: p.createdAt });

export const recurringData = (r: Recurring): Row => ({
  title: r.title,
  amount: r.amount,
  category: r.category,
  ...moneyData(r),
  note: r.note ?? null,
  day: r.day,
  last_month: r.lastMonth,
  created_at: r.createdAt,
});

/** What an outbox line uploads: the item as it is now, or its deletion. */
export function changeFor(
  line: { tbl: SyncTable; group_id: string; row_id: string; op: string; updated_at: number },
  group: Group | undefined,
): Change {
  const base = { table: line.tbl, group_id: line.group_id, id: line.row_id, updated_at: line.updated_at };
  const gone = { ...base, deleted: true as const };
  if (line.op === 'delete' || !group) return gone;
  const find = <T extends { id: string }>(list: T[] | undefined) => list?.find((x) => x.id === line.row_id);
  switch (line.tbl) {
    case 'groups':
      return { ...base, data: { name: group.name, kind: group.kind } };
    case 'members': {
      const pos = group.members.findIndex((m) => m.id === line.row_id);
      return pos < 0 ? gone : { ...base, data: { name: group.members[pos].name, pos } };
    }
    case 'expenses': {
      const e = find(group.expenses);
      return e ? { ...base, data: expenseData(e) } : gone;
    }
    case 'payments': {
      const p = find(group.payments);
      return p ? { ...base, data: paymentData(p) } : gone;
    }
    case 'recurring': {
      const r = find(group.recurring);
      return r ? { ...base, data: recurringData(r) } : gone;
    }
  }
}

/** The whole group for put_group_online (§8). Your member row must already have your account id. */
export function putOnlineData(g: Group): Row {
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    created_at: g.createdAt,
    members: g.members.map((m) => ({ id: m.id, name: m.name })),
    expenses: g.expenses.map((e) => ({ id: e.id, ...expenseData(e) })),
    payments: g.payments.map((p) => ({ id: p.id, ...paymentData(p) })),
    recurring: (g.recurring ?? []).map((r) => ({ id: r.id, ...recurringData(r) })),
  };
}

// ---- from the server ----

const MODES: SplitMode[] = ['equal', 'exact', 'shares', 'percent'];
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

function pairs(v: unknown): Pair[] | null {
  if (!Array.isArray(v)) return null;
  const ok = v.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && (p[1] === null || typeof p[1] === 'number'));
  return ok ? (v as Pair[]) : null;
}

function moneyFrom(r: Row) {
  const payers = pairs(r.payers);
  const splits = pairs(r.splits);
  const splitMode = r.split_mode as SplitMode;
  if (!payers || !splits || !MODES.includes(splitMode) || num(r.amount) === null || !str(r.title)) return null;
  return {
    title: r.title as string,
    amount: r.amount as number,
    category: r.category as CategoryKey,
    payers: Object.fromEntries(payers.map(([id, v]) => [id, v ?? 0])),
    splitMode,
    splitAmong: splits.map(([id]) => id),
    ...(splitMode !== 'equal' ? { splitValues: Object.fromEntries(splits.map(([id, v]) => [id, v ?? 0])) } : {}),
    ...(str(r.note) ? { note: r.note as string } : {}),
  };
}

/** Null when the row is broken (it's left out, never half-loaded). */
export function expenseFrom(r: Row): Expense | null {
  const money = moneyFrom(r);
  if (!money || !str(r.id) || !str(r.date)) return null;
  return {
    id: r.id as string,
    ...money,
    date: r.date as string,
    ...(str(r.month) ? { month: r.month as string } : {}),
    ...(str(r.recurring_id) ? { recurringId: r.recurring_id as string } : {}),
    ...(num(r.pinned_at) !== null ? { pinnedAt: r.pinned_at as number } : {}),
    ...(num(r.archived_at) !== null ? { archivedAt: r.archived_at as number } : {}),
    createdAt: num(r.created_at) ?? 0,
  };
}

export function paymentFrom(r: Row): Payment | null {
  if (!str(r.id) || !str(r.from_id) || !str(r.to_id) || num(r.amount) === null) return null;
  return { id: r.id as string, from: r.from_id as string, to: r.to_id as string, amount: r.amount as number, createdAt: num(r.created_at) ?? 0 };
}

export function recurringFromRow(r: Row): Recurring | null {
  const money = moneyFrom(r);
  if (!money || !str(r.id) || num(r.day) === null || !str(r.last_month)) return null;
  return { id: r.id as string, ...money, day: r.day as number, lastMonth: r.last_month as string, createdAt: num(r.created_at) ?? 0 };
}

export function memberFrom(r: Row): Member | null {
  if (!str(r.id) || !str(r.name)) return null;
  const status = r.status as string;
  return {
    id: r.id as string,
    name: r.name as string,
    role: (['creator', 'admin', 'member'].includes(r.role as string) ? r.role : 'member') as Role,
    ...(str(r.user_id) ? { account: true } : {}),
    ...(status === 'left' || status === 'removed' || status === 'merged' ? { gone: status } : {}),
  };
}

export interface GroupInfo {
  name: string;
  kind: GroupKind;
  settings: GroupSettings;
  deletedAt: number | null;
}

export function groupInfoFrom(r: Row): GroupInfo | null {
  if (!str(r.name)) return null;
  const who = (v: unknown) => (v === 'admins' ? 'admins' : 'all') as 'all' | 'admins';
  return {
    name: r.name as string,
    kind: (['trip', 'hostel', 'other'].includes(r.kind as string) ? r.kind : 'other') as GroupKind,
    settings: {
      editInfo: who(r.edit_info),
      addExpenses: who(r.add_expenses),
      addGuests: who(r.add_guests),
      requireApproval: r.require_approval === true,
    },
    deletedAt: num(r.deleted_at),
  };
}
