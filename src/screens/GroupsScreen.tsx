import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { FilterBar, type FilterOption } from '../components/FilterBar';
import { Pager } from '../components/Pager';
import { useGroups } from '../context/GroupsContext';
import { getLastBackup } from '../lib/storage';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { money } from '../lib/money';
import { plural } from '../lib/format';
import { groupKindOf, type IconName } from '../data/categories';
import { filterGroups, type GroupFilter } from '../lib/groupFilters';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { Group } from '../types';
import type { ScreenProps } from '../navigation/types';

const BACKUP_NAG_MS = 14 * 24 * 3600 * 1000;

const FILTERS: FilterOption<GroupFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'trip', label: 'Trip', icon: 'airplane-outline' },
  { key: 'hostel', label: 'Hostel', icon: 'home-outline' },
  { key: 'other', label: 'Other', icon: 'people-outline' },
  { key: 'visited', label: 'Most visited', icon: 'flame-outline' },
];

const FILTER_EMPTY: Record<Exclude<GroupFilter, 'all'>, { icon: IconName; title: string; body: string }> = {
  trip: { icon: 'airplane-outline', title: 'No trips yet', body: 'Groups you make with the Trip type show up here.' },
  hostel: {
    icon: 'home-outline',
    title: 'No hostel or flat groups',
    body: 'Groups you make with the Hostel / Flat type show up here.',
  },
  other: { icon: 'people-outline', title: 'No other groups', body: 'Groups you make with the Other type show up here.' },
  visited: { icon: 'flame-outline', title: 'Nothing here yet', body: 'The groups you open most often will show up here.' },
};

export function GroupsScreen({ navigation }: ScreenProps<'Groups'>) {
  const { groups, ready, visits } = useGroups();
  const [filter, setFilter] = useState<GroupFilter>('all');
  // Every filter's list is built up front: the pager keeps all of them mounted.
  const lists = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, filterGroups(groups, f.key, visits)])) as Record<GroupFilter, Group[]>,
    [groups, visits],
  );
  const filterIndex = FILTERS.findIndex((f) => f.key === filter);
  const onPage = useCallback((i: number) => setFilter(FILTERS[i].key), []);
  const [lastBackup, setLastBackup] = useState<number | null | undefined>(undefined);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10} accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={22} color={colors.white} />
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

  const renderList = (f: GroupFilter) => (
    <FlatList
      data={lists[f]}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        needsBackup && groups.length ? (
          <Pressable onPress={() => navigation.navigate('Export')} style={styles.nag}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={styles.nagText}>
              {lastBackup ? 'No backup in the last 2 weeks.' : 'Not backed up yet.'} Your data is only on this phone. Tap to save a copy.
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ) : null
      }
      ListEmptyComponent={
        // A View, not a fragment: FlatList passes onLayout to this element.
        groups.length === 0 ? (
          <View>
            <EmptyState
              icon="wallet-outline"
              title="No groups yet"
              body="Make a group for a trip, your hostel mess or a flat, add everyone, and log who paid for what. We'll work out who owes whom."
            />
            <Pressable onPress={() => navigation.navigate('Import')} hitSlop={8}>
              <Text style={styles.importLink}>Have a backup or a group file? Import it</Text>
            </Pressable>
          </View>
        ) : f !== 'all' ? (
          <View>
            <EmptyState {...FILTER_EMPTY[f]} />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <GroupCard
          group={item}
          visits={f === 'visited' ? visits[item.id]?.count : undefined}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        />
      )}
    />
  );

  return (
    <ScreenContainer>
      {groups.length ? (
        <>
          <FilterBar options={FILTERS} value={filter} onChange={setFilter} />
          <Pager index={filterIndex} onIndexChange={onPage}>
            {FILTERS.map((f) => (
              <React.Fragment key={f.key}>{renderList(f.key)}</React.Fragment>
            ))}
          </Pager>
        </>
      ) : (
        renderList('all')
      )}
      <Fab
        label="New group"
        // Starting from a type filter, the new group gets that type.
        onPress={() =>
          navigation.navigate('GroupForm', filter === 'all' || filter === 'visited' ? undefined : { kind: filter })
        }
      />
    </ScreenContainer>
  );
}

function GroupCard({ group, visits, onPress }: { group: Group; visits?: number; onPress: () => void }) {
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
          {visits ? ` · opened ${visits === 1 ? 'once' : `${visits} times`}` : ''}
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
  list: { paddingHorizontal: spacing(4), paddingTop: spacing(1), paddingBottom: spacing(28) },
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
