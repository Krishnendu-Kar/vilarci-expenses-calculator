/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addVisit,
  archive,
  filterGroups,
  isLocked,
  isPinned,
  lock,
  pin,
  pinDaysLeft,
  prunePrefs,
  pruneVisits,
  sanitizePrefs,
  sanitizeVisits,
  unarchive,
  unlock,
  unpin,
  type Visits,
} from '../groupFilters';
import { group } from './fixtures';
import type { GroupKind } from '../../types';

const g = (id: string, kind: GroupKind, updatedAt: number) => ({ ...group(['A'], [], id), kind, updatedAt });
const groups = [g('goa', 'trip', 1), g('mess', 'hostel', 3), g('flat', 'other', 2), g('manali', 'trip', 4)];
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe('filterGroups', () => {
  it('leaves locked groups out of every list', () => {
    const prefs = lock({}, 'mess', 1);
    assert.deepEqual(ids(filterGroups(groups, 'all', {}, prefs)), ['manali', 'flat', 'goa']);
    assert.deepEqual(ids(filterGroups(groups, 'hostel', {}, prefs)), []);
    assert.deepEqual(ids(filterGroups(groups, 'visited', { mess: { count: 3, last: 1 } }, prefs)), []);
    assert.deepEqual(ids(filterGroups(groups, 'archived', {}, archive(prefs, 'mess'))), []);
  });

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

describe('pins and archive', () => {
  const DAY = 24 * 3600 * 1000;

  it('pinned groups come first, latest pin on top, within their filter too', () => {
    let prefs = pin({}, 'goa', null, 100);
    prefs = pin(prefs, 'flat', 7, 200);
    assert.deepEqual(ids(filterGroups(groups, 'all', {}, prefs, 300)), ['flat', 'goa', 'manali', 'mess']);
    assert.deepEqual(ids(filterGroups(groups, 'trip', {}, prefs, 300)), ['goa', 'manali']);
  });

  it('a timed pin runs out', () => {
    const prefs = pin({}, 'goa', 1, 0);
    assert.equal(isPinned(prefs.goa, DAY - 1), true);
    assert.equal(pinDaysLeft(prefs.goa, 1), 1);
    assert.equal(isPinned(prefs.goa, DAY + 1), false);
    assert.deepEqual(ids(filterGroups(groups, 'all', {}, prefs, DAY + 1)), ['manali', 'mess', 'flat', 'goa']);
    assert.deepEqual(prunePrefs(prefs, groups, DAY + 1), {});
  });

  it('archived groups leave every list but Archived, and archiving unpins', () => {
    let prefs = pin({}, 'mess', null, 1);
    prefs = archive(prefs, 'mess', 5);
    assert.equal(isPinned(prefs.mess), false);
    assert.ok(!ids(filterGroups(groups, 'all', {}, prefs)).includes('mess'));
    assert.deepEqual(filterGroups(groups, 'hostel', {}, prefs), []);
    assert.deepEqual(filterGroups(groups, 'visited', { mess: { count: 3, last: 1 } }, prefs), []);
    assert.deepEqual(ids(filterGroups(groups, 'archived', {}, prefs)), ['mess']);
    assert.deepEqual(unarchive(prefs, 'mess'), {});
  });

  it('unpin keeps the archive state; pruning drops deleted groups', () => {
    const prefs = { goa: { pinnedAt: 1, pinUntil: null }, gone: { archivedAt: 1 } };
    assert.deepEqual(unpin(prefs, 'goa'), { gone: { archivedAt: 1 } });
    assert.deepEqual(prunePrefs(prefs, groups, 2), { goa: { pinnedAt: 1, pinUntil: null } });
  });

  it('ignores malformed stored prefs', () => {
    assert.deepEqual(sanitizePrefs([1]), {});
    assert.deepEqual(sanitizePrefs({ a: { pinnedAt: 5 }, b: { archivedAt: 'x' }, c: null }), { a: { pinnedAt: 5, pinUntil: null } });
  });
});

describe('group lock', () => {
  it('locks and unlocks without touching the pin', () => {
    const pinned = pin({}, 'goa', null, 1);
    const locked = lock(pinned, 'goa', 9);
    assert.equal(isLocked(locked.goa), true);
    assert.equal(isPinned(locked.goa), true);
    assert.deepEqual(unlock(locked, 'goa'), pinned);
    assert.deepEqual(unlock(lock({}, 'goa', 9), 'goa'), {}, 'no empty entry left behind');
  });

  it('stays through archive, unarchive, unpin and pruning', () => {
    let prefs = lock(pin({}, 'mess', null, 1), 'mess', 2);
    prefs = archive(prefs, 'mess', 5);
    assert.deepEqual(prefs.mess, { archivedAt: 5, lockedAt: 2 });
    assert.deepEqual(unarchive(prefs, 'mess'), { mess: { lockedAt: 2 } });
    assert.deepEqual(unpin(lock({}, 'goa', 3), 'goa'), { goa: { lockedAt: 3 } });
    assert.deepEqual(prunePrefs({ goa: { lockedAt: 3 }, gone: { lockedAt: 4 } }, groups), { goa: { lockedAt: 3 } });
  });

  it('reads a stored lock', () => {
    assert.deepEqual(sanitizePrefs({ a: { lockedAt: 7 }, b: { lockedAt: 'yes' } }), { a: { lockedAt: 7 } });
  });
});
