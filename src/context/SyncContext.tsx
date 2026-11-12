import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useGroups } from './GroupsContext';
import { useAuth } from './AuthContext';
import { useUndo } from './UndoContext';
import { finishSync, loadSetting, outboxCounts, pendingSync, saveSetting } from '../lib/storage';
import { syncNow } from '../lib/sync/engine';
import { putOnlineData } from '../lib/sync/wire';
import { putGroupOnline, syncApi } from '../lib/api/sync';
import { listenForPokes, MAX_CHANNELS } from '../lib/api/poke';
import type { SyncApi } from '../lib/sync/engine';
import { forgetUpiCache } from '../lib/upiCache';
import { DEFAULT_SETTINGS } from '../lib/permissions';
import { resolveMe } from '../lib/people';
import { noAnswer } from '../lib/accountRules';
import { parseOnlineQueue } from '../lib/groupDraft';
import { translate } from '../i18n';
import type { Group } from '../types';

// Live groups on this phone (onlinedb.md §9.6). Signed in, it syncs when the
// app opens or comes back, two seconds after a change that
// waits in the outbox, and again after a failure (2 s, 5 s, 15 s, 1 min, then
// every 5 min). While the app is on screen it also listens for the server's
// poke (§9.7) and syncs when a live group has something newer. No timers
// otherwise: an idle app makes no requests.

export type SyncState = 'idle' | 'syncing' | 'failed';

/** queued: no internet; it goes online by itself once there is. */
export type PutOnlineResult = 'online' | 'exists' | 'pickMe' | 'signIn' | 'queued';

interface SyncValue {
  state: SyncState;
  /** When the last sync finished, or null. */
  lastSynced: number | null;
  /** Changes waiting to go up, per group. */
  waiting: Record<string, number>;
  /** Sync now (pull-to-refresh, a retry button). */
  syncNow: () => Promise<void>;
  /**
   * Puts a local group online (§8). `meId`: who you are in it, when the app
   * can't tell (it says `pickMe`). With no internet it waits in a queue
   * (`queued`) and goes up by itself later. Throws when the server refuses.
   */
  putOnline: (groupId: string, meId?: string) => Promise<PutOnlineResult>;
  /** Local groups waiting for internet to go online. */
  queued: ReadonlySet<string>;
}

const SyncContext = createContext<SyncValue | null>(null);

