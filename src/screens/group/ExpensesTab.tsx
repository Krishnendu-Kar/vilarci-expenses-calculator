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
import { isClosed, monthOf } from '../../lib/months';
import { money } from '../../lib/money';
import { dayLabel, monthLabel } from '../../lib/format';
import { payerText, splitShort } from '../../lib/describe';
import { notify } from '../../lib/confirm';
import { categoryOf } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';
import type { Expense, Group } from '../../types';

interface Props {
  group: Group;
  /** What the tab lists: the month's expenses for hostel groups, else all. */
  shown: Expense[];
  month: string | null;
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

export function ExpensesTab({ group, shown, month, names, onOpen }: Props) {
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
  const repeats = new Set((group.recurring ?? []).map((r) => r.id));

  const sections = useMemo((): Section[] => {
    // A search looks through every month and the archive too.
    if (searching) {
      return byDay(searchExpenses(group.expenses, query, names, group.members.length, (k) => categoryOf(k).label));
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

  const empty = searching ? (
    <EmptyState icon="search-outline" title={i18n.t('expenses.noMatch.title')} body={i18n.t('expenses.noMatch.body', { query: query.trim() })} />
  ) : group.expenses.length && month ? (
    <EmptyState
      icon="calendar-outline"
      title={i18n.t('expenses.emptyMonth.title', { month: monthLabel(month) })}
      body={i18n.t('expenses.emptyMonth.body')}
    />
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
    // Archiving or deleting changes the month's numbers, so a closed month says no.
    const m = monthOf(e.date);
    if (isClosed(group, m)) return notify(i18n.t('month.lockedTitle', { month: monthLabel(m) }), i18n.t('month.lockedBody'));
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
            <SearchBar value={query} onChangeText={setQuery} placeholder={i18n.t('expenses.search')} />
            {searching && month ? <Text style={t.explain}>{i18n.t('expenses.searchAllMonths')}</Text> : null}
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
