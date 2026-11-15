import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import appConfig from '../../app.json';
import { loadSetting, saveSetting } from './storage';
import { unregisterDevice } from './api/push';

// Notifications on this phone (notification.md). Pushes come from Firebase
// to our own Android build (google-services.json in the build); Expo Go and
// the web can't get them, so everything here quietly does nothing there.

const PACKAGE = appConfig.expo.android.package;
/** Our own Android build (the Play Store app or a dev build), where pushes can arrive. */
export const pushSupported = Platform.OS === 'android' && Application.applicationId === PACKAGE;

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** The three Android channels: people can turn each off or change its sound in the phone's settings. */
export const CHANNELS = ['activity', 'requests', 'news'] as const;
export type Channel = (typeof CHANNELS)[number];

export async function permission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function askPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  try {
    const p = await Notifications.requestPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Creates (or renames, after a language change) the channels. Android shows these names in its settings. */
export async function setupChannels(names: Record<Channel, string>) {
  if (!pushSupported) return;
  const common = {
    lightColor: '#9A0003',
    vibrationPattern: [0, 220, 140, 220],
    enableVibrate: true,
    sound: 'default',
  };
  await Promise.all([
    Notifications.setNotificationChannelAsync('activity', {
      ...common,
      name: names.activity,
      importance: Notifications.AndroidImportance.HIGH,
      // Names and amounts stay hidden on a locked screen.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync('requests', {
      ...common,
      name: names.requests,
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync('news', {
      ...common,
      name: names.news,
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ]).catch((e) => console.warn('Could not set up notification channels', e));
}

/** This phone's FCM token, or null (Expo Go, no Firebase in the build, offline on first use). */
export async function deviceToken(): Promise<string | null> {
  if (!pushSupported) return null;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === 'string' && t.data ? t.data : null;
  } catch {
    return null;
  }
}

/** What this phone last told the server. */
export interface PushReg {
  token: string;
  user: string;
  /** Everything sent, so a change (language, locked groups) registers again. */
  key: string;
  at: number;
}

export async function loadReg(): Promise<PushReg | null> {
  try {
    const raw = await loadSetting('pushReg');
    const r = raw ? JSON.parse(raw) : null;
    return r && typeof r.token === 'string' && typeof r.user === 'string' ? r : null;
  } catch {
    return null;
  }
}

export const saveReg = (r: PushReg | null) => saveSetting('pushReg', r ? JSON.stringify(r) : null).catch(() => {});

/**
 * Deletes this phone's FCM token. Firebase then refuses anything still on
 * its way to it (even what waited while the phone was off), and the server
 * drops the dead token. False when it couldn't (offline): try again later.
 */
async function dropToken(): Promise<boolean> {
  if (!pushSupported) return true;
  try {
    await Notifications.unregisterForNotificationsAsync();
    return true;
  } catch {
    return false;
  }
}

const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

/**
 * Before logging out (still signed in): this phone stops getting that
 * account's notifications. Three locks: the server forgets the phone, the
 * token itself is deleted, and (in PushContext) a push for an account that
 * isn't signed in is never shown. If the phone is offline, the token is
 * deleted the next time it's online (retryTokenDrop).
 */
export async function forgetThisPhone() {
  if (!pushSupported) return;
  const reg = await loadReg();
  if (reg) await within(unregisterDevice(reg.token), 4000).catch(() => {});
  await saveReg(null);
  if (!(await dropToken())) await saveSetting('pushDropToken', '1').catch(() => {});
}

/** A token drop that failed at log-out (offline): done now if possible. */
export async function retryTokenDrop() {
  if (!pushSupported) return;
  const pending = await loadSetting('pushDropToken').catch(() => null);
  if (pending && (await dropToken())) await saveSetting('pushDropToken', null).catch(() => {});
}

export { forThisAccount, pushTarget, type PushTarget } from './pushData';
