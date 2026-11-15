// Outdated versions (supabase/migrations/20261115100000_app_release.sql):
// the server says which versionCodes are too old and from which day, and
// which is the newest. This file only decides; UpdateGate shows it.

/** The server's answer, as kept on the phone for offline starts. */
export interface Release {
  /** versionCodes below this are outdated. 0: none are. */
  minCode: number;
  /** The version name of minCode ("3.5.0"). */
  minName: string | null;
  /** The day outdated versions stop working ("2026-11-20"), and that midnight in India as ms. */
  minFrom: string | null;
  minFromAt: number | null;
  /** Below this, Play's own update dialog is offered. */
  latestCode: number;
  /** The server's clock when this was read, and how far ahead of this phone it was. */
  serverAt: number;
  offset: number;
}

export type ReleaseState =
  | { kind: 'ok' }
  /** A newer version is out: Play's dialog, now and then. */
  | { kind: 'update' }
  /** Outdated, still usable until `minFrom`: a warning once a day. */
  | { kind: 'warn'; minName: string; minFrom: string }
  /** Outdated and past the day: the Update needed screen. */
  | { kind: 'blocked'; minName: string; minFrom: string };

const DAY = 24 * 60 * 60 * 1000;
/** Play's dialog for an optional update: at most this often. */
export const PLAY_EVERY = 3 * DAY;

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : Number(v) || 0);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The RPC's answer (or the saved copy) as a Release; null if it isn't one. */
export function parseRelease(raw: unknown, phoneNow?: number): Release | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  // Fresh from the server: `now`. Saved: serverAt + offset.
  const serverAt = int(r.now ?? r.serverAt);
  if (serverAt <= 0) return null;
  const minFromAt = int(r.min_from_at ?? r.minFromAt);
  return {
    minCode: int(r.min_code ?? r.minCode),
    minName: text(r.min_name ?? r.minName),
    minFrom: text(r.min_from ?? r.minFrom),
    minFromAt: minFromAt > 0 ? minFromAt : null,
    latestCode: int(r.latest_code ?? r.latestCode),
    serverAt,
    offset: r.now !== undefined && phoneNow !== undefined ? serverAt - phoneNow : int(r.offset),
  };
}

/**
 * Now by the server's clock. Never earlier than the last time the server was
 * heard from, so setting the phone's date back can't undo a day that passed.
 */
export const serverNow = (r: Release, phoneNow: number) => Math.max(phoneNow + r.offset, r.serverAt);

export function releaseState(r: Release | null, myCode: number | null, phoneNow: number): ReleaseState {
  if (!r || !myCode || myCode <= 0) return { kind: 'ok' };
  if (myCode < r.minCode && r.minFromAt !== null) {
    const minName = r.minName ?? '';
    const minFrom = r.minFrom ?? '';
    return serverNow(r, phoneNow) >= r.minFromAt ? { kind: 'blocked', minName, minFrom } : { kind: 'warn', minName, minFrom };
  }
  return myCode < r.latestCode ? { kind: 'update' } : { kind: 'ok' };
}
