import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/api/supabase';
import { fetchAccountProfile, saveAccountProfile } from '../lib/api/account';
import { sameVpa } from '../lib/upi';
import { useGroups } from './GroupsContext';
import type { UpiId } from '../types';

// Who is signed in, if anyone. An account is optional: signed out, the app
// works exactly as before.
//
// Your name and UPI ids live on this phone (Profile) and are copied to the
// account: on a new phone with nothing set yet, the account's are used;
// otherwise this phone's are uploaded, and again after every change.

export interface AuthUser {
  id: string;
  email: string;
  /** When the account was made (ISO), for "Since Nov 2026" on Profile. */
  createdAt: string;
  emailConfirmed: boolean;
}

const toUser = (u: { id: string; email?: string; created_at: string; email_confirmed_at?: string | null }): AuthUser => ({
  id: u.id,
  email: u.email ?? '',
  createdAt: u.created_at,
  emailConfirmed: !!u.email_confirmed_at,
});

interface AuthValue {
  /** False until the saved sign-in has been read. */
  ready: boolean;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthValue>({ ready: false, user: null });

const sameIds = (a: UpiId[], b: UpiId[]) =>
  a.length === b.length && a.every((u, i) => sameVpa(u.vpa, b[i].vpa) && (u.label ?? '') === (b[i].label ?? ''));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready: dataReady, profile, upiIds, setProfileName, setUpiIds } = useGroups();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  // The account whose first sync is done (then every change is uploaded).
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  // Bumped when the app comes back, to retry a sync that failed offline.
  const [retry, setRetry] = useState(0);
  const local = useRef({ name: profile.name, upiIds });
  // What the account holds now, to skip uploads that change nothing.
  const saved = useRef('');
  const keyOf = (name: string, ids: UpiId[]) => JSON.stringify([name.trim(), ids]);
  local.current = { name: profile.name, upiIds };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        setUser(u ? toUser(u) : null);
      })
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser((cur) => {
        if (!u) return null;
        const next = toUser(u);
        return cur && cur.id === next.id && cur.email === next.email && cur.emailConfirmed === next.emailConfirmed ? cur : next;
      });
    });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setRetry((n) => n + 1));
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  // First sync after signing in (or opening the app signed in).
  useEffect(() => {
    if (!user || !dataReady || syncedFor === user.id) return;
    let cancelled = false;
    (async () => {
      const server = await fetchAccountProfile(user.id);
      const mine = local.current;
      // Field by field: what this phone has wins, but an empty name or UPI
      // list takes the account's (a name typed here must not wipe the UPI ids
      // saved from another phone).
      const name = mine.name.trim() || server?.name || '';
      const ids = mine.upiIds.length ? mine.upiIds : (server?.upiIds ?? []);
      if (name !== mine.name.trim()) setProfileName(name);
      if (!sameIds(ids, mine.upiIds)) setUpiIds(ids);
      if (!server || server.name !== name || !sameIds(server.upiIds, ids)) {
        await saveAccountProfile({ name, upiIds: ids });
      }
      saved.current = keyOf(name, ids);
      if (!cancelled) setSyncedFor(user.id);
    })().catch((e) => console.warn('Could not sync the account profile', e));
    return () => {
      cancelled = true;
    };
  }, [user, dataReady, syncedFor, retry, setProfileName, setUpiIds]);

  // After that, upload changes made on this phone (a second after the last one).
  useEffect(() => {
    if (!user || syncedFor !== user.id || keyOf(profile.name, upiIds) === saved.current) return;
    const t = setTimeout(() => {
      const key = keyOf(profile.name, upiIds);
      saveAccountProfile({ name: profile.name.trim(), upiIds })
        .then(() => (saved.current = key))
        .catch((e) => {
          console.warn('Could not save the account profile', e);
          // Try the whole sync again when the app next comes back.
          setSyncedFor(null);
        });
    }, 1000);
    return () => clearTimeout(t);
  }, [user, syncedFor, profile.name, upiIds]);

  useEffect(() => {
    if (!user) setSyncedFor(null);
  }, [user]);

  const value = useMemo(() => ({ ready, user }), [ready, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
