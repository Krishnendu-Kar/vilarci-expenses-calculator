// How the connection looks, for the yellow bar under the header. Kept apart
// from the NetInfo module so it runs in the tests.

export type Connection = 'ok' | 'slow' | 'offline';

/** A server answer (or a wait) this long means a slow connection. */
export const SLOW_MS = 5_000;
/** An answer this quick means it's fine again. */
export const QUICK_MS = 2_000;
/** "Slow" stays up this long after the last slow answer, unless a quick one comes first. */
export const SLOW_FOR_MS = 60_000;

/** What NetInfo says, as far as it matters here. */
export interface NetSnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
  details: unknown;
}

/**
 * No network, or a network that can't reach the internet: offline. A slow
 * answer from our server lately, or a 2G phone network: slow.
 */
export function connectionOf(net: NetSnapshot | null, slow: boolean): Connection {
  if (net && (net.isConnected === false || net.isInternetReachable === false)) return 'offline';
  if (slow) return 'slow';
  const generation = (net?.details as { cellularGeneration?: string | null } | null)?.cellularGeneration;
  if (net?.type === 'cellular' && generation === '2g') return 'slow';
  return 'ok';
}
