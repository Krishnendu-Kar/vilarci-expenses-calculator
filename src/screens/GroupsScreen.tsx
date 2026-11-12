import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { FilterBar, type FilterOption } from '../components/FilterBar';
import { Pager } from '../components/Pager';
import { ActionSheet } from '../components/ActionSheet';
import { MoreButton, pressPoint } from '../components/MoreButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Avatar } from '../components/Avatar';
import { HeroBackground } from '../components/HeroBackground';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { useMenu, type MenuAnchor, type MenuItem } from '../context/MenuContext';
import { useLock } from '../context/LockContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { getLastBackup, loadSetting } from '../lib/storage';
import { autoBackupIfDue } from '../lib/autoBackup';
import { askOwner, lockSupport } from '../lib/deviceLock';
import { confirmAction, notify } from '../lib/confirm';
import { computeBalances, counted, groupTotal, suggestTransfers } from '../lib/split';
import { money } from '../lib/money';
import { groupKindOf, type IconName } from '../data/categories';
import { filterGroups, isArchived, isLocked, isPinned, pinDaysLeft, type GroupFilter, type GroupPref } from '../lib/groupFilters';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { kindTint } from '../theme/colors';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { Group } from '../types';
import type { TabProps } from '../navigation/types';

// Bundled, so the top works offline.
const LOGO = require('../../assets/logo.png');

