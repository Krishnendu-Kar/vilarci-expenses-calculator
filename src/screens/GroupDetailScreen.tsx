import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Fab } from '../components/Fab';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { ActionSheet, type SheetOption } from '../components/ActionSheet';
import { Pager } from '../components/Pager';
import { PrimaryButton } from '../components/PrimaryButton';
import { MoreButton } from '../components/MoreButton';
import { useAfterPaint } from '../components/useAfterPaint';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { useMenu, type MenuItem } from '../context/MenuContext';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { addMonths, filterGroup, firstMonthOf, lastPickableMonth, NO_FILTER, thisMonth, type ExpenseFilter } from '../lib/months';
import { resolveMe } from '../lib/people';
import { isArchived } from '../lib/groupFilters';
import { can } from '../lib/permissions';
import { money } from '../lib/money';
import { monthLabel } from '../lib/format';
import { buildHtmlReport, buildTextReport } from '../lib/report';
import { buildBackup } from '../lib/backup';
import { fileSafe, shareMessage, sharePdf, shareTextFile } from '../lib/files';
import { notify } from '../lib/confirm';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { ExpensesTab } from './group/ExpensesTab';
import { MembersTab } from './group/MembersTab';
import { SettleTab } from './group/SettleTab';
import { StatsTab } from './group/StatsTab';
import { FilterSheet } from './group/FilterSheet';
import { useGroupExit } from './group/useGroupExit';
import { useUnreadActivity } from './group/activitySeen';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import type { ScreenProps } from '../navigation/types';

type Tab = 'expenses' | 'members' | 'settle' | 'stats';

