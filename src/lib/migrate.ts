import type { CategoryKey, Expense, Group, GroupKind, Member, Payment, SplitMode } from '../types';
import { toISODate } from './format';

/**
 * Turns anything that claims to be a list of groups (saved data from an older
 * version, or a file someone imported) into valid v2 groups. Anything that
 * can't be trusted is dropped and counted, never half-loaded.
 *
 * v1 → v2: `paidBy: id` became `payers: {id: amount}`, `exactShares` became
 * `splitValues`, and expenses gained a `date`.
 */
export const SCHEMA_VERSION = 2;

export interface SanitizeResult {
  groups: Group[];
  /** Groups, expenses or payments dropped because they were broken. */
  skipped: number;
}

const KINDS: GroupKind[] = ['trip', 'hostel', 'other'];
const CATEGORIES: CategoryKey[] = ['food', 'travel', 'stay', 'groceries', 'fun', 'shopping', 'other'];
const MODES: SplitMode[] = ['equal', 'exact', 'shares', 'percent'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const now = Date.now();
  return {
    id: g.id,
    name: g.name.trim().slice(0, 40),
    kind: KINDS.includes(g.kind as GroupKind) ? (g.kind as GroupKind) : 'other',
    members,
    expenses,
    payments,
    createdAt: typeof g.createdAt === 'number' ? g.createdAt : now,
    updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : now,
  };
}

function sanitizeExpense(e: unknown, ids: Set<string>): Expense | null {
  if (!isObj(e) || !isStr(e.id) || !isPosInt(e.amount)) return null;
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

  const createdAt = typeof e.createdAt === 'number' ? e.createdAt : Date.now();
  const category = CATEGORIES.includes(e.category as CategoryKey) ? (e.category as CategoryKey) : 'other';
  return {
    id: e.id,
    title: (isStr(e.title) ? e.title : 'Expense').trim().slice(0, 50) || 'Expense',
    amount,
    category,
    payers,
    splitMode,
    splitAmong,
    ...(splitValues ? { splitValues } : {}),
    date: typeof e.date === 'string' && DATE_RE.test(e.date) ? e.date : toISODate(new Date(createdAt)),
    ...(isStr(e.note) ? { note: e.note.slice(0, 200) } : {}),
    createdAt,
  };
}
