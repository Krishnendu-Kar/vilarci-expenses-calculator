/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createStore, type Db } from '../db/store';
import { planGroups, type Saved } from '../db/rows';
import { syncNow, type SyncApi } from '../sync/engine';
import { rebase } from '../sync/merge';
import { putOnlineData, type Change, type Membership, type Page, type Row, type SyncResponse } from '../sync/wire';
import { allowed, can, DEFAULT_SETTINGS, type Action } from '../permissions';
import { dropRepeats } from '../months';
import { expense } from './fixtures';
import type { Group, GroupSettings, Role } from '../../types';

// Two phones, each with its own SQLite database, talking to a small stand-in
// for the server. The stand-in follows the rules of supabase/…_sync.sql
// (whose own tests are supabase/tests/sync_test.sql) closely enough to check
// the phone's side: outbox, bookmarks, no echo, refusals, clock, rebase.

type Table = 'members' | 'expenses' | 'payments' | 'recurring';
const ITEM_TABLES: Table[] = ['members', 'expenses', 'payments', 'recurring'];
const BOOKKEEPING = ['group_id', 'id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'seq'];
const body = (r: Row) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !BOOKKEEPING.includes(k)).sort()));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

interface ServerGroup {
  row: Row;
  last: number;
  rows: Record<Table, Map<string, Row>>;
  events: Row[];
}

class FakeServer {
  time = Date.UTC(2026, 10, 10, 9);
  groups = new Map<string, ServerGroup>();
  /** How many changes the last call carried. */
  lastUpload = 0;
  private ids = 0;

  private seq(g: ServerGroup) {
    return ++g.last;
  }
  private event(g: ServerGroup, s: number, type: string, actor: string, data: Row) {
    g.events.push({ id: `ev-${++this.ids}`, type, actor, data, created_at: this.time, seq: s });
  }

  putOnline(user: string, p: Row): number {
    const g: ServerGroup = { row: {}, last: 0, rows: { members: new Map(), expenses: new Map(), payments: new Map(), recurring: new Map() }, events: [] };
    const stamp = (r: Row) => ({ ...r, group_id: p.id, updated_at: this.time, updated_by: user, deleted_at: null, seq: this.seq(g) });
    (p.members as Row[]).forEach((m, i) =>
      g.rows.members.set(m.id as string, {
        ...stamp(m),
        user_id: m.id === user ? user : null,
        role: m.id === user ? 'creator' : 'member',
        status: 'active',
        pos: i,
      }),
    );
    for (const t of ['expenses', 'payments', 'recurring'] as const) for (const r of p[t] as Row[]) g.rows[t].set(r.id as string, stamp(r));
    const s = this.seq(g);
    g.row = { id: p.id, name: p.name, kind: p.kind, edit_info: 'all', add_expenses: 'all', add_guests: 'all', require_approval: false, deleted_at: null, updated_at: this.time, updated_by: user, seq: s };
    this.event(g, s, 'group_online', user, {});
    this.groups.set(p.id as string, g);
    return s;
  }

  addMember(groupId: string, user: string, name: string, role: Role = 'member') {
    const g = this.groups.get(groupId)!;
    g.rows.members.set(user, { id: user, group_id: groupId, user_id: user, name, role, status: 'active', pos: g.rows.members.size, seq: this.seq(g) });
  }

  setMember(groupId: string, user: string, patch: Row) {
    const g = this.groups.get(groupId)!;
    g.rows.members.set(user, { ...g.rows.members.get(user)!, ...patch, seq: this.seq(g) });
  }

  setSettings(groupId: string, patch: Row) {
    const g = this.groups.get(groupId)!;
    g.row = { ...g.row, ...patch, seq: this.seq(g) };
  }

  private settings(g: ServerGroup): GroupSettings {
    return {
      editInfo: g.row.edit_info as 'all',
      addExpenses: g.row.add_expenses as 'all',
      addGuests: g.row.add_guests as 'all',
      requireApproval: g.row.require_approval as boolean,
    };
  }