const TABS: Tab[] = ['expenses', 'members', 'settle', 'stats'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GroupDetailScreen({ navigation, route }: ScreenProps<'GroupDetail'>) {
  const group = useGroup(route.params.groupId);
  const { recordVisit, prefs, unarchiveGroup, profile, meMap, upiIds } = useGroups();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('expenses');
  const onPage = useCallback((i: number) => setTab(TABS[i]), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // The Expenses list and Stats follow the filter; Members and Settle are all-time.
  // Hostel/flat groups open on this month.
  const [filter, setFilter] = useState<ExpenseFilter>(() =>
    group?.kind === 'hostel' ? { month: thisMonth(), categories: [] } : NO_FILTER,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const { isOpen, open } = useLock();
  const { openMenu } = useMenu();
  const exit = useGroupExit(group);
  const { user } = useAuth();
  const focused = useIsFocused();
  const unread = useUnreadActivity(group, user?.id ?? null, focused);
  const { state: syncState, waiting, syncNow } = useSync();
  // Changes of this group not uploaded yet (onlinedb.md §9.8): shown until they're up.
  const unsent = group?.online ? (waiting[group.id] ?? 0) : 0;
  const closed = !!group && !isOpen(group.id);
  const unlock = useCallback(
    () => open(route.params.groupId, t('lock.promptOpen', { name: group?.name ?? '' })),
    [open, route.params.groupId, group?.name, t],
  );

  // A locked group asks right away; the button on the lock screen asks again.
  useEffect(() => {
    if (closed) unlock();
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feeds the home screen's "Most visited" filter. Counted on leaving: counting
  // on opening redraws every screen behind this one just as it should appear.
  useEffect(() => () => recordVisit(route.params.groupId), [recordVisit, route.params.groupId]);

  // One ⋮ in the header holds the group's actions, each only when you may use it.
  useLayoutEffect(() => {
    if (!group || closed) {
      navigation.setOptions({ title: group?.name ?? '', headerRight: () => null });
      return;
    }
    const items: MenuItem[] = [
      ...(can('edit_info', group) || can('add_guests', group)
        ? [{ key: 'edit', icon: 'create-outline' as const, title: t('groupForm.editTitle') }]
        : []),
      // A live group: its link, QR and code (requests too, for admins).
      ...(group.online && can('share_invite', group)
        ? [{ key: 'link', icon: 'link-outline' as const, title: t('detail.shareLink') }]
        : []),
      { key: 'report', icon: 'share-social-outline', title: t('detail.shareReport') },
      ...(group.online && can('change_settings', group)
        ? [{ key: 'access', icon: 'shield-checkmark-outline' as const, title: t('detail.manageAccess') }]
        : []),
      // Live and still in it: leave; admins also delete for everyone, or restore within 30 days.
      ...(group.online?.deletedAt != null && can('delete_group', group)
        ? [{ key: 'restore', icon: 'refresh-outline' as const, title: t('exit.restore') }]
        : []),
      ...(group.online?.status === 'active' && group.online.deletedAt == null && can('delete_group', group)
        ? [{ key: 'delete', icon: 'trash-outline' as const, title: t('exit.delete'), danger: true }]
        : []),
      ...(group.online?.status === 'active' && can('leave', group)
        ? [{ key: 'leave', icon: 'exit-outline' as const, title: t('exit.leave'), danger: true }]
        : []),
    ];
    const pick = (key: string) => {
      if (key === 'edit') navigation.navigate('GroupForm', { groupId: group.id });
      else if (key === 'link') navigation.navigate('Invite', { groupId: group.id });
      else if (key === 'report') setSheetOpen(true);
      else if (key === 'access') navigation.navigate('GroupSettings', { groupId: group.id });
      else if (key === 'leave') exit.leave();
      else if (key === 'delete') exit.deleteForEveryone();
      else if (key === 'restore') exit.restore();
    };
    navigation.setOptions({
      title: group.name,
      headerRight: () => (
        <View style={styles.headerActions}>
          {/* Changes waiting to go up: tap to try now. Nothing shows when all is up. */}
          {unsent ? (
            <Pressable
              onPress={() => void syncNow()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('sync.waiting', { count: unsent })}
            >
              <Ionicons
                name={syncState === 'syncing' ? 'sync-outline' : syncState === 'failed' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
                size={20}
                color={colors.white}
              />
            </Pressable>
          ) : null}
          {/* A live group: its Activity, every change with who and when; a dot when someone else changed something. */}
          {group.online ? (
            <Pressable
              onPress={() => navigation.navigate('Activity', { groupId: group.id })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={unread ? t('activity.unread') : t('activity.title')}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.white} />
              {unread ? <View style={styles.dot} /> : null}
            </Pressable>
          ) : null}
          <MoreButton size={22} color={colors.white} hitSlop={12} onOpen={(anchor) => openMenu(anchor, items, pick)} />
        </View>
      ),
    });
  }, [navigation, group, closed, colors, styles, t, openMenu, exit, unread, unsent, syncState, syncNow]);

  // The page shows first (header, name, tabs) and works out the numbers
  // straight after, so opening a group never waits for the maths.
  const ready = useAfterPaint();
  const view = useMemo(() => (group && ready ? filterGroup(group, filter) : group), [group, filter, ready]);
  const balances = useMemo(() => (group && ready ? computeBalances(group) : []), [group, ready]);
  // Stats' "who paid" reads paid/share of the filtered expenses only.
  const viewBalances = useMemo(() => (view && view !== group ? computeBalances(view) : balances), [view, group, balances]);
  const transfers = useMemo(() => suggestTransfers(balances), [balances]);

  if (!group || !view) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>{t('common.missingGroup')}</Text>
      </ScreenContainer>
    );
  }

  if (closed) {
    return (
      <ScreenContainer>
        <View style={styles.locked}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={34} color={colors.tint} />
          </View>
          <Text style={styles.lockedTitle}>{t('lock.title')}</Text>
          <Text style={styles.lockedBody}>{t('lock.body')}</Text>
          <PrimaryButton label={t('lock.unlockButton')} onPress={unlock} style={styles.unlockBtn} />
        </View>
      </ScreenContainer>
    );
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
  const total = ready ? groupTotal(view) : 0;
  const meId = resolveMe(group, profile, meMap[group.id]);
  const archived = isArchived(prefs[group.id]);
  // A live group you can only read now, and why.
  const readOnly = group.online
    ? group.online.status === 'left'
      ? t('exit.bannerLeft')
      : group.online.status === 'removed'
        ? t('exit.bannerRemoved')
        : group.online.status === 'gone'
          ? t('exit.bannerGone')
          : group.online.deletedAt != null
            ? t('exit.bannerDeleted')
            : null
    : null;
  const totalLabel = filter.month
    ? t(filter.categories.length ? 'detail.spentInFiltered' : 'detail.spentIn', { month: monthLabel(filter.month) })
    : filter.categories.length
      ? t('detail.filteredTotal')
      : t('detail.totalSpent');
  // ‹ › beside the month: back to the group's first month, ahead as far as the month picker goes.
  const month = filter.month;
  const canBack = !!month && month > firstMonthOf(group);
  const canAhead = !!month && month < lastPickableMonth();
  const stepMonth = (n: number) => month && setFilter({ ...filter, month: addMonths(month, n) });

  const tabLabels: { key: Tab; label: string }[] = [
    { key: 'expenses', label: t('detail.tabExpenses') },
    { key: 'members', label: t('detail.tabMembers') },
    { key: 'settle', label: transfers.length ? t('detail.tabSettleCount', { count: transfers.length }) : t('detail.tabSettle') },
    { key: 'stats', label: t('detail.tabStats') },
  ];

  const shareOptions: SheetOption[] = [
    { key: 'pdf', icon: 'document-text-outline', title: t('detail.pdf'), body: t('detail.pdfBody') },
    { key: 'text', icon: 'logo-whatsapp', title: t('detail.text'), body: t('detail.textBody') },
    { key: 'file', icon: 'phone-portrait-outline', title: t('detail.file'), body: t('detail.fileBody') },
  ];

  const closeSheet = async () => {
    setSheetOpen(false);
    // Let the modal finish sliding away so iOS can present the share sheet.
    if (Platform.OS === 'ios') await wait(450);
  };

  const share = async (key: string) => {
    setBusy(key);
    const base = fileSafe(group.name);
    try {
      // Reports say where to pay you, when you're in the group and have a UPI id.
      const pay = meId ? { memberId: meId, upiIds } : undefined;
      if (key === 'pdf') await sharePdf(`${base}-expenses.pdf`, buildHtmlReport(group, new Date(), pay), closeSheet);
      else if (key === 'text') await shareMessage(buildTextReport(group, pay), closeSheet);
      else await shareTextFile(`${base}.vilarci.json`, buildBackup([group]), 'application/json', closeSheet);
      setSheetOpen(false);
    } catch (e) {
      notify(t('detail.shareFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenContainer>
      {/* The header colour carries on: the total, then the tabs, like the website's phone. */}
      <View style={styles.hero}>
        <View style={styles.total}>
          <View style={styles.labelRow}>
            {month ? (
              <MonthStep icon="chevron-back" label={t('detail.prevMonth')} enabled={canBack} onPress={() => stepMonth(-1)} />
            ) : null}
            <Text style={styles.totalLabel} numberOfLines={1}>
              {totalLabel}
            </Text>
            {month ? (
              <MonthStep icon="chevron-forward" label={t('detail.nextMonth')} enabled={canAhead} onPress={() => stepMonth(1)} />
            ) : null}
          </View>
          {/* Same height before the numbers are in, so nothing jumps. */}
          <Text style={[styles.totalValue, !ready && styles.waiting]} numberOfLines={1} adjustsFontSizeToFit>
            {money(total)}
          </Text>
          <Text style={[styles.totalSub, !ready && styles.waiting]} numberOfLines={1}>
            {t('detail.perPerson', { amount: money(Math.round(total / group.members.length)) })} · {t('count.person', { count: group.members.length })}
          </Text>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tabLabels.map(({ key, label }) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                  {label}
                </Text>
                <View style={[styles.tabLine, on && styles.tabLineOn]} />
              </Pressable>
            );
          })}
        </View>
      </View>
      {readOnly ? (
        <View style={styles.archived}>
          <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.archivedText}>{readOnly}</Text>
        </View>
      ) : null}
      {archived ? (
        <View style={styles.archived}>
          <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.archivedText}>{t('detail.archived')}</Text>
          <Pressable onPress={() => unarchiveGroup(group.id)} hitSlop={8}>
            <Text style={styles.link}>{t('groupMenu.unarchive')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Same order as TABS. Built once the page is on screen. */}
      {ready ? (
        <Pager index={TABS.indexOf(tab)} onIndexChange={onPage} lazy>
          <ExpensesTab
            group={group}
            shown={view.expenses}
            filter={filter}
            onFilter={setFilter}
            onOpenFilter={() => setFilterOpen(true)}
            onRecurring={() => navigation.navigate('Recurring', { groupId: group.id })}
            names={names}
            onOpen={(e) => navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: e.id })}
          />
          <MembersTab group={group} balances={balances} names={names} meId={meId} />
          <SettleTab group={group} transfers={transfers} names={names} meId={meId} onShare={() => setSheetOpen(true)} />
          <StatsTab group={view} balances={viewBalances} names={names} filter={filter} onFilter={setFilter} />
        </Pager>
      ) : (
        <View style={styles.flex} />
      )}

      {tab === 'expenses' && can('edit_expenses', group) ? (
        <Fab label={t('detail.addExpense')} onPress={() => navigation.navigate('ExpenseForm', { groupId: group.id })} />
      ) : null}

      <ActionSheet
        visible={sheetOpen}
        title={t('detail.shareTitle')}
        subtitle={t('detail.shareSubtitle', { name: group.name })}
        options={shareOptions}
        busy={busy}
        onPick={share}
        onClose={() => setSheetOpen(false)}
      />
      <FilterSheet visible={filterOpen} group={group} value={filter} onApply={setFilter} onClose={() => setFilterOpen(false)} />
    </ScreenContainer>
  );
}

/** A small glass circle on the hero that moves the month by one. */
function MonthStep({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.step, !enabled && styles.stepOff, pressed && styles.stepPressed]}
    >
      <Ionicons name={icon} size={16} color={colors.white} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  missing: { textAlign: 'center', marginTop: spacing(16), color: c.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  // The Activity bell's unread dot: the brand's gold on the maroon header.
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: c.accent,
    borderWidth: 1.5,
    borderColor: c.header,
  },
  locked: { alignItems: 'center', paddingTop: spacing(20), paddingHorizontal: spacing(8) },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  lockedTitle: { fontSize: font.xl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
  lockedBody: { fontSize: font.md, color: c.textSecondary, textAlign: 'center', marginTop: spacing(2), lineHeight: 21 },
  unlockBtn: { alignSelf: 'stretch', marginTop: spacing(6) },
  // Same colour as the header bar above it, so the two read as one piece.
  hero: { backgroundColor: c.header, paddingHorizontal: spacing(5) },
  total: { alignItems: 'center', paddingTop: spacing(3), paddingBottom: spacing(4) },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(3), alignSelf: 'stretch' },
  totalLabel: { color: c.white, opacity: 0.75, fontSize: font.sm, letterSpacing: 0.3, flexShrink: 1 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  stepOff: { opacity: 0.35 },
  stepPressed: { backgroundColor: 'rgba(255,255,255,0.26)' },
  totalValue: { color: c.white, fontFamily: DISPLAY_FONT, fontSize: 40, lineHeight: 46, marginVertical: 2 },
  totalSub: { color: c.white, opacity: 0.75, fontSize: font.sm },
  waiting: { opacity: 0 },
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', justifyContent: 'space-between' },
  tab: { alignItems: 'center', paddingHorizontal: spacing(1) },
  tabText: { color: c.white, opacity: 0.65, fontSize: font.md, fontWeight: '600', paddingTop: spacing(2), paddingBottom: spacing(2.5) },
  tabTextOn: { opacity: 1 },
  tabLine: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  tabLineOn: { backgroundColor: c.white },
  archived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginHorizontal: spacing(4),
    marginTop: spacing(3),
  },
  archivedText: { flex: 1, fontSize: font.sm, color: c.textPrimary },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
}));
