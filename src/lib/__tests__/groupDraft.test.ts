/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { draftHasContent, parseGroupDraft, parseOnlineQueue } from '../groupDraft';
import { connectionOf } from '../connection';
import { noAnswer } from '../accountRules';

describe('New group draft', () => {
  const me = { id: 'me', name: 'Krish' };

  it('is worth keeping once something is typed or someone besides you is added', () => {
    assert.equal(draftHasContent({ name: ' ', members: [me], meId: 'me' }), false);
    assert.equal(draftHasContent({ name: 'Goa', members: [me], meId: 'me' }), true);
    assert.equal(draftHasContent({ name: '', members: [me, { id: 'r', name: 'Rahul' }], meId: 'me' }), true);
  });

  it('reads back what was saved, and drops what is broken', () => {
    const saved = { name: 'Goa', kind: 'hostel', members: [me, { id: 'r', name: 'Rahul' }, { id: 7 }], meId: 'me', where: 'online', savedAt: 5 };
    assert.deepEqual(parseGroupDraft(JSON.stringify(saved)), {
      name: 'Goa',
      kind: 'hostel',
      members: [me, { id: 'r', name: 'Rahul' }],
      meId: 'me',
      where: 'online',
      savedAt: 5,
    });
    assert.equal(parseGroupDraft(JSON.stringify({ ...saved, kind: 'boat', where: 'moon' }))?.kind, 'trip');
    assert.equal(parseGroupDraft(JSON.stringify({ ...saved, where: 'moon' }))?.where, 'local');
    assert.equal(parseGroupDraft(JSON.stringify({ name: '', members: [me], meId: 'me' })), null, 'an empty form is no draft');
    assert.equal(parseGroupDraft('{nope'), null);
    assert.equal(parseGroupDraft(null), null);
  });

  it('reads the waiting-to-go-online list', () => {
    assert.deepEqual(parseOnlineQueue('["a","b","a",3,""]'), ['a', 'b']);
    assert.deepEqual(parseOnlineQueue('oops'), []);
    assert.deepEqual(parseOnlineQueue(null), []);
  });
});

describe('connection bar', () => {
  const wifi = { isConnected: true, isInternetReachable: true, type: 'wifi', details: {} };

  it('says offline with no network, or a network without internet', () => {
    assert.equal(connectionOf({ ...wifi, isConnected: false }, false), 'offline');
    assert.equal(connectionOf({ ...wifi, isInternetReachable: false }, true), 'offline');
    assert.equal(connectionOf({ ...wifi, isInternetReachable: null }, false), 'ok', 'not known yet is not offline');
  });

  it('says slow after slow answers, or on 2G', () => {
    assert.equal(connectionOf(wifi, true), 'slow');
    assert.equal(connectionOf({ ...wifi, type: 'cellular', details: { cellularGeneration: '2g' } }, false), 'slow');
    assert.equal(connectionOf({ ...wifi, type: 'cellular', details: { cellularGeneration: '4g' } }, false), 'ok');
    assert.equal(connectionOf(null, false), 'ok');
  });

  it('tells "no answer at all" apart from the server saying no', () => {
    assert.equal(noAnswer(new TypeError('Network request failed')), true);
    assert.equal(noAnswer({ message: 'TypeError: Failed to fetch' }), true);
    assert.equal(noAnswer({ code: '42501', message: 'not allowed' }), false);
    assert.equal(noAnswer(undefined), false);
  });
});