  private apply(user: string, ch: Change): Row {
    const g = this.groups.get(ch.group_id);
    if (!g) return { status: 'rejected', reason: 'no_group', current: null };
    const me = [...g.rows.members.values()].find((m) => m.user_id === user && m.status === 'active');
    if (!me) return { status: 'rejected', reason: 'not_member', current: null };
    const action: Action = ch.table === 'members' ? 'add_guests' : ch.table === 'groups' ? 'edit_info' : 'edit_expenses';
    const at = ch.updated_at > this.time + 120_000 ? this.time : ch.updated_at;
    const older = (cur: Row) => [at, user].join() !== [cur.updated_at, cur.updated_by].join() && (at < (cur.updated_at as number) || (at === cur.updated_at && user < (cur.updated_by as string)));

    if (ch.table === 'groups') {
      if (!allowed(action, me.role as Role, this.settings(g))) return { status: 'rejected', reason: 'not_allowed', current: g.row };
      if (older(g.row)) return { status: 'rejected', reason: 'older', current: g.row };
      const s = this.seq(g);
      g.row = { ...g.row, ...ch.data, updated_at: at, updated_by: user, seq: s };
      return { status: 'applied', seq: s };
    }
    const table = g.rows[ch.table];
    const cur = table.get(ch.id);
    if (!allowed(action, me.role as Role, this.settings(g))) return { status: 'rejected', reason: 'not_allowed', current: cur ?? null };
    if (ch.deleted) {
      if (!cur || cur.deleted_at != null) return { status: 'applied', seq: cur?.seq ?? null };
      if (older(cur)) return { status: 'rejected', reason: 'older', current: cur };
      const s = this.seq(g);
      table.set(ch.id, { ...cur, deleted_at: at, updated_at: at, updated_by: user, seq: s });
      if (ch.table === 'expenses') this.event(g, s, 'expense_deleted', user, { id: ch.id });
      return { status: 'applied', seq: s };
    }
    const next: Row = { ...ch.data, id: ch.id, group_id: ch.group_id };
    if (ch.table === 'members') Object.assign(next, { user_id: null, role: 'member', status: 'active' });
    if (cur && cur.deleted_at == null) {
      if (ch.table === 'recurring' && body({ ...cur, last_month: '' }) === body({ ...next, last_month: '' })) {
        if ((next.last_month as string) <= (cur.last_month as string)) return { status: 'applied', seq: cur.seq };
        const s = this.seq(g);
        table.set(ch.id, { ...cur, last_month: next.last_month, seq: s });
        return { status: 'applied', seq: s };
      }
      if (body(cur) === body({ ...cur, ...next })) return { status: 'applied', seq: cur.seq };
    }
    if (cur && older(cur)) return { status: 'rejected', reason: 'older', current: cur };
    const s = this.seq(g);
    table.set(ch.id, { ...cur, ...next, created_at: cur?.created_at ?? next.created_at, updated_at: at, updated_by: user, deleted_at: null, seq: s });
    if (ch.table === 'expenses') this.event(g, s, cur && cur.deleted_at == null ? 'expense_edited' : 'expense_added', user, { id: ch.id });
    return { status: 'applied', seq: s };
  }

  private pull(g: ServerGroup, cursor: number, max: number, admin: boolean): Page {
    const after = cursor > g.last ? 0 : cursor;
    const upto = Math.min(g.last, after + Math.max(Math.floor(max / 2), 1));
    const inWindow = (r: Row) => (r.seq as number) > after && (r.seq as number) <= upto;
    const rows = (t: Table) =>
      [...g.rows[t].values()].filter((r) => inWindow(r) && (after > 0 || r.deleted_at == null)).sort((a, b) => (a.seq as number) - (b.seq as number));
    return {
      group_id: g.row.id as string,
      cursor: upto,
      more: upto < g.last,
      full: after === 0,
      group: inWindow(g.row) ? g.row : null,
      members: rows('members'),
      expenses: rows('expenses'),
      payments: rows('payments'),
      recurring: rows('recurring'),
      events: g.events.filter(inWindow),
      join_requests: admin ? [] : [],
    };
  }

  sync(user: string, changesIn: Change[], cursors: Record<string, number>, max = 500): SyncResponse {
    const changes = clone(changesIn);
    this.lastUpload = changes.length;
    const results = changes.map((ch) => ({ table: ch.table, group_id: ch.group_id, id: ch.id, ...this.apply(user, ch) }));
    const changesOut: Page[] = [];
    const groups: Membership[] = [];
    for (const [id, g] of this.groups) {
      const m = g.rows.members.get(user);
      if (m && (m.status === 'active' || id in cursors)) {
        groups.push({ id, status: m.status as Membership['status'], role: m.role as Role, last_seq: g.last, deleted_at: null });
      }
      if (m?.status === 'active' && id in cursors) changesOut.push(this.pull(g, cursors[id], max, m.role !== 'member'));
    }
    for (const id of Object.keys(cursors)) if (!this.groups.get(id)?.rows.members.has(user)) groups.push({ id, status: 'none' });
    return clone({ server_now: this.time, results, groups, changes: changesOut }) as SyncResponse;
  }

