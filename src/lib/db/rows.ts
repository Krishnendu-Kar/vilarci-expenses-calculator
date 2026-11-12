import type { CategoryKey, Expense, Group, GroupKind, Member, OnlineInfo, Payment, Recurring, SplitMode } from '../../types';
import { monthOf, repeatExpenseId } from '../months';

// Groups ↔ table rows. The app keeps whole groups in memory and changes them
// without mutating (a changed expense is a new object, an untouched one is
// the same object), so working out what to write is a cheap comparison of
// the last saved state with the new one.

export type SQLValue = string | number | null;

export interface Statement {
  sql: string;
  params: SQLValue[];
}

/** A saved group. binnedAt: null in the list, a time while it's in the Bin. */
export interface Saved {
  group: Group;
  binnedAt: number | null;
}

const COLUMNS = {
  groups: ['id', 'name', 'kind', 'created_at', 'updated_at', 'binned_at'],
  // The cursor is left out: only a sync moves it (setCursor in store.ts).
  online_groups: [
    'group_id',
    'role',
    'status',
    'edit_info',
    'add_expenses',
    'add_guests',
    'require_approval',
    'deleted_at',
  ],
  members: ['group_id', 'person_id', 'name', 'pos', 'role', 'account', 'gone'],
  expenses: [
    'group_id',
    'id',
    'title',
    'amount',
    'category',
    'split_mode',
    'date',
    'month',
    'note',
    'recurring_id',
    'pinned_at',
    'archived_at',
    'created_at',
  ],
  recurring: ['group_id', 'id', 'title', 'amount', 'category', 'split_mode', 'note', 'day', 'last_month', 'created_at'],
  payers: ['group_id', 'parent_id', 'person_id', 'amount', 'pos'],
  splits: ['group_id', 'parent_id', 'person_id', 'pos', 'value'],
  payments: ['group_id', 'id', 'from_id', 'to_id', 'amount', 'created_at'],
  closed_months: ['group_id', 'month'],
  outbox: ['tbl', 'group_id', 'row_id', 'op', 'updated_at'],
} as const;

type Table = keyof typeof COLUMNS;

/** What an outbox line points at: the server's table names. */
export type SyncTable = 'groups' | 'members' | 'expenses' | 'payments' | 'recurring';

/** Insert order: groups before the rows that point at them. */
const TABLES = Object.keys(COLUMNS) as Table[];

// SQLite allows 32766 values per statement; stay well under it.
const MAX_VALUES = 9000;

/** Multi-row inserts, split so no statement gets too many values. */
export function insertRows(table: string, columns: readonly string[], rows: SQLValue[][], tail = ''): Statement[] {
  const out: Statement[] = [];
  const per = Math.max(1, Math.floor(MAX_VALUES / columns.length));
  const one = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    out.push({
      sql: `INSERT ${tail ? '' : 'OR REPLACE '}INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => one).join(', ')}${tail}`,
      params: chunk.flat(),
    });
  }
  return out;
}

/** `DELETE … WHERE group_id = ? AND <column> IN (…)`, split like inserts. */
function deleteIn(table: string, column: string, values: string[], groupId?: string): Statement[] {
  const out: Statement[] = [];
  for (let i = 0; i < values.length; i += MAX_VALUES) {
    const chunk = values.slice(i, i + MAX_VALUES);
    const ins = `${column} IN (${chunk.map(() => '?').join(', ')})`;
    out.push(
      groupId === undefined
        ? { sql: `DELETE FROM ${table} WHERE ${ins}`, params: chunk }
        : { sql: `DELETE FROM ${table} WHERE group_id = ? AND ${ins}`, params: [groupId, ...chunk] },
    );
  }
  return out;
}

const updateAll = (key: string, columns: readonly string[]) =>
  ` ON CONFLICT(${key}) DO UPDATE SET ${columns
    .slice(1)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')}`;

