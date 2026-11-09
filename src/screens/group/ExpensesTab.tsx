import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { MoreButton, pressPoint } from '../../components/MoreButton';
import { useGroups } from '../../context/GroupsContext';
import { useUndo } from '../../context/UndoContext';
import { useMenu, type MenuAnchor, type MenuItem } from '../../context/MenuContext';
import { counted, sortExpenses } from '../../lib/split';
import { searchExpenses } from '../../lib/search';
import { expenseMonth, isFiltered, NO_FILTER, type ExpenseFilter } from '../../lib/months';
import { money } from '../../lib/money';
import { dayLabel, monthLabel } from '../../lib/format';
import { payerText, splitShort } from '../../lib/describe';
import { categoryOf } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';
import { FilterChips } from './FilterChips';
import type { Expense, Group } from '../../types';

interface Props {
  group: Group;
  /** The expenses the filter lets through. */
  shown: Expense[];
  filter: ExpenseFilter;
  onFilter: (f: ExpenseFilter) => void;
  onOpenFilter: () => void;
  /** Hostel/flat groups: opens the list of repeating expenses. */
  onRecurring: () => void;
  names: Record<string, string>;
  onOpen: (e: Expense) => void;
}

interface Section {
  key: string;
  kind: 'pinned' | 'day' | 'archived';
  date?: string;
  total?: number;
  count?: number;
  data: Expense[];
}

function byDay(list: Expense[]): Section[] {
  const days = new Map<string, Expense[]>();
  for (const e of sortExpenses(list)) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return [...days.entries()].map(([date, data]) => ({
    key: date,
    kind: 'day' as const,
    date,
    total: data.filter(counted).reduce((s, e) => s + e.amount, 0),
    data,
  }));
}

