import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CategoryKey, SplitMode } from '../types';

// Unsaved "Add expense" forms, one per group, so leaving the page (or the
// app) doesn't lose what was typed. Never exported or shared.
const DRAFTS_KEY = 'vilarci-split:expense-drafts';
// Who "me"/"ami" is in each group, remembered for "Many at once".
const ME_KEY = 'vilarci-split:me';

export interface OneForm {
  title: string;
  amountText: string;
  category: CategoryKey;
  date: string;
  note: string;
  multiPay: boolean;
  payer: string;
  payerTexts: Record<string, string>;
  mode: SplitMode;
  selected: string[];
  values: Record<Exclude<SplitMode, 'equal'>, Record<string, string>>;
}

export interface ManyForm {
  text: string;
  date: string;
  category: CategoryKey;
  /** Typed name (lower-cased) → member id, or "new" to add them. */
  names: Record<string, string>;
  /** Per-row fixes, keyed by rowKey(). */
  rows: Record<string, { payer?: string; among?: string[] | null }>;
}

export interface ExpenseDraft {
  formMode: 'one' | 'many';
  one?: OneForm;
  many?: ManyForm;
  savedAt: number;
}

type Store = Record<string, ExpenseDraft>;

async function readAll(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadDraft(groupId: string): Promise<ExpenseDraft | null> {
  const d = (await readAll())[groupId];
  return d && (d.formMode === 'one' || d.formMode === 'many') ? d : null;
}

export async function saveDraft(groupId: string, draft: ExpenseDraft) {
  const all = await readAll();
  all[groupId] = draft;
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
}

export async function clearDraft(groupId: string) {
  const all = await readAll();
  if (!(groupId in all)) return;
  delete all[groupId];
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
}

export async function getMe(groupId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(ME_KEY);
    return (raw ? JSON.parse(raw) : {})[groupId] ?? null;
  } catch {
    return null;
  }
}

export async function setMe(groupId: string, memberId: string) {
  let all: Record<string, string> = {};
  try {
    all = JSON.parse((await AsyncStorage.getItem(ME_KEY)) ?? '{}');
  } catch {
    // start over
  }
  all[groupId] = memberId;
  await AsyncStorage.setItem(ME_KEY, JSON.stringify(all));
}