const BACKUP_NAG_MS = 14 * 24 * 3600 * 1000;
/** Height of the logo / Scan / Settings row at the top. */
const TOP_ROW = 44;
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
  const {
    groups,
    ready,
    visits,
    prefs,
    pinGroup,
    unpinGroup,
    archiveGroup,
    unarchiveGroup,
    lockGroup,
    unlockGroup,
    moveToBin,
    restoreFromBin,
    giveNewId,
  } = useGroups();
  const insets = useSafeAreaInsets();
  const { isOpen, openAll } = useLock();
  const { showUndo, showNote } = useUndo();
  const { user } = useAuth();
  const { putOnline, syncNow } = useSync();
  const [pickMeFor, setPickMeFor] = useState<Group | null>(null);
  const { openMenu } = useMenu();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [pinFor, setPinFor] = useState<Group | null>(null);

  // Opening the app (and coming back to it): a Drive backup, if auto backup is on and one is due.
  const groupsRef = React.useRef(groups);
  groupsRef.current = groups;
  useEffect(() => {
    const t = setTimeout(() => void autoBackupIfDue(groupsRef.current), 5000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void autoBackupIfDue(groupsRef.current));
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

  // First start: the welcome pages, once.
  useEffect(() => {
    let current = true;
    loadSetting('welcomeSeen')
      .then((seen) => {
        if (current && !seen) navigation.navigate('Welcome');
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [navigation]);

  // Locked groups are off the lists (like WhatsApp's locked chats). Pulling a
  // list down shows a "Locked groups" row; it hides again once you go elsewhere.
  const locked = useMemo(() => groups.filter((g) => isLocked(prefs[g.id])), [groups, prefs]);
  const [revealed, setRevealed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => () => setRevealed(false), []));
  const onPullDown = useCallback(async () => {
    if (locked.length) setRevealed(true);
    // A pull is also a sync (onlinedb.md §9.6).
    setRefreshing(true);
    try {
      await syncNow();
    } finally {
      setRefreshing(false);
    }
  }, [locked.length, syncNow]);
  const openLocked = async () => {
    if (await openAll(locked.map((g) => g.id), t('lock.promptLocked'))) navigation.navigate('LockedGroups');
  };

  const archivedCount = groups.filter((g) => isArchived(prefs[g.id]) && !isLocked(prefs[g.id])).length;
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

  const openScan = useCallback(() => navigation.navigate('Scan'), [navigation]);
  const pull = useMemo(
    () => ({
      onPull: openScan,
      hint: (
        <View style={styles.pullHint}>
          <View style={styles.pullCircle}>
            <Ionicons name="camera-outline" size={24} color={colors.onPrimary} />
          </View>
          <Text style={styles.pullText}>{t('scan.short')}</Text>
        </View>
      ),
    }),
    [openScan, styles, colors, t],
  );

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
    // Locking uses the phone's fingerprint or screen lock, so not on the web.
    ...(Platform.OS === 'web'
      ? []
      : [
          isLocked(prefs[g.id])
            ? { key: 'unlock', icon: 'lock-open-outline' as const, title: t('groupMenu.unlock') }
            : { key: 'lock', icon: 'lock-closed-outline' as const, title: t('groupMenu.lock') },
        ]),
    ...(g.online ? [] : [{ key: 'online', icon: 'cloud-upload-outline' as const, title: t('online.menu') }]),
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
    else if (key === 'lock') lockOne(g);
    else if (key === 'unlock') {
      askOwner(t('lock.promptUnlock', { name: g.name }), t('common.cancel')).then((ok) => ok && unlockGroup(g.id));
    } else if (key === 'bin') {
      // A live group you're still in: leave it first (then its copy can go to the Bin).
      if (g.online?.status === 'active') {
        notify(t('groupForm.leaveFirstTitle'), t('groupForm.leaveFirstBody', { name: g.name }));
        return;
      }
      moveToBin(g.id);
      showUndo(t('bin.moved', { name: g.name }), () => restoreFromBin(g.id));
    } else if (key === 'online') goOnline(g);
  };

  // Put online (onlinedb.md §8): signed in, said yes, and the app knows which member is you.
  const goOnline = (g: Group) => {
    if (!user) {
      notify(t('online.signInTitle'), t('online.signInBody'));
      navigation.navigate('Auth', { mode: 'signIn' });
      return;
    }
    confirmAction(t('online.confirmTitle', { name: g.name }), t('online.confirmBody'), t('online.confirmButton'), () => void upload(g));
  };

  const upload = async (g: Group, meId?: string) => {
    try {
      showNote(t('online.working', { name: g.name }));
      const res = await putOnline(g.id, meId);
      if (res === 'pickMe') setPickMeFor(g);
      else if (res === 'signIn') notify(t('online.signInTitle'), t('online.signInBody'));
      else if (res === 'exists') {
        // A copy went online first (a shared group file): this one can go up as its own group.
        confirmAction(t('online.existsTitle'), t('online.existsBody'), t('online.existsButton'), () => {
          const moved = giveNewId(g.id);
          if (moved) void upload(moved, meId);
        });
      } else showNote(t('online.done', { name: g.name }));
    } catch (e) {
      notify(t('online.failed'), e instanceof Error ? e.message : String(e));
    }
  };

  // The owner confirms first, so nobody else can lock someone's group.
  const lockOne = async (g: Group) => {
    const support = await lockSupport();
    if (support === 'noScreenLock') return notify(t('lock.noScreenLock.title'), t('lock.noScreenLock.body'));
    if (support !== 'ok') return;
    if (!(await askOwner(t('lock.promptLock', { name: g.name }), t('common.cancel')))) return;
    lockGroup(g.id);
    // It leaves Home now; the note says where it went.
    showUndo(t('lock.doneHidden', { name: g.name }), () => unlockGroup(g.id));
  };

  const renderList = (f: GroupFilter) => (
    <FlatList
      data={lists[f] ?? []}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onPullDown()} tintColor={colors.tint} colors={[colors.primary]} />
      }
      ListHeaderComponent={
        <>
          {revealed && locked.length ? (
            <Pressable onPress={() => void openLocked()} style={({ pressed }) => [styles.lockedRow, pressed && styles.pressed]}>
              <View style={styles.lockedIcon}>
                <Ionicons name="lock-closed" size={17} color={colors.tint} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.lockedTitle}>
                  {t('lock.lockedRow')} ({locked.length})
                </Text>
                <Text style={styles.lockedBody} numberOfLines={1}>
                  {t('lock.lockedRowBody')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          {needsBackup && groups.length ? (
            <Pressable onPress={() => navigation.navigate('Export')} style={styles.nag}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.tint} />
              <Text style={styles.nagText}>
                {t('home.nag', { status: lastBackup ? t('home.nag.old') : t('home.nag.never') })}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.tint} />
            </Pressable>
          ) : null}
        </>
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
          closed={!isOpen(item.id)}
          visits={f === 'visited' ? visits[item.id]?.count : undefined}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
          onMenu={(anchor) => showMenu(item, anchor)}
        />
      )}
    />
  );

  const hero = (
    // Runs up under the status bar; its icons stay white on the dark top. The
    // light hangs down to just above the search bar.
    <HeroBackground
      kind="pendulum"
      reach={insets.top + spacing(2) + TOP_ROW + spacing(3) - 4}
      style={[styles.hero, { paddingTop: insets.top + spacing(2) }]}
    >
      <View style={styles.heroTop}>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.wordmark}>Vilarci E-Split</Text>
        <View style={styles.flex} />
        <GlassButton icon="camera-outline" label={t('scan.title')} onPress={openScan} />
        <GlassButton icon="settings-outline" label={t('settings.title')} onPress={() => navigation.navigate('Settings')} />
      </View>
      <Pressable
        onPress={() => navigation.navigate('Search')}
        accessibilityRole="search"
        style={({ pressed }) => [styles.searchBar, pressed && styles.glassPressed]}
      >
        <Ionicons name="search" size={17} color="rgba(255,255,255,0.85)" />
        <Text style={styles.searchText} numberOfLines={1}>
          {t('search.placeholder')}
        </Text>
      </Pressable>
    </HeroBackground>
  );

  return (
    <ScreenContainer tabs>
      {hero}
      {groups.length ? (
        <>
          <FilterBar options={options} value={filter} onChange={setFilter} />
          <Pager index={filterIndex} onIndexChange={onPage} pullStart={pull}>
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
    </ScreenContainer>
  );
}

function GlassButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.glassBtn, pressed && styles.glassPressed]}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
    </Pressable>
  );
}

