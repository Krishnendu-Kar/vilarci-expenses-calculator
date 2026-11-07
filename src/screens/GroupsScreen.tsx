import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { FilterBar, type FilterOption } from '../components/FilterBar';
import { Pager } from '../components/Pager';
import { ActionSheet } from '../components/ActionSheet';
import { MoreButton, pressPoint } from '../components/MoreButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { useMenu, type MenuAnchor, type MenuItem } from '../context/MenuContext';
import { getLastBackup } from '../lib/storage';
import { computeBalances, counted, groupTotal, suggestTransfers } from '../lib/split';
import { money } from '../lib/money';
import { groupKindOf, type IconName } from '../data/categories';
import { filterGroups, isArchived, isPinned, pinDaysLeft, type GroupFilter, type GroupPref } from '../lib/groupFilters';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { Group } from '../types';
import type { TabProps } from '../navigation/types';

const BACKUP_NAG_MS = 14 * 24 * 3600 * 1000;
const PIN_DAYS = [1, 7, 15];

const FILTERS: { key: GroupFilter; label: Key; icon?: IconName }[] = [
  { key: 'all', label: 'home.filter.all' },
  { key: 'trip', label: 'home.filter.trip', icon: 'airplane-outline' },
  { key: 'hostel', label: 'home.filter.hostel', icon: 'home-outline' },
  { key: 'other', label: 'home.filter.other', icon: 'people-outline' },
  { key: 'visited', label: 'home.filter.visited', icon: 'flame-outline' },
  { key: 'archived', label: 'home.filter.archived', icon: 'archive-outline' },
];

const FILTER_EMPTY: Record<Exclude<GroupFilter, 'all'>, { icon: IconName; title: Key; body: Key }> = {
  trip: { icon: 'airplane-outline', title: 'home.emptyTrip.title', body: 'home.emptyTrip.body' },
  hostel: { icon: 'home-outline', title: 'home.emptyHostel.title', body: 'home.emptyHostel.body' },
  other: { icon: 'people-outline', title: 'home.emptyOther.title', body: 'home.emptyOther.body' },
  visited: { icon: 'flame-outline', title: 'home.emptyVisited.title', body: 'home.emptyVisited.body' },
  archived: { icon: 'archive-outline', title: 'home.emptyArchived.title', body: 'home.emptyArchived.body' },
};

