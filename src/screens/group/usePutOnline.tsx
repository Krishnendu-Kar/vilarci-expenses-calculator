import React, { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ActionSheet } from '../../components/ActionSheet';
import { useAuth } from '../../context/AuthContext';
import { useGroups } from '../../context/GroupsContext';
import { useSync } from '../../context/SyncContext';
import { useUndo } from '../../context/UndoContext';
import { confirmAction, notify } from '../../lib/confirm';
import { useI18n } from '../../i18n/I18nContext';
import type { Group } from '../../types';

interface Options {
  /** It went up under a new id (a copy of it was already online), for a page that shows it by id. */
  onMoved?: (groupId: string) => void;
  /** It's online now (not when it's waiting for internet). */
  onOnline?: (groupId: string) => void;
}

/**
 * Put online (onlinedb.md §8), from Home's ⋮, the group's own ⋮, or a new
 * group created as Online: signed in, said yes, and the app knows which
 * member is you. `start` asks first; `go` doesn't (the choice was made on
 * the New group form). With no internet it waits and goes up by itself.
 * `sheet` is the "Which one is you?" picker to render on the page.
 */
export function usePutOnline({ onMoved, onOnline }: Options = {}) {
  const navigation = useNavigation();
  const { giveNewId } = useGroups();
  const { user } = useAuth();
  const { putOnline } = useSync();
  const { showNote } = useUndo();
  const { t } = useI18n();
  const [pickMeFor, setPickMeFor] = useState<Group | null>(null);
  const movedRef = useRef(onMoved);
  movedRef.current = onMoved;
  const onlineRef = useRef(onOnline);
  onlineRef.current = onOnline;

  const upload = useCallback(
    async (g: Group, meId?: string) => {
      try {
        showNote(t('online.working', { name: g.name }));
        const res = await putOnline(g.id, meId);
        if (res === 'pickMe') setPickMeFor(g);
        else if (res === 'queued') showNote(t('online.queued', { name: g.name }));
        else if (res === 'signIn') notify(t('online.signInTitle'), t('online.signInBody'));
        else if (res === 'exists') {
          // A copy went online first (a shared group file): this one can go up as its own group.
          confirmAction(t('online.existsTitle'), t('online.existsBody'), t('online.existsButton'), () => {
            const moved = giveNewId(g.id);
            if (!moved) return;
            movedRef.current?.(moved.id);
            void upload(moved, meId);
          });
        } else {
          showNote(t('online.done', { name: g.name }));
          onlineRef.current?.(g.id);
        }
      } catch (e) {
        notify(t('online.failed'), e instanceof Error ? e.message : String(e));
      }
    },
    [giveNewId, putOnline, showNote, t],
  );

  const start = useCallback(
    (g: Group) => {
      if (!user) {
        notify(t('online.signInTitle'), t('online.signInBody'));
        navigation.navigate('Auth', { mode: 'signIn' });
        return;
      }
      confirmAction(t('online.confirmTitle', { name: g.name }), t('online.confirmBody'), t('online.confirmButton'), () => void upload(g));
    },
    [user, navigation, upload, t],
  );

  const sheet = (
    <ActionSheet
      visible={!!pickMeFor}
      title={t('online.whoTitle')}
      subtitle={t('online.whoBody', { name: pickMeFor?.name ?? '' })}
      options={(pickMeFor?.members ?? []).map((m) => ({ key: m.id, icon: 'person-outline', title: m.name }))}
      onPick={(memberId) => {
        const g = pickMeFor;
        setPickMeFor(null);
        if (g) void upload(g, memberId);
      }}
      onClose={() => setPickMeFor(null)}
    />
  );

  const go = useCallback((g: Group, meId?: string) => void upload(g, meId), [upload]);

  return { start, go, sheet };
}
