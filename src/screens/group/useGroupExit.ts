import { useCallback, useMemo } from 'react';
import { useGroups } from '../../context/GroupsContext';
import { useSync } from '../../context/SyncContext';
import { useUndo } from '../../context/UndoContext';
import {
  deleteGroupOnline,
  leaveGroup,
  removeMember,
  restoreGroupOnline,
  type LeaveProblem,
} from '../../lib/api/groups';
import { confirmAction, notify } from '../../lib/confirm';
import { money } from '../../lib/money';
import { translate } from '../../i18n';
import type { Group, Member } from '../../types';

/**
 * Why you (or `name`) can't go yet, as one sentence (onlinedb.md §17).
 * The server's balance is paid − owed: above zero means they get money back.
 */
export function problemText(p: LeaveProblem, name?: string): string {
  switch (p.reason) {
    case 'not_settled': {
      const amount = money(Math.abs(p.balance));
      if (name) return translate(p.balance < 0 ? 'exit.theyOwe' : 'exit.theyGet', { name, amount });
      return translate(p.balance < 0 ? 'exit.youOwe' : 'exit.youGet', { amount });
    }
    case 'in_repeat':
      return name ? translate('exit.inRepeatThem', { name, title: p.title }) : translate('exit.inRepeatYou', { title: p.title });
    case 'last_admin':
      return translate('exit.lastAdmin');
    case 'last_account':
      return translate('exit.lastAccount');
  }
}

/**
 * Leaving, removing someone, deleting and restoring a live group: each asks
 * first, says why when the server says not yet, and syncs straight after so
 * the change shows (left groups turn read-only, removed people get a tag).
 */
export function useGroupExit(group: Group | undefined) {
  const { syncNow } = useSync();
  const { showNote } = useUndo();
  const { names } = useGroups();
  // Hooks run before the page knows the group exists.
  const id = group?.id ?? '';
  const name = group?.name ?? '';

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        await syncNow();
      } catch {
        notify(name, translate('exit.failed'));
      }
    },
    [name, syncNow],
  );

  const leave = useCallback(
    () =>
      confirmAction(translate('exit.leaveTitle', { name }), translate('exit.leaveBody'), translate('exit.leave'), () =>
        void run(async () => {
          const res = await leaveGroup(id);
          if (res.status === 'left' || res.status === 'not_member') showNote(translate('exit.left', { name }));
          else notify(translate('exit.cantLeave'), problemText({ ...res, reason: res.status } as LeaveProblem));
        }),
      ),
    [id, name, run, showNote],
  );

  const remove = useCallback(
    (m: Member) => {
      const who = names.of(m);
      confirmAction(translate('exit.removeTitle', { name: who }), translate('exit.removeBody'), translate('exit.remove'), () =>
        void run(async () => {
          const res = await removeMember(id, m.id);
          if (res.status === 'removed' || res.status === 'gone') showNote(translate('exit.removed', { name: who }));
          else
            notify(
              translate('exit.cantRemove', { name: who }),
              problemText({ ...res, reason: res.status } as LeaveProblem, who),
            );
        }),
      );
    },
    [id, run, showNote, names],
  );

  const deleteForEveryone = useCallback(
    () =>
      confirmAction(translate('exit.deleteTitle', { name }), translate('exit.deleteBody'), translate('exit.delete'), () =>
        void run(async () => {
          await deleteGroupOnline(id);
          showNote(translate('exit.deleted', { name }));
        }),
      ),
    [id, name, run, showNote],
  );

  const restore = useCallback(
    () =>
      void run(async () => {
        await restoreGroupOnline(id);
        showNote(translate('exit.restored', { name }));
      }),
    [id, name, run, showNote],
  );

  return useMemo(() => ({ leave, remove, deleteForEveryone, restore }), [leave, remove, deleteForEveryone, restore]);
}