const TAILS: Partial<Record<Table, string>> = {
  // A group's own row never uses INSERT OR REPLACE: replacing it would delete
  // everything that belongs to it. Its online row keeps its cursor.
  groups: updateAll('id', COLUMNS.groups),
  online_groups: updateAll('group_id', COLUMNS.online_groups),
  // A second change to the same item replaces the first; the later time stays
  // (a repeat adding this month must not hide a real edit waiting to go).
  outbox:
    ' ON CONFLICT(tbl, group_id, row_id) DO UPDATE SET op = excluded.op,' +
    ' updated_at = max(outbox.updated_at, excluded.updated_at), tries = 0, last_error = NULL',
};

/** When the outbox lines of one save were made, in server time. */
export interface OutboxStamp {
  now: number;
}

// The fixed time of an expense a repeat added: the same on every phone, and
// older than any real edit or delete of it (§9.5).
const repeatTime = (e: Expense) =>
  e.recurringId && e.id === repeatExpenseId(e.recurringId, monthOf(e.date))
    ? Date.UTC(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, Number(e.date.slice(8, 10)))
    : null;

// A repeat whose only change is the month it reached: moved on by this phone
// adding the month's expense, not edited. Sent as time 0, so it never wins
// over a real edit; the server still keeps the later month.
const monthOnly = (before: Recurring, after: Recurring) =>
  JSON.stringify({ ...before, lastMonth: '' }) === JSON.stringify({ ...after, lastMonth: '' });

class Writer {
  deletes: Statement[] = [];
  rows = Object.fromEntries(TABLES.map((t) => [t, [] as SQLValue[][]])) as Record<Table, SQLValue[][]>;

  queue(table: SyncTable, groupId: string, rowId: string, op: 'upsert' | 'delete', at: number) {
    this.rows.outbox.push([table, groupId, rowId, op, at]);
  }

  money(groupId: string, e: Expense | Recurring) {
    Object.entries(e.payers).forEach(([person, amount], i) => this.rows.payers.push([groupId, e.id, person, amount, i]));
    e.splitAmong.forEach((person, i) =>
      this.rows.splits.push([groupId, e.id, person, i, e.splitValues?.[person] ?? null]),
    );
  }

  expense(groupId: string, e: Expense) {
    this.rows.expenses.push([
      groupId,
      e.id,
      e.title,
      e.amount,
      e.category,
      e.splitMode,
      e.date,
      e.month ?? null,
      e.note ?? null,
      e.recurringId ?? null,
      e.pinnedAt ?? null,
      e.archivedAt ?? null,
      e.createdAt,
    ]);
    this.money(groupId, e);
  }

  recurring(groupId: string, r: Recurring) {
    this.rows.recurring.push([groupId, r.id, r.title, r.amount, r.category, r.splitMode, r.note ?? null, r.day, r.lastMonth, r.createdAt]);
    this.money(groupId, r);
  }

  payment(groupId: string, p: Payment) {
    this.rows.payments.push([groupId, p.id, p.from, p.to, p.amount, p.createdAt]);
  }

  /**
   * Only the expenses (or payments, repeats) that were added, changed or
   * removed. `queue`, for a live group: also an outbox line for each.
   */
  list<T extends { id: string }>(
    groupId: string,
    table: 'expenses' | 'recurring' | 'payments',
    before: T[] | undefined,
    after: T[] | undefined,
    write: (item: T) => void,
    queue?: (item: T | null, was: T | undefined, id: string) => void,
  ) {
    if (before === after) return;
    const old = new Map((before ?? []).map((x) => [x.id, x]));
    const now = new Set<string>();
    const changed: string[] = [];
    for (const item of after ?? []) {
      now.add(item.id);
      const was = old.get(item.id);
      if (was === item) continue;
      if (was) changed.push(item.id);
      write(item);
      queue?.(item, was, item.id);
    }
    const removed = [...old.keys()].filter((id) => !now.has(id));
    if (removed.length) this.deletes.push(...deleteIn(table, 'id', removed, groupId));
    removed.forEach((id) => queue?.(null, old.get(id), id));
    // Who paid and the splits are written again in full for a changed item.
    if (table !== 'payments') {
      const stale = [...changed, ...removed];
      if (stale.length) {
        this.deletes.push(...deleteIn('payers', 'parent_id', stale, groupId), ...deleteIn('splits', 'parent_id', stale, groupId));
      }
    }
  }