  row(groupId: string, t: Table, id: string) {
    return this.groups.get(groupId)!.rows[t].get(id);
  }
}

function memoryDb(): Db {
  const raw = new DatabaseSync(':memory:');
  return {
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
}

/** A phone: its own database, clock and groups on screen, like GroupsContext. */
async function phone(server: FakeServer, user: string, clockAhead = 0) {
  let n = 0;
  const db = memoryDb();
  const p = {
    user,
    clock: () => server.time + clockAhead,
    groups: [] as Group[],
    store: createStore(async () => db, async () => ({}), () => `${user}-new-${++n}`, () => server.time + clockAhead),
    api: { sync: async (c, cur, max) => server.sync(user, c, cur, max) } as SyncApi,
    group(id: string) {
      return p.groups.find((g) => g.id === id)!;
    },
    async save(groups: Group[]) {
      p.groups = groups;
      await p.store.saveGroups(groups, []);
    },
    async edit(id: string, fn: (g: Group) => Group) {
      await p.save(p.groups.map((g) => (g.id === id ? fn(g) : g)));
    },
    async sync(max?: number) {
      const out = await syncNow(p.store, p.api, { now: p.clock, max });
      p.groups = p.groups.map((g) => {
        const t = out.touched.get(g.id);
        return t ? rebase(g, t.base, t.next) : g;
      });
      await p.store.saveGroups(p.groups, []);
      return out;
    },
    async waiting() {
      return (await p.store.outboxCounts())[GID] ?? 0;
    },
  };
  await p.store.loadAll();
  return p;
}

const A = 'aaaaaaaa-0000-4000-8000-000000000001'; // Krish, puts the group online
const B = 'bbbbbbbb-0000-4000-8000-000000000002'; // Neha, joins
const R = 'cccccccc-0000-4000-8000-000000000003'; // Rahul, a guest
const GID = 'dddddddd-0000-4000-8000-000000000004';

const online = (role: Role) => ({ role, status: 'active' as const, settings: DEFAULT_SETTINGS });

/** Krish's group goes online with a dinner in it; Neha joins and downloads it. */
async function setup(kind: Group['kind'] = 'trip', extra: Partial<Group> = {}) {
  const server = new FakeServer();
  const a = await phone(server, A);
  const b = await phone(server, B);
  const local: Group = {
    id: GID,
    name: 'Goa',
    kind,
    members: [{ id: A, name: 'Krish' }, { id: R, name: 'Rahul' }],
    expenses: [{ ...expense('dinner', 900, A, [A, R]), id: 'e0000000-0000-4000-8000-000000000001' }],
    payments: [],
    createdAt: server.time,
    updatedAt: server.time,
    ...extra,
  };
  await a.save([local]);
  const cursor = server.putOnline(A, clone(putOnlineData(local)));
  const live: Group = {
    ...local,
    online: online('creator'),
    members: [{ id: A, name: 'Krish', role: 'creator', account: true }, { id: R, name: 'Rahul', role: 'member' }],
  };
  await a.store.adoptRemote([live], { [GID]: cursor });
  a.groups = [live];

  server.addMember(GID, B, 'Neha');
  // What joining (step 5) leaves on Neha's phone before the first download.
  const joined: Group = { id: GID, name: '', kind, members: [{ id: B, name: 'Neha' }], expenses: [], payments: [], createdAt: 0, updatedAt: 0, online: online('member') };
  await b.store.adoptRemote([joined], { [GID]: 0 });
  b.groups = [joined];
  await b.sync();
  return { server, a, b };
}

const amountOf = (g: Group, id: string) => g.expenses.find((e) => e.id === id)?.amount;
const DINNER = 'e0000000-0000-4000-8000-000000000001';
const TAXI = 'e0000000-0000-4000-8000-000000000002';

describe('sync between two phones', () => {
  it('downloads the whole group on joining, and sends nothing back', async () => {
    const { server, b } = await setup();
    const g = b.group(GID);
    assert.equal(g.name, 'Goa');
    assert.deepEqual(g.members.map((m) => m.name).sort(), ['Krish', 'Neha', 'Rahul']);
    assert.equal(g.members.find((m) => m.id === A)?.role, 'creator');
    assert.equal(g.members.find((m) => m.id === R)?.account, undefined, 'Rahul is a guest');
    assert.equal(amountOf(g, DINNER), 90000);
    assert.equal(await b.waiting(), 0);
    await b.sync();
    assert.equal(server.lastUpload, 0, 'nothing that came down goes back up');
  });

  it('keeps what came down after the app is closed and opened again', async () => {
    const { b } = await setup();
    const again = await b.store.loadAll();
    assert.deepEqual(again.groups.find((g) => g.id === GID), b.group(GID));
  });

  it('uploads a new expense once and the other phone gets it', async () => {
    const { server, a, b } = await setup();
    await a.edit(GID, (g) => ({ ...g, expenses: [{ ...expense('taxi', 300, A, [A, B]), id: TAXI }, ...g.expenses] }));
    assert.equal(await a.waiting(), 1);
    await a.sync();
    assert.equal(server.lastUpload, 1);
    assert.equal(await a.waiting(), 0);
    assert.equal(server.row(GID, 'expenses', TAXI)?.amount, 30000);
    await b.sync();
    assert.equal(amountOf(b.group(GID), TAXI), 30000);
    assert.equal(await b.waiting(), 0);
  });

  it('keeps the later of two offline edits on both phones', async () => {
    const { server, a, b } = await setup();
    const setAmount = (rupees: number) => (g: Group) => ({ ...g, expenses: g.expenses.map((e) => (e.id === DINNER ? { ...e, amount: rupees * 100, payers: { [A]: rupees * 100 } } : e)) });
    server.time += 60_000;
    await a.edit(GID, setAmount(950)); // 8:00
    server.time += 5 * 60_000;
    await b.edit(GID, setAmount(1000)); // 8:05
    await b.sync(); // Neha online first
    const out = await a.sync(); // Krish's older edit arrives later
    assert.equal(out.refused[0]?.reason, 'older');
    assert.equal(amountOf(a.group(GID), DINNER), 100000, "Krish's phone shows Neha's later change");
    assert.equal(await a.waiting(), 0);
    await b.sync();
    assert.equal(amountOf(b.group(GID), DINNER), 100000);
  });

  it("doesn't let a phone clock that runs a day ahead win", async () => {
    const { server: s, a, b } = await setup();
    // Krish's second phone, its clock a day ahead.
    const fast = await phone(s, A, 24 * 3600_000);
    // The fast phone learns the server's clock on its first sync.
    await fast.store.adoptRemote([{ ...a.group(GID) }], { [GID]: 0 });
    fast.groups = [{ ...a.group(GID) }];
    await fast.sync();
    s.time += 60_000;
    await fast.edit(GID, (g) => ({ ...g, expenses: g.expenses.map((e) => (e.id === DINNER ? { ...e, title: 'Fast phone' } : e)) }));
    s.time += 60_000;
    await b.edit(GID, (g) => ({ ...g, expenses: g.expenses.map((e) => (e.id === DINNER ? { ...e, title: 'Later, right clock' } : e)) }));
    await b.sync();
    await fast.sync();
    assert.equal(fast.group(GID).expenses.find((e) => e.id === DINNER)?.title, 'Later, right clock');
  });

  it('settles delete against edit by time, both ways', async () => {
    const { server, a, b } = await setup();
    server.time += 1000;
    await a.edit(GID, (g) => ({ ...g, expenses: g.expenses.filter((e) => e.id !== DINNER) }));
    server.time += 1000;
    await b.edit(GID, (g) => ({ ...g, expenses: g.expenses.map((e) => (e.id === DINNER ? { ...e, title: 'Dinner (edited)' } : e)) }));
    await a.sync();
    assert.equal(server.row(GID, 'expenses', DINNER)?.deleted_at != null, true);
    await b.sync(); // the later edit brings it back
    await a.sync();
    assert.equal(a.group(GID).expenses.find((e) => e.id === DINNER)?.title, 'Dinner (edited)');
  });

  it('undoes a change refused because the rights changed while offline, and says so', async () => {
    const { server, b } = await setup();
    server.setSettings(GID, { add_expenses: 'admins' });
    await b.edit(GID, (g) => ({ ...g, expenses: [{ ...expense('snacks', 50, B, [B]), id: TAXI }, ...g.expenses] }));
    const out = await b.sync();
    assert.equal(out.refused[0]?.reason, 'not_allowed');
    assert.equal(amountOf(b.group(GID), TAXI), undefined, 'the refused expense is gone again');
    assert.equal(b.group(GID).online?.settings.addExpenses, 'admins');
    assert.equal(can('edit_expenses', b.group(GID)), false, 'and the app no longer offers it');
    assert.equal(await b.waiting(), 0);
  });

  it('adds a guest and an expense with them, which reach the other phone', async () => {
    const { a, b } = await setup();
    const G = 'eeeeeeee-0000-4000-8000-000000000005';
    await b.edit(GID, (g) => ({
      ...g,
      members: [...g.members, { id: G, name: 'Rohit' }],
      expenses: [{ ...expense('chai', 40, B, [B, G]), id: TAXI }, ...g.expenses],
    }));
    assert.equal(await b.waiting(), 2);
    await b.sync();
    await a.sync();
    assert.equal(a.group(GID).members.find((m) => m.id === G)?.name, 'Rohit');
    assert.deepEqual(a.group(GID).expenses.find((e) => e.id === TAXI)?.splitAmong, [B, G]);
  });

  it('downloads a big group in pages', async () => {
    const { a, b } = await setup();
    const many = Array.from({ length: 30 }, (_, i) => ({ ...expense(`x${i}`, 10 + i, A, [A, B]), id: `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    await a.edit(GID, (g) => ({ ...g, expenses: [...many, ...g.expenses] }));
    await a.sync();
    await b.sync(20);
    assert.equal(b.group(GID).expenses.length, 31);
  });

  it('stops changes once you left, and keeps the copy to read', async () => {
    const { server, b } = await setup();
    server.setMember(GID, B, { status: 'left' });
    await b.sync();
    assert.equal(b.group(GID).online?.status, 'left');
    assert.equal(can('edit_expenses', b.group(GID)), false);
    assert.equal(amountOf(b.group(GID), DINNER), 90000);
  });

});

describe('sync pieces', () => {
  it('keeps a change made on screen while a sync was running', () => {
    const base = { id: 'g', name: 'Goa', kind: 'trip' as const, members: [], payments: [], createdAt: 0, updatedAt: 0, expenses: [expense('x', 1, 'A', ['A']), expense('y', 1, 'A', ['A'])] };
    const fromServer = expense('x', 2, 'A', ['A']);
    const next = { ...base, expenses: [expense('z', 3, 'A', ['A']), fromServer, base.expenses[1]] };
    const mine = { ...base.expenses[1], title: 'edited here' };
    const current = { ...base, expenses: [base.expenses[0], mine] };
    const out = rebase(current, base, next);
    assert.deepEqual(out.expenses.map((e) => e.id), ['z', 'x', 'y']);
    assert.equal(out.expenses[1], fromServer);
    assert.equal(out.expenses[2], mine);
    assert.equal(rebase(base, base, next), next);
  });

  it('queues only changes to groups that were already live, with the right times', () => {
    const rent = { id: 'r', title: 'rent', amount: 100, category: 'other' as const, payers: { A: 100 }, splitMode: 'equal' as const, splitAmong: ['A'], day: 1, lastMonth: '2026-09', createdAt: 0 };
    const g: Group = { id: 'g', name: 'Flat', kind: 'hostel', members: [{ id: 'A', name: 'A' }], expenses: [], payments: [], recurring: [rent], createdAt: 0, updatedAt: 0 };
    const outboxOf = (before: Group, after: Group) =>
      planGroups(new Map<string, Saved>([['g', { group: before, binnedAt: null }]]), [{ group: after, binnedAt: null }], { now: 777 })
        .filter((s) => s.sql.includes('INTO outbox'))
        .flatMap((s) => {
          const rows: unknown[][] = [];
          for (let i = 0; i < s.params.length; i += 5) rows.push(s.params.slice(i, i + 5));
          return rows;
        });
    assert.deepEqual(outboxOf(g, dropRepeats(g)), [], 'a local group queues nothing');

    const live = { ...g, online: online('admin') };
    assert.deepEqual(outboxOf(live, dropRepeats(live)), [['recurring', 'g', 'r', 'delete', 777]], 'clearing an old repeat deletes it on the server');
    const renamed = { ...live, name: 'Flat 2' };
    assert.deepEqual(outboxOf(live, renamed), [['groups', 'g', 'g', 'upsert', 777]]);
    assert.deepEqual(outboxOf(g, live), [], 'going online uploads the group whole instead');
  });
});