/** Up to three members' initials, overlapping, then "+N". */
function Faces({ names }: { names: string[] }) {
  const styles = useStyles();
  const extra = names.length - 3;
  return (
    <View style={styles.faces}>
      {names.slice(0, 3).map((n, i) => (
        <View key={`${n}-${i}`} style={[styles.face, i > 0 && styles.faceOver]}>
          <Avatar name={n} size={16} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={[styles.face, styles.faceOver, styles.faceMore]}>
          <Text style={styles.faceMoreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
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
  /** Locked and not unlocked: amounts stay hidden. */
  closed: boolean;
  visits?: number;
  onPress: () => void;
  onMenu: (anchor: MenuAnchor) => void;
}

export function GroupCard({ group, pref, closed, visits, onPress, onMenu }: CardProps) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const kind = groupKindOf(group.kind);
  const tint = kindTint(group.kind, dark);
  const pending = useMemo(() => suggestTransfers(computeBalances(group)).length, [group]);
  const total = groupTotal(group);
  const pinned = isPinned(pref);
  const daysLeft = pinDaysLeft(pref);
  const { waiting } = useSync();
  const unsent = group.online ? (waiting[group.id] ?? 0) : 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={(e) => onMenu(pressPoint(e))}
      style={({ pressed }) => [styles.card, pinned && styles.cardPinned, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint.bg }]}>
        <Ionicons name={kind.icon} size={19} color={tint.fg} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          {pinned ? <Ionicons name="pin" size={13} color={colors.tint} /> : null}
          {isLocked(pref) ? <Ionicons name="lock-closed" size={12} color={colors.textSecondary} /> : null}
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          {group.online ? (
            <Ionicons
              // Live: up to date, changes waiting to go up, or read-only now.
              name={unsent ? 'cloud-upload-outline' : group.online.status === 'active' ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={13}
              color={unsent ? colors.tint : colors.textSecondary}
              accessibilityLabel={unsent ? t('sync.waiting', { count: unsent }) : t('online.live')}
            />
          ) : null}
          {pinned && daysLeft ? <Text style={styles.pinDays}>{t('home.card.pinnedDays', { count: daysLeft })}</Text> : null}
        </View>
        {/* One line, like a chat list: who's in it and how many expenses. */}
        <View style={styles.metaRow}>
          {group.members.length ? <Faces names={group.members.map((m) => m.name)} /> : null}
          <Text style={styles.meta} numberOfLines={1}>
            {t('count.expense', { count: group.expenses.filter(counted).length })}
            {visits ? ` · ${t('home.card.opened', { count: visits })}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        {closed ? (
          <>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text style={styles.totalLabel}>{t('home.card.locked')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.total}>{money(total)}</Text>
            {/* Under the amount: a dot and a few words, red while payments are due. */}
            {group.expenses.length ? (
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: pending ? colors.danger : colors.success }]} />
                <Text style={[styles.statusText, { color: pending ? colors.danger : colors.success }]} numberOfLines={1}>
                  {pending ? t('home.card.toSettle', { count: pending }) : t('home.card.allSettled')}
                </Text>
              </View>
            ) : (
              <Text style={styles.totalLabel}>{t('home.card.spent')}</Text>
            )}
          </>
        )}
      </View>
      <MoreButton onOpen={onMenu} hitSlop={12} style={styles.more} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  loader: { marginTop: spacing(16) },
  flex: { flex: 1 },
  hero: { paddingHorizontal: spacing(4), paddingBottom: spacing(4) },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), height: TOP_ROW },
  logo: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  wordmark: { color: '#FFFFFF', fontFamily: DISPLAY_FONT, fontSize: font.lg + 1, fontWeight: '700', letterSpacing: 0.3 },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glassPressed: { backgroundColor: 'rgba(255,255,255,0.24)' },
  // Frosted glass like the buttons above it, so it sits in the dark top
  // instead of standing out of it; the light shows through.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    height: 44,
    marginTop: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  searchText: { flex: 1, fontSize: font.md, color: 'rgba(255,255,255,0.65)' },
  pullHint: { alignItems: 'center', gap: spacing(1.5), width: 90 },
  pullCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.accent,
  },
  pullText: { fontSize: font.xs + 1, fontWeight: '800', color: c.tint },
  // Grows to fill, so an empty list can still be pulled down.
  list: { flexGrow: 1, paddingHorizontal: spacing(3), paddingTop: 0, paddingBottom: spacing(28) },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(1.5),
  },
  lockedIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  lockedTitle: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  lockedBody: { fontSize: font.sm - 1, color: c.textSecondary, marginTop: 2 },
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
  // A compact row, close to a chat list: rows sit almost edge to edge.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    paddingVertical: spacing(2.5),
    paddingLeft: spacing(3),
    paddingRight: 0,
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: c.border,
  },
  cardPinned: { borderColor: c.primaryLight },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  name: { flexShrink: 1, fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  pinDays: { fontSize: font.xs, fontWeight: '700', color: c.tint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: spacing(1) },
  meta: { flexShrink: 1, fontSize: font.sm - 1, color: c.textSecondary },
  faces: { flexDirection: 'row' },
  // A ring in the card's colour, so the overlap reads as separate faces.
  face: { borderRadius: 10, borderWidth: 2, borderColor: c.surface },
  faceOver: { marginLeft: -7 },
  faceMore: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
  faceMoreText: { fontSize: 8, fontWeight: '800', color: c.textSecondary },
  right: { alignItems: 'flex-end', marginLeft: spacing(2), maxWidth: '40%' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flexShrink: 1, fontSize: font.xs - 1, fontWeight: '700' },
  total: { fontFamily: DISPLAY_FONT, fontSize: font.md + 1, color: c.textPrimary },
  totalLabel: { fontSize: font.xs - 1, color: c.textSecondary },
  more: { paddingHorizontal: spacing(2), paddingVertical: spacing(2), marginLeft: spacing(0.5) },
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
