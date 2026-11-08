import type { CategoryKey, SplitMode } from '../types';
import * as storage from './storage';

// Unsaved "Add expense" forms, one per group, so leaving the page (or the
// app) doesn't lose what was typed. Never exported or shared.

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
  /** Hostel/flat groups: "Repeat every month" was switched on. */
  repeat?: boolean;
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

export async function loadDraft(groupId: string): Promise<ExpenseDraft | null> {
  try {
    const d = (await storage.loadDraft(groupId)) as ExpenseDraft | null;
    return d && (d.formMode === 'one' || d.formMode === 'many') ? d : null;
  } catch {
    return null;
  }
}

export async function saveDraft(groupId: string, draft: ExpenseDraft) {
  await storage.saveDraft(groupId, draft);
}

export async function clearDraft(groupId: string) {
  await storage.clearDraft(groupId);
}