export function ExpensesTab({ group, shown, filter, onFilter, onOpenFilter, onRecurring, names, onOpen }: Props) {
  const t = useTabStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const i18n = useI18n();
  const { deleteExpense, saveExpense, pinExpense, archiveExpense } = useGroups();
  const { showUndo } = useUndo();
  const { openMenu } = useMenu();
  const [query, setQuery] = useState('');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const searching = !!query.trim();
  const filtered = isFiltered(filter);
  const repeats = new Set((group.recurring ?? []).map((r) => r.id));
  const hostel = group.kind === 'hostel';
  const repeatCount = group.recurring?.length ?? 0;
  const filterCount = (filter.month ? 1 : 0) + filter.categories.length;
  const shownLive = shown.filter(counted);
  const shownTotal = shownLive.reduce((s, e) => s + e.amount, 0);

  const sections = useMemo((): Section[] => {
    // A search looks inside the filter, archived expenses included.
    if (searching) {
      return byDay(searchExpenses(shown, query, names, group.members.length, (k) => categoryOf(k).label));
    }
    const live = shown.filter(counted);
    const pinned = live.filter((e) => e.pinnedAt != null).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
    const archived = sortExpenses(shown.filter((e) => !counted(e)));
    return [
      ...(pinned.length ? [{ key: 'pinned', kind: 'pinned' as const, data: pinned }] : []),
      ...byDay(live.filter((e) => e.pinnedAt == null)),
      ...(archived.length
        ? [{ key: 'archived', kind: 'archived' as const, count: archived.length, data: archivedOpen ? archived : [] }]
        : []),
    ];
    // The language is a dependency: category names are searched in it.
  }, [group, shown, query, searching, names, archivedOpen, i18n.lang]);

  // With a filter on, nothing found may just be outside it: offer to drop it.
  const clearFilter = filtered ? (
    <Pressable onPress={() => onFilter(NO_FILTER)} style={({ pressed }) => [styles.clearBtn, pressed && t.pressed]}>
      <Text style={styles.clearText}>{searching ? i18n.t('filter.searchAll') : i18n.t('filter.showAll')}</Text>
    </Pressable>
  ) : null;
  const empty = searching ? (
    <View>
      <EmptyState icon="search-outline" title={i18n.t('expenses.noMatch.title')} body={i18n.t('expenses.noMatch.body', { query: query.trim() })} />
      {clearFilter}
    </View>
  ) : group.expenses.length && filter.month && !filter.categories.length ? (
    <View>
      <EmptyState
        icon="calendar-outline"
        title={i18n.t('expenses.emptyMonth.title', { month: monthLabel(filter.month) })}
        body={i18n.t('expenses.emptyMonth.body')}
      />
      {clearFilter}
    </View>
  ) : group.expenses.length && filtered ? (
    <View>
      <EmptyState icon="funnel-outline" title={i18n.t('filter.empty.title')} body={i18n.t('filter.empty.body')} />
      {clearFilter}
    </View>
  ) : (
    <EmptyState icon="receipt-outline" title={i18n.t('expenses.empty.title')} body={i18n.t('expenses.empty.body')} />
  );

  // ---- the ⋮ menu on each expense ----
  const menuItems = (e: Expense): MenuItem[] => [
    ...(counted(e)
      ? [
          e.pinnedAt != null
            ? { key: 'unpin', icon: 'remove-circle-outline' as const, title: i18n.t('expMenu.unpin') }
            : { key: 'pin', icon: 'pin-outline' as const, title: i18n.t('expMenu.pin') },
        ]
      : []),
    counted(e)
      ? { key: 'archive', icon: 'archive-outline', title: i18n.t('expMenu.archive') }
      : { key: 'unarchive', icon: 'arrow-undo-outline', title: i18n.t('expMenu.unarchive') },
    { key: 'delete', icon: 'trash-outline', title: i18n.t('expMenu.delete'), danger: true },
  ];

  const showMenu = (e: Expense, anchor: MenuAnchor) => openMenu(anchor, menuItems(e), (key) => pickMenu(e, key));

  const pickMenu = (e: Expense, key: string) => {
    if (key === 'pin' || key === 'unpin') return pinExpense(group.id, e.id, key === 'pin');
    if (key === 'archive') {
      archiveExpense(group.id, e.id, true);
      showUndo(i18n.t('expenses.archivedDone', { name: e.title }), () => archiveExpense(group.id, e.id, false));
    } else if (key === 'unarchive') archiveExpense(group.id, e.id, false);
    else if (key === 'delete') {
      deleteExpense(group.id, e.id);
      showUndo(i18n.t('expense.deleted', { name: e.title }), () => saveExpense(group.id, e));
    }
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      contentContainerStyle={t.list}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        group.expenses.length ? (
          <View>
            <View style={styles.searchRow}>
              <View style={styles.flex}>
                <SearchBar value={query} onChangeText={setQuery} placeholder={i18n.t('expenses.search')} />
              </View>
              <Pressable
                onPress={onOpenFilter}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('filter.button')}
                style={({ pressed }) => [styles.filterBtn, filtered && styles.filterBtnOn, pressed && t.pressed]}
              >
                <Ionicons name="funnel-outline" size={18} color={filtered ? colors.onPrimary : colors.tint} />
                {filterCount ? <Text style={styles.filterCount}>{filterCount}</Text> : null}
              </Pressable>
            </View>
            <FilterChips filter={filter} onChange={onFilter} />
            {filtered && shownLive.length ? (
              <Text style={t.explain}>
                {i18n.t('count.expense', { count: shownLive.length })} · {money(shownTotal)}
              </Text>
            ) : null}
            {hostel ? (
              <Pressable onPress={onRecurring} style={({ pressed }) => [styles.repeatRow, pressed && t.pressed]}>
                <Ionicons name="repeat-outline" size={18} color={colors.tint} />
                <View style={styles.flex}>
                  <Text style={styles.repeatTitle}>{i18n.t('recurring.title')}</Text>
                  <Text style={styles.repeatBody} numberOfLines={1}>
                    {repeatCount ? i18n.t('recurring.count', { count: repeatCount }) : i18n.t('recurring.none')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : undefined
      }
      renderSectionHeader={({ section }) =>
        section.kind === 'pinned' ? (
          <View style={styles.dayHead}>
            <View style={styles.headLeft}>
              <Ionicons name="pin" size={13} color={colors.textSecondary} />
              <Text style={styles.dayLabel}>{i18n.t('expenses.pinned')}</Text>
            </View>
          </View>
        ) : section.kind === 'archived' ? (
          <Pressable onPress={() => setArchivedOpen((o) => !o)} style={styles.archivedHead} hitSlop={6}>
            <Ionicons name="archive-outline" size={15} color={colors.textSecondary} />
            <Text style={[styles.dayLabel, styles.flex]}>{i18n.t('expenses.archived', { count: section.count ?? 0 })}</Text>
            <Ionicons name={archivedOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>{dayLabel(section.date!)}</Text>
            <Text style={styles.dayLabel}>{money(section.total ?? 0)}</Text>
          </View>
        )
      }
      // A View, not a fragment: the list passes onLayout to this element.
      ListEmptyComponent={<View>{empty}</View>}
      renderItem={({ item }) => {
        const cat = categoryOf(item.category);
        const archived = !counted(item);
        return (
          <Pressable
            onPress={() => onOpen(item)}
            onLongPress={(e) => showMenu(item, pressPoint(e))}
            style={({ pressed }) => [t.row, styles.row, archived && styles.archivedRow, pressed && t.pressed]}
          >
            <View style={styles.catIcon}>
              <Ionicons name={cat.icon} size={20} color={archived ? colors.textSecondary : colors.tint} />
            </View>
            <View style={t.rowBody}>
              <View style={styles.titleRow}>
                {item.pinnedAt != null && !archived ? <Ionicons name="pin" size={13} color={colors.tint} /> : null}
                <Text style={[t.rowTitle, styles.title]} numberOfLines={1}>
                  {item.title}
                </Text>
                {archived ? <Text style={styles.tag}>{i18n.t('expenses.archivedTag')}</Text> : null}
                {item.month ? (
                  <Text style={styles.tag} numberOfLines={1}>
                    {i18n.t('expenses.forMonth', { month: monthLabel(expenseMonth(item)) })}
                  </Text>
                ) : null}
              </View>
              <Text style={t.rowMeta} numberOfLines={1}>
                {i18n.t('expenses.paidLine', { payers: payerText(item, names), split: splitShort(item, group.members.length) })}
              </Text>
            </View>
            <View style={t.rowRight}>
              <Text style={[t.rowAmount, archived && styles.struck]}>{money(item.amount)}</Text>
              <View style={styles.icons}>
                {item.recurringId && repeats.has(item.recurringId) ? (
                  <Ionicons name="repeat" size={13} color={colors.textSecondary} />
                ) : null}
                {item.note ? <Ionicons name="document-text-outline" size={13} color={colors.textSecondary} /> : null}
              </View>
            </View>
            <MoreButton size={17} style={styles.more} onOpen={(anchor) => showMenu(item, anchor)} />
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    height: 44,
    minWidth: 44,
    paddingHorizontal: spacing(3),
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  filterBtnOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterCount: { fontSize: font.sm, fontWeight: '800', color: c.onPrimary },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2),
  },
  repeatTitle: { fontSize: font.sm + 1, fontWeight: '700', color: c.textPrimary },
  repeatBody: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  clearBtn: {
    alignSelf: 'center',
    marginTop: -spacing(6),
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(2.5),
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  clearText: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  dayLabel: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  archivedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
  },
  row: { paddingRight: spacing(1) },
  archivedRow: { opacity: 0.65 },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  title: { flexShrink: 1 },
  tag: {
    flexShrink: 0,
    fontSize: font.xs,
    fontWeight: '700',
    color: c.textSecondary,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  struck: { textDecorationLine: 'line-through', color: c.textSecondary },
  icons: { flexDirection: 'row', gap: spacing(1), marginTop: 2 },
  more: { paddingHorizontal: spacing(2), paddingVertical: spacing(2), marginLeft: spacing(1) },
}));
