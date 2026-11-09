import type { CategoryKey, Expense, Group, GroupKind, Member, Payment, Person, Recurring, SplitMode } from '../types';
import { toISODate } from './format';

/**
 * Turns anything that claims to be a list of groups (saved data from an older
 * version, or a file someone imported) into valid groups. Anything that
 * can't be trusted is dropped and counted, never half-loaded.
 *
 * v1 → v2: `paidBy: id` became `payers: {id: amount}`, `exactShares` became
 * `splitValues`, and expenses gained a `date`.
 * v2 → v3: hostel groups gained `closedMonths` and `recurring`; expenses
 * gained optional `recurringId`, `pinnedAt` and `archivedAt`. Nothing to
 * convert; v2 data is valid v3.
 * 1.3 added an optional expense `month`. The version stays 3: older apps
 * refuse files with a higher number, and they can simply ignore `month`.
 */
export const SCHEMA_VERSION = 3;

export interface SanitizeResult {
  groups: Group[];
  /** Groups, expenses or payments dropped because they were broken. */
  skipped: number;
}

const KINDS: GroupKind[] = ['trip', 'hostel', 'other'];
const CATEGORIES: CategoryKey[] = ['food', 'travel', 'stay', 'groceries', 'fun', 'shopping', 'other'];
const MODES: SplitMode[] = ['equal', 'exact', 'shares', 'percent'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);

export function sanitizeGroups(raw: unknown): SanitizeResult {
  const counter = { skipped: 0 };
  if (!Array.isArray(raw)) return { groups: [], skipped: 0 };
  const seen = new Set<string>();
  const groups: Group[] = [];
  for (const g of raw) {
    const clean = sanitizeGroup(g, counter);
    if (!clean || seen.has(clean.id)) {
      counter.skipped++;
      continue;
    }
    seen.add(clean.id);
    groups.push(clean);
  }
  return { groups, skipped: counter.skipped };
}

function sanitizeGroup(g: unknown, counter: { skipped: number }): Group | null {
  if (!isObj(g) || !isStr(g.id) || !isStr(g.name) || !Array.isArray(g.members)) return null;

  const members: Member[] = [];
  for (const m of g.members) {
    if (isObj(m) && isStr(m.id) && isStr(m.name) && !members.some((x) => x.id === m.id)) {
      members.push({ id: m.id, name: m.name.trim().slice(0, 30) });
    }
  }
  if (members.length === 0) return null;
  const ids = new Set(members.map((m) => m.id));

  const expenses: Expense[] = [];
  for (const e of Array.isArray(g.expenses) ? g.expenses : []) {
    const clean = sanitizeExpense(e, ids);
    if (clean) expenses.push(clean);
    else counter.skipped++;
  }

  const payments: Payment[] = [];
  for (const p of Array.isArray(g.payments) ? g.payments : []) {
    if (isObj(p) && isStr(p.id) && ids.has(p.from as string) && ids.has(p.to as string) && p.from !== p.to && isPosInt(p.amount)) {
      payments.push({
        id: p.id,
        from: p.from as string,
        to: p.to as string,
        amount: p.amount,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      });
    } else {
      counter.skipped++;
    }
  }

  const closedMonths = Array.isArray(g.closedMonths)
    ? [...new Set(g.closedMonths.filter((m): m is string => typeof m === 'string' && MONTH_RE.test(m)))].sort()
    : [];

  const recurring: Recurring[] = [];
  for (const r of Array.isArray(g.recurring) ? g.recurring : []) {
    const clean = sanitizeRecurring(r, ids);
    if (clean && !recurring.some((x) => x.id === clean.id)) recurring.push(clean);
    else counter.skipped++;
  }

  const now = Date.now();
  return {
    id: g.id,
    name: g.name.trim().slice(0, 40),
    kind: KINDS.includes(g.kind as GroupKind) ? (g.kind as GroupKind) : 'other',
    members,
    expenses,
    payments,
    // Only present when used, so older groups stay exactly as they were.
    ...(closedMonths.length ? { closedMonths } : {}),
    ...(recurring.length ? { recurring } : {}),
    createdAt: typeof g.createdAt === 'number' ? g.createdAt : now,
    updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : now,
  };
}

type Money = Pick<Expense, 'amount' | 'payers' | 'splitMode' | 'splitAmong' | 'splitValues' | 'category' | 'title'>;

