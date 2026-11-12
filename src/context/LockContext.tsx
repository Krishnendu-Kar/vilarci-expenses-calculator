import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useGroups } from './GroupsContext';
import { isLocked } from '../lib/groupFilters';
import { askOwner } from '../lib/deviceLock';
import { translate } from '../i18n';
import type { Group } from '../types';

// Groups locked on this phone stay shut until the fingerprint, face or
// screen lock says yes. That lasts until the app has been away for a minute.
const AWAY_MS = 60_000;

interface LockValue {
  /** Not locked, or unlocked since the app was last away. */
  isOpen: (groupId: string) => boolean;
  /** Asks for the fingerprint or screen lock; true when it said yes. */
  open: (groupId: string, prompt: string) => Promise<boolean>;
  /** One fingerprint or screen lock opens all these groups (the Locked groups page). */
  openAll: (groupIds: string[], prompt: string) => Promise<boolean>;
  /** Shut again now, without waiting for the app to be away (leaving the Locked groups page). */
  lockAgain: (groupIds: string[]) => void;
}

const LockContext = createContext<LockValue>({
  isOpen: () => true,
  open: async () => true,
  openAll: async () => true,
  lockAgain: () => {},
});

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = useGroups();
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const awayAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (awayAt.current !== null && Date.now() - awayAt.current > AWAY_MS) setUnlocked(new Set());
        awayAt.current = null;
      } else if (awayAt.current === null) {
        awayAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const isOpen = useCallback((groupId: string) => !isLocked(prefs[groupId]) || unlocked.has(groupId), [prefs, unlocked]);

  const open = useCallback(async (groupId: string, prompt: string) => {
    if (!(await askOwner(prompt, translate('common.cancel')))) return false;
    setUnlocked((s) => new Set(s).add(groupId));
    return true;
  }, []);

  const openAll = useCallback(async (groupIds: string[], prompt: string) => {
    if (!(await askOwner(prompt, translate('common.cancel')))) return false;
    setUnlocked((s) => new Set([...s, ...groupIds]));
    return true;
  }, []);

  const lockAgain = useCallback((groupIds: string[]) => {
    setUnlocked((s) => {
      if (!groupIds.some((id) => s.has(id))) return s;
      const next = new Set(s);
      groupIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isOpen, open, openAll, lockAgain }), [isOpen, open, openAll, lockAgain]);
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export const useLock = () => useContext(LockContext);

/**
 * For pages that add up several groups (People, a person, Profile): the
 * groups whose numbers may show. How many were left out is never shown, so
 * nobody looking at the phone learns whether locked groups exist.
 */
export function useOpenGroups(): { groups: Group[] } {
  const { groups } = useGroups();
  const { isOpen } = useLock();
  return useMemo(() => ({ groups: groups.filter((g) => isOpen(g.id)) }), [groups, isOpen]);
}
