import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group, Person, Profile } from '../types';
import { SCHEMA_VERSION, sanitizeGroups, sanitizePeople } from './migrate';
import { sanitizePrefs, sanitizeVisits, type GroupPrefs, type Visits } from './groupFilters';
import { sanitizeBin, type BinItem } from './bin';

// v1 keeps everything on the device. A later version swaps this module for
// the database; the rest of the app only talks to these functions.
const KEY = 'vilarci-split:groups';
const LAST_BACKUP_KEY = 'vilarci-split:last-backup';
// The rest are kept apart from groups, so they never end up in backups or
// shared files: open counts, pins/archive, the People directory, your
// profile, who "me" is per group, and app settings.
const VISITS_KEY = 'vilarci-split:visits';
const PREFS_KEY = 'vilarci-split:group-prefs';
const PEOPLE_KEY = 'vilarci-split:people';
const PROFILE_KEY = 'vilarci-split:profile';
const ME_KEY = 'vilarci-split:me';
// Deleted groups, kept 30 days so they can be restored.
const BIN_KEY = 'vilarci-split:bin';
const SETTING_KEYS = { theme: 'vilarci-split:theme', language: 'vilarci-split:language' } as const;

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

/** The saved groups exactly as stored, for rescuing data when the app can't start. */
export async function loadRawGroups(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function saveGroups(groups: Group[]) {
  const data: Stored = { version: SCHEMA_VERSION, groups };
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

async function readJson(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

export async function loadBin(): Promise<BinItem[]> {
  return sanitizeBin(await readJson(BIN_KEY));
}

export async function saveBin(bin: BinItem[]) {
  await AsyncStorage.setItem(BIN_KEY, JSON.stringify(bin));
}

export async function loadVisits(): Promise<Visits> {
  return sanitizeVisits(await readJson(VISITS_KEY));
}

export async function saveVisits(visits: Visits) {
  await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(visits));
}

export async function loadPrefs(): Promise<GroupPrefs> {
  return sanitizePrefs(await readJson(PREFS_KEY));
}

export async function savePrefs(prefs: GroupPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function loadPeople(): Promise<Person[]> {
  return sanitizePeople(await readJson(PEOPLE_KEY));
}

export async function savePeople(people: Person[]) {
  await AsyncStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

export const EMPTY_PROFILE: Profile = { name: '', personId: null };

export async function loadProfile(): Promise<Profile> {
  const p = (await readJson(PROFILE_KEY)) as Partial<Profile> | null;
  return {
    name: typeof p?.name === 'string' ? p.name.slice(0, 30) : '',
    personId: typeof p?.personId === 'string' ? p.personId : null,
  };
}

export async function saveProfile(profile: Profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Group id → the member who is "me" in it. */
export type MeMap = Record<string, string>;

export async function loadMeMap(): Promise<MeMap> {
  const raw = await readJson(ME_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as MeMap;
}

export async function saveMeMap(map: MeMap) {
  await AsyncStorage.setItem(ME_KEY, JSON.stringify(map));
}

export async function loadSetting(key: keyof typeof SETTING_KEYS): Promise<string | null> {
  return AsyncStorage.getItem(SETTING_KEYS[key]);
}

export async function saveSetting(key: keyof typeof SETTING_KEYS, value: string) {
  await AsyncStorage.setItem(SETTING_KEYS[key], value);
}

export async function getLastBackup(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_BACKUP_KEY);
  return raw ? Number(raw) : null;
}

export async function setLastBackup(ts: number) {
  await AsyncStorage.setItem(LAST_BACKUP_KEY, String(ts));
}
