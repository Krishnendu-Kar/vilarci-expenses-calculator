/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchExpenses, searchMembers } from '../search';
import { expense } from './fixtures';
import type { CategoryKey } from '../../types';

const names = { A: 'Krish', B: 'Tamal', C: 'Sayak' };
const label = (k: CategoryKey) => ({ food: 'Food', travel: 'Travel' })[k as 'food'] ?? 'Other';
const list = [
  { ...expense('Rice', 120, 'A', ['A', 'B', 'C']), category: 'food' as const },
  { ...expense('Auto', 1200, 'B', ['B', 'C']), category: 'travel' as const, note: 'to the station' },
  expense('Boat', 400, 'C', ['A', 'B', 'C']),
];
const find = (q: string) => searchExpenses(list, q, names, 3, label).map((e) => e.title);

describe('searchExpenses', () => {
  it('matches titles, notes and categories', () => {
    assert.deepEqual(find('rice'), ['Rice']);
    assert.deepEqual(find('station'), ['Auto']);
    assert.deepEqual(find('travel'), ['Auto']);
  });

  it('matches who paid, and who it was for when not everyone', () => {
    assert.deepEqual(find('tamal'), ['Auto']);
    assert.deepEqual(find('sayak'), ['Auto', 'Boat']);
    assert.deepEqual(find('krish'), ['Rice']);
  });

  it('matches amounts, and needs every word', () => {
    assert.deepEqual(find('120'), ['Rice', 'Auto']);
    assert.deepEqual(find('₹1,200'), ['Auto']);
    assert.deepEqual(find('krish rice'), ['Rice']);
    assert.deepEqual(find('krish boat'), []);
    assert.equal(searchExpenses(list, '  ', names, 3, label), list);
  });
});

describe('searchMembers', () => {
  it('filters by name', () => {
    const people = [{ name: 'Krish Kar' }, { name: 'Tamal' }];
    assert.deepEqual(searchMembers(people, 'kar'), [{ name: 'Krish Kar' }]);
    assert.equal(searchMembers(people, ''), people);
  });
});
