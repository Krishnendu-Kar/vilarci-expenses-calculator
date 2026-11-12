import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { QUICK_MS, SLOW_FOR_MS, SLOW_MS, connectionOf, type Connection, type NetSnapshot } from './connection';

// One watch on the connection for the whole app: NetInfo for "no internet",
// and the time our own server calls take for "slow" (a phone can't measure
// its speed by itself, and a test download would cost the user data).

let net: NetSnapshot | null = null;
let slowUntil = 0;
let current: Connection = 'ok';
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function update() {
  const next = connectionOf(net, Date.now() < slowUntil);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function markSlow() {
  slowUntil = Date.now() + SLOW_FOR_MS;
  if (slowTimer) clearTimeout(slowTimer);
  slowTimer = setTimeout(update, SLOW_FOR_MS + 50);
  update();
}

let started = false;
function start() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => {
    net = s;
    update();
  });
}

/**
 * fetch, timed: an answer (or a wait) over 5 s shows "Slow internet" for a
 * minute; a quick answer clears it. Used by the Supabase client.
 */
export const timedFetch: typeof fetch = (input, init) => {
  const began = Date.now();
  const waiting = setTimeout(markSlow, SLOW_MS);
  return fetch(input, init).then(
    (res) => {
      clearTimeout(waiting);
      const took = Date.now() - began;
      if (took >= SLOW_MS) markSlow();
      else if (took < QUICK_MS && slowUntil) {
        slowUntil = 0;
        update();
      }
      return res;
    },
    (e: unknown) => {
      clearTimeout(waiting);
      throw e;
    },
  );
};

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** ok, slow or offline, kept up to date. */
export function useConnection(): Connection {
  return useSyncExternalStore(subscribe, () => current);
}
