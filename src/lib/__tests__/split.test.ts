/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocate,
  categoryTotals,
  computeBalances,
  counted,
  dailyTotals,
  groupTotal,
  expenseShares,
  memberIsInvolved,
  activeIn,
  peopleIn,
  suggestTransfers,
} from '../split';
import { expense, group } from './fixtures';

const net = (g: ReturnType<typeof group>) =>
  Object.fromEntries(computeBalances(g).map((b) => [b.memberId, b.net]));

/** Records every suggested transfer as paid and returns the leftover balances. */
function settle(g: ReturnType<typeof group>) {
  g.payments = suggestTransfers(computeBalances(g)).map((t, i) => ({ id: String(i), ...t, createdAt: 0 }));
  return computeBalances(g).map((b) => b.net);
}

describe('allocate', () => {
  it('always adds up to the amount', () => {
    for (const amount of [1, 2, 100, 500000, 123457]) {
      for (const n of [1, 3, 6, 7]) {
        const parts = allocate(amount, Array.from({ length: n }, (_, i) => [String(i), 1]));
        assert.equal(Object.values(parts).reduce((s, v) => s + v, 0), amount);
      }
    }
  });

  it('gives leftover paise to the first people', () => {
    assert.deepEqual(allocate(100, [['a', 1], ['b', 1], ['c', 1]]), { a: 34, b: 33, c: 33 });
  });

  it('splits by weight', () => {
    assert.deepEqual(allocate(90000, [['a', 2], ['b', 1]]), { a: 60000, b: 30000 });
  });

  it('returns nothing for zero weight', () => {
    assert.deepEqual(allocate(100, [['a', 0]]), {});
  });
});

describe('expenseShares', () => {
  it('equal split among a subset', () => {
    assert.deepEqual(expenseShares(expense('boat', 4000, 'A', ['A', 'B', 'C'])), {
      A: 133334,
      B: 133333,
      C: 133333,
    });
  });

  it('exact amounts', () => {
    const e = expense('x', 1000, 'A', ['A', 'B'], { mode: 'exact', values: { A: 70000, B: 30000 } });
    assert.deepEqual(expenseShares(e), { A: 70000, B: 30000 });
  });

  it('shares: a couple counts double', () => {
    const e = expense('stay', 3000, 'A', ['A', 'B'], { mode: 'shares', values: { A: 2, B: 1 } });
    assert.deepEqual(expenseShares(e), { A: 200000, B: 100000 });
  });

  it('percent in basis points', () => {
    const e = expense('x', 1000, 'A', ['A', 'B', 'C'], { mode: 'percent', values: { A: 5000, B: 2500, C: 2500 } });
    assert.deepEqual(expenseShares(e), { A: 50000, B: 25000, C: 25000 });
  });

  it('uneven percent still adds up', () => {
    const e = expense('x', 100, 'A', ['A', 'B', 'C'], { mode: 'percent', values: { A: 3333, B: 3333, C: 3334 } });
    const s = expenseShares(e);
    assert.equal(s.A + s.B + s.C, 10000);
  });
});

describe('the 6-friend trip', () => {
  const P = ['A', 'B', 'C', 'D', 'E', 'F'];
  const trip = () =>
    group(P, [
      expense('travel', 5000, 'A', P),
      expense('food', 3000, 'B', P),
      expense('icecream', 2000, 'C', P),
      expense('thing', 1200, 'D', ['D', 'E', 'F']),
      expense('boat', 4000, 'A', ['A', 'B', 'C']),
    ]);

  it('nets to zero across the group', () => {
    assert.equal(Object.values(net(trip())).reduce((s, v) => s + v, 0), 0);
  });

  it('suggests who pays whom', () => {
    const t = suggestTransfers(computeBalances(trip()));
    assert.deepEqual(
      t.map((x) => [x.from, x.to, x.amount]),
      [
        ['E', 'A', 206666],
        ['F', 'A', 206666],
        ['C', 'A', 99999],
        ['D', 'A', 86666],
      ],
    );
  });

  it('everyone is even (within ₹1) after paying', () => {
    for (const n of settle(trip())) assert.ok(Math.abs(n) < 100);
  });
});

describe('hostel mess', () => {
  it('5 students settle up', () => {
    const S = ['s1', 's2', 's3', 's4', 's5'];
    const g = group(S, [
      expense('rice', 300, 's1', S),
      expense('veg', 500, 's2', S),
      expense('oil', 250, 's3', S),
      expense('milk', 150, 's1', S),
    ]);
    assert.deepEqual(net(g), { s1: 21000, s2: 26000, s3: 1000, s4: -24000, s5: -24000 });
    assert.ok(suggestTransfers(computeBalances(g)).length <= 4);
    for (const n of settle(g)) assert.equal(n, 0);
  });
});