  online(g: Group) {
    const o = g.online!;
    this.rows.online_groups.push([
      g.id,
      o.role,
      o.status,
      o.settings.editInfo,
      o.settings.addExpenses,
      o.settings.addGuests,
      o.settings.requireApproval ? 1 : 0,
      o.deletedAt ?? null,
    ]);
  }

  statements(): Statement[] {
    return [
      ...this.deletes,
      ...TABLES.flatMap((t) => (this.rows[t].length ? insertRows(t, COLUMNS[t], this.rows[t], TAILS[t] ?? '') : [])),
    ];
  }
}

/**
 * The statements that turn the saved state `before` into `after`. With
 * `stamp`, changes to live groups also go in the outbox, in the same
 * transaction (onlinedb.md §9.1). Without it (changes that came from the
 * server) nothing is queued, so nothing is sent back.
 */
export function planGroups(before: Map<string, Saved>, after: Saved[], stamp?: OutboxStamp): Statement[] {
  const w = new Writer();
  const kept = new Set<string>();
  for (const { group: g, binnedAt } of after) {
    kept.add(g.id);
    const was = before.get(g.id);
    if (was && was.group === g && was.binnedAt === binnedAt) continue;
    const old = was?.group;
    w.rows.groups.push([g.id, g.name, g.kind, g.createdAt, g.updatedAt, binnedAt]);
    if (g.online && old?.online !== g.online) w.online(g);
    if (!g.online && old?.online) w.deletes.push({ sql: 'DELETE FROM online_groups WHERE group_id = ?', params: [g.id] });
    if (!old || old.members !== g.members) {
      if (old) w.deletes.push({ sql: 'DELETE FROM members WHERE group_id = ?', params: [g.id] });
      g.members.forEach((m, i) =>
        w.rows.members.push([g.id, m.id, m.name, i, m.role ?? null, m.account ? 1 : 0, m.gone ?? null]),
      );
    }
    if (!old || old.closedMonths !== g.closedMonths) {
      if (old) w.deletes.push({ sql: 'DELETE FROM closed_months WHERE group_id = ?', params: [g.id] });
      (g.closedMonths ?? []).forEach((m) => w.rows.closed_months.push([g.id, m]));
    }

    // Only a group that was already live: putting one online uploads it whole.
    const live = stamp && old?.online && g.online?.status === 'active' ? stamp.now : null;
    const op = (item: unknown) => (item ? 'upsert' : 'delete');
    w.list(
      g.id,
      'expenses',
      old?.expenses,
      g.expenses,
      (e) => w.expense(g.id, e),
      live === null
        ? undefined
        : (e, was, id) => w.queue('expenses', g.id, id, op(e), (e && !was && repeatTime(e)) || live),
    );
    w.list(
      g.id,
      'payments',
      old?.payments,
      g.payments,
      (p) => w.payment(g.id, p),
      live === null ? undefined : (p, _was, id) => w.queue('payments', g.id, id, op(p), live),
    );
    w.list(
      g.id,
      'recurring',
      old?.recurring,
      g.recurring,
      (r) => w.recurring(g.id, r),
      live === null
        ? undefined
        : (r, was, id) => w.queue('recurring', g.id, id, op(r), r && was && monthOnly(was, r) ? 0 : live),
    );

    if (live !== null && old) {
      if (old.name !== g.name || old.kind !== g.kind) w.queue('groups', g.id, g.id, 'upsert', live);
      // Guests added, renamed or moved. Leaving and removing aren't changes a phone uploads.
      const oldPos = new Map(old.members.map((m, i) => [m.id, { m, i }]));
      g.members.forEach((m, i) => {
        const o = oldPos.get(m.id);
        if (!m.account && !m.gone && (!o || o.m.name !== m.name || o.i !== i)) w.queue('members', g.id, m.id, 'upsert', live);
      });
    }
  }
  const gone = [...before.keys()].filter((id) => !kept.has(id));
  // Everything in the group goes with it (ON DELETE CASCADE).
  if (gone.length) w.deletes.push(...deleteIn('groups', 'id', gone));
  return w.statements();
}