export function GroupsScreen({ navigation }: TabProps<'Home'>) {
  const { groups, ready, visits, prefs, pinGroup, unpinGroup, archiveGroup, unarchiveGroup, moveToBin, restoreFromBin } =
    useGroups();
  const { showUndo } = useUndo();
  const { openMenu } = useMenu();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [pinFor, setPinFor] = useState<Group | null>(null);

  const archivedCount = groups.filter((g) => isArchived(prefs[g.id])).length;
  // "Archived" only shows up once something is archived.
  const filters = useMemo(
    () => FILTERS.filter((f) => f.key !== 'archived' || archivedCount > 0),
    [archivedCount],
  );
  const options: FilterOption<GroupFilter>[] = filters.map((f) => ({
    key: f.key,
    icon: f.icon,
    label: f.key === 'archived' ? t(f.label, { count: archivedCount }) : t(f.label),
  }));
  useEffect(() => {
    if (!filters.some((f) => f.key === filter)) setFilter('all');
  }, [filters, filter]);

  // Every filter's list is built up front: the pager keeps all of them mounted.
  const lists = useMemo(
    () =>
      Object.fromEntries(filters.map((f) => [f.key, filterGroups(groups, f.key, visits, prefs)])) as Record<GroupFilter, Group[]>,
    [groups, visits, prefs, filters],
  );
  const filterIndex = Math.max(0, filters.findIndex((f) => f.key === filter));
  const onPage = useCallback((i: number) => setFilter(filters[i].key), [filters]);
  const [lastBackup, setLastBackup] = useState<number | null | undefined>(undefined);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          hitSlop={10}
          accessibilityLabel={t('settings.title')}
          style={styles.headerBtn}
        >
          <Ionicons name="settings-outline" size={22} color={colors.white} />
        </Pressable>
      ),
    });
  }, [navigation, colors, t, styles]);

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
      <ScreenContainer tabs>
        <ActivityIndicator style={styles.loader} color={colors.tint} />
      </ScreenContainer>
    );
  }

  // Pin opens its "for how long" choices inside the same menu.
  const pinItems: MenuItem[] = [
    { key: 'pin:always', icon: 'infinite-outline', title: t('pin.always') },
    ...PIN_DAYS.map((d): MenuItem => ({ key: `pin:${d}`, icon: 'time-outline', title: t('pin.days', { count: d }) })),
    { key: 'pin:custom', icon: 'create-outline', title: t('pin.custom') },
  ];

  const menuItems = (g: Group): MenuItem[] => [
    isPinned(prefs[g.id])
      ? { key: 'unpin', icon: 'remove-circle-outline', title: t('groupMenu.unpin') }
      : { key: 'pin', icon: 'pin-outline', title: t('groupMenu.pin'), children: pinItems },
    isArchived(prefs[g.id])
      ? { key: 'unarchive', icon: 'arrow-undo-outline', title: t('groupMenu.unarchive') }
      : { key: 'archive', icon: 'archive-outline', title: t('groupMenu.archive') },
    { key: 'bin', icon: 'trash-outline', title: t('groupMenu.bin'), danger: true },
  ];

  const showMenu = (g: Group, anchor: MenuAnchor) => openMenu(anchor, menuItems(g), (key) => pickMenu(g, key));

  const pickMenu = (g: Group, key: string) => {
    if (key === 'pin:custom') setPinFor(g);
    else if (key === 'pin:always') pinGroup(g.id, null);
    else if (key.startsWith('pin:')) pinGroup(g.id, Number(key.slice(4)));
    else if (key === 'unpin') unpinGroup(g.id);
    else if (key === 'archive') {
      archiveGroup(g.id);
      showUndo(t('home.archived', { name: g.name }), () => unarchiveGroup(g.id));
    } else if (key === 'unarchive') unarchiveGroup(g.id);
    else if (key === 'bin') {
      moveToBin(g.id);
      showUndo(t('bin.moved', { name: g.name }), () => restoreFromBin(g.id));
    }
  };

  const renderList = (f: GroupFilter) => (
    <FlatList
      data={lists[f] ?? []}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        needsBackup && groups.length ? (
          <Pressable onPress={() => navigation.navigate('Export')} style={styles.nag}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.tint} />
            <Text style={styles.nagText}>
              {t('home.nag', { status: lastBackup ? t('home.nag.old') : t('home.nag.never') })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.tint} />
          </Pressable>
        ) : undefined
      }
      ListEmptyComponent={
        // A View, not a fragment: FlatList passes onLayout to this element.
        groups.length === 0 ? (
          <View>
            <EmptyState icon="wallet-outline" title={t('home.empty.title')} body={t('home.empty.body')} />
            <Pressable onPress={() => navigation.navigate('Import')} hitSlop={8}>
              <Text style={styles.importLink}>{t('home.importLink')}</Text>
            </Pressable>
          </View>
        ) : f !== 'all' ? (
          <View>
            <EmptyState icon={FILTER_EMPTY[f].icon} title={t(FILTER_EMPTY[f].title)} body={t(FILTER_EMPTY[f].body)} />
          </View>
        ) : undefined
      }
      renderItem={({ item }) => (
        <GroupCard
          group={item}
          pref={prefs[item.id]}
          visits={f === 'visited' ? visits[item.id]?.count : undefined}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
          onMenu={(anchor) => showMenu(item, anchor)}
        />
      )}
    />
  );

  return (
    <ScreenContainer tabs>
      {groups.length ? (
        <>
          <FilterBar options={options} value={filter} onChange={setFilter} />
          <Pager index={filterIndex} onIndexChange={onPage}>
            {filters.map((f) => (
              <React.Fragment key={f.key}>{renderList(f.key)}</React.Fragment>
            ))}
          </Pager>
        </>
      ) : (
        renderList('all')
      )}
      <Fab
        label={t('home.newGroup')}
        // Starting from a type filter, the new group gets that type.
        onPress={() =>
          navigation.navigate(
            'GroupForm',
            filter === 'trip' || filter === 'hostel' || filter === 'other' ? { kind: filter } : undefined,
          )
        }
      />

      <PinSheet
        group={pinFor}
        onClose={() => setPinFor(null)}
        onPin={(days) => {
          if (pinFor) pinGroup(pinFor.id, days);
          setPinFor(null);
        }}
      />
    </ScreenContainer>
  );
}

