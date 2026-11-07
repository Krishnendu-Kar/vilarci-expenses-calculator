/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { binDaysLeft, purgeBin, sanitizeBin } from '../bin';
import { group } from './fixtures';

const DAY = 24 * 3600 * 1000;

describe('bin', () => {
  const item = { group: group(['A', 'B'], []), binnedAt: 0 };

  it('counts down 30 days', () => {
    assert.equal(binDaysLeft(item, 0), 30);
    assert.equal(binDaysLeft(item, 29.5 * DAY), 1);
    assert.equal(binDaysLeft(item, 10 * DAY + 1), 20);
  });

  it('deletes for good after 30 days', () => {
    const fresh = { group: group(['A'], [], 'fresh'), binnedAt: 25 * DAY };
    assert.deepEqual(purgeBin([item, fresh], 30 * DAY).map((b) => b.group.id), ['fresh']);
    const kept = [item];
    assert.equal(purgeBin(kept, 29 * DAY), kept, 'unchanged when nothing expired');
  });

  it('ignores broken stored entries', () => {
    assert.deepEqual(sanitizeBin('x'), []);
    const out = sanitizeBin([item, { group: 'nope', binnedAt: 1 }, { group: item.group }, item]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0], item);
  });
});
