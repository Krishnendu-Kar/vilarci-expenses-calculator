import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group } from '../types';

// v1 keeps everything on the device. v2 swaps this module for the database;
// the rest of the app only talks to loadGroups/saveGroups.
const KEY = 'vilarci-split:groups';
const SCHEMA_VERSION = 1;

interface Stored {
  version: number;
  groups: Group[];
}

export async function loadGroups(): Promise<Group[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Stored;
  return Array.isArray(parsed?.groups) ? parsed.groups : [];
}

export async function saveGroups(groups: Group[]) {
  const data: Stored = { version: SCHEMA_VERSION, groups };
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
