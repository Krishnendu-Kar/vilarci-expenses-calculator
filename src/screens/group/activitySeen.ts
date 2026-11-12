import { useEffect, useState } from 'react';
import { loadEvents, loadSetting, saveSetting } from '../../lib/storage';
import type { Group } from '../../types';

// The unread dot on a live group's Activity bell (onlinedb.md §18): there's
// a line newer than the last one you saw, made by someone else. What was
// seen is kept on this phone only.

async function readSeen(): Promise<Record<string, number>> {
  try {
    const raw = JSON.parse((await loadSetting('activitySeen')) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Opening Activity: everything up to `seq` has been seen. */
export async function markActivitySeen(groupId: string, seq: number) {
  const seen = await readSeen();
  if ((seen[groupId] ?? 0) >= seq) return;
  await saveSetting('activitySeen', JSON.stringify({ ...seen, [groupId]: seq }));
}

/**
 * True when someone other than `meId` changed the group since you last
 * opened its Activity. Checked again whenever the group changes or `focused`
 * turns true (back from the Activity page).
 */
export function useUnreadActivity(group: Group | undefined, meId: string | null, focused: boolean): boolean {
  const [unread, setUnread] = useState(false);
  const live = !!group?.online;
  useEffect(() => {
    if (!group || !live || !focused) return;
    let current = true;
    Promise.all([loadEvents(group.id, 50), readSeen()])
      .then(([events, seen]) => {
        const newest = events.find((e) => e.actor !== meId);
        if (current) setUnread(!!newest && newest.seq > (seen[group.id] ?? 0));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [group, live, meId, focused]);
  return live && unread;
}
