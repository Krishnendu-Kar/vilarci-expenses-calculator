/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adoptAccountId, applyMembers, nameTakenIn, netsByPerson, netsFor, personForProfile, reconcilePeople, renameInGroups, resolveMe, totals } from '../people';
import { expense, group } from './fixtures';
import type { Group, Person } from '../../types';

const named = (g: Group, names: Record<string, string>): Group => ({
  ...g,
  members: g.members.map((m) => ({ ...m, name: names[m.id] ?? m.name })),
});
const person = (id: string, name: string): Person => ({ id, name, createdAt: 0 });

describe('reconcilePeople', () => {
  it('builds the directory from older data that has none', () => {
    const goa = group(['A', 'B'], [], 'goa');
    const { people } = reconcilePeople([goa], []);
    assert.deepEqual(people.map((p) => [p.id, p.name]), [['A', 'Person A'], ['B', 'Person B']]);
  });

  it("refreshes group names from the directory, and leaves matching groups untouched", () => {
    const goa = group(['A', 'B'], [], 'goa');
    const mess = group(['A', 'C'], [], 'mess');
    const people = [person('A', 'Krish'), person('B', 'Person B'), person('C', 'Person C')];
    const out = reconcilePeople([goa, named(mess, { A: 'Krish' })], people);
    assert.equal(out.groups[0].members[0].name, 'Krish');
    assert.equal(out.groups[1], out.groups[1]);
    assert.equal(out.groups[1].members[0].name, 'Krish');
    assert.equal(out.people, people, 'nothing new to add');
  });
});

describe('applyMembers', () => {
  it('adds new people and renames existing ones in every group', () => {
    const goa = group(['A', 'B'], [], 'goa');
    const mess = group(['A', 'C'], [], 'mess');
    const people = reconcilePeople([goa, mess], []).people;
    const out = applyMembers([goa, mess], people, [
      { id: 'A', name: 'Krishnendu' },
      { id: 'Z', name: 'Zoya' },
    ]);
    assert.equal(out.people.find((p) => p.id === 'A')?.name, 'Krishnendu');
    assert.ok(out.people.some((p) => p.id === 'Z' && p.name === 'Zoya'));
    assert.equal(out.groups[1].members.find((m) => m.id === 'A')?.name, 'Krishnendu');
  });
});

describe('names', () => {
  const goa = named(group(['A', 'B'], [], 'goa'), { A: 'Krish', B: 'Tamal' });
  const mess = named(group(['A', 'C'], [], 'mess'), { A: 'Krish', C: 'Sayak' });

  it('renames a person in every group', () => {
    const out = renameInGroups([goa, mess], 'A', 'K');
    assert.deepEqual(out.map((g) => g.members[0].name), ['K', 'K']);
  });

  it("won't let a rename take a name someone else has in one of their groups", () => {
    assert.equal(nameTakenIn([goa, mess], 'A', 'sayak')?.id, 'mess');
    assert.equal(nameTakenIn([goa, mess], 'A', 'Rahul'), undefined);
    // Tamal isn't in Sayak's groups, so Sayak can be renamed Tamal.
    assert.equal(nameTakenIn([goa, mess], 'C', 'Tamal'), undefined);
  });
});

describe('resolveMe', () => {
  const g = named(group(['A', 'B', 'C'], []), { A: 'Krish', B: 'Tamal', C: 'Krish K' });

  it('prefers a hand-picked member, then the linked person, then an exact name', () => {
    assert.equal(resolveMe(g, { name: 'Krish', personId: 'B' }, 'C'), 'C');
    assert.equal(resolveMe(g, { name: 'Krish', personId: 'B' }), 'B');
    assert.equal(resolveMe(g, { name: 'krish', personId: null }), 'A');
  });

  it("doesn't guess", () => {
    assert.equal(resolveMe(g, { name: 'Kri', personId: null }), null);
    assert.equal(resolveMe(g, { name: '', personId: 'gone' }, 'gone'), null);
  });
});

