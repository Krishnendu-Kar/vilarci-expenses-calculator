import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Segmented } from '../components/Segmented';
import { Fab } from '../components/Fab';
import { ActionSheet, type SheetOption } from '../components/ActionSheet';
import { Pager } from '../components/Pager';
import { MonthBar } from '../components/MonthBar';
import { useGroup, useGroups } from '../context/GroupsContext';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { addMonths, daysIn, inMonth, isClosed, monthBalances, monthsOf, thisMonth, type Month } from '../lib/months';
import { resolveMe } from '../lib/people';
import { isArchived } from '../lib/groupFilters';
import { money } from '../lib/money';
import { monthLabel, todayISO } from '../lib/format';
import { buildHtmlReport, buildTextReport } from '../lib/report';
import { buildBackup } from '../lib/backup';
import { fileSafe, shareMessage, sharePdf, shareTextFile } from '../lib/files';
import { confirmAction, notify } from '../lib/confirm';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { ExpensesTab } from './group/ExpensesTab';
import { MembersTab } from './group/MembersTab';
import { SettleTab } from './group/SettleTab';
import { StatsTab } from './group/StatsTab';
import type { ScreenProps } from '../navigation/types';

type Tab = 'expenses' | 'members' | 'settle' | 'stats';

const TABS: Tab[] = ['expenses', 'members', 'settle', 'stats'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GroupDetailScreen({ navigation, route }: ScreenProps<'GroupDetail'>) {
  const group = useGroup(route.params.groupId);
  const { recordVisit, prefs, unarchiveGroup, profile, meMap, setClosed } = useGroups();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('expenses');
  const onPage = useCallback((i: number) => setTab(TABS[i]), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [monthMenu, setMonthMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Hostel/flat groups show one month at a time (null = all months).
  const [month, setMonth] = useState<Month | null>(() => thisMonth());

  // Feeds the home screen's "Most visited" filter.
  useEffect(() => {
    recordVisit(route.params.groupId);
  }, [recordVisit, route.params.groupId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
      headerRight: () =>
        group ? (
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
  }, [navigation, group, colors, styles, t]);

  const monthly = group?.kind === 'hostel';
  const shownMonth = monthly ? month : null;
  const months = useMemo(() => (group && monthly ? monthsOf(group) : []), [group, monthly]);
  const view = useMemo(() => (group && shownMonth ? inMonth(group, shownMonth) : group), [group, shownMonth]);
  const balances = useMemo(() => (group ? computeBalances(group) : []), [group]);
  const monthRows = useMemo(() => (group && shownMonth ? monthBalances(group, shownMonth) : null), [group, shownMonth]);
  const transfers = useMemo(() => suggestTransfers(balances), [balances]);

  if (!group || !view) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>{t('common.missingGroup')}</Text>
      </ScreenContainer>
    );
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
  const total = groupTotal(view);
  const meId = resolveMe(group, profile, meMap[group.id]);
  const archived = isArchived(prefs[group.id]);
  const monthIndex = shownMonth ? months.indexOf(shownMonth) : -1;
  const closed = !!shownMonth && isClosed(group, shownMonth);

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
      if (key === 'pdf') await sharePdf(`${base}-expenses.pdf`, buildHtmlReport(group), closeSheet);
      else if (key === 'text') await shareMessage(buildTextReport(group), closeSheet);
      else await shareTextFile(`${base}.vilarci.json`, buildBackup([group]), 'application/json', closeSheet);
      setSheetOpen(false);
    } catch (e) {
      notify(t('detail.shareFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const recurringCount = group.recurring?.length ?? 0;
  const monthOptions: SheetOption[] = [
    ...(shownMonth
      ? [
          closed
            ? {
                key: 'reopen',
                icon: 'lock-open-outline' as const,
                title: t('month.reopen', { month: monthLabel(shownMonth) }),
                body: t('month.reopenBody'),
              }
            : {
                key: 'close',
                icon: 'lock-closed-outline' as const,
                title: t('month.close', { month: monthLabel(shownMonth) }),
                body: t('month.closeBody', { next: monthLabel(addMonths(shownMonth, 1)) }),
              },
          { key: 'all', icon: 'calendar-outline' as const, title: t('month.showAll'), body: t('month.showAllBody') },
        ]
      : [{ key: 'current', icon: 'today-outline' as const, title: t('month.showCurrent'), body: monthLabel(thisMonth()) }]),
    {
      key: 'recurring',
      icon: 'repeat-outline',
      title: t('recurring.title'),
      body: recurringCount ? t('recurring.count', { count: recurringCount }) : t('recurring.none'),
    },
  ];

  const pickMonthOption = (key: string) => {
    setMonthMenu(false);
    if (key === 'all') setMonth(null);
    else if (key === 'current') setMonth(thisMonth());
    else if (key === 'recurring') navigation.navigate('Recurring', { groupId: group.id });
    else if (key === 'close' && shownMonth) {
      confirmAction(
        t('month.closeConfirm', { month: monthLabel(shownMonth) }),
        t('month.closeBody', { next: monthLabel(addMonths(shownMonth, 1)) }),
        t('month.closeButton'),
        () => setClosed(group.id, shownMonth, true),
      );
    } else if (key === 'reopen' && shownMonth) setClosed(group.id, shownMonth, false);
  };

  // A new expense from a past month's page is dated in that month.
  const addExpense = () => {
    const current = thisMonth();
    const date =
      shownMonth && shownMonth < current && !closed ? `${shownMonth}-${String(daysIn(shownMonth)).padStart(2, '0')}` : todayISO();
    navigation.navigate('ExpenseForm', { groupId: group.id, date });
  };

  return (
    <ScreenContainer>
      <View style={styles.top}>
        {archived ? (
          <View style={styles.archived}>
            <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.archivedText}>{t('detail.archived')}</Text>
            <Pressable onPress={() => unarchiveGroup(group.id)} hitSlop={8}>
              <Text style={styles.link}>{t('groupMenu.unarchive')}</Text>
            </Pressable>
          </View>
        ) : null}
        {monthly ? (
          <MonthBar
            month={shownMonth}
            closed={closed}
            canPrev={monthIndex > 0}
            canNext={monthIndex >= 0 && monthIndex < months.length - 1}
            onPrev={() => setMonth(months[monthIndex - 1])}
            onNext={() => setMonth(months[monthIndex + 1])}
            onMenu={() => setMonthMenu(true)}
          />
        ) : null}
        <View style={styles.summary}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>{shownMonth ? t('detail.spentThisMonth') : t('detail.totalSpent')}</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>{t('detail.avg')}</Text>
            <Text style={styles.summaryValue}>{money(Math.round(total / group.members.length))}</Text>
          </View>
        </View>
        <Segmented
          options={[
            { key: 'expenses', label: t('detail.tabExpenses') },
            { key: 'members', label: t('detail.tabMembers') },
            { key: 'settle', label: transfers.length ? t('detail.tabSettleCount', { count: transfers.length }) : t('detail.tabSettle') },
            { key: 'stats', label: t('detail.tabStats') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {/* Same order as TABS. */}
      <Pager index={TABS.indexOf(tab)} onIndexChange={onPage}>
        <ExpensesTab
          group={group}
          shown={view.expenses}
          month={shownMonth}
          names={names}
          onOpen={(e) => navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: e.id })}
        />
        <MembersTab balances={monthRows ?? balances} monthly={!!monthRows} names={names} meId={meId} />
        <SettleTab group={group} transfers={transfers} names={names} meId={meId} month={shownMonth} onShare={() => setSheetOpen(true)} />
        <StatsTab group={view} balances={monthRows ?? balances} names={names} />
      </Pager>

      {tab === 'expenses' ? <Fab label={t('detail.addExpense')} onPress={addExpense} /> : null}

      <ActionSheet
        visible={sheetOpen}
        title={t('detail.shareTitle')}
        subtitle={t('detail.shareSubtitle', { name: group.name })}
        options={shareOptions}
        busy={busy}
        onPick={share}
        onClose={() => setSheetOpen(false)}
      />
      <ActionSheet
        visible={monthMenu}
        title={shownMonth ? monthLabel(shownMonth) : t('month.all')}
        options={monthOptions}
        onPick={pickMonthOption}
        onClose={() => setMonthMenu(false)}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  missing: { textAlign: 'center', marginTop: spacing(16), color: c.textSecondary },
  headerIcons: { flexDirection: 'row', gap: spacing(5), alignItems: 'center' },
  top: { paddingHorizontal: spacing(4), paddingTop: spacing(4), paddingBottom: spacing(2) },
  archived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(3),
  },
  archivedText: { flex: 1, fontSize: font.sm, color: c.textPrimary },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  summary: {
    flexDirection: 'row',
    backgroundColor: c.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing(4),
    marginBottom: spacing(4),
  },
  summaryCol: { flex: 1, alignItems: 'center', paddingHorizontal: spacing(1) },
  summaryLabel: { color: c.onPrimary, opacity: 0.75, fontSize: font.xs + 1, fontWeight: '600', letterSpacing: 0.4, textAlign: 'center' },
  summaryValue: { color: c.onPrimary, fontSize: font.xxl, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
}));
