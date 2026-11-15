import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { useGroups } from './GroupsContext';
import { useSync } from './SyncContext';
import { useI18n } from '../i18n/I18nContext';
import { loadSetting, saveSetting } from '../lib/storage';
import { isLocked } from '../lib/groupFilters';
import { appVersion } from '../lib/appUpdate';
import {
  askPermission,
  deviceToken,
  forThisAccount,
  loadReg,
  permission as readPermission,
  pushSupported,
  pushTarget,
  retryTokenDrop,
  saveReg,
  setupChannels,
  type PushPermission,
  type PushTarget,
} from '../lib/push';
import { DEFAULT_PREFS, fetchPrefs, muteGroup, parsePrefs, registerDevice, savePrefs, type PushKind, type PushPrefs } from '../lib/api/push';
import { navigationRef } from '../navigation/navigationRef';
import { useNews } from './NewsContext';

// Push notifications in the app (notification.md):
// - registers this phone for the signed-in account (again on a language or
//   lock change, and once a day so the server knows it's still in use);
// - asks for the permission once, when you first have a live group;
// - never shows a push meant for another account (a phone that logged out);
// - a tap opens the group (or its join requests); a push while the app is
//   open syncs at once;
// - your switches and muted groups, kept on the phone for offline.

const DAY = 24 * 60 * 60 * 1000;

interface PushValue {
  supported: boolean;
  permission: PushPermission;
  prefs: PushPrefs;
  /** Ask for the permission (Settings → Notifications), or open the phone's settings once it was refused. */
  turnOn: () => Promise<void>;
  setKind: (kind: PushKind, on: boolean) => Promise<void>;
  isMuted: (groupId: string) => boolean;
  setMuted: (groupId: string, muted: boolean) => Promise<void>;
  /** Re-read the permission and switches (Settings opens, the app comes back). */
  refresh: () => void;
}

