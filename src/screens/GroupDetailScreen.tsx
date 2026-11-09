import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Fab } from '../components/Fab';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { ActionSheet, type SheetOption } from '../components/ActionSheet';
import { Pager } from '../components/Pager';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { addMonths, filterGroup, firstMonthOf, lastPickableMonth, NO_FILTER, thisMonth, type ExpenseFilter } from '../lib/months';
import { resolveMe } from '../lib/people';
import { isArchived } from '../lib/groupFilters';
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

  // Feeds the home screen's "Most visited" filter.
  useEffect(() => {
    recordVisit(route.params.groupId);
  }, [recordVisit, route.params.groupId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
      headerRight: () =>
        group && !closed ? (
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setSheetOpen(true)} hitSlop={10} accessibilityLabel={t('detail.share')}>
              <Ionicons name="share-social-outline" size={22} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('GroupForm', { groupId: group.id })}
              hitSlop={10}
              accessibilityLabel={t('groupForm.editTitle')}
            >
              <Ionicons name="create-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
        ) : null,
    });
  }, [navigation, group, closed, colors, styles, t]);

  const view = useMemo(() => (group ? filterGroup(group, filter) : group), [group, filter]);
  const balances = useMemo(() => (group ? computeBalances(group) : []), [group]);
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
  const total = groupTotal(view);
  const meId = resolveMe(group, profile, meMap[group.id]);
  const archived = isArchived(prefs[group.id]);
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
          <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(total)}
          </Text>
          <Text style={styles.totalSub} numberOfLines={1}>
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
      {archived ? (
        <View style={styles.archived}>
          <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.archivedText}>{t('detail.archived')}</Text>
          <Pressable onPress={() => unarchiveGroup(group.id)} hitSlop={8}>
            <Text style={styles.link}>{t('groupMenu.unarchive')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Same order as TABS. */}
      <Pager index={TABS.indexOf(tab)} onIndexChange={onPage}>
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
        <MembersTab balances={balances} names={names} meId={meId} />
        <SettleTab group={group} transfers={transfers} names={names} meId={meId} onShare={() => setSheetOpen(true)} />
        <StatsTab group={view} balances={viewBalances} names={names} filter={filter} onFilter={setFilter} />
      </Pager>

      {tab === 'expenses' ? (
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
  headerIcons: { flexDirection: 'row', gap: spacing(5), alignItems: 'center' },
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
