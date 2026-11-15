import { Platform } from 'react-native';
import { getInstallReferrerAsync } from 'expo-application';
import { loadSetting, saveSetting } from './storage';
import { referrerCode } from './invite';

// Play can be slow to answer; Home doesn't wait longer than this for it.
const WAIT_MS = 3000;

/**
 * The invite code of the link this app was installed from (the website's
 * "Get it on Google Play" with `referrer=join=<code>`), asked once per
 * install: Play keeps the referrer for months, so asking again would reopen
 * Join on a later start. Android only; null on any trouble.
 */
export async function installInviteCode(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    if (await loadSetting('installChecked')) return null;
    await saveSetting('installChecked', String(Date.now()));
    const referrer = await Promise.race([
      getInstallReferrerAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS)),
    ]);
    return referrer ? referrerCode(referrer) : null;
  } catch {
    return null;
  }
}
