import { supabase } from './supabase';

// The live poke (onlinedb.md §9.7): after every change to a live group the
// server broadcasts { seq } on the private channel `group:<id>`, which only
// its members may hear. Phones listen while on screen and sync when told
// there's something newer. Not needed for correctness: they also sync on
// opening and coming back.

/** Supabase's free plan allows 100 channels per connection; the busiest groups go first. */
export const MAX_CHANNELS = 50;

/** Listens on each group's channel; returns a function that stops listening. */
export function listenForPokes(groupIds: string[], onPoke: (groupId: string, seq: number) => void): () => void {
  if (!groupIds.length) return () => {};
  let stopped = false;
  const channels: ReturnType<typeof supabase.channel>[] = [];
  // Private channels need the sign-in on the realtime connection first.
  void supabase.realtime
    .setAuth()
    .catch(() => {})
    .then(() => {
      if (stopped) return;
      for (const id of groupIds.slice(0, MAX_CHANNELS)) {
        channels.push(
          supabase
            .channel(`group:${id}`, { config: { private: true } })
            .on('broadcast', { event: 'poke' }, ({ payload }) => onPoke(id, Number(payload?.seq) || 0))
            .subscribe(),
        );
      }
    });
  return () => {
    stopped = true;
    channels.forEach((c) => void supabase.removeChannel(c));
  };
}
