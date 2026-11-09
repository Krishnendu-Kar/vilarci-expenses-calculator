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
}

const LockContext = createContext<LockValue>({ isOpen: () => true, open: async () => true });

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

  const value = useMemo(() => ({ isOpen, open }), [isOpen, open]);
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export const useLock = () => useContext(LockContext);

/**
 * For pages that add up several groups (People, a person, Profile): the
 * groups whose numbers may show, and how many locked ones were left out.
 */
export function useOpenGroups(): { groups: Group[]; hidden: number } {
  const { groups } = useGroups();
  const { isOpen } = useLock();
  return useMemo(() => {
    const open = groups.filter((g) => isOpen(g.id));
    return { groups: open, hidden: groups.length - open.length };
  }, [groups, isOpen]);
}