const PushContext = createContext<PushValue>({
  supported: false,
  permission: 'unsupported',
  prefs: DEFAULT_PREFS,
  turnOn: async () => {},
  setKind: async () => {},
  isMuted: () => false,
  setMuted: async () => {},
  refresh: () => {},
});

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { groups, prefs: groupPrefs, peekGroups } = useGroups();
  const { syncNow } = useSync();
  // Stable: re-reads news from us when a news push comes in or is tapped.
  const { refresh: refreshNews } = useNews();
  const { lang, t } = useI18n();
  const [perm, setPerm] = useState<PushPermission>(pushSupported ? 'undetermined' : 'unsupported');
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [token, setToken] = useState<string | null>(null);
  // Bumped when the app comes back or the phone is online again.
  const [tick, setTick] = useState(0);
  const userRef = useRef(user?.id ?? null);
  userRef.current = user?.id ?? null;

  const hasLive = groups.some((g) => g.online);
  // Live groups locked on this phone: their pushes say nothing about names or money.
  const hidden = useMemo(
    () => groups.filter((g) => g.online && isLocked(groupPrefs[g.id])).map((g) => g.id).sort(),
    [groups, groupPrefs],
  );
  const hiddenKey = hidden.join(',');

  // Shown while the app is open only if it's for the signed-in account.
  // Everything below that touches expo-notifications runs only in our own
  // build: Expo Go on Android has no remote push since SDK 53 and throws.
  useEffect(() => {
    if (!pushSupported) return;
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const show = forThisAccount(pushTarget(n.request.content.data), userRef.current);
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      },
    });
  }, []);

  // Channel names follow the app's language.
  useEffect(() => {
    void setupChannels({ activity: t('push.channelActivity'), requests: t('push.channelRequests'), news: t('push.channelNews') });
  }, [lang, t]);

  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => s === 'active' && setTick((n) => n + 1));
    const net = NetInfo.addEventListener((s) => s.isConnected && setTick((n) => n + 1));
    let tok: { remove: () => void } | null = null;
    if (pushSupported) {
      try {
        tok = Notifications.addPushTokenListener((tk) => typeof tk.data === 'string' && setToken(tk.data));
      } catch (e) {
        console.warn('Push token listener unavailable', e);
      }
    }
    return () => {
      app.remove();
      net();
      tok?.remove();
    };
  }, []);

  // The permission, on start and whenever the app comes back (it may have changed in the phone's settings).
  useEffect(() => {
    void readPermission().then(setPerm);
  }, [tick]);

  // A token that couldn't be deleted at log-out (offline) goes now.
  useEffect(() => {
    void retryTokenDrop();
  }, [tick]);

  // Ask once: signed in, with a live group, never asked before.
  useEffect(() => {
    if (!pushSupported || !user || !hasLive || perm !== 'undetermined') return;
    let alive = true;
    const timer = setTimeout(async () => {
      if ((await loadSetting('pushAsked').catch(() => null)) || !alive) return;
      await saveSetting('pushAsked', String(Date.now())).catch(() => {});
      const p = await askPermission();
      if (alive) setPerm(p);
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [user, hasLive, perm]);

  // Register (or refresh) this phone for the signed-in account.
  useEffect(() => {
    if (!pushSupported || !user || perm !== 'granted') return;
    let alive = true;
    (async () => {
      await retryTokenDrop();
      const tk = token ?? (await deviceToken());
      if (!tk || !alive) return;
      const code = appVersion()?.code ?? 0;
      const key = JSON.stringify([tk, user.id, lang, code, hiddenKey]);
      const last = await loadReg();
      if (last && last.key === key && Date.now() - last.at < DAY) return;
      await registerDevice({ token: tk, platform: 'android', locale: lang, appCode: code, hidden });
      await saveReg({ token: tk, user: user.id, key, at: Date.now() });
      // Registered for this account now, so an old log-out's token drop must not undo it.
      await saveSetting('pushDropToken', null).catch(() => {});
    })().catch((e) => console.warn('Could not register for notifications', e));
    return () => {
      alive = false;
    };
    // hidden is covered by hiddenKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, perm, token, lang, hiddenKey, tick]);

  // Your switches: the saved copy first, then the server's.
  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULT_PREFS);
      return;
    }
    let alive = true;
    loadSetting('pushPrefs')
      .then((raw) => alive && raw && setPrefs(parsePrefs(JSON.parse(raw))))
      .catch(() => {});
    fetchPrefs()
      .then((p) => {
        if (!alive) return;
        setPrefs(p);
        void saveSetting('pushPrefs', JSON.stringify(p)).catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, tick]);

  // A tapped notification: open what it's about (only for the signed-in account).
  const open = useCallback(
    async (target: PushTarget | null) => {
      if (!target || !forThisAccount(target, userRef.current)) return;
      for (let i = 0; i < 20 && !navigationRef.isReady(); i++) await new Promise((r) => setTimeout(r, 150));
      if (!navigationRef.isReady()) return;
      // News from us opens the News page (the bell on Home).
      if (target.kind === 'news') {
        void refreshNews(true);
        navigationRef.navigate('News');
        return;
      }
      const gid = target.groupId;
      if (!gid) return;
      if (!peekGroups().some((g) => g.id === gid)) await syncNow().catch(() => {});
      if (!peekGroups().some((g) => g.id === gid)) return;
      if (target.kind === 'join_request') navigationRef.navigate('Invite', { groupId: gid });
      else navigationRef.navigate('GroupDetail', { groupId: gid });
    },
    [peekGroups, syncNow, refreshNews],
  );

  useEffect(() => {
    if (!pushSupported) return;
    const subs: { remove: () => void }[] = [];
    try {
      const first = Notifications.getLastNotificationResponse();
      if (first) {
        void open(pushTarget(first.notification.request.content.data));
        Notifications.clearLastNotificationResponse();
      }
      subs.push(
        Notifications.addNotificationResponseReceivedListener((r) => {
          void open(pushTarget(r.notification.request.content.data));
          Notifications.clearLastNotificationResponse();
        }),
      );
      // Something changed in a group while the app is open: fetch it now.
      subs.push(
        Notifications.addNotificationReceivedListener((n) => {
          const target = pushTarget(n.request.content.data);
          if (target?.kind === 'news') void refreshNews(true);
          else if (target?.groupId) void syncNow().catch(() => {});
        }),
      );
    } catch (e) {
      console.warn('Notification listeners unavailable', e);
    }
    return () => subs.forEach((x) => x.remove());
  }, [open, syncNow, refreshNews]);

  const keep = useCallback((p: PushPrefs) => {
    setPrefs(p);
    void saveSetting('pushPrefs', JSON.stringify(p)).catch(() => {});
  }, []);

  const turnOn = useCallback(async () => {
    const now = await readPermission();
    if (now === 'denied') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    if (now === 'undetermined') setPerm(await askPermission());
    else setPerm(now);
  }, []);

  const setKind = useCallback(
    async (kind: PushKind, on: boolean) => {
      const before = prefs;
      keep({ ...prefs, [kind]: on });
      try {
        keep(await savePrefs({ [kind]: on }));
      } catch (e) {
        keep(before);
        throw e;
      }
    },
    [prefs, keep],
  );

  const setMuted = useCallback(
    async (groupId: string, muted: boolean) => {
      const before = prefs;
      const list = prefs.mutedGroups.filter((g) => g !== groupId);
      keep({ ...prefs, mutedGroups: muted ? [...list, groupId] : list });
      try {
        keep(await muteGroup(groupId, muted));
      } catch (e) {
        keep(before);
        throw e;
      }
    },
    [prefs, keep],
  );

  const value = useMemo<PushValue>(
    () => ({
      supported: pushSupported,
      permission: perm,
      prefs,
      turnOn,
      setKind,
      isMuted: (gid) => prefs.mutedGroups.includes(gid),
      setMuted,
      refresh: () => setTick((n) => n + 1),
    }),
    [perm, prefs, turnOn, setKind, setMuted],
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export const usePush = () => useContext(PushContext);
