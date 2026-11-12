import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allowed, can, DEFAULT_SETTINGS, type Action, canRecordPayment } from '../permissions';
import type { GroupSettings, Role } from '../../types';

// The same rows as the can() section of supabase/tests/sync_test.sql: the
// phone and the server must agree on every one.
type Row = [Action | 'fly', Role | 'guest' | null, string, Partial<GroupSettings> & { deleted?: boolean }, boolean];

const TABLE: Row[] = [
  ['read', 'member', 'default', {}, true],
  ['read', null, 'not a member', {}, false],
  ['edit_expenses', 'member', 'everyone', {}, true],
  ['edit_expenses', 'member', 'admins only', { addExpenses: 'admins' }, false],
  ['edit_expenses', 'admin', 'admins only', { addExpenses: 'admins' }, true],
  ['edit_expenses', 'creator', 'admins only', { addExpenses: 'admins' }, true],
  ['edit_info', 'member', 'everyone', {}, true],
  ['edit_info', 'member', 'admins only', { editInfo: 'admins' }, false],
  ['edit_info', 'admin', 'admins only', { editInfo: 'admins' }, true],
  ['add_guests', 'member', 'everyone', {}, true],
  ['add_guests', 'member', 'admins only', { addGuests: 'admins' }, false],
  ['add_guests', 'admin', 'admins only', { addGuests: 'admins' }, true],
  ['share_invite', 'member', 'approval on', { requireApproval: true }, true],
  ['change_settings', 'member', 'default', {}, false],
  ['change_settings', 'admin', 'default', {}, true],
  ['reset_invite', 'member', 'default', {}, false],
  ['reset_invite', 'admin', 'default', {}, true],
  ['decide_requests', 'member', 'default', {}, false],
  ['decide_requests', 'admin', 'default', {}, true],
  ['link_guest', 'member', 'default', {}, false],
  ['link_guest', 'creator', 'default', {}, true],
  ['set_role', 'member', 'default', {}, false],
  ['set_role', 'admin', 'default', {}, true],
  ['remove_member', 'member', 'default', {}, false],
  ['remove_member', 'admin', 'default', {}, true],
  ['delete_group', 'member', 'default', {}, false],
  ['delete_group', 'admin', 'default', {}, true],
  ['delete_group', 'creator', 'default', {}, true],
  ['leave', 'member', 'default', {}, true],
  ['leave', 'creator', 'default', {}, true],
  ['read', 'member', 'group deleted', { deleted: true }, true],
  ['edit_expenses', 'creator', 'group deleted', { deleted: true }, false],
  ['delete_group', 'admin', 'group deleted', { deleted: true }, true],
  ['delete_group', 'member', 'group deleted', { deleted: true }, false],
  ['fly', 'creator', 'unknown action', {}, false],
  ['edit_expenses', 'guest', 'unknown role', {}, false],
];

describe('permissions', () => {
  for (const [action, role, setting, { deleted, ...settings }, expect] of TABLE) {
    it(`${action} / ${role ?? 'no role'} / ${setting}`, () => {
      assert.equal(allowed(action as Action, role as Role | null, { ...DEFAULT_SETTINGS, ...settings }, deleted), expect);
    });
  }

  it('lets you do anything in a local group, and only read once you left a live one', () => {
    assert.equal(can('delete_group', {}), true);
    const online = { role: 'admin' as const, status: 'active' as const, settings: DEFAULT_SETTINGS };
    assert.equal(can('delete_group', { online }), true);
    assert.equal(can('edit_expenses', { online: { ...online, role: null, status: 'left' } }), false);
    assert.equal(can('read', { online: { ...online, role: null, status: 'removed' } }), true);
  });
});

describe('who may mark a payment paid', () => {
  const live = (role: 'creator' | 'admin' | 'member', extra = {}) => ({
    online: { role, status: 'active' as const, settings: { ...DEFAULT_SETTINGS, ...extra } },
  });

  it('a local group: anyone (it is only yours)', () => {
    assert.equal(canRecordPayment({}, null, 'a', 'b'), true);
  });

  it('a member: only a payment they pay or get', () => {
    assert.equal(canRecordPayment(live('member'), 'me', 'me', 'b'), true);
    assert.equal(canRecordPayment(live('member'), 'me', 'a', 'me'), true);
    assert.equal(canRecordPayment(live('member'), 'me', 'a', 'b'), false);
    assert.equal(canRecordPayment(live('member'), null, 'a', 'b'), false);
  });

  it('admins and the creator: any payment', () => {
    assert.equal(canRecordPayment(live('admin'), 'me', 'a', 'b'), true);
    assert.equal(canRecordPayment(live('creator'), 'me', 'a', 'b'), true);
  });

  it('nobody, when only admins may change expenses and you are not one', () => {
    assert.equal(canRecordPayment(live('member', { addExpenses: 'admins' }), 'me', 'me', 'b'), false);
  });
});
