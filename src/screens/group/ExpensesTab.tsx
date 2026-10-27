import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../components/EmptyState';
import { sortExpenses } from '../../lib/split';
import { money } from '../../lib/money';
import { dayLabel } from '../../lib/format';
import { payerText, splitShort } from '../../lib/describe';
import { categoryOf } from '../../data/categories';
import { colors } from '../../theme/colors';
import { font, radii, spacing } from '../../theme/tokens';
import { tabStyles as t } from './styles';
import type { Expense, Group } from '../../types';

interface Props {
  group: Group;
  names: Record<string, string>;
  onOpen: (e: Expense) => void;
}

export function ExpensesTab({ group, names, onOpen }: Props) {
  const sections = useMemo(() => {
    const byDay = new Map<string, Expense[]>();
    for (const e of sortExpenses(group.expenses)) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    return [...byDay.entries()].map(([date, data]) => ({
      date,
      total: data.reduce((s, e) => s + e.amount, 0),
      data,
    }));
  }, [group.expenses]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      contentContainerStyle={t.list}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHead}>
          <Text style={styles.dayLabel}>{dayLabel(section.date)}</Text>
          <Text style={styles.dayLabel}>{money(section.total)}</Text>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No expenses yet"
          body="Add what each person paid for — travel, food, rice, a boat ride for just 3 of you — and pick who it's for."
        />
      }
      renderItem={({ item }) => {
        const cat = categoryOf(item.category);
        return (
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [t.row, pressed && t.pressed]}>
            <View style={styles.catIcon}>
              <Ionicons name={cat.icon} size={20} color={colors.primary} />
            </View>
            <View style={t.rowBody}>
              <Text style={t.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={t.rowMeta} numberOfLines={1}>
                {payerText(item, names)} paid · {splitShort(item, group.members.length)}
              </Text>
            </View>
            <View style={t.rowRight}>
              <Text style={t.rowAmount}>{money(item.amount)}</Text>
              {item.note ? <Ionicons name="document-text-outline" size={13} color={colors.textSecondary} /> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
  dayLabel: { fontSize: font.sm, fontWeight: '700', color: colors.textSecondary },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
});
