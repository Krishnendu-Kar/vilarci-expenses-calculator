import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { binDaysLeft } from '../lib/bin';
import { groupTotal } from '../lib/split';
import { money } from '../lib/money';
import { shortDate } from '../lib/format';
import { confirmAction } from '../lib/confirm';
import { groupKindOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

/** Deleted groups: restore within 30 days, or delete for good now. */
export function BinScreen() {
  const { bin, moveToBin, restoreFromBin, deleteForever } = useGroups();
  const { showUndo } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const items = [...bin].sort((a, b) => b.binnedAt - a.binnedAt);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {items.length ? <Text style={styles.explain}>{t('bin.explain')}</Text> : null}
        {items.length === 0 ? <EmptyState icon="trash-outline" title={t('bin.empty.title')} body={t('bin.empty.body')} /> : null}
        {items.map(({ group, binnedAt }) => (
          <View key={group.id} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.iconWrap}>
                <Ionicons name={groupKindOf(group.kind).icon} size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={styles.meta}>
                  {t('count.expense', { count: group.expenses.length })} · {money(groupTotal(group))}
                </Text>
                <Text style={styles.meta}>{t('bin.binnedOn', { date: shortDate(binnedAt) })}</Text>
                <Text style={styles.left}>{t('bin.daysLeft', { count: binDaysLeft({ group, binnedAt }) })}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  restoreFromBin(group.id);
                  showUndo(t('bin.restored', { name: group.name }), () => moveToBin(group.id));
                }}
                hitSlop={8}
                style={styles.action}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={colors.tint} />
                <Text style={styles.restore}>{t('bin.restore')}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  confirmAction(t('bin.deleteTitle', { name: group.name }), t('bin.deleteBody'), t('common.delete'), () =>
                    deleteForever(group.id),
                  )
                }
                hitSlop={8}
                style={styles.action}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.delete}>{t('bin.deleteNow')}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  explain: { fontSize: font.sm, color: c.textSecondary, marginBottom: spacing(3), lineHeight: 18 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  top: { flexDirection: 'row', gap: spacing(3) },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  name: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  left: { fontSize: font.sm, color: c.danger, fontWeight: '600', marginTop: spacing(1) },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(3),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  restore: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  delete: { color: c.danger, fontWeight: '700', fontSize: font.sm + 1 },
}));
