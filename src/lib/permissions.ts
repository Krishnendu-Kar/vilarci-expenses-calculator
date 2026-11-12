import type { Group, GroupSettings, OnlineInfo, Role } from '../types';

// Who may do what in a live group (onlinedb.md §13). The phone asks first, so
// the app never offers or saves a change the server would refuse; the server
// asks again (private.can in supabase/migrations/…_sync.sql). The two must
// give the same answers: both test files walk the same table.

export type Action =
  | 'read'
  | 'share_invite'
  | 'leave'
  | 'edit_expenses'
  | 'edit_info'
  | 'add_guests'
  | 'change_settings'
  | 'reset_invite'
  | 'decide_requests'
  | 'link_guest'
  | 'set_role'
  | 'remove_member'
  | 'delete_group';

export const DEFAULT_SETTINGS: GroupSettings = {
  editInfo: 'all',
  addExpenses: 'all',
  addGuests: 'all',
  requireApproval: false,
};

const ADMIN_ONLY: Action[] = [
  'change_settings',
  'reset_invite',
  'decide_requests',
  'link_guest',
  'set_role',
  'remove_member',
  'delete_group',
];

/**
 * The rule itself. `role` is null for someone who isn't an active member.
 * Admins have every power the creator has; who can be demoted or removed is
 * checked where that happens. A deleted group is read-only, but admins can
 * still restore it.
 */
export function allowed(action: Action, role: Role | null, settings: GroupSettings, deleted = false): boolean {
  if (role !== 'creator' && role !== 'admin' && role !== 'member') return false;
  const admin = role !== 'member';
  if (deleted) return action === 'read' || (action === 'delete_group' && admin);
  switch (action) {
    case 'read':
    case 'share_invite':
    case 'leave':
      return true;
    case 'edit_expenses':
      return admin || settings.addExpenses === 'all';
    case 'edit_info':
      return admin || settings.editInfo === 'all';
    case 'add_guests':
      return admin || settings.addGuests === 'all';
    default:
      return ADMIN_ONLY.includes(action) && admin;
  }
}

/** May you do this in this group? Local groups: always (they're only yours). */
export function can(action: Action, group: Pick<Group, 'online'>): boolean {
  const o: OnlineInfo | undefined = group.online;
  if (!o) return true;
  if (o.status !== 'active') return action === 'read';
  return allowed(action, o.role, o.settings, o.deletedAt != null);
}

/**
 * May you mark a payment between these two as paid, or undo it? In a live
 * group only the payer, the receiver or an admin may (the server asks the
 * same: private.may_record_payment). `meId` is your member id there. Local
 * groups: always.
 */
export function canRecordPayment(group: Pick<Group, 'online'>, meId: string | null, from: string, to: string): boolean {
  if (!group.online) return true;
  if (!can('edit_expenses', group)) return false;
  const role = group.online.role;
  return role === 'creator' || role === 'admin' || (!!meId && (meId === from || meId === to));
}
