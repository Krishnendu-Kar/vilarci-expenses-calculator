import type { Group, Role } from '../../types';
import type { Refusal, Store } from '../db/store';
import type { Change, SyncResponse } from './wire';

// One sync (onlinedb.md §9.2–9.3): upload what waits in the outbox and fetch
// what changed after each bookmark, in one call, as many rounds as it takes
// (more pages, more uploads). The store saves each answer; the caller puts
// the changed groups on screen with `rebase`.

export interface SyncApi {
  sync(changes: Change[], cursors: Record<string, number>, max?: number): Promise<SyncResponse>;
}

export interface SyncOutcome {
  /** Changed groups: as saved before the sync, and after. */
  touched: Map<string, { base: Group; next: Group }>;
  /** Changes the server didn't take; their items are back to the server's version. */
  refused: Refusal[];
  /** Live groups you're in that this phone doesn't have yet. */
  unknown: { id: string; role: Role }[];
}

/** Enough for a 3000-row download in pages of 500, and a full outbox. */
const MAX_ROUNDS = 10;

export async function syncNow(
  store: Pick<Store, 'pendingSync' | 'finishSync'>,
  api: SyncApi,
  opts: { now?: () => number; max?: number } = {},
): Promise<SyncOutcome> {
  const now = opts.now ?? Date.now;
  const touched: SyncOutcome['touched'] = new Map();
  const refused: Refusal[] = [];
  let unknown: SyncOutcome['unknown'] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { lines, changes, cursors } = await store.pendingSync();
    const sentAt = now();
    const res = await api.sync(changes, cursors, opts.max);
    // The server's clock, against the middle of the round trip.
    const offset = res.server_now - Math.round((sentAt + now()) / 2);
    const step = await store.finishSync(lines, res, offset);
    for (const [id, t] of step.touched) touched.set(id, { base: touched.get(id)?.base ?? t.base, next: t.next });
    refused.push(...step.refused);
    unknown = step.unknown;
    if (!step.again) break;
  }
  return { touched, refused, unknown };
}
