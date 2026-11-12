import { loadSetting, saveSetting } from './storage';
import { sanitizeUpiIds } from './upi';
import type { UpiId } from '../types';

// Co-members' UPI ids from their accounts, kept on this phone so Settle
// still shows them offline ({ userId: UpiId[] }).

export type UpiCache = Record<string, UpiId[]>;

let memory: UpiCache | null = null;

export async function readUpiCache(): Promise<UpiCache> {
  if (memory) return memory;
  try {
    const raw = JSON.parse((await loadSetting('upiCache')) ?? '{}');
    const out: UpiCache = {};
    if (raw && typeof raw === 'object') for (const [id, v] of Object.entries(raw)) out[id] = sanitizeUpiIds(v);
    memory = out;
  } catch {
    memory = {};
  }
  return memory;
}

export async function addToUpiCache(fresh: UpiCache): Promise<UpiCache> {
  const next = { ...(await readUpiCache()), ...fresh };
  memory = next;
  await saveSetting('upiCache', JSON.stringify(next));
  return next;
}

/** Logging out: other people's UPI ids leave the phone with the live groups. */
export function forgetUpiCache() {
  memory = {};
  void saveSetting('upiCache', '{}').catch(() => {});
}
