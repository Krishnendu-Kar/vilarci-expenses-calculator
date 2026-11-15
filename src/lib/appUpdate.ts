import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Application from 'expo-application';
import appConfig from '../../app.json';

// This app's version, and getting a newer one: Play's own in-app update
// (expo-in-app-updates), else the Play Store page. The native part is only
// in a store build, not in Expo Go or on the web, so it's loaded lazily, the
// same way as Google sign-in (api/google.ts).

type UpdatesModule = typeof import('expo-in-app-updates');

const PACKAGE = appConfig.expo.android.package;
/**
 * A Play Store (or dev) build of this app carries our package name. Expo Go
 * has its own, and its own version numbers, which would mean nothing here.
 */
const ownBuild = Platform.OS === 'android' && Application.applicationId === PACKAGE;

/**
 * The versionCode and name the server's numbers are compared with. Our own
 * Android build reads its own; Expo Go and the web use app.json's, so the
 * check can be tried there too. (No App Store build yet: an iPhone in Expo Go
 * counts as the Android version.)
 */
export function appVersion(): { code: number; name: string } | null {
  const code = Number(ownBuild ? Application.nativeBuildVersion : appConfig.expo.android.versionCode);
  const name = (ownBuild ? Application.nativeApplicationVersion : appConfig.expo.version) ?? '';
  return code > 0 ? { code, name } : null;
}

let loaded: UpdatesModule | null | undefined;

function updates(): UpdatesModule | null {
  if (loaded === undefined) {
    // Ask first whether the native part is in this build: loading the
    // library without it throws.
    const native = Platform.OS === 'android' && requireOptionalNativeModule('ExpoInAppUpdates') != null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = native ? (require('expo-in-app-updates') as UpdatesModule) : null;
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

/** The Play Store page of the app (the web page where there's no Play Store app). */
export async function openStorePage() {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`).catch(() => {});
  }
}

/**
 * Update now: Play's full-screen update when it has one for this phone,
 * else the Play Store page.
 */
export async function updateNow() {
  try {
    if (await updates()?.startUpdate(true)) return;
  } catch {
    // Fall through to the store page.
  }
  await openStorePage();
}

/**
 * Play's own "Update available" dialog (a flexible update: it downloads
 * while the app is used, then the app restarts on the new version). False
 * when Play has nothing for this phone, or this build can't ask.
 */
export async function offerPlayUpdate(): Promise<boolean> {
  const lib = updates();
  if (!lib) return false;
  try {
    const info = await lib.checkForUpdate();
    if (!info.updateAvailable || !info.flexibleAllowed) return false;
    return await lib.startUpdate(false);
  } catch {
    return false;
  }
}
