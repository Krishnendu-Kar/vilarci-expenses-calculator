/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  applyRecurring,
  daysIn,
  dueDate,
  inMonth,
  monthBalances,
  monthsOf,
  recurringFrom,
  setMonthClosed,
  withRepeat,
} from '../months';
import { computeBalances } from '../split';
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

  it('lists every month from the first expense up to now', () => {
    const g = { ...group(['A'], [expense('x', 10, 'A', ['A'], { date: '2026-08-15' })]), createdAt: new Date(2026, 7, 1).getTime() };
    assert.deepEqual(monthsOf(g, new Date(2026, 9, 30)), ['2026-08', '2026-09', '2026-10']);
  });
});

describe('monthBalances', () => {
  // A pays 300 for A,B,C in September; B pays 150 for everyone in October.
  const g = hostel(
    group(['A', 'B', 'C'], [
      expense('sep', 300, 'A', ['A', 'B', 'C'], { date: '2026-09-10' }),
      expense('oct', 150, 'B', ['A', 'B', 'C'], { date: '2026-10-02' }),
    ]),
  );

  it("shows the month's own numbers plus what carried in", () => {
    const oct = Object.fromEntries(monthBalances(g, '2026-10').map((b) => [b.memberId, b]));
    assert.equal(oct.A.paid, 0);
    assert.equal(oct.B.paid, 15000);
    assert.equal(oct.A.carried, 20000);
    assert.equal(oct.C.carried, -10000);
    assert.equal(oct.C.net, -15000);
  });

  it('ends the latest month where the all-time balance is', () => {
    const all = Object.fromEntries(computeBalances(g).map((b) => [b.memberId, b.net]));
    for (const b of monthBalances(g, '2026-10')) assert.equal(b.net, all[b.memberId]);
    assert.deepEqual(inMonth(g, '2026-09').expenses.map((e) => e.id), ['sep']);
  });
});

describe('applyRecurring', () => {
  const rent = expense('rent', 9000, 'A', ['A', 'B', 'C'], { date: '2026-08-01' });
  const base = hostel(group(['A', 'B', 'C'], [rent]));
  const withRent = { ...base, expenses: [{ ...rent, recurringId: 'r1' }], recurring: [recurringFrom(rent, 'r1', 0)] };

  it('adds each month that has come due, on its day', () => {
    const out = applyRecurring(withRent, new Date(2026, 9, 30), id);
    const added = out.expenses.filter((e) => e.id !== 'rent');
    assert.deepEqual(added.map((e) => e.date).sort(), ['2026-09-01', '2026-10-01']);
    assert.ok(added.every((e) => e.recurringId === 'r1' && e.amount === rent.amount));
    assert.equal(out.recurring![0].lastMonth, '2026-10');
  });

  it("waits for the day, and changes nothing when nothing's due", () => {
    const late = { ...withRent, recurring: [{ ...withRent.recurring[0], day: 31, lastMonth: '2026-09' }] };
    assert.equal(applyRecurring(late, new Date(2026, 9, 30), id), late);
    const done = applyRecurring(withRent, new Date(2026, 9, 30), id);
    assert.equal(applyRecurring(done, new Date(2026, 9, 31), id), done);
  });

  it('skips closed months but moves past them', () => {
    const closed = { ...withRent, closedMonths: ['2026-09'] };
    const out = applyRecurring(closed, new Date(2026, 9, 30), id);
    assert.deepEqual(out.expenses.filter((e) => e.id !== 'rent').map((e) => e.date), ['2026-10-01']);
    assert.equal(out.recurring![0].lastMonth, '2026-10');
  });

  it('only runs for hostel and flat groups', () => {
    const trip = { ...withRent, kind: 'trip' as const };
    assert.equal(applyRecurring(trip, new Date(2026, 9, 30), id), trip);
  });
});

describe('withRepeat', () => {
  const g = hostel(group(['A', 'B'], []));
  const wifi = expense('wifi', 800, 'A', ['A', 'B'], { date: '2026-10-31' });

  it('switching it on makes a repeat linked to the expense', () => {
    const { expense: e, recurring } = withRepeat(g, wifi, true, () => 'r9', 5);
    assert.equal(e.recurringId, 'r9');
    assert.deepEqual([recurring[0].day, recurring[0].lastMonth, recurring[0].amount], [31, '2026-10', 80000]);
  });

  it('editing keeps a 31st as the 31st even in a short month, and updates the money', () => {
    const r = { ...recurringFrom(wifi, 'r9', 5), lastMonth: '2026-11' };
    const nov = { ...wifi, id: 'nov', date: '2026-11-30', amount: 90000, payers: { A: 90000 }, recurringId: 'r9' };
    const out = withRepeat({ ...g, recurring: [r] }, nov, true, id);
    assert.deepEqual([out.recurring[0].day, out.recurring[0].amount, out.recurring[0].lastMonth], [31, 90000, '2026-11']);
  });

  it('switching it off stops the repeat and unlinks the expense', () => {
    const r = recurringFrom(wifi, 'r9', 5);
    const out = withRepeat({ ...g, recurring: [r] }, { ...wifi, recurringId: 'r9' }, false, id);
    assert.equal(out.expense.recurringId, undefined);
    assert.deepEqual(out.recurring, []);
  });
});

describe('setMonthClosed', () => {
  it('closes and reopens, leaving no empty list behind', () => {
    const g = hostel(group(['A'], []));
    const closed = setMonthClosed(setMonthClosed(g, '2026-10', true), '2026-09', true);
    assert.deepEqual(closed.closedMonths, ['2026-09', '2026-10']);
    const open = setMonthClosed(setMonthClosed(closed, '2026-09', false), '2026-10', false);
    assert.equal('closedMonths' in open, false);
  });
});