// ---- reading back ----

export interface GroupRow {
  id: string;
  name: string;
  kind: string;
  created_at: number;
  updated_at: number;
  binned_at: number | null;
}
export interface MemberRow {
  group_id: string;
  person_id: string;
  name: string;
  role: string | null;
  account: number;
  gone: string | null;
}
export interface OnlineRow {
  group_id: string;
  role: string | null;
  status: string;
  edit_info: string;
  add_expenses: string;
  add_guests: string;
  require_approval: number;
  deleted_at: number | null;
}
export interface ExpenseRow {
  group_id: string;
  id: string;
  title: string;
  amount: number;
  category: string;
  split_mode: string;
  date: string;
  month: string | null;
  note: string | null;
  recurring_id: string | null;
  pinned_at: number | null;
  archived_at: number | null;
  created_at: number;
}
export interface RecurringRow {
  group_id: string;
  id: string;
  title: string;
  amount: number;
  category: string;
  split_mode: string;
  note: string | null;
  day: number;
  last_month: string;
  created_at: number;
}
export interface PayerRow {
  group_id: string;
  parent_id: string;
  person_id: string;
  amount: number;
}
export interface SplitRow {
  group_id: string;
  parent_id: string;
  person_id: string;
  value: number | null;
}
export interface PaymentRow {
  group_id: string;
  id: string;
  from_id: string;
  to_id: string;
  amount: number;
  created_at: number;
}
export interface MonthRow {
  group_id: string;
  month: string;
}

export interface GroupTables {
  groups: GroupRow[];
  online_groups: OnlineRow[];
  members: MemberRow[];
  expenses: ExpenseRow[];
  recurring: RecurringRow[];
  payers: PayerRow[];
  splits: SplitRow[];
  payments: PaymentRow[];
  closed_months: MonthRow[];
}

/** The SELECTs for GroupTables, each in the order the app shows things. */
export const SELECTS: Record<keyof GroupTables, string> = {
  groups: 'SELECT * FROM groups ORDER BY updated_at DESC',
  online_groups: 'SELECT * FROM online_groups',
  members: 'SELECT group_id, person_id, name, role, account, gone FROM members ORDER BY group_id, pos',
  expenses: 'SELECT * FROM expenses ORDER BY created_at DESC, rowid DESC',
  recurring: 'SELECT * FROM recurring ORDER BY created_at, rowid',
  payers: 'SELECT group_id, parent_id, person_id, amount FROM payers ORDER BY group_id, parent_id, pos',
  splits: 'SELECT group_id, parent_id, person_id, value FROM splits ORDER BY group_id, parent_id, pos',
  payments: 'SELECT * FROM payments ORDER BY created_at DESC, rowid DESC',
  closed_months: 'SELECT * FROM closed_months ORDER BY month',
};

const byGroup = <T extends { group_id: string }>(rows: T[]) => {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.group_id);
    if (list) list.push(r);
    else m.set(r.group_id, [r]);
  }
  return m;
};

const key = (groupId: string, parentId: string) => `${groupId}\n${parentId}`;

