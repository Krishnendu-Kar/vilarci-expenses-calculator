import { supabase } from './supabase';
import type { SyncApi } from '../sync/engine';
import type { Row, SyncResponse } from '../sync/wire';

// The two server functions of live groups (supabase/migrations/…_sync.sql).
// Both need a sign-in; the client sends it.

export const syncApi: SyncApi = {
  async sync(changes, cursors, max) {
    const { data, error } = await supabase.rpc('sync', { p_changes: changes, p_cursors: cursors, p_max: max ?? 500 });
    if (error) throw error;
    return data as SyncResponse;
  },
};

export type PutOnlineResult =
  | { status: 'online'; group_id: string; cursor: number; server_now: number }
  | { status: 'exists'; group_id: string };

/** The first upload of a local group (§8). `exists`: a copy of it is online already. */
export async function putGroupOnline(group: Row): Promise<PutOnlineResult> {
  const { data, error } = await supabase.rpc('put_group_online', { p_group: group });
  if (error) throw error;
  return data as PutOnlineResult;
}
