import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group } from '../types';
import { SCHEMA_VERSION, sanitizeGroups } from './migrate';

// v1 keeps everything on the device. A later version swaps this module for
// the database; the rest of the app only talks to loadGroups/saveGroups.
const KEY = 'vilarci-split:groups';
const LAST_BACKUP_KEY = 'vilarci-split:last-backup';

interface Stored {
  version: number;
  groups: unknown;
}

/** Older saved data is upgraded here on load. */
export async function loadGroups(): Promise<Group[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Stored;
  return sanitizeGroups(parsed?.groups).groups;
}

export async function saveGroups(groups: Group[]) {
  const data: Stored = { version: SCHEMA_VERSION, groups };
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function getLastBackup(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_BACKUP_KEY);
  return raw ? Number(raw) : null;
}

export async function setLastBackup(ts: number) {
  await AsyncStorage.setItem(LAST_BACKUP_KEY, String(ts));
}
