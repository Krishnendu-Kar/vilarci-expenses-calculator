import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { money } from '../lib/money';
import { joinNames, splitShort } from '../lib/describe';
import { sortExpenses } from '../lib/split';
import { confirmAction } from '../lib/confirm';
import { categoryOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Recurring } from '../types';
import type { ScreenProps } from '../navigation/types';

/** A hostel/flat group's monthly repeats: what they are, and a way to stop them. */
export function RecurringScreen({ navigation, route }: ScreenProps<'Recurring'>) {
  const group = useGroup(route.params.groupId);
  const { stopRecurring, restoreRecurring } = useGroups();
  const { showUndo } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!group) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>{t('common.missingGroup')}</Text>
      </ScreenContainer>
    );
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
  const list = group.recurring ?? [];
  const latest = (r: Recurring) => sortExpenses(group.expenses.filter((e) => e.recurringId === r.id))[0];

  const stop = (r: Recurring) =>
    confirmAction(t('recurring.stopTitle', { name: r.title }), t('recurring.stopBody'), t('recurring.stop'), () => {
      stopRecurring(group.id, r.id);
      showUndo(t('recurring.stopped', { name: r.title }), () => restoreRecurring(group.id, r));
    });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {list.length === 0 ? (
          <EmptyState icon="repeat-outline" title={t('recurring.empty.title')} body={t('recurring.empty.body')} />
        ) : null}
        {list.map((r) => {
          const last = latest(r);
          const cat = categoryOf(r.category);
          return (
            <View key={r.id} style={styles.card}>
              <Pressable
                disabled={!last}
                onPress={() => last && navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: last.id })}
                style={styles.cardTop}
                accessibilityHint={t('recurring.latest')}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={cat.icon} size={20} color={colors.tint} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.meta}>{t('recurring.every', { day: r.day })}</Text>
                  <Text style={styles.meta} numberOfLines={2}>
                    {t('recurring.paidBy', { name: joinNames(Object.keys(r.payers).map((id) => names[id] ?? '?')) })} ·{' '}
                    {splitShort(r, group.members.length)}
                  </Text>
                </View>
                <Text style={styles.amount}>{money(r.amount)}</Text>
              </Pressable>
              <View style={styles.actions}>
                {last ? (
                  <Pressable
                    onPress={() => navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: last.id })}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>{t('recurring.latest')}</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable onPress={() => stop(r)} hitSlop={8} style={styles.stop}>
                  <Ionicons name="stop-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.stopText}>{t('recurring.stop')}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  missing: { textAlign: 'center', marginTop: spacing(16), color: c.textSecondary },
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  amount: { fontSize: font.md + 1, fontWeight: '800', color: c.textPrimary },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(3),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  stopText: { color: c.danger, fontWeight: '700', fontSize: font.sm + 1 },
}));
