/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addVisit, filterGroups, pruneVisits, sanitizeVisits, type Visits } from '../groupFilters';
import { group } from './fixtures';
import type { GroupKind } from '../../types';

const g = (id: string, kind: GroupKind, updatedAt: number) => ({ ...group(['A'], [], id), kind, updatedAt });
const groups = [g('goa', 'trip', 1), g('mess', 'hostel', 3), g('flat', 'other', 2), g('manali', 'trip', 4)];
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe('filterGroups', () => {
  it('all: newest activity first', () => {
    assert.deepEqual(ids(filterGroups(groups, 'all', {})), ['manali', 'mess', 'flat', 'goa']);
  });

  it('by kind', () => {
    assert.deepEqual(ids(filterGroups(groups, 'trip', {})), ['manali', 'goa']);
    assert.deepEqual(ids(filterGroups(groups, 'hostel', {})), ['mess']);
    assert.deepEqual(ids(filterGroups(groups, 'other', {})), ['flat']);
  });

  it('most visited: only opened groups, most opened first, ties by latest', () => {
    const visits: Visits = { goa: { count: 5, last: 10 }, flat: { count: 2, last: 50 }, mess: { count: 2, last: 60 } };
    assert.deepEqual(ids(filterGroups(groups, 'visited', visits)), ['goa', 'mess', 'flat']);
  });

  it('most visited is empty until something is opened', () => {
    assert.deepEqual(filterGroups(groups, 'visited', {}), []);
  });

  it('does not reorder the input array', () => {
    const copy = [...groups];
    filterGroups(groups, 'all', {});
    assert.deepEqual(ids(groups), ids(copy));
  });
});

describe('visits', () => {
  it('counts and timestamps opens', () => {
    let v: Visits = {};
    v = addVisit(v, 'goa', 100);
    v = addVisit(v, 'goa', 200);
    assert.deepEqual(v, { goa: { count: 2, last: 200 } });
  });

  it('prunes deleted groups', () => {
    assert.deepEqual(pruneVisits({ goa: { count: 1, last: 1 }, gone: { count: 9, last: 1 } }, groups), {
      goa: { count: 1, last: 1 },
    });
  });

  it('ignores malformed stored data', () => {
    assert.deepEqual(sanitizeVisits('nope'), {});
    assert.deepEqual(sanitizeVisits({ a: { count: 2, last: 5 }, b: { count: -1, last: 5 }, c: null, d: { count: 1.5, last: 1 } }), {
      a: { count: 2, last: 5 },
    });
  });
});
