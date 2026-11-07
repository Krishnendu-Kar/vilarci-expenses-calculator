/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyMembers, nameTakenIn, netsFor, personForProfile, reconcilePeople, renameInGroups, resolveMe, totals } from '../people';
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
});