const memberOf = (m: MemberRow): Member => ({
  id: m.person_id,
  name: m.name,
  ...(m.role !== null ? { role: m.role as Member['role'] } : {}),
  ...(m.account ? { account: true } : {}),
  ...(m.gone !== null ? { gone: m.gone as Member['gone'] } : {}),
});

const onlineOf = (o: OnlineRow): OnlineInfo => ({
  role: o.role as OnlineInfo['role'],
  status: o.status as OnlineInfo['status'],
  settings: {
    editInfo: o.edit_info as 'all' | 'admins',
    addExpenses: o.add_expenses as 'all' | 'admins',
    addGuests: o.add_guests as 'all' | 'admins',
    requireApproval: o.require_approval === 1,
  },
  ...(o.deleted_at !== null ? { deletedAt: o.deleted_at } : {}),
});

/** Whole groups again, from their rows. */
export function assembleGroups(t: GroupTables): Saved[] {
  const online = new Map(t.online_groups.map((o) => [o.group_id, o]));
  const members = byGroup(t.members);
  const expenses = byGroup(t.expenses);
  const recurring = byGroup(t.recurring);
  const payments = byGroup(t.payments);
  const months = byGroup(t.closed_months);
  const payers = new Map<string, Record<string, number>>();
  for (const p of t.payers) {
    const k = key(p.group_id, p.parent_id);
    payers.set(k, { ...payers.get(k), [p.person_id]: p.amount });
  }
  const splits = new Map<string, SplitRow[]>();
  for (const s of t.splits) {
    const k = key(s.group_id, s.parent_id);
    splits.set(k, [...(splits.get(k) ?? []), s]);
  }

  const moneyOf = (groupId: string, r: { id: string; split_mode: string }) => {
    const k = key(groupId, r.id);
    const among = splits.get(k) ?? [];
    const mode = r.split_mode as SplitMode;
    return {
      payers: payers.get(k) ?? {},
      splitMode: mode,
      splitAmong: among.map((s) => s.person_id),
      ...(mode !== 'equal'
        ? { splitValues: Object.fromEntries(among.filter((s) => s.value !== null).map((s) => [s.person_id, s.value as number])) }
        : {}),
    };
  };

  return t.groups.map((g): Saved => {
    const closedMonths = (months.get(g.id) ?? []).map((m) => m.month);
    const reps = (recurring.get(g.id) ?? []).map(
      (r): Recurring => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        category: r.category as CategoryKey,
        ...moneyOf(g.id, r),
        ...(r.note !== null ? { note: r.note } : {}),
        day: r.day,
        lastMonth: r.last_month,
        createdAt: r.created_at,
      }),
    );
    const o = online.get(g.id);
    return {
      binnedAt: g.binned_at,
      group: {
        id: g.id,
        name: g.name,
        kind: g.kind as GroupKind,
        members: (members.get(g.id) ?? []).map(memberOf),
        expenses: (expenses.get(g.id) ?? []).map(
          (e): Expense => ({
            id: e.id,
            title: e.title,
            amount: e.amount,
            category: e.category as CategoryKey,
            ...moneyOf(g.id, e),
            date: e.date,
            ...(e.month !== null ? { month: e.month } : {}),
            ...(e.note !== null ? { note: e.note } : {}),
            ...(e.recurring_id !== null ? { recurringId: e.recurring_id } : {}),
            ...(e.pinned_at !== null ? { pinnedAt: e.pinned_at } : {}),
            ...(e.archived_at !== null ? { archivedAt: e.archived_at } : {}),
            createdAt: e.created_at,
          }),
        ),
        payments: (payments.get(g.id) ?? []).map(
          (p): Payment => ({ id: p.id, from: p.from_id, to: p.to_id, amount: p.amount, createdAt: p.created_at }),
        ),
        // Only present when used, like groups saved before.
        ...(closedMonths.length ? { closedMonths } : {}),
        ...(reps.length ? { recurring: reps } : {}),
        ...(o ? { online: onlineOf(o) } : {}),
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      },
    };
  });
}
