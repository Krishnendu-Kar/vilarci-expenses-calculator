import { supabase } from './supabase';
import { sanitizeUpiIds } from '../upi';
import type { UpiId } from '../../types';

// Other people's UPI ids (onlinedb.md §19): saved with their account, and
// readable only by people who share a live group with them (the profiles
// policy). Ids you can't see simply don't come back.

export async function fetchUpiIds(userIds: string[]): Promise<Record<string, UpiId[]>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase.from('profiles').select('id, upi_ids').in('id', userIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: { id: string; upi_ids: unknown }) => [r.id, sanitizeUpiIds(r.upi_ids)]));
}