const RETRY_MS = [2_000, 5_000, 15_000, 60_000, 300_000];
const AFTER_CHANGE_MS = 2_000;
/** Pokes close together (several people adding at once) make one sync. */
const POKE_MS = 400;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const {
    groups,
    ready,
    profile,
    meMap,
    setMe,
    applySync,
    adoptAccount,
    markOnline,
    dropGroups,
    peekGroups,
    addLiveGroups,
    giveNewId,
  } = useGroups();
  const { showNote } = useUndo();
  const [state, setState] = useState<SyncState>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [waiting, setWaiting] = useState<Record<string, number>>({});

  // Put online with no internet: the group waits here (saved, so it survives
  // a restart) and goes up on the next sync that gets through.
  const [queue, setQueue] = useState<string[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueLoaded = useRef(false);
  const setQueued = useCallback((fn: (q: string[]) => string[]) => {
    const next = fn(queueRef.current);
    if (next === queueRef.current) return;
    queueRef.current = next;
    setQueue(next);
    if (queueLoaded.current) void saveSetting('onlineQueue', next.length ? JSON.stringify(next) : null).catch(() => {});
  }, []);
  const enqueue = useCallback((id: string) => setQueued((q) => (q.includes(id) ? q : [...q, id])), [setQueued]);
  const dequeue = useCallback((id: string) => setQueued((q) => (q.includes(id) ? q.filter((x) => x !== id) : q)), [setQueued]);
  useEffect(() => {
    loadSetting('onlineQueue')
      .then((raw) => {
        const saved = parseOnlineQueue(raw);
        queueLoaded.current = true;
        setQueued((q) => [...new Set([...saved, ...q])]);
      })
      .catch(() => {
        queueLoaded.current = true;
      });
  }, [setQueued]);
  // Set below; the queue is worked through at the start of every sync.
  const putOnlineRef = useRef<(groupId: string) => Promise<PutOnlineResult>>(async () => 'signIn');

  const running = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Signed in, even with no live group here yet: on a new phone the first
  // sync (about 200 bytes) is what tells it which groups you're in.
  const canSync = ready && !!user;
  const canSyncRef = useRef(canSync);
  canSyncRef.current = canSync;
  // The newest change number the server has told us of, per group: a poke
  // for one of our own changes (or one already pulled) doesn't sync again.
  const serverSeq = useRef(new Map<string, number>());
  const api = useMemo<SyncApi>(
    () => ({
      async sync(changes, cursors, max) {
        const res = await syncApi.sync(changes, cursors, max);
        for (const m of res.groups ?? []) if (m.last_seq != null) serverSeq.current.set(m.id, m.last_seq);
        return res;
      },
    }),
    [],
  );

  // Groups waiting for internet go up first. Still no answer: this throws, and
  // the sync's own retry (2 s … 5 min) tries again.
  const putQueued = useCallback(async () => {
    for (const id of [...queueRef.current]) {
      const g = peekGroups().find((x) => x.id === id);
      if (!g || g.online) {
        dequeue(id);
        continue;
      }
      try {
        let res = await putOnlineRef.current(id);
        if (res === 'queued') throw new Error('Still offline');
        if (res === 'exists') {
          // A copy of it is online already (a shared group file): this one goes up as its own group.
          dequeue(id);
          const moved = giveNewId(id);
          res = moved ? await putOnlineRef.current(moved.id) : 'online';
          if (res === 'queued') throw new Error('Still offline');
        }
        dequeue(id);
        if (res === 'online') showNote(translate('online.done', { name: g.name }));
      } catch (e) {
        if (e instanceof Error && e.message === 'Still offline') throw e;
        // The server said no: it stays on the phone, and Put online can try again.
        dequeue(id);
        showNote(translate('online.failedQueued', { name: g.name }));
      }
    }
  }, [peekGroups, dequeue, giveNewId, showNote]);

  const run = useCallback(async () => {
    if (!canSyncRef.current) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setState('syncing');
    try {
      do {
        again.current = false;
        await putQueued();
        const out = await syncNow({ pendingSync, finishSync }, api);
        applySync(out.touched);
        if (out.refused.length) showNote(translate('sync.refused', { count: out.refused.length }));
        // Signed in on a new phone (or added elsewhere): your live groups come down whole.
        if (out.unknown.length) {
          const now = Date.now();
          await addLiveGroups(
            out.unknown.map(
              ({ id, role }): Group => ({
                id,
                name: '',
                kind: 'other',
                members: [],
                expenses: [],
                payments: [],
                createdAt: now,
                updatedAt: now,
                online: { role, status: 'active', settings: DEFAULT_SETTINGS },
              }),
            ),
          );
          again.current = true;
        }
      } while (again.current);
      failures.current = 0;
      setState('idle');
      setLastSynced(Date.now());
    } catch (e) {
      console.warn('Sync failed', e);
      setState('failed');
      const wait = RETRY_MS[Math.min(failures.current, RETRY_MS.length - 1)];
      failures.current += 1;
      retryTimer.current = setTimeout(() => void run(), wait);
    } finally {
      running.current = false;
      outboxCounts()
        .then(setWaiting)
        .catch(() => {});
    }
  }, [api, applySync, showNote, addLiveGroups, putQueued]);

  // Opening the app (or signing in, or the first live group), and coming back to it.
  useEffect(() => {
    if (!canSync) return;
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => sub.remove();
  }, [canSync, run]);

  // A change here: two seconds later, if anything waits in the outbox, it goes
  // up. (What came down from a sync waits for nothing, so it never loops.)
  useEffect(() => {
    if (!canSync) return;
    const timer = setTimeout(() => {
      outboxCounts()
        .then((counts) => {
          setWaiting(counts);
          if (Object.values(counts).some((n) => n > 0)) void run();
        })
        .catch(() => {});
    }, AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [groups, canSync, run]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  // While on screen: listen on each live group you're in, busiest first.
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const liveIds = useMemo(
    () =>
      groups
        .filter((g) => g.online?.status === 'active' && g.online.deletedAt == null)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHANNELS)
        .map((g) => g.id)
        // In a fixed order, so a group moving up the list doesn't reconnect them all.
        .sort()
        .join(','),
    [groups],
  );
  useEffect(() => {
    if (!canSync || !active || !liveIds) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = listenForPokes(liveIds.split(','), (groupId, seq) => {
      if (seq <= (serverSeq.current.get(groupId) ?? 0)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), POKE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [canSync, active, liveIds, run]);

  // Signed in: the person who is you takes your account id (§11.4).
  useEffect(() => {
    if (ready && user && profile.personId && profile.personId !== user.id) adoptAccount(user.id, profile.personId);
  }, [ready, user, profile.personId, adoptAccount]);

  // In a live group your account's member is you, whatever its name there
  // (a group put online as "Neha" is still yours).
  useEffect(() => {
    if (!ready || !user) return;
    for (const g of groups) {
      if (g.online && meMap[g.id] !== user.id && g.members.some((m) => m.id === user.id && !m.gone)) setMe(g.id, user.id);
    }
  }, [ready, user, groups, meMap, setMe]);

  // Logged out: live groups leave this phone (decision 8). They're safe on the
  // server and come back on the next sign-in.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!authReady || !ready) return;
    if (user) wasSignedIn.current = true;
    else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      dropGroups(groups.filter((g) => g.online).map((g) => g.id));
      forgetUpiCache();
      // Waiting groups stay local: another account mustn't put them online.
      setQueued(() => []);
    }
  }, [authReady, ready, user, groups, dropGroups, setQueued]);

  const putOnline = useCallback(
    async (groupId: string, meId?: string): Promise<PutOnlineResult> => {
      if (!user) return 'signIn';
      const local = peekGroups().find((g) => g.id === groupId);
      if (!local || local.online) return 'online';
      const me = meId ?? resolveMe(local, profile, meMap[groupId]);
      if (!me) return 'pickMe';
      // You're in it with your account id before it goes up.
      const group = adoptAccount(user.id, me).find((g) => g.id === groupId);
      if (!group?.members.some((m) => m.id === user.id)) return 'pickMe';
      let res: Awaited<ReturnType<typeof putGroupOnline>>;
      try {
        res = await putGroupOnline(putOnlineData(group));
      } catch (e) {
        if (!noAnswer(e)) throw e;
        enqueue(groupId);
        // The sync's retries (2 s … 5 min) bring it up once there's internet.
        void run();
        return 'queued';
      }
      if (res.status === 'exists') return 'exists';
      const liveGroup: Group = {
        ...group,
        online: { role: 'creator', status: 'active', settings: DEFAULT_SETTINGS },
        members: group.members.map((m) =>
          m.id === user.id ? { ...m, role: 'creator', account: true } : { ...m, role: 'member' },
        ),
      };
      // One change back: its "put online" Activity line comes down with the first sync.
      await markOnline(group, liveGroup, Math.max(0, res.cursor - 1));
      dequeue(groupId);
      return 'online';
    },
    [user, profile, meMap, adoptAccount, markOnline, peekGroups, enqueue, dequeue, run],
  );
  putOnlineRef.current = putOnline;
  const queued = useMemo(() => new Set(queue), [queue]);

  const value = useMemo(
    () => ({ state, lastSynced, waiting, syncNow: run, putOnline, queued }),
    [state, lastSynced, waiting, run, putOnline, queued],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
