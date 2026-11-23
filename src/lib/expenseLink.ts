import { INVITE_HOST } from './invite';
import type { Group } from '../types';

// A shared expense of a live group: https://esplit.vilarci.in/e/<group>/<expense>
// (also vesplit://e/<group>/<expense>). Both ids are the server's UUIDs, each
// written as 22 URL-safe characters (the same 16 bytes), so the link stays
// short in a chat. The link carries nothing else: only someone in the group
// can open it, from their own copy of the group.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKED = /^[A-Za-z0-9_-]{22}$/;

/** A UUID as 22 base64url characters, or null when it isn't a UUID. */
export function packId(uuid: string): string | null {
  if (!UUID.test(uuid)) return null;
  const hex = uuid.replace(/-/g, '').toLowerCase();
  const bytes = Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  let out = '';
  for (let i = 0; i < 16; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < 16) out += B64[(n >> 6) & 63];
    if (i + 2 < 16) out += B64[n & 63];
  }
  return out;
}

/** Back to the UUID (lower case), or null for anything packId couldn't have made. */
export function unpackId(packed: string): string | null {
  if (!PACKED.test(packed)) return null;
  const v = [...packed].map((c) => B64.indexOf(c));
  // The last character holds only 2 bits: the rest must be 0, so every id has one spelling.
  if (v[21] & 15) return null;
  const bytes: number[] = [];
  for (let i = 0; i < 22; i += 4) {
    const n = (v[i] << 18) | (v[i + 1] << 12) | ((v[i + 2] ?? 0) << 6) | (v[i + 3] ?? 0);
    bytes.push((n >> 16) & 255);
    if (i + 2 < 22) bytes.push((n >> 8) & 255);
    if (i + 3 < 22) bytes.push(n & 255);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The link to an expense, or null when the ids aren't UUIDs (a group that was never online). */
export function expenseLink(groupId: string, expenseId: string): string | null {
  const g = packId(groupId);
  const e = packId(expenseId);
  return g && e ? `https://${INVITE_HOST}/e/${g}/${e}` : null;
}

/**
 * The link to put in a shared expense: live groups only, while the group is
 * still on the server (not gone or deleted for everyone). A group on this
 * phone only has nobody else to open it, so its message goes without one.
 */
export function shareLink(group: Pick<Group, 'id' | 'online'>, expenseId: string): string | null {
  const o = group.online;
  if (!o || o.status === 'gone' || o.deletedAt != null) return null;
  return expenseLink(group.id, expenseId);
}

export interface ExpenseTarget {
  groupId: string;
  expenseId: string;
}

/**
 * A link that opened the app, as the path the navigator hands over
 * ("e/<group>/<expense>", from the website's address or vesplit://):
 * the two ids, 'broken' for an expense link that can't be read, or null when
 * it isn't an expense link at all.
 */
export function expensePath(path: string): ExpenseTarget | 'broken' | null {
  const rest = path.trim().replace(/^\/+/, '').replace(/[?#].*$/, '');
  if (!/^e(?:\/|$)/i.test(rest)) return null;
  const m = rest.match(/^e\/([^/]+)\/([^/]+)\/?$/i);
  const groupId = m ? unpackId(m[1]) : null;
  const expenseId = m ? unpackId(m[2]) : null;
  return groupId && expenseId ? { groupId, expenseId } : 'broken';
}
