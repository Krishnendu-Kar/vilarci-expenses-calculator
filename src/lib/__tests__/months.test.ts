/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  daysIn,
  dueDate,
  expenseMonth,
  filterGroup,
  firstMonthOf,
  isFiltered,
  lastPickableMonth,
  monthsWithExpenses,
  NO_FILTER,
  dropRepeats,
  recurringFrom,
  repeatExpenseId,
} from '../months';
import { expense, group } from './fixtures';
import type { Group } from '../../types';

const hostel = (g: Group): Group => ({ ...g, kind: 'hostel' });
let n = 0;
const id = () => `id${++n}`;

describe('month maths', () => {
  it('adds months across years and knows month lengths', () => {
    assert.equal(addMonths('2026-12', 1), '2027-01');
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(daysIn('2028-02'), 29);
    assert.equal(daysIn('2026-02'), 28);
    assert.equal(dueDate('2026-02', 31), '2026-02-28');
    assert.equal(dueDate('2026-03', 5), '2026-03-05');
  });

  it('lets an expense count for 12 months ahead at most', () => {
    assert.equal(lastPickableMonth(new Date(2026, 10, 8)), '2027-11');
  });
});

describe('expense month and the filter', () => {
  // A forgotten October bill added in November, next month's gas bought early, a normal one.
  const late = { ...expense('late', 300, 'A', ['A', 'B'], { date: '2026-11-02' }), month: '2026-10', category: 'stay' as const };
  const early = { ...expense('early', 900, 'B', ['A', 'B'], { date: '2026-11-20' }), month: '2026-12' };
  const nov = { ...expense('nov', 150, 'A', ['A', 'B'], { date: '2026-11-05' }), category: 'food' as const };
  const g = hostel(group(['A', 'B'], [late, early, nov]));
  const ids = (x: { expenses: { id: string }[] }) => x.expenses.map((e) => e.id);

  it("counts an expense in its own month, else its date's", () => {
    assert.deepEqual([late, early, nov].map(expenseMonth), ['2026-10', '2026-12', '2026-11']);
    assert.deepEqual([...monthsWithExpenses(g)].sort(), ['2026-10', '2026-11', '2026-12']);
  });

  it('filters by month, by categories, or both', () => {
    assert.deepEqual(ids(filterGroup(g, { month: '2026-10', categories: [] })), ['late']);
    assert.deepEqual(ids(filterGroup(g, { month: '2026-11', categories: [] })), ['nov'], 'dated in November but counts for another month');
    assert.deepEqual(ids(filterGroup(g, { month: null, categories: ['food', 'stay'] })), ['late', 'nov']);
    assert.deepEqual(ids(filterGroup(g, { month: '2026-11', categories: ['stay'] })), []);
  });

  it('gives back the same group when nothing is filtered, and keeps payments', () => {
    assert.equal(filterGroup(g, NO_FILTER), g);
    assert.equal(isFiltered(NO_FILTER), false);
    const paid = { ...g, payments: [{ id: 'p', from: 'B', to: 'A', amount: 100, createdAt: 0 }] };
    assert.equal(filterGroup(paid, { month: '2026-10', categories: [] }).payments, paid.payments);
  });

  it("steps back no further than the first expense or the group's start", () => {
    const now = new Date(2026, 10, 8);
    const made = (m: number) => new Date(2026, m, 15).getTime();
    // A group made in September whose first expense counts for October.
    assert.equal(firstMonthOf({ ...g, createdAt: made(8) }, now), '2026-09');
    // Made in December, but with an October bill: October.
    assert.equal(firstMonthOf({ ...g, createdAt: made(11) }, now), '2026-10');
    // A new empty group made later than today's month still reaches this month.
    assert.equal(firstMonthOf({ ...g, expenses: [], createdAt: made(11) }, now), '2026-11');
  });
});

describe('monthly repeats (removed)', () => {
  const rent = expense('rent', 9000, 'A', ['A', 'B'], { date: '2026-08-01' });
  const base = { ...group(['A', 'B'], [{ ...rent, recurringId: 'r1' }]), kind: 'hostel' as const };

  it('clears old repeats and keeps what they added', () => {
    const out = dropRepeats({ ...base, recurring: [recurringFrom(rent, 'r1', 0)] });
    assert.equal(out.recurring, undefined);
    assert.deepEqual(out.expenses.map((e) => e.id), ['rent']);
  });

  it('leaves a group without repeats as it is', () => {
    assert.equal(dropRepeats(base), base);
  });
});
