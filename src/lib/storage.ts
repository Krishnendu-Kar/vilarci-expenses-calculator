import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import { newId } from './id';
import { SCHEMA_VERSION } from './migrate';
import { createStore, LEGACY_KEYS, type Db, type LegacyData } from './db/store';

// Everything is saved in SQLite on the device (lib/db). Versions before 1.2
// used AsyncStorage: that data is copied over, with new UUIDs, the first
// time this version starts, and left where it was as a spare copy.
// A later version swaps this module for the server; the rest of the app
// only talks to these functions.

async function open(): Promise<Db> {
  const db = await openDatabaseAsync('vilarci-split.db');
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params) => {
      await db.runAsync(sql, params);
    },
    all: (sql, params = []) => db.getAllAsync(sql, params),
    transaction: (fn) => db.withTransactionAsync(fn),
  };
}

async function readLegacy(): Promise<LegacyData> {
  const entries = Object.entries(LEGACY_KEYS) as [keyof typeof LEGACY_KEYS, string][];
  const values = await AsyncStorage.multiGet(entries.map(([, key]) => key));
  return Object.fromEntries(entries.map(([name], i) => [name, values[i][1]]));
}

const store = createStore(open, readLegacy, newId);

export const {
  loadAll,
  saveGroups,
  savePeople,
  savePrefs,
  saveVisits,
  saveProfile,
  saveUpiIds,
  saveMeMap,
  loadSetting,
  saveSetting,
  getLastBackup,
  setLastBackup,
  loadDraft,
  saveDraft,
  clearDraft,
  adoptIds,
  pendingSync,
  finishSync,
  adoptRemote,
  outboxCounts,
  loadEvents,
} = store;
export { EMPTY_PROFILE, type MeMap } from './db/store';

/**
 * The saved groups as a backup-shaped JSON string, for rescuing data when
 * the app can't start. If the database can't be read, the copy from before
 * 1.2 is the next best thing.
 */
export async function loadRawGroups(): Promise<string | null> {
  try {
    const groups = await store.dumpGroups();
    return groups.length ? JSON.stringify({ version: SCHEMA_VERSION, groups }) : null;
  } catch {
    return AsyncStorage.getItem(LEGACY_KEYS.groups);
  }
}
