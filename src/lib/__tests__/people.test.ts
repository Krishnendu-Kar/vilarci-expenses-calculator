/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adoptAccountId,
  applyMembers,
  makeNames,
  netsByPerson,
  netsFor,
  personForProfile,
  groupsWith,
  reconcilePeople,
  renameInGroups,
  resolveMe,
  restoreSavedNames,
  savedNames,
  totals,
} from '../people';
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

  it('renames from a form in local groups only: a live group keeps its names', () => {
    const online = { role: 'member' as const, status: 'active' as const, settings: { editInfo: 'all' as const, addExpenses: 'all' as const, addGuests: 'all' as const, requireApproval: false } };
    const live = { ...mess, online };
    const out = applyMembers([goa, live], [person('A', 'Krish')], [{ id: 'A', name: 'Krishnendu' }]);
    assert.equal(out.groups[0].members[0].name, 'Krishnendu');
    assert.equal(out.groups[1], live, 'your account is never renamed from a form');
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

  it('never picks a guest that was linked to an account', () => {
    const live = named(group(['A', 'B'], []), { A: 'Swapnanil Pal', B: 'Swapnanil Pal' });
    live.members[0] = { ...live.members[0], gone: 'merged' };
    assert.equal(resolveMe(live, { name: 'Swapnanil Pal', personId: null }), 'B');
    assert.equal(resolveMe(live, { name: 'Krish', personId: 'A' }, 'A'), null);
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

describe('names shown on this phone (WhatsApp style)', () => {
  const online = { role: 'member' as const, status: 'active' as const, settings: { editInfo: 'all' as const, addExpenses: 'all' as const, addGuests: 'all' as const, requireApproval: false } };
  const live: Group = {
    ...group([], []),
    online,
    members: [
      { id: 'me', name: 'Krishnendu', account: true },
      { id: 'sayan', name: 'Sayan Sen', account: true },
      { id: 'neha', name: 'Neha Das', account: true },
      { id: 'guest', name: 'Rahul' },
    ],
  };
  const local = { ...group([], [], 'local'), members: [{ id: 'bubai', name: 'Bubai' }, { id: 'neha', name: 'Neha' }] };
  const people: Person[] = [
    person('me', 'Krish'),
    { ...person('sayan', 'Sayan Sen') },
    { ...person('neha', 'Neha'), saved: true },
    person('guest', 'Rahul'),
    person('bubai', 'Bubai'),
  ];
  const names = makeNames([live, local], people, new Set(['me']));

  it('marks accounts you have not saved with ~, and shows saved names as you saved them', () => {
    assert.deepEqual(names.all(live), { me: 'Krishnendu', sayan: '~Sayan Sen', neha: 'Neha', guest: 'Rahul' });
    assert.equal(names.all(live), names.all(live), 'the same map for the same group');
    assert.deepEqual(names.all(local), { bubai: 'Bubai', neha: 'Neha' });
  });

  it('shows People the same way, and knows their own names', () => {
    assert.deepEqual(people.map((p) => names.person(p)), ['Krish', '~Sayan Sen', 'Neha', 'Rahul', 'Bubai']);
    assert.equal(names.unsaved('sayan'), true);
    assert.equal(names.unsaved('neha'), false);
    assert.equal(names.unsaved('guest'), false, 'guests have no name of their own');
    assert.equal(names.unsaved('me'), false);
    assert.equal(names.own('neha'), 'Neha Das');
    assert.equal(names.own('guest'), undefined);
  });

  it('round-trips saved names through a backup, keeping names already saved here', () => {
    assert.deepEqual(savedNames(people), [{ id: 'neha', name: 'Neha' }]);
    const here = [person('sayan', 'Sayan Sen'), { ...person('neha', 'Neha'), saved: true }];
    const out = restoreSavedNames(here, [{ id: 'sayan', name: 'Sayan' }, { id: 'neha', name: 'Old name' }, { id: 'new', name: 'Bhai' }], 9);
    assert.deepEqual(out, [
      { id: 'sayan', name: 'Sayan', createdAt: 0, saved: true },
      { id: 'neha', name: 'Neha', createdAt: 0, saved: true },
      { id: 'new', name: 'Bhai', createdAt: 9, saved: true },
    ]);
    assert.equal(restoreSavedNames(here, []), here);
    assert.equal(restoreSavedNames(here, [{ id: 'neha', name: 'Other' }]), here, 'nothing changed');
  });
});

describe('removing someone from People', () => {
  // A live group where guest G was linked into account A.
  const live = (): Group => {
    const g = group(['A', 'G', 'B'], []);
    g.members = g.members.map((m) => (m.id === 'G' ? { ...m, gone: 'merged' as const } : m));
    return g;
  };

  it("doesn't count a linked guest's old row as being in the group", () => {
    assert.deepEqual(groupsWith([live()], 'G'), []);
    assert.equal(groupsWith([live()], 'A').length, 1);
  });

  it("doesn't bring a linked guest back into People on the next start", () => {
    const { people } = reconcilePeople([live()], []);
    assert.deepEqual(people.map((p) => p.id).sort(), ['A', 'B']);
  });
});
