import { buildBackup } from './backup';
import { backupDue, uploadBackup } from './drive';
import { driveAccess } from './api/google';
import { loadSetting, saveSetting, setLastBackup } from './storage';
import type { Group } from '../types';
import type { SavedName } from './people';

// Drive backup settings kept on the phone, and the automatic backup that
// runs when the app opens, if one is due (onlinedb.md §21: no background
// service needed).

export type AutoEvery = 0 | 1 | 7;

export interface LastBackup {
  at: number;
  size: number;
}

export async function readLastBackup(): Promise<LastBackup | null> {
  try {
    const v = JSON.parse((await loadSetting('driveLast')) ?? 'null');
    return v && typeof v.at === 'number' && typeof v.size === 'number' ? v : null;
  } catch {
    return null;
  }
}

export async function readAutoEvery(): Promise<AutoEvery> {
  const v = Number(await loadSetting('driveAuto').catch(() => null));
  return v === 1 || v === 7 ? v : 0;
}

export const saveAutoEvery = (every: AutoEvery) => saveSetting('driveAuto', String(every));

/**
 * Backs up now (asking Google when `interactive`). Null when no account could
 * be used. `contacts`: the names you saved for people with accounts.
 */
export async function backUpToDrive(groups: Group[], interactive: boolean, contacts: SavedName[] = []): Promise<LastBackup | null> {
  const access = await driveAccess(interactive);
  if (!access) return null;
  const size = await uploadBackup(access.token, buildBackup(groups, contacts));
  const last = { at: Date.now(), size };
  await saveSetting('driveLast', JSON.stringify(last));
  // Counts as a backup for Home's "not backed up" reminder too.
  await setLastBackup(last.at);
  return last;
}

let running = false;

/** On opening the app: back up quietly if auto backup is on and one is due. */
export async function autoBackupIfDue(groups: Group[], contacts: SavedName[] = []) {
  if (running) return;
  running = true;
  try {
    const [every, last] = await Promise.all([readAutoEvery(), readLastBackup()]);
    if (!backupDue(last?.at ?? null, every, Date.now())) return;
    await backUpToDrive(groups, false, contacts);
  } catch (e) {
    console.warn('Auto backup failed', e);
  } finally {
    running = false;
  }
}
