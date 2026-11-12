/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backupDue, backupName, multipartBody, oldBackups, type DriveFile } from '../drive';

const file = (name: string, createdTime: string): DriveFile => ({ id: name, name, createdTime });

describe('Drive backup', () => {
  it('keeps the newest two backups, and leaves other files alone', () => {
    const files = [
      file('vilarci-split-backup-2026-11-09.json', '2026-11-09T10:00:00Z'),
      file('vilarci-split-backup-2026-11-11.json', '2026-11-11T10:00:00Z'),
      file('something-else.json', '2026-01-01T00:00:00Z'),
      file('vilarci-split-backup-2026-11-10.json', '2026-11-10T10:00:00Z'),
    ];
    assert.deepEqual(
      oldBackups(files).map((f) => f.name),
      ['vilarci-split-backup-2026-11-09.json'],
    );
  });

  it('names the file by date', () => {
    assert.equal(backupName(new Date('2026-11-11T05:00:00Z')), 'vilarci-split-backup-2026-11-11.json');
  });

  it('builds a multipart body: details, then the file', () => {
    const body = multipartBody({ name: 'a.json' }, '{"x":1}', 'B');
    assert.equal(
      body,
      '--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a.json"}\r\n--B\r\nContent-Type: application/json\r\n\r\n{"x":1}\r\n--B--\r\n',
    );
  });

  it('auto backup: off, never done, not yet due, due', () => {
    const day = 24 * 3600 * 1000;
    assert.equal(backupDue(null, 0, 10 * day), false);
    assert.equal(backupDue(null, 1, 10 * day), true);
    assert.equal(backupDue(10 * day, 7, 12 * day), false);
    assert.equal(backupDue(10 * day, 7, 17 * day), true);
  });
});
