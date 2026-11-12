/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanContactNames, membersFromContacts } from '../contacts';

describe('contact names', () => {
  it('tidies, sorts and keeps each name once', () => {
    assert.deepEqual(cleanContactNames(['  Rahul   K ', 'neha', 'Rahul K', null, '', 'Amit']), ['Amit', 'neha', 'Rahul K']);
  });

  it('drops names that are only a number, and cuts long ones to 30', () => {
    assert.deepEqual(cleanContactNames(['+91 98765 43210', '(033) 2222-1111', 'A'.repeat(40)]), ['A'.repeat(30)]);
  });
});

describe('members from contacts', () => {
  const people = [{ id: 'p-neha', name: 'Neha', createdAt: 1 }];
  let n = 0;
  const newId = () => `new-${++n}`;

  it('reuses someone already in People, makes guests of the rest, skips who is in the group', () => {
    const out = membersFromContacts(['neha', 'Rahul', 'Krish', 'rahul'], people, [{ id: 'me', name: 'Krish' }], newId);
    assert.deepEqual(out.add, [
      { id: 'p-neha', name: 'Neha' },
      { id: 'new-1', name: 'Rahul' },
    ]);
    assert.deepEqual(out.already, ['Krish', 'rahul']);
  });
});