/** The fields an expense and a monthly repeat share: amount, who paid, the split. */
function sanitizeMoney(e: Obj, ids: Set<string>): Money | null {
  if (!isPosInt(e.amount)) return null;
  const amount = e.amount;

  // v1 stored a single payer id.
  let payers: Record<string, number> = {};
  if (isStr(e.paidBy)) {
    payers = { [e.paidBy]: amount };
  } else if (isObj(e.payers)) {
    for (const [id, v] of Object.entries(e.payers)) if (isPosInt(v)) payers[id] = v;
  }
  if (!Object.keys(payers).every((id) => ids.has(id)) || sum(payers) !== amount) return null;

  const splitMode = e.splitMode as SplitMode;
  if (!MODES.includes(splitMode) || !Array.isArray(e.splitAmong)) return null;
  const splitAmong = [...new Set(e.splitAmong.filter((id): id is string => typeof id === 'string'))];
  if (splitAmong.length === 0 || !splitAmong.every((id) => ids.has(id))) return null;

  let splitValues: Record<string, number> | undefined;
  if (splitMode !== 'equal') {
    const rawValues = isObj(e.splitValues) ? e.splitValues : isObj(e.exactShares) ? e.exactShares : null;
    if (!rawValues) return null;
    splitValues = {};
    for (const id of splitAmong) {
      const v = rawValues[id];
      if (!isPosInt(v)) return null;
      splitValues[id] = v;
    }
    if (splitMode === 'exact' && sum(splitValues) !== amount) return null;
    if (splitMode === 'percent' && sum(splitValues) !== 10000) return null;
  }

  const category = CATEGORIES.includes(e.category as CategoryKey) ? (e.category as CategoryKey) : 'other';
  return {
    title: (isStr(e.title) ? e.title : 'Expense').trim().slice(0, 50) || 'Expense',
    amount,
    category,
    payers,
    splitMode,
    splitAmong,
    ...(splitValues ? { splitValues } : {}),
  };
}

function sanitizeExpense(e: unknown, ids: Set<string>): Expense | null {
  if (!isObj(e) || !isStr(e.id)) return null;
  const money = sanitizeMoney(e, ids);
  if (!money) return null;
  const createdAt = typeof e.createdAt === 'number' ? e.createdAt : Date.now();
  const date = typeof e.date === 'string' && DATE_RE.test(e.date) ? e.date : toISODate(new Date(createdAt));
  // Only kept when it differs from the date's month, so there's one way to say "same month".
  const month = typeof e.month === 'string' && MONTH_RE.test(e.month) && e.month !== date.slice(0, 7) ? e.month : null;
  return {
    id: e.id,
    title: money.title,
    amount: money.amount,
    category: money.category,
    payers: money.payers,
    splitMode: money.splitMode,
    splitAmong: money.splitAmong,
    ...(money.splitValues ? { splitValues: money.splitValues } : {}),
    date,
    ...(month ? { month } : {}),
    ...(isStr(e.note) ? { note: e.note.slice(0, 200) } : {}),
    ...(isStr(e.recurringId) ? { recurringId: e.recurringId } : {}),
    ...(typeof e.pinnedAt === 'number' ? { pinnedAt: e.pinnedAt } : {}),
    ...(typeof e.archivedAt === 'number' ? { archivedAt: e.archivedAt } : {}),
    createdAt,
  };
}

function sanitizeRecurring(r: unknown, ids: Set<string>): Recurring | null {
  if (!isObj(r) || !isStr(r.id) || !Number.isInteger(r.day) || (r.day as number) < 1 || (r.day as number) > 31) return null;
  if (typeof r.lastMonth !== 'string' || !MONTH_RE.test(r.lastMonth)) return null;
  const money = sanitizeMoney(r, ids);
  if (!money) return null;
  return {
    id: r.id,
    title: money.title,
    amount: money.amount,
    category: money.category,
    payers: money.payers,
    splitMode: money.splitMode,
    splitAmong: money.splitAmong,
    ...(money.splitValues ? { splitValues: money.splitValues } : {}),
    ...(isStr(r.note) ? { note: r.note.slice(0, 200) } : {}),
    day: r.day as number,
    lastMonth: r.lastMonth,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  };
}

/** The People directory as stored; anything malformed is dropped. */
export function sanitizePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  const out: Person[] = [];
  for (const p of raw) {
    if (isObj(p) && isStr(p.id) && isStr(p.name) && p.name.trim() && !out.some((x) => x.id === p.id)) {
      out.push({ id: p.id, name: p.name.trim().slice(0, 30), createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0 });
    }
  }
  return out;
}
