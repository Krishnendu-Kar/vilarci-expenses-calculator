import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { useGroups } from '../context/GroupsContext';
import { getLastBackup } from '../lib/storage';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { money } from '../lib/money';
import { plural } from '../lib/format';
import { groupKindOf } from '../data/categories';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { Group } from '../types';
import type { ScreenProps } from '../navigation/types';

const BACKUP_NAG_MS = 14 * 24 * 3600 * 1000;

export function GroupsScreen({ navigation }: ScreenProps<'Groups'>) {
  const { groups, ready } = useGroups();
  const sorted = useMemo(() => [...groups].sort((a, b) => b.updatedAt - a.updatedAt), [groups]);
  const [lastBackup, setLastBackup] = useState<number | null | undefined>(undefined);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Backup')} hitSlop={10} accessibilityLabel="Backup and restore">
          <Ionicons name="cloud-upload-outline" size={22} color={colors.white} />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Re-read when coming back from the backup screen.
  useFocusEffect(
    useCallback(() => {
      getLastBackup().then(setLastBackup).catch(() => setLastBackup(null));
    }, []),
  );

  const expenseCount = groups.reduce((s, g) => s + g.expenses.length, 0);
  const needsBackup =
    lastBackup !== undefined && expenseCount >= 3 && (!lastBackup || Date.now() - lastBackup > BACKUP_NAG_MS);

  if (!ready) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={sorted}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          sorted.length ? (
            <>
              {needsBackup ? (
                <Pressable onPress={() => navigation.navigate('Backup')} style={styles.nag}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                  <Text style={styles.nagText}>
                    {lastBackup ? 'No backup in the last 2 weeks.' : 'Not backed up yet.'} Your data is only on this phone. Tap to save a copy.
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
              <Text style={styles.heading}>Your groups</Text>
            </>
          ) : null
        }
        ListEmptyComponent={
          // A View, not a fragment: FlatList passes onLayout to this element.
          <View>
            <EmptyState
              icon="wallet-outline"
              title="No groups yet"
              body="Make a group for a trip, your hostel mess or a flat, add everyone, and log who paid for what. We'll work out who owes whom."
            />
            <Pressable onPress={() => navigation.navigate('Backup')} hitSlop={8}>
              <Text style={styles.importLink}>Have a backup or a group file? Import it</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <GroupCard group={item} onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })} />
        )}
      />
      <Fab label="New group" onPress={() => navigation.navigate('GroupForm')} />
    </ScreenContainer>
  );
}

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const kind = groupKindOf(group.kind);
  const pending = useMemo(() => suggestTransfers(computeBalances(group)).length, [group]);
  const total = groupTotal(group);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Ionicons name={kind.icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.meta}>
          {plural(group.members.length, 'member')} · {plural(group.expenses.length, 'expense')}
        </Text>
        {group.expenses.length ? (
          <View style={[styles.badge, pending ? styles.badgePending : styles.badgeDone]}>
            <Text style={[styles.badgeText, pending ? styles.badgeTextPending : styles.badgeTextDone]}>
              {pending ? `${plural(pending, 'payment')} to settle` : 'All settled'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{money(total)}</Text>
        <Text style={styles.totalLabel}>spent</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing(16) },
  list: { padding: spacing(4), paddingBottom: spacing(28) },
  nag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing(3.5),
    marginBottom: spacing(5),
  },
  nagText: { flex: 1, fontSize: font.sm, color: colors.textPrimary, lineHeight: 18 },
  importLink: { textAlign: 'center', color: colors.primary, fontWeight: '700', fontSize: font.md },
  heading: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing(3),
    marginLeft: spacing(1),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing(4),
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  cardBody: { flex: 1 },
  name: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing(2),
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  badgePending: { backgroundColor: colors.dangerBg },
  badgeDone: { backgroundColor: colors.successBg },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  badgeTextPending: { color: colors.danger },
  badgeTextDone: { color: colors.success },
  right: { alignItems: 'flex-end', marginLeft: spacing(2) },
  total: { fontSize: font.lg, fontWeight: '800', color: colors.textPrimary },
  totalLabel: { fontSize: font.xs, color: colors.textSecondary },
});
