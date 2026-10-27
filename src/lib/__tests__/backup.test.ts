/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, mergeGroups, parseBackup, planImport } from '../backup';
import { sanitizeGroups } from '../migrate';
import { toPaise } from '../money';
import { expense, group } from './fixtures';

describe('sanitizeGroups: v1 → v2 migration', () => {
  const v1 = {
    id: 'g1',
    name: 'Goa',
    kind: 'trip',
    members: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
    expenses: [
      { id: 'e1', title: 'Food', amount: 1000, category: 'food', paidBy: 'a', splitMode: 'equal', splitAmong: ['a', 'b'], createdAt: new Date(2026, 9, 20, 15).getTime() },
      { id: 'e2', title: 'Cab', amount: 900, category: 'travel', paidBy: 'b', splitMode: 'exact', splitAmong: ['a', 'b'], exactShares: { a: 600, b: 300 }, createdAt: 0 },
    ],
    payments: [{ id: 'p1', from: 'b', to: 'a', amount: 100, createdAt: 0 }],
    createdAt: 1,
    updatedAt: 2,
  };

  it('converts paidBy, exactShares and adds a date', () => {
    const { groups, skipped } = sanitizeGroups([v1]);
    assert.equal(skipped, 0);
    const [e1, e2] = groups[0].expenses;
    assert.deepEqual(e1.payers, { a: 1000 });
    assert.equal(e1.date, '2026-10-20');
    assert.deepEqual(e2.payers, { b: 900 });
    assert.deepEqual(e2.splitValues, { a: 600, b: 300 });
    assert.equal(groups[0].payments.length, 1);
  });

  it('keeps v2 data unchanged', () => {
    const g = group(['A', 'B'], [expense('x', 100, { A: 6000, B: 4000 }, ['A', 'B'], { mode: 'shares', values: { A: 1, B: 3 } })]);
    assert.deepEqual(sanitizeGroups([g]).groups[0], g);
  });

  it('drops broken items and counts them', () => {
    const bad = {
      ...v1,
      expenses: [
        ...v1.expenses,
        { id: 'neg', amount: -5, paidBy: 'a', splitMode: 'equal', splitAmong: ['a'] },
        { id: 'stranger', amount: 100, paidBy: 'zz', splitMode: 'equal', splitAmong: ['a'] },
        { id: 'payers-mismatch', amount: 100, payers: { a: 50 }, splitMode: 'equal', splitAmong: ['a'] },
        { id: 'exact-mismatch', amount: 100, paidBy: 'a', splitMode: 'exact', splitAmong: ['a'], splitValues: { a: 99 } },
        { id: 'pct-mismatch', amount: 100, paidBy: 'a', splitMode: 'percent', splitAmong: ['a'], splitValues: { a: 9000 } },
        'junk',
      ],
      payments: [...v1.payments, { id: 'self', from: 'a', to: 'a', amount: 5 }],
    };
    const { groups, skipped } = sanitizeGroups([bad, { nope: true }, null]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].expenses.length, 2);
    assert.equal(skipped, 6 + 1 + 2);
  });

  it('rejects duplicate group ids', () => {
    const { groups, skipped } = sanitizeGroups([v1, v1]);
    assert.equal(groups.length, 1);
    assert.equal(skipped, 1);
  });
});

describe('backup files', () => {
  const g = group(['A', 'B'], [expense('x', 250, 'A', ['A', 'B'])]);

  it('round-trips', () => {
    const parsed = parseBackup(buildBackup([g]));
    assert.deepEqual(parsed.groups, [g]);
    assert.equal(parsed.skipped, 0);
    assert.ok(parsed.exportedAt);
  });

  it('explains bad files', () => {
    assert.throws(() => parseBackup('not json'), /can't be read/);
    assert.throws(() => parseBackup('{"hello":1}'), /isn't a Vilarci Split backup/);
    assert.throws(() => parseBackup('{"app":"vilarci-split","version":99,"groups":[]}'), /newer version/);
    assert.throws(() => parseBackup('{"app":"vilarci-split","version":2,"groups":[]}'), /No usable groups/);
  });

  it('plans and merges an import', () => {
    const local = [{ ...g, updatedAt: 10 }, group(['A'], [], 'g2')];
    const incoming = [{ ...g, name: 'Renamed', updatedAt: 5 }, group(['A'], [], 'g3')];
    const plan = planImport(local, incoming);
    assert.deepEqual(plan.added.map((x) => x.id), ['g3']);
    assert.equal(plan.replaced.length, 1);
    assert.equal(plan.replaced[0].localIsNewer, true);

    const merged = mergeGroups(local, incoming);
    assert.deepEqual(merged.map((x) => x.id).sort(), ['g1', 'g2', 'g3']);
    assert.equal(merged.find((x) => x.id === 'g1')?.name, 'Renamed');
  });
});

describe('toPaise', () => {
  it('parses amounts', () => {
    assert.equal(toPaise('1200'), 120000);
    assert.equal(toPaise('1,200.5'), 120050);
    assert.equal(toPaise('₹ 0.29'), 29);
    assert.equal(toPaise('1200.29'), 120029);
    assert.equal(toPaise(''), null);
    assert.equal(toPaise('1.234'), null);
    assert.equal(toPaise('abc'), null);
  });
});
