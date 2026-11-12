import type { CategoryKey, Expense, Group, Recurring } from '../types';
import { toISODate } from './format';
import { uuid5 } from './uuid5';

// Months: the Expenses list and Stats can show one month at a time (hostel
// groups open on this month), an expense can count for another month than
// its date's, and hostel/flat groups add repeating costs like rent by
// themselves. Balances are always all-time.

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

/** The month an expense counts for: its own `month` if set, else its date's. */
export const expenseMonth = (e: Expense): Month => e.month ?? monthOf(e.date);

/** An expense can't count for a month further ahead than this. */
export const MONTHS_AHEAD = 12;

/** The latest month an expense can count for. */
export const lastPickableMonth = (now = new Date()): Month => addMonths(thisMonth(now), MONTHS_AHEAD);

/**
 * What the Expenses list and Stats show: one month (null = every month) and
 * some categories (empty = every category). Members and Settle always use
 * the whole group.
 */
export interface ExpenseFilter {
  month: Month | null;
  categories: CategoryKey[];
}

export const NO_FILTER: ExpenseFilter = { month: null, categories: [] };

export const isFiltered = (f: ExpenseFilter) => f.month !== null || f.categories.length > 0;

export function matchesFilter(e: Expense, f: ExpenseFilter) {
  return (f.month === null || expenseMonth(e) === f.month) && (f.categories.length === 0 || f.categories.includes(e.category));
}

/**
 * The group with only the expenses the filter lets through. Payments stay:
 * only "paid" and "share" are read from a filtered group.
 */
export function filterGroup(group: Group, f: ExpenseFilter): Group {
  return isFiltered(f) ? { ...group, expenses: group.expenses.filter((e) => matchesFilter(e, f)) } : group;
}

/** Months with at least one expense, marked in the month picker. */
export function monthsWithExpenses(group: Group): Set<Month> {
  return new Set(group.expenses.map(expenseMonth));
}

/**
 * The earliest month worth stepping back to with the ‹ arrow: the group's
 * first expense or the month it was made, and never later than this month.
 */
export function firstMonthOf(group: Group, now = new Date()): Month {
  let first = thisMonth(now);
  const made = monthOf(toISODate(new Date(group.createdAt)));
  if (made < first) first = made;
  for (const m of monthsWithExpenses(group)) if (m < first) first = m;
  return first;
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

const REPEAT_IDS = '6c1f3a52-8e0d-4b7a-9d25-3f4e8a1c7b90';

/**
 * The id of the expense a repeat adds for a month. The same on every phone,
 * so in a live group two phones adding March's rent make one expense.
 */
export const repeatExpenseId = (recurringId: string, m: Month) => uuid5(`${recurringId}/${m}`, REPEAT_IDS);

/**
 * Adds every repeat that has come due (one expense per month, on its day)
 * up to today. Returns the same group when nothing was due.
 */
export function applyRecurring(group: Group, now: Date): Group {
  if (group.kind !== 'hostel' || !group.recurring?.length) return group;
  const today = toISODate(now);
  const current = monthOf(today);
  const have = new Set(group.expenses.map((e) => e.id));
  const added: Expense[] = [];
  let changed = false;
  const recurring = group.recurring.map((r) => {
    let last = r.lastMonth;
    for (let i = 0, m = addMonths(last, 1); m <= current && i < MAX_CATCH_UP; i++, m = addMonths(m, 1)) {
      const date = dueDate(m, r.day);
      if (date > today) break;
      last = m;
      // Already here: another phone added it and it came down with a sync.
      const id = repeatExpenseId(r.id, m);
      if (have.has(id)) continue;
      added.push({
        id,
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
