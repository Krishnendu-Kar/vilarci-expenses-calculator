/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createStore, LEGACY_KEYS, type Db, type LegacyData } from '../db/store';
import { planGroups } from '../db/rows';
import { isUuid, remapGroup } from '../legacyIds';
import { sanitizeGroups } from '../migrate';
import type { ExpenseDraft } from '../drafts';
import type { Expense, Group, Person } from '../../types';

// The real SQL runs here, on Node's built-in SQLite.

function memoryDb() {
  const raw = new DatabaseSync(':memory:');
  const db: Db = {
    exec: async (sql) => raw.exec(sql),
    run: async (sql, params) => {
      raw.prepare(sql).run(...params);
    },
    all: async <T,>(sql: string, params: (string | number | null)[] = []) => raw.prepare(sql).all(...params) as T[],
    transaction: async (fn) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { raw, db };
}

function uuids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`;
}

/** A store on the same database, as if the app had been closed and opened again. */
function reopen(db: Db, legacy: LegacyData = {}) {
  return createStore(async () => db, async () => legacy, uuids());
}

const count = (raw: DatabaseSync, table: string) => (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

// Ids in the style of before 1.2.
const A = 'lq8x3k9aaaa1';
const B = 'lq8x3k9bbbb2';
const C = 'lq8x3k9cccc3';

const meal: Expense = {
  id: 'lq8x3kexp001',
  title: 'Dinner',
  amount: 100_00,
  category: 'food',
  payers: { [A]: 60_00, [B]: 40_00 },
  splitMode: 'shares',
  // Order matters: it decides who gets a leftover paisa.
  splitAmong: [C, A, B],
  splitValues: { [C]: 2, [A]: 1, [B]: 1 },
  date: '2026-10-12',
  note: 'Birthday',
  pinnedAt: 500,
  createdAt: 300,
};
const rent: Expense = {
  id: 'lq8x3kexp002',
  title: 'Rent',
  amount: 9000_00,
  category: 'stay',
  payers: { [A]: 9000_00 },
  splitMode: 'equal',
  splitAmong: [A, B, C],
  date: '2026-10-01',
  recurringId: 'lq8x3krep001',
  archivedAt: 900,
  createdAt: 200,
};

const hostel: Group = {
  id: 'lq8x3kgrp001',
  name: 'Hostel 4B',
  kind: 'hostel',
  members: [
    { id: A, name: 'Krish' },
    { id: B, name: 'Sayak' },
    { id: C, name: 'Riya' },
  ],
  expenses: [meal, rent],
  payments: [
    { id: 'lq8x3kpay002', from: B, to: A, amount: 500_00, createdAt: 800 },
    { id: 'lq8x3kpay001', from: C, to: A, amount: 100_00, createdAt: 700 },
  ],
  closedMonths: ['2026-09'],
  recurring: [
    {
      id: 'lq8x3krep001',
      title: 'Rent',
      amount: 9000_00,
      category: 'stay',
      payers: { [A]: 9000_00 },
      splitMode: 'equal',
      splitAmong: [A, B, C],
      day: 1,
      lastMonth: '2026-10',
      createdAt: 100,
    },
  ],
  createdAt: 50,
  updatedAt: 1000,
};

const goa: Group = {
  id: 'lq8x3kgrp002',
  name: 'Goa',
  kind: 'trip',
  members: [
    { id: A, name: 'Krish' },
    { id: B, name: 'Sayak' },
  ],
  expenses: [
    { id: 'lq8x3kexp003', title: 'Boat', amount: 3000_00, category: 'fun', payers: { [B]: 3000_00 }, splitMode: 'exact', splitAmong: [A, B], splitValues: { [A]: 1000_00, [B]: 2000_00 }, date: '2026-09-02', createdAt: 40 },
  ],
  payments: [],
  createdAt: 10,
  updatedAt: 20,
};

const people: Person[] = [
  { id: A, name: 'Krish', createdAt: 1 },
  { id: B, name: 'Sayak', createdAt: 2 },
  { id: C, name: 'Riya', createdAt: 3 },
];

const draft: ExpenseDraft = {
  formMode: 'one',
  savedAt: 5,
  one: {
    title: 'Chai',
    amountText: '48+80',
    category: 'food',
    date: '2026-10-20',
    note: '',
    multiPay: false,
    payer: B,
    payerTexts: { [B]: '128' },
    mode: 'exact',
    selected: [A, B],
    values: { exact: { [A]: '64' }, shares: {}, percent: {} },
  },
};

const legacy: LegacyData = {
  groups: JSON.stringify({ version: 3, groups: [hostel] }),
  bin: JSON.stringify([{ group: goa, binnedAt: 4000 }]),
  people: JSON.stringify(people),
  profile: JSON.stringify({ name: 'Krish', personId: A }),
  me: JSON.stringify({ [goa.id]: B }),
  prefs: JSON.stringify({ [hostel.id]: { pinnedAt: 10, pinUntil: null }, [goa.id]: { archivedAt: 30 } }),
  visits: JSON.stringify({ [hostel.id]: { count: 7, last: 99 } }),
  drafts: JSON.stringify({ [hostel.id]: draft }),
  theme: 'dark',
  language: 'bn',
  lastBackup: '123456',
};

/** The UUID each old id became, read from the database. */
const idMap = (raw: DatabaseSync) =>
  new Map((raw.prepare('SELECT old_id, new_id FROM legacy_ids').all() as { old_id: string; new_id: string }[]).map((r) => [r.old_id, r.new_id]));

describe('SQLite store', () => {
  it('starts empty on a new phone', async () => {
    const { raw, db } = memoryDb();
    const all = await reopen(db).loadAll();
    assert.deepEqual(all.groups, []);
    assert.deepEqual(all.bin, []);
    assert.deepEqual(all.profile, { name: '', personId: null });
    assert.equal(count(raw, 'settings'), 1, 'only the "already imported" mark');
  });

  it('copies AsyncStorage data over once, with every id a UUID', async () => {
    const { raw, db } = memoryDb();
    const all = await reopen(db, legacy).loadAll();
    const map = idMap(raw);
    const to = (id: string) => map.get(id)!;
    const back = new Map([...map].map(([o, n]) => [n, o]));

    // Same groups, only the ids changed.
    assert.equal(all.groups.length, 1);
    assert.deepEqual(remapGroup(all.groups[0], (id) => back.get(id) ?? id), sanitizeGroups([hostel]).groups[0]);
    assert.deepEqual(remapGroup(all.bin[0].group, (id) => back.get(id) ?? id), goa);
    assert.equal(all.bin[0].binnedAt, 4000);
    const g = all.groups[0];
    for (const id of [g.id, ...g.members.map((m) => m.id), ...g.expenses.map((e) => e.id), ...g.payments.map((p) => p.id)]) {
      assert.ok(isUuid(id), id);
    }
    // Links survive: the repeat, payers, splits, the same person in both groups.
    assert.equal(g.expenses[1].recurringId, g.recurring![0].id);
    assert.deepEqual(g.expenses[0].splitAmong, [to(C), to(A), to(B)]);
    assert.equal(all.bin[0].group.members[0].id, g.members[0].id);

    assert.deepEqual(all.people.map((p) => p.id), [to(A), to(B), to(C)]);
    assert.deepEqual(all.profile, { name: 'Krish', personId: to(A) });
    assert.deepEqual(all.meMap, { [to(goa.id)]: to(B) });
    assert.deepEqual(all.prefs, { [to(hostel.id)]: { pinnedAt: 10, pinUntil: null }, [to(goa.id)]: { archivedAt: 30 } });
    assert.deepEqual(all.visits, { [to(hostel.id)]: { count: 7, last: 99 } });

    const s = reopen(db, legacy);
    const d = (await s.loadDraft(to(hostel.id))) as ExpenseDraft;
    assert.equal(d.one!.payer, to(B));
    assert.deepEqual(d.one!.selected, [to(A), to(B)]);
    assert.deepEqual(d.one!.values.exact, { [to(A)]: '64' });
    assert.equal(await s.loadSetting('theme'), 'dark');
    assert.equal(await s.loadSetting('language'), 'bn');
    assert.equal(await s.getLastBackup(), 123456);

    // Opening again doesn't import a second time.
    const again = await reopen(db, legacy).loadAll();
    assert.deepEqual(again.groups, all.groups);
    assert.equal(count(raw, 'groups'), 2);
  });

  it('leaves everything alone when the old groups are unreadable', async () => {
    const { raw, db } = memoryDb();
    await assert.rejects(reopen(db, { groups: '{broken' }).loadAll());
    assert.equal(count(raw, 'settings'), 0, 'not marked as imported, so the next start tries again');
    const fixed = await reopen(db, legacy).loadAll();
    assert.equal(fixed.groups.length, 1);
  });

  it('saves only what changed, and reads back exactly what was saved', async () => {
    const { raw, db } = memoryDb();
    const s = reopen(db, legacy);
    let { groups, bin } = await s.loadAll();
    const check = async () => {
      const read = await reopen(db).loadAll();
      assert.deepEqual(read.groups, groups);
      assert.deepEqual(read.bin, bin);
    };

    // Nothing changed: nothing to write.
    await s.saveGroups(groups, bin);
    const saved = new Map([...groups, ...bin.map((b) => b.group)].map((g) => [g.id, { group: g, binnedAt: bin.find((b) => b.group === g)?.binnedAt ?? null }]));
    assert.deepEqual(planGroups(saved, [...saved.values()]), []);

    // Edit one expense: only that expense, its payers and splits.
    const g = groups[0];
    const edited = { ...g.expenses[0], title: 'Dinner at Mainland', payers: { [g.members[0].id]: 100_00 } };
    const g2 = { ...g, expenses: [edited, g.expenses[1]], updatedAt: 2000 };
    const plan = planGroups(saved, [{ group: g2, binnedAt: null }, ...[...saved.values()].slice(1)]);
    const tables = new Set(plan.map((st) => /(?:INTO|FROM) (\w+)/.exec(st.sql)![1]));
    assert.deepEqual([...tables].sort(), ['expenses', 'groups', 'payers', 'splits'], 'nothing else is touched');
    groups = [g2];
    await s.saveGroups(groups, bin);
    await check();

    // Delete an expense and a payment, add a payment.
    const g3 = {
      ...g2,
      expenses: [edited],
      payments: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', from: g.members[2].id, to: g.members[0].id, amount: 1, createdAt: 9000 }, g2.payments[0]],
    };
    groups = [g3];
    await s.saveGroups(groups, bin);
    await check();
    assert.equal(count(raw, 'payers'), 1 + 1 + 1, 'Dinner, the Rent repeat, Boat');

    // To the Bin and back, then deleted for good with everything in it.
    bin = [{ group: g3, binnedAt: 5000 }, ...bin];
    groups = [];
    await s.saveGroups(groups, bin);
    await check();
    groups = [g3];
    bin = bin.slice(1);
    await s.saveGroups(groups, bin);
    await check();
    groups = [];
    await s.saveGroups(groups, bin);
    await check();
    assert.equal(count(raw, 'groups'), 1, 'only Goa, in the Bin');
    assert.equal(count(raw, 'closed_months'), 0);
    assert.equal(count(raw, 'splits'), 2, 'Boat only');
  });

  it('keeps one copy when a group is in the list and the Bin at once', async () => {
    const { db } = memoryDb();
    const s = reopen(db, legacy);
    const { groups, bin } = await s.loadAll();
    // A file of the binned group was imported.
    await s.saveGroups([...groups, bin[0].group], bin);
    const read = await reopen(db).loadAll();
    assert.equal(read.groups.length, 2);
    assert.deepEqual(read.bin, []);
  });

  it('turns old ids in an imported file into the same UUIDs as here', async () => {
    const { raw, db } = memoryDb();
    const s = reopen(db, legacy);
    await s.loadAll();
    const map = idMap(raw);
    const stranger = { ...goa, id: 'lq8x3kgrp999', members: [...goa.members, { id: 'lq8x3knew001', name: 'Tina' }] };
    const [mine, theirs] = await s.adoptIds([hostel, stranger]);
    assert.equal(mine.id, map.get(hostel.id), 'an old backup still replaces the group');
    assert.equal(mine.members[0].id, map.get(A));
    assert.ok(isUuid(theirs.id) && isUuid(theirs.members[2].id));
    const [twice] = await s.adoptIds([stranger]);
    assert.equal(twice.id, theirs.id, 'the same file twice gets the same ids');
    const fresh = await s.adoptIds([mine]);
    assert.equal(fresh[0], mine, 'UUID files are left as they are');
  });

  it('saves people, pins, visits, "me", profile, drafts and settings', async () => {
    const { db } = memoryDb();
    const s = reopen(db);
    await s.loadAll();
    const id = 'aaaaaaaa-0000-4000-8000-0000000000aa';
    const p = [{ id, name: 'Krish', createdAt: 1 }];
    await s.savePeople(p);
    await s.savePrefs({ [id]: { pinnedAt: 1, pinUntil: 99 } });
    await s.saveVisits({ [id]: { count: 2, last: 3 } });
    await s.saveMeMap({ g: id });
    await s.saveProfile({ name: 'Krish', personId: id });
    await s.saveSetting('theme', 'light');
    await s.setLastBackup(42);
    await s.saveDraft('g', draft);
    let read = await reopen(db).loadAll();
    assert.deepEqual(read.people, p);
    assert.deepEqual(read.prefs, { [id]: { pinnedAt: 1, pinUntil: 99 } });
    assert.deepEqual(read.visits, { [id]: { count: 2, last: 3 } });
    assert.deepEqual(read.meMap, { g: id });
    assert.deepEqual(read.profile, { name: 'Krish', personId: id });
    assert.equal(await s.loadSetting('theme'), 'light');
    assert.equal(await s.getLastBackup(), 42);
    assert.deepEqual(await s.loadDraft('g'), draft);

    await s.savePeople([]);
    await s.saveProfile({ name: 'Krish', personId: null });
    await s.clearDraft('g');
    read = await reopen(db).loadAll();
    assert.deepEqual(read.people, []);
    assert.equal(read.profile.personId, null);
    assert.equal(await s.loadDraft('g'), null);
  });

  it('knows every AsyncStorage key older versions used', () => {
    assert.equal(Object.values(LEGACY_KEYS).length, 11);
  });
});