describe('personForProfile', () => {
  const goa = named(group(['A', 'B'], [], 'goa'), { A: 'Krish' });
  const mess = named(group(['A2', 'C'], [], 'mess'), { A2: 'Krish' });
  const trip = named(group(['A2', 'D'], [], 'trip'), { A2: 'Krish' });
  const people = reconcilePeople([goa, mess, trip], []).people;

  it('uses the linked person, else the same name in the most groups', () => {
    assert.equal(personForProfile({ name: 'Krish', personId: 'A' }, people, [goa, mess, trip])?.id, 'A');
    assert.equal(personForProfile({ name: 'Krish', personId: null }, people, [goa, mess, trip])?.id, 'A2');
    assert.equal(personForProfile({ name: 'Nobody', personId: null }, people, [goa]), null);
  });
});

describe('netsFor / totals', () => {
  it("adds up a person's balances across groups, ignoring paise", () => {
    const goa = group(['A', 'B'], [expense('x', 100, 'A', ['A', 'B'])], 'goa');
    const mess = group(['A', 'C'], [expense('y', 300, 'C', ['A', 'C'])], 'mess');
    const dust = group(['A', 'D'], [{ ...expense('z', 1, 'D', ['A', 'D']), amount: 99, payers: { D: 99 } }], 'dust');
    const nets = netsFor([goa, mess, dust], 'A');
    assert.deepEqual(nets.map((n) => n.net), [5000, -15000, -50]);
    assert.deepEqual(totals(nets), { owed: 5000, owes: 15000 });
  });

  it('gives everyone the same nets in one pass as netsFor does one by one', () => {
    const goa = group(['A', 'B'], [expense('x', 100, 'A', ['A', 'B'])], 'goa');
    const mess = group(['A', 'C'], [expense('y', 300, 'C', ['A', 'C'])], 'mess');
    const all = netsByPerson([goa, mess]);
    for (const id of ['A', 'B', 'C']) assert.deepEqual(all.get(id), netsFor([goa, mess], id));
    assert.equal(all.get('Z'), undefined);
  });
});

describe('adoptAccountId', () => {
  const acct = 'acct-1';
  const trip = { ...group(['me', 'B'], [expense('dinner', 300, 'me', ['me', 'B'])]), payments: [{ id: 'p1', from: 'B', to: 'me', amount: 100, createdAt: 0 }] };
  const other = group(['B', 'C'], [expense('taxi', 100, 'B', ['B', 'C'])], 'g2');
  const state = {
    groups: [trip, other],
    bin: [],
    people: [person('me', 'Krish'), person('B', 'Neha'), person('C', 'Sayak')],
    meMap: { g1: 'me' },
    profile: { name: 'Krish', personId: 'me' },
  };

  it('gives you the account id everywhere, and leaves other groups as they were', () => {
    const out = adoptAccountId(state, 'me', acct);
    const g = out.groups[0];
    assert.deepEqual(g.members.map((m) => m.id), [acct, 'B']);
    assert.deepEqual(g.expenses[0].payers, { [acct]: 30000 });
    assert.deepEqual(g.expenses[0].splitAmong, [acct, 'B']);
    assert.equal(g.payments[0].to, acct);
    assert.equal(out.groups[1], other, 'a group without you is the same object');
    assert.deepEqual(out.people.map((p) => p.id), [acct, 'B', 'C']);
    assert.deepEqual(out.meMap, { g1: acct });
    assert.equal(out.profile.personId, acct);
  });

  it('changes nothing when you already have it', () => {
    assert.equal(adoptAccountId(state, acct, acct), state);
  });
});

describe('people in live groups', () => {
  const online = { role: 'member' as const, status: 'active' as const, settings: { editInfo: 'all' as const, addExpenses: 'all' as const, addGuests: 'all' as const, requireApproval: false } };

  it("keeps a live group's names, and still adds its new people to the directory", () => {
    const live = { ...group(['A', 'N'], []), online, members: [{ id: 'A', name: 'Krishnendu' }, { id: 'N', name: 'Neha' }] };
    const out = reconcilePeople([live], [person('A', 'Krish')]);
    assert.equal(out.groups[0], live, 'not renamed to this phone’s nickname');
    assert.deepEqual(out.people.map((p) => p.id), ['A', 'N']);
  });

  it('leaves live groups alone when you take your account id', () => {
    const live = { ...group(['me', 'B'], []), online };
    const s = { groups: [live], bin: [], people: [person('me', 'Krish')], meMap: {}, profile: { name: 'Krish', personId: 'me' } };
    assert.equal(adoptAccountId(s, 'me', 'acct').groups[0], live);
  });
});
