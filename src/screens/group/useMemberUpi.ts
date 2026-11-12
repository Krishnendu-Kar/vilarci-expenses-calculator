import { useEffect, useState } from 'react';
import { fetchUpiIds } from '../../lib/api/upi';
import { addToUpiCache, readUpiCache, type UpiCache } from '../../lib/upiCache';
import type { Group, UpiId } from '../../types';

/**
 * Member id → UPI ids, for the people with an account in a live group (their
 * member id is their account id). The phone's copy shows first; a fresh one
 * is asked for each time Settle opens.
 */
export function useMemberUpi(group: Group): UpiCache {
  const [ids, setIds] = useState<UpiCache>({});
  const accounts = group.online
    ? group.members
        .filter((m) => m.account && !m.gone)
        .map((m) => m.id)
        .sort()
        .join(',')
    : '';
  useEffect(() => {
    if (!accounts) return;
    let current = true;
    const list = accounts.split(',');
    const pick = (c: UpiCache) => Object.fromEntries(list.filter((id) => c[id]?.length).map((id) => [id, c[id]]));
    void readUpiCache().then((c) => current && setIds(pick(c)));
    fetchUpiIds(list)
      .then(addToUpiCache)
      .then((c) => current && setIds(pick(c)))
      // Offline: the copy kept on the phone stands.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [accounts]);
  return ids;
}

/**
 * One account's UPI ids (a person's page): the phone's copy first, then a
 * fresh one. Empty for a guest (null) or someone who added none.
 */
export function useAccountUpi(userId: string | null): UpiId[] {
  const [ids, setIds] = useState<UpiId[]>([]);
  useEffect(() => {
    if (!userId) {
      setIds([]);
      return;
    }
    let current = true;
    void readUpiCache().then((c) => current && setIds(c[userId] ?? []));
    fetchUpiIds([userId])
      .then(addToUpiCache)
      .then((c) => current && setIds(c[userId] ?? []))
      // Offline: the copy kept on the phone stands.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [userId]);
  return ids;
}
