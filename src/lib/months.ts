import type { Expense, Group, Payment, Recurring } from '../types';
import { computeBalances, type MemberBalance } from './split';
import { toISODate } from './format';

// Hostel/flat groups run month by month: each month is viewed on its own,
// anything unpaid carries into the next month, a finished month can be
// closed (its expenses are then locked), and repeating costs like rent are
// added by themselves.

/** 'YYYY-MM'. Compares correctly as a plain string. */
export type Month = string;

export const monthOf = (isoDate: string): Month => isoDate.slice(0, 7);

export const thisMonth = (now = new Date()): Month => monthOf(toISODate(now));

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysIn(m: Month) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}

/** The date a repeat lands on in month `m`: its day, or the month's last day. */
export function dueDate(m: Month, day: number) {
  return `${m}-${String(Math.min(day, daysIn(m))).padStart(2, '0')}`;
}

/** Payments have no date of their own; they count in the month they were recorded. */
export const paymentMonth = (p: Payment): Month => monthOf(toISODate(new Date(p.createdAt)));

export function isClosed(group: Group, m: Month) {
  return group.closedMonths?.includes(m) ?? false;
}

/** Every month from the group's first activity up to this month (or a later dated expense), oldest first. */
export function monthsOf(group: Group, now = new Date()): Month[] {
  const seen = [
    monthOf(toISODate(new Date(group.createdAt))),
    ...group.expenses.map((e) => monthOf(e.date)),
    ...group.payments.map(paymentMonth),
  ];
  const current = thisMonth(now);
  let first = seen.reduce((a, b) => (b < a ? b : a), current);
  const last = seen.reduce((a, b) => (b > a ? b : a), current);
  const out: Month[] = [];
  // Capped so a stray old date can't make a list of hundreds of months.
  while (first <= last && out.length < 120) {
    out.push(first);
    first = addMonths(first, 1);
  }
  return out;
}

/** The group with only month `m`'s expenses and payments: what the month's tabs show. */
export function inMonth(group: Group, m: Month): Group {
  return {
    ...group,
    expenses: group.expenses.filter((e) => monthOf(e.date) === m),
    payments: group.payments.filter((p) => paymentMonth(p) === m),
  };
}

function beforeMonth(group: Group, m: Month): Group {
  return {
    ...group,
    expenses: group.expenses.filter((e) => monthOf(e.date) < m),
    payments: group.payments.filter((p) => paymentMonth(p) < m),
  };
}

export interface MonthBalance extends MemberBalance {
  /** Balance brought in from earlier months (same sign rule as `net`). */
  carried: number;
}

/**
 * One month's numbers per person: paid/share/sent/received are that month's,
 * `carried` is everything before it, and `net` is where they stand at the
 * end of the month (carried + this month).
 */
export function monthBalances(group: Group, m: Month): MonthBalance[] {
  const before = new Map(computeBalances(beforeMonth(group, m)).map((b) => [b.memberId, b.net]));
  return computeBalances(inMonth(group, m)).map((b) => {
    const carried = before.get(b.memberId) ?? 0;
    return { ...b, carried, net: b.net + carried };
  });
}

/** Turns a saved expense into the monthly repeat that copies it. */
export function recurringFrom(e: Expense, id: string, now = Date.now()): Recurring {
  return {
    id,
    title: e.title,
    amount: e.amount,
    category: e.category,
    payers: e.payers,
    splitMode: e.splitMode,
    splitAmong: e.splitAmong,
    ...(e.splitValues ? { splitValues: e.splitValues } : {}),
    ...(e.note ? { note: e.note } : {}),
    day: Number(e.date.slice(8, 10)),
    lastMonth: monthOf(e.date),
    createdAt: now,
  };
}

/** Months a repeat catches up in one go, so a bad saved month can't flood the group. */
const MAX_CATCH_UP = 36;

/**
 * Adds every repeat that has come due (one expense per month, on its day)
 * up to today. Closed months are skipped. Returns the same group when
 * nothing was due.
 */
export function applyRecurring(group: Group, now: Date, newId: () => string): Group {
  if (group.kind !== 'hostel' || !group.recurring?.length) return group;
  const today = toISODate(now);
  const current = monthOf(today);
  const added: Expense[] = [];
  let changed = false;
  const recurring = group.recurring.map((r) => {
    let last = r.lastMonth;
    for (let i = 0, m = addMonths(last, 1); m <= current && i < MAX_CATCH_UP; i++, m = addMonths(m, 1)) {
      const date = dueDate(m, r.day);
      if (date > today) break;
      if (!isClosed(group, m)) {
        added.push({
          id: newId(),
          title: r.title,
          amount: r.amount,
          category: r.category,
          payers: r.payers,
          splitMode: r.splitMode,
          splitAmong: r.splitAmong,
          ...(r.splitValues ? { splitValues: r.splitValues } : {}),
          date,
          ...(r.note ? { note: r.note } : {}),
          recurringId: r.id,
          createdAt: now.getTime() + added.length,
        });
      }
      last = m;
    }
    if (last === r.lastMonth) return r;
    changed = true;
    return { ...r, lastMonth: last };
  });
  if (!changed) return group;
  return { ...group, recurring, expenses: [...added, ...group.expenses], updatedAt: now.getTime() };
}

/**
 * "Repeat every month" on an expense being saved. On: makes a repeat from
 * it, or updates its repeat so the next months use the new numbers. Off:
 * stops its repeat. Returns the expense to save and the group's new repeats.
 */
export function withRepeat(
  group: Group,
  e: Expense,
  repeat: boolean,
  newId: () => string,
  now = Date.now(),
): { expense: Expense; recurring: Recurring[] } {
  const list = group.recurring ?? [];
  const current = e.recurringId ? list.find((r) => r.id === e.recurringId) : undefined;
  if (repeat) {
    if (current) {
      // A 31st moved to the 30th in a short month keeps its real day.
      const day = dueDate(monthOf(e.date), current.day) === e.date ? current.day : Number(e.date.slice(8, 10));
      const lastMonth = monthOf(e.date) > current.lastMonth ? monthOf(e.date) : current.lastMonth;
      const updated = { ...recurringFrom(e, current.id, current.createdAt), day, lastMonth };
      return { expense: e, recurring: list.map((r) => (r.id === current.id ? updated : r)) };
    }
    const id = newId();
    const expense = { ...e, recurringId: id };
    return { expense, recurring: [...list, recurringFrom(expense, id, now)] };
  }
  if (!current) return { expense: e, recurring: list };
  const { recurringId: _stopped, ...expense } = e;
  return { expense, recurring: list.filter((r) => r.id !== current.id) };
}

/** The group with `recurring` set, leaving the key out when the list is empty. */
export function setRecurring(group: Group, recurring: Recurring[]): Group {
  const { recurring: _old, ...rest } = group;
  return recurring.length ? { ...rest, recurring } : rest;
}

/** Closes or reopens a month. */
export function setMonthClosed(group: Group, m: Month, closed: boolean): Group {
  const months = new Set(group.closedMonths ?? []);
  if (closed) months.add(m);
  else months.delete(m);
  const { closedMonths: _old, ...rest } = group;
  return months.size ? { ...rest, closedMonths: [...months].sort() } : rest;
}
