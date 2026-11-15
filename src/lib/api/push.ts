import { supabase } from './supabase';
import { parsePrefs, type PushKind, type PushPrefs } from '../pushData';

export { DEFAULT_PREFS, PUSH_KINDS, parsePrefs, type PushKind, type PushPrefs } from '../pushData';

// Push notifications on the server (supabase/migrations/…_push.sql,
// notification.md): this phone's registration, your switches, muted groups
// and reminders. All need you signed in.

export async function registerDevice(d: { token: string; platform: 'android' | 'ios'; locale: string; appCode: number; hidden: string[] }) {
  const { error } = await supabase.rpc('register_push_device', {
    p_token: d.token,
    p_platform: d.platform,
    p_locale: d.locale,
    p_app_code: d.appCode,
    p_hidden: d.hidden,
  });
  if (error) throw error;
}

export async function unregisterDevice(token: string) {
  const { error } = await supabase.rpc('unregister_push_device', { p_token: token });
  if (error) throw error;
}

export async function fetchPrefs(): Promise<PushPrefs> {
  const { data, error } = await supabase.rpc('get_push_prefs');
  if (error) throw error;
  return parsePrefs(data);
}

export async function savePrefs(change: Partial<Record<PushKind, boolean>>): Promise<PushPrefs> {
  const { data, error } = await supabase.rpc('set_push_prefs', { p_prefs: change });
  if (error) throw error;
  return parsePrefs(data);
}

export async function muteGroup(groupId: string, muted: boolean): Promise<PushPrefs> {
  const { data, error } = await supabase.rpc('mute_group', { p_group: groupId, p_muted: muted });
  if (error) throw error;
  return parsePrefs(data);
}

export type RemindResult = 'sent' | 'too_soon' | 'settled' | 'not_owed' | 'no_account' | 'not_member';

/** Remind a member who owes money (once a day per person; only if you're owed). */
export async function remind(groupId: string, memberId: string): Promise<{ status: RemindResult; amount?: number }> {
  const { data, error } = await supabase.rpc('remind', { p_group: groupId, p_member: memberId });
  if (error) throw error;
  const r = (data ?? {}) as { status?: RemindResult; amount?: number };
  return { status: r.status ?? 'not_member', amount: r.amount };
}
