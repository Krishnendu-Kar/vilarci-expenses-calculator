import React, { useEffect, useMemo, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { useMenu } from '../context/MenuContext';
import { isLocked } from '../lib/groupFilters';
import { askOwner } from '../lib/deviceLock';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { GroupCard } from './GroupsScreen';
import type { ScreenProps } from '../navigation/types';

/**
 * Locked groups, kept off Home (like WhatsApp's locked chats). Reached by
 * pulling Home's list down and passing the fingerprint or screen lock, which
 * opens them all for this visit. Leaving the page locks them again.
 */
export function LockedGroupsScreen({ navigation }: ScreenProps<'LockedGroups'>) {
  const { groups, prefs, unlockGroup } = useGroups();
  const { isOpen, lockAgain } = useLock();
  const { openMenu } = useMenu();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();

  const locked = useMemo(() => groups.filter((g) => isLocked(prefs[g.id])), [groups, prefs]);

  // Leaving the page shuts every one of them again (opening a group from here
  // keeps this page underneath, so they stay open meanwhile).
  const ids = useRef<string[]>([]);
  ids.current = locked.map((g) => g.id);
  useEffect(() => () => lockAgain(ids.current), [lockAgain]);

  // Somehow here without the fingerprint or screen lock: back to Home.
  useEffect(() => {
    if (locked.some((g) => !isOpen(g.id))) navigation.goBack();
  }, [locked, isOpen, navigation]);

  // Removing the lock asks once more; the group goes back to Home.
  const unlock = async (groupId: string, name: string) => {
    if (await askOwner(t('lock.promptUnlock', { name }), t('common.cancel'))) unlockGroup(groupId);
  };

  return (
    <ScreenContainer>
      <FlatList
        data={locked}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.note}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.tint} />
            <Text style={styles.noteText}>{t('lock.lockedNote')}</Text>
          </View>
        }
        ListEmptyComponent={
          // A View, not a fragment: the list passes onLayout to this element.
          <View>
            <EmptyState icon="lock-open-outline" title={t('lock.noneLocked')} body="" />
          </View>
        }
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            pref={prefs[item.id]}
            closed={!isOpen(item.id)}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
            onMenu={(anchor) =>
              openMenu(anchor, [{ key: 'unlock', icon: 'lock-open-outline', title: t('groupMenu.unlock') }], () =>
                void unlock(item.id, item.name),
              )
            }
          />
        )}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  list: { padding: spacing(3), paddingBottom: spacing(12) },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(3),
  },
  noteText: { flex: 1, fontSize: font.sm - 1, color: c.textSecondary, lineHeight: 17 },
}));
