import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

// The phone's own fingerprint, face or screen lock (PIN, pattern, password)
// guards locked groups. The app stores no PIN of its own; the phone checks.

export type LockSupport = 'ok' | 'unsupported' | 'noScreenLock';

/** Whether a group can be locked on this device. */
export async function lockSupport(): Promise<LockSupport> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE ? 'noScreenLock' : 'ok';
  } catch {
    return 'unsupported';
  }
}

/**
 * Asks for the fingerprint, face or screen lock. True when it said yes.
 * A phone whose screen lock has since been removed lets its owner in:
 * only they could remove it, and the group must not stay shut for good.
 */
export async function askOwner(promptMessage: string, cancelLabel: string): Promise<boolean> {
  const support = await lockSupport();
  if (support !== 'ok') return true;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
