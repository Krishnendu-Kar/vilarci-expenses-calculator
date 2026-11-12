import { supabase } from './supabase';
import { INVITE_HOST } from '../invite';
import type { GroupKind, GroupSettings } from '../../types';

// Joining and running a live group (supabase/migrations/…_invites_roles.sql).
// All online only (onlinedb.md §9.9); what they change reaches the phone with
// the next sync.

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const inviteUrl = (code: string) => `https://${INVITE_HOST}/join/${code}`;

/** The group's invite code; null while the link is off. `reset` (admins): a new one. */
export const inviteLink = (groupId: string, reset = false) =>
  call<{ code: string | null }>('invite_link', { p_group: groupId, p_reset: reset }).then((r) => r.code);

export interface InvitePreview {
  status: 'open' | 'member' | 'pending' | 'full' | 'invalid';
  group_id?: string;
  name?: string;
  kind?: GroupKind;
  members?: number;
  require_approval?: boolean;
  guests?: { id: string; name: string }[];
}

export const previewInvite = (code: string) => call<InvitePreview>('preview_invite', { p_code: code });

export type JoinStatus = 'joined' | 'pending' | 'member' | 'full' | 'invalid';

/** `claim`: the guest you are ("I'm Rahul"), or null. */
export const joinGroup = (code: string, claim: string | null) =>
  call<{ status: JoinStatus; group_id?: string }>('join_group', { p_code: code, p_claim: claim });

export interface JoinRequest {
  id: string;
  user_id: string;
  name: string;
  claim_member: string | null;
  created_at: number;
}

/** Requests waiting in a group (admins only; Row Level Security shows nobody else's). */
export async function pendingRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('id, user_id, name, claim_member, created_at')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as JoinRequest[];
}

export const decideRequest = (requestId: string, approve: boolean, linkGuest: string | null) =>
  call<{ status: string }>('decide_request', { p_request: requestId, p_approve: approve, p_link_guest: linkGuest });

/** The guest and the member are the same person (§16). Can't be undone. */
export const linkGuest = (groupId: string, guestId: string, intoId: string) =>
  call<{ status: string }>('link_guest', { p_group: groupId, p_guest: guestId, p_into: intoId });

/** status: changed, same, or last_admin (someone else must be an admin first). */
export const setRole = (groupId: string, memberId: string, role: 'admin' | 'member') =>
  call<{ status: 'changed' | 'same' | 'last_admin' }>('set_role', { p_group: groupId, p_member: memberId, p_role: role });

/** Any of the settings, and the invite link on or off. */
export function updateSettings(groupId: string, s: Partial<GroupSettings> & { inviteOn?: boolean }) {
  return call<{ status: string }>('update_settings', {
    p_group: groupId,
    p_settings: {
      ...(s.editInfo ? { edit_info: s.editInfo } : {}),
      ...(s.addExpenses ? { add_expenses: s.addExpenses } : {}),
      ...(s.addGuests ? { add_guests: s.addGuests } : {}),
      ...(s.requireApproval !== undefined ? { require_approval: s.requireApproval } : {}),
      ...(s.inviteOn !== undefined ? { invite_on: s.inviteOn } : {}),
    },
  });
}

// Leaving, removing and deleting (…_leave_delete_poke.sql, …_gone_members.sql).

/** Why leaving (or deleting the account) is blocked in a group. */
export type LeaveProblem =
  | { reason: 'not_settled'; balance: number }
  | { reason: 'in_repeat'; title: string }
  | { reason: 'last_admin' }
  | { reason: 'last_account' };

export type LeaveResult =
  | { status: 'left' | 'not_member' | 'last_admin' | 'last_account' }
  | { status: 'not_settled'; balance: number }
  | { status: 'in_repeat'; title: string };

/** Leave a live group: only when settled (under ₹1), out of every repeat, and not the last admin. */
export const leaveGroup = (groupId: string) => call<LeaveResult>('leave_group', { p_group: groupId });

export type RemoveResult =
  | { status: 'removed' | 'gone' }
  | { status: 'not_settled'; balance: number }
  | { status: 'in_repeat'; title: string };

/** An admin removes someone (guest or account) who is settled and in no repeat. */
export const removeMember = (groupId: string, memberId: string) =>
  call<RemoveResult>('remove_member', { p_group: groupId, p_member: memberId });

/** Creator or admins: read-only for everyone, cleaned up after 30 days. */
export const deleteGroupOnline = (groupId: string) =>
  call<{ status: 'deleted' | 'same' }>('delete_group', { p_group: groupId });

export const restoreGroupOnline = (groupId: string) =>
  call<{ status: 'restored' | 'same' }>('restore_group', { p_group: groupId });

export type AccountBlocker = { group_id: string; name: string } & LeaveProblem;

/** Groups you can't leave yet, so the account can't be deleted. Empty = free to go. */
export const accountBlockers = () => call<AccountBlocker[]>('account_blockers', {});

/** The verified email of someone in one of your live groups; null for anyone else (or unconfirmed). */
export const memberEmail = (userId: string) => call<string | null>('member_email', { p_user: userId });