describe('multiple payers', () => {
  it('credits each payer for their part', () => {
    const g = group(['A', 'B', 'C'], [expense('dinner', 3000, { A: 200000, B: 100000 }, ['A', 'B', 'C'])]);
    assert.deepEqual(net(g), { A: 100000, B: 0, C: -100000 });
    assert.deepEqual(suggestTransfers(computeBalances(g)), [{ from: 'C', to: 'A', amount: 100000 }]);
  });
});

describe('stats', () => {
  it('totals by category and by day', () => {
    const g = group(['A', 'B'], [
      { ...expense('a', 100, 'A', ['A', 'B'], { date: '2026-10-02' }), category: 'food' },
      { ...expense('b', 300, 'A', ['A', 'B'], { date: '2026-10-01' }), category: 'travel' },
      { ...expense('c', 50, 'B', ['A', 'B'], { date: '2026-10-02' }), category: 'food' },
    ]);
    assert.deepEqual(categoryTotals(g), [
      { key: 'travel', amount: 30000, count: 1 },
      { key: 'food', amount: 15000, count: 2 },
    ]);
    assert.deepEqual(dailyTotals(g), [
      { date: '2026-10-01', amount: 30000 },
      { date: '2026-10-02', amount: 15000 },
    ]);
  });
});

describe('memberIsInvolved', () => {
  it('counts payers, split members and payments', () => {
    const g = group(['A', 'B', 'C', 'D'], [expense('x', 100, { B: 10000 }, ['C'])]);
    g.payments = [{ id: 'p', from: 'A', to: 'C', amount: 100, createdAt: 0 }];
    assert.equal(memberIsInvolved(g, 'A'), true);
    assert.equal(memberIsInvolved(g, 'B'), true);
    assert.equal(memberIsInvolved(g, 'C'), true);
    assert.equal(memberIsInvolved(g, 'D'), false);
  });
});

describe('archived expenses', () => {
  it('stay saved but count nowhere: balances, totals, categories, days', () => {
    const live = expense('rice', 300, 'A', ['A', 'B', 'C']);
    const old = { ...expense('boat', 900, 'B', ['A', 'B', 'C'], { date: '2026-10-28' }), archivedAt: 5 };
    const g = group(['A', 'B', 'C'], [live, old]);
    assert.deepEqual(net(g), { A: 20000, B: -10000, C: -10000 });
    assert.equal(groupTotal(g), 30000);
    assert.deepEqual(categoryTotals(g).map((c) => c.amount), [30000]);
    assert.deepEqual(dailyTotals(g).map((d) => d.date), ['2026-10-27']);
    assert.equal(counted(old), false);
    // The archived expense still holds B in the group.
    assert.equal(memberIsInvolved(group(['A', 'B'], [{ ...old, splitAmong: ['A', 'B'] }]), 'B'), true);
  });
});

describe('a guest linked to an account', () => {
  // Live group: D was a guest, now linked into C (the server moved D's money to C). E left.
  const linked = () => {
    const g = group(['A', 'B', 'C', 'D', 'E'], [expense('rent', 400, 'A', ['A', 'B', 'C', 'E'])]);
    g.members = g.members.map((m) => (m.id === 'D' ? { ...m, gone: 'merged' as const } : m.id === 'E' ? { ...m, gone: 'left' as const } : m));
    return g;
  };

  it("isn't counted as one more person", () => {
    assert.deepEqual(peopleIn(linked()).map((m) => m.id), ['A', 'B', 'C', 'E']);
  });

  it("can't be in a new expense, and neither can someone who left", () => {
    assert.deepEqual(activeIn(linked()).map((m) => m.id), ['A', 'B', 'C']);
  });

  it('has no balance row once its money moved', () => {
    assert.deepEqual(computeBalances(linked()).map((b) => b.memberId), ['A', 'B', 'C', 'E']);
  });

  it('keeps its row while it still holds money (not synced yet), so nothing goes missing', () => {
    const g = linked();
    g.expenses.push(expense('tea', 50, 'D', ['A', 'D']));
    const rows = computeBalances(g);
    assert.ok(rows.some((b) => b.memberId === 'D'));
    assert.equal(rows.reduce((s, b) => s + b.net, 0), 0);
  });
});
