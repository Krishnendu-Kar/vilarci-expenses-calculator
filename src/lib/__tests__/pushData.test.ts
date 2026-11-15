/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, forThisAccount, parsePrefs, pushTarget } from '../pushData';

describe('push notifications on the phone', () => {
  it('reads the server switches, filling gaps with "on"', () => {
    assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
    const p = parsePrefs({ expenses: false, news: false, muted_groups: ['g1', 7, 'g2'] });
    assert.equal(p.expenses, false);
    assert.equal(p.payments, true, 'missing → on');
    assert.equal(p.news, false);
    assert.deepEqual(p.mutedGroups, ['g1', 'g2'], 'junk dropped');
    assert.deepEqual(parsePrefs(JSON.parse(JSON.stringify(p))), p, 'the saved copy reads back the same');
  });

  it('a tapped push points at its group', () => {
    assert.deepEqual(pushTarget({ kind: 'expense_added', uid: 'u1', group_id: 'g1' }), { kind: 'expense_added', uid: 'u1', groupId: 'g1' });
    assert.equal(pushTarget({ group_id: 'g1' }), null, 'no kind');
    assert.equal(pushTarget('nope'), null);
  });

  it("a push for another account is never shown (a phone that logged out)", () => {
    const t = pushTarget({ kind: 'payment_added', uid: 'alice', group_id: 'g' });
    assert.equal(forThisAccount(t, 'alice'), true);
    assert.equal(forThisAccount(t, 'bob'), false, 'someone else signed in');
    assert.equal(forThisAccount(t, null), false, 'signed out');
    assert.equal(forThisAccount(pushTarget({ kind: 'news' }), null), true, 'no account in it');
  });
});