/** Pin for a number of days typed in (Always / 1 / 7 / 15 are in the ⋮ menu). */
function PinSheet({ group, onClose, onPin }: { group: Group | null; onClose: () => void; onPin: (days: number) => void }) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!group) {
      setText('');
      setError(null);
    }
  }, [group]);

  const days = parseInt(text, 10);
  const pinCustom = () => {
    if (!Number.isInteger(days) || days < 1 || days > 365) return setError(t('pin.customError'));
    onPin(days);
  };

  return (
    <ActionSheet
      visible={!!group}
      title={t('pin.title', { name: group?.name ?? '' })}
      subtitle={t('pin.subtitle')}
      options={[]}
      onPick={() => {}}
      onClose={onClose}
    >
      <View style={styles.custom}>
        <Text style={styles.customLabel}>{t('pin.customLabel')}</Text>
        <TextInput
          style={styles.customInput}
          value={text}
          onChangeText={(v) => {
            setText(v.replace(/[^0-9]/g, ''));
            setError(null);
          }}
          keyboardType="number-pad"
          keyboardAppearance={dark ? 'dark' : 'light'}
          placeholder="30"
          placeholderTextColor={colors.textSecondary}
          maxLength={3}
          autoFocus
          onSubmitEditing={pinCustom}
        />
        {error ? <Text style={styles.customError}>{error}</Text> : null}
        <PrimaryButton
          label={Number.isInteger(days) && days > 0 ? t('pin.customButton', { count: days }) : t('groupMenu.pin')}
          onPress={pinCustom}
          style={styles.customBtn}
        />
      </View>
    </ActionSheet>
  );
}

interface CardProps {
  group: Group;
  pref?: GroupPref;
  visits?: number;
  onPress: () => void;
  onMenu: (anchor: MenuAnchor) => void;
}

function GroupCard({ group, pref, visits, onPress, onMenu }: CardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const kind = groupKindOf(group.kind);
  const pending = useMemo(() => suggestTransfers(computeBalances(group)).length, [group]);
  const total = groupTotal(group);
  const pinned = isPinned(pref);
  const daysLeft = pinDaysLeft(pref);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={(e) => onMenu(pressPoint(e))}
      style={({ pressed }) => [styles.card, pinned && styles.cardPinned, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={kind.icon} size={22} color={colors.tint} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          {pinned ? <Ionicons name="pin" size={14} color={colors.tint} /> : null}
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={2}>
          {t('count.member', { count: group.members.length })} · {t('count.expense', { count: group.expenses.filter(counted).length })}
          {visits ? ` · ${t('home.card.opened', { count: visits })}` : ''}
        </Text>
        <View style={styles.badges}>
          {group.expenses.length ? (
            <View style={[styles.badge, pending ? styles.badgePending : styles.badgeDone]}>
              <Text style={[styles.badgeText, pending ? styles.badgeTextPending : styles.badgeTextDone]}>
                {pending ? t('home.card.toSettle', { count: pending }) : t('home.card.allSettled')}
              </Text>
            </View>
          ) : null}
          {pinned ? (
            <View style={[styles.badge, styles.badgePin]}>
              <Text style={[styles.badgeText, styles.badgeTextPin]}>
                {daysLeft ? t('home.card.pinnedDays', { count: daysLeft }) : t('home.card.pinned')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{money(total)}</Text>
        <Text style={styles.totalLabel}>{t('home.card.spent')}</Text>
      </View>
      <MoreButton onOpen={onMenu} hitSlop={12} style={styles.more} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  loader: { marginTop: spacing(16) },
  headerBtn: { paddingHorizontal: spacing(2) },
  list: { paddingHorizontal: spacing(4), paddingTop: spacing(1), paddingBottom: spacing(28) },
  nag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing(3.5),
    marginBottom: spacing(5),
  },
  nagText: { flex: 1, fontSize: font.sm, color: c.textPrimary, lineHeight: 18 },
  importLink: { textAlign: 'center', color: c.tint, fontWeight: '700', fontSize: font.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing(4),
    paddingLeft: spacing(4),
    paddingRight: spacing(1),
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: c.border,
  },
  cardPinned: { borderColor: c.primaryLight },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  name: { flexShrink: 1, fontSize: font.lg, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing(2),
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  badgePending: { backgroundColor: c.dangerBg },
  badgeDone: { backgroundColor: c.successBg },
  badgePin: { backgroundColor: c.surfaceAlt },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  badgeTextPending: { color: c.danger },
  badgeTextDone: { color: c.success },
  badgeTextPin: { color: c.tint },
  right: { alignItems: 'flex-end', marginLeft: spacing(2) },
  total: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary },
  totalLabel: { fontSize: font.xs, color: c.textSecondary },
  more: { paddingHorizontal: spacing(2), paddingVertical: spacing(3), marginLeft: spacing(1) },
  custom: { marginTop: spacing(4), paddingHorizontal: spacing(1) },
  customLabel: { fontSize: font.sm, fontWeight: '600', color: c.textSecondary, marginBottom: spacing(1.5), textTransform: 'uppercase' },
  customInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: font.lg,
    color: c.textPrimary,
  },
  customError: { color: c.danger, fontSize: font.sm, marginTop: spacing(1.5), fontWeight: '600' },
  customBtn: { marginTop: spacing(4) },
}));
