import type { UpiId } from '../types';

// UPI ids ("VPA"): name@bank, like krish@okaxis. You can keep up to 3, on
// this phone for now; they show in reports and in Settle so people know
// where to pay you.

export const MAX_UPI = 3;
const LABEL_MAX = 20;

// NPCI's shape: a handle (letters, digits, . _ -), "@", then the bank's handle.
const VPA_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9.-]{1,63}$/i;

/** As typed, minus spaces (people paste "krish @okaxis"). */
export const cleanVpa = (s: string) => s.replace(/\s+/g, '');

export const isVpa = (s: string) => VPA_RE.test(cleanVpa(s));

/** The same id, whatever the letter case. */
export const sameVpa = (a: string, b: string) => cleanVpa(a).toLowerCase() === cleanVpa(b).toLowerCase();

/** Valid, unique ids from anything stored; at most MAX_UPI. */
export function sanitizeUpiIds(raw: unknown): UpiId[] {
  if (!Array.isArray(raw)) return [];
  const out: UpiId[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object' || typeof (r as UpiId).vpa !== 'string') continue;
    const vpa = cleanVpa((r as UpiId).vpa);
    if (!isVpa(vpa) || out.some((u) => sameVpa(u.vpa, vpa))) continue;
    const label = typeof (r as UpiId).label === 'string' ? (r as UpiId).label!.trim().slice(0, LABEL_MAX) : '';
    out.push(label ? { vpa, label } : { vpa });
    if (out.length === MAX_UPI) break;
  }
  return out;
}

/** "krish@okaxis, krish@ybl" for reports. */
export const vpaList = (ids: UpiId[]) => ids.map((u) => u.vpa).join(', ');
