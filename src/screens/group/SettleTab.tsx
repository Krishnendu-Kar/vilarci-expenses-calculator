import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SectionLabel } from '../../components/SectionLabel';
import { useGroups } from '../../context/GroupsContext';
import { useUndo } from '../../context/UndoContext';
import type { Transfer } from '../../lib/split';
import { money } from '../../lib/money';
import { shortDate } from '../../lib/format';
import { confirmAction } from '../../lib/confirm';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';
import type { Group } from '../../types';

interface Props {
  group: Group;
  transfers: Transfer[];
  names: Record<string, string>;
  meId: string | null;
  /** Set when a hostel group is showing one month. */
  month: string | null;
  onShare: () => void;
}

export function SettleTab({ group, transfers, names, meId, month, onShare }: Props) {
  const { addPayment, deletePayment, restorePayment } = useGroups();
  const { showUndo } = useUndo();
  const t = useTabStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const i18n = useI18n();
  const name = (id: string) => (id === meId ? i18n.t('common.youName', { name: names[id] }) : names[id]);

  const markPaid = (tr: Transfer) => {
    const p = addPayment(group.id, tr);
    showUndo(i18n.t('settle.markedPaid', { from: names[tr.from], to: names[tr.to], amount: money(tr.amount) }), () =>
      deletePayment(group.id, p.id),
    );
  };

  return (
    <ScrollView contentContainerStyle={t.list}>
      {transfers.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title={group.expenses.length ? i18n.t('settle.allSettled.title') : i18n.t('settle.nothing.title')}
          body={group.expenses.length ? i18n.t('settle.allSettled.body') : i18n.t('settle.nothing.body')}
        />
      ) : (
        <>
          <Text style={t.explain}>{i18n.t('settle.explain')}</Text>
          {month ? <Text style={t.explain}>{i18n.t('settle.allMonths')}</Text> : null}
          {transfers.map((tr) => (
            <View key={`${tr.from}-${tr.to}`} style={[t.row, (tr.from === meId || tr.to === meId) && t.rowMe]}>
              <Avatar name={names[tr.from]} size={32} />
              <View style={styles.transferText}>
                <Text style={styles.transferLine} numberOfLines={2}>
                  {i18n.tr('settle.pays', {
                    from: <Text style={t.bold}>{name(tr.from)}</Text>,
                    to: <Text style={t.bold}>{name(tr.to)}</Text>,
                  })}
                </Text>
                <Text style={styles.transferAmount}>{money(tr.amount)}</Text>
              </View>
              <Pressable onPress={() => markPaid(tr)} style={({ pressed }) => [styles.paidBtn, pressed && t.pressed]}>
                <Ionicons name="checkmark" size={16} color={colors.onSuccess} />
                <Text style={styles.paidText}>{i18n.t('settle.paid')}</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      {group.expenses.length ? (
        <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && t.pressed]}>
          <Ionicons name="share-social-outline" size={18} color={colors.tint} />
          <Text style={styles.shareText}>{i18n.t('settle.send')}</Text>
        </Pressable>
      ) : null}

      {group.payments.length ? (
        <View style={styles.history}>
          <SectionLabel>{i18n.t('settle.recorded')}</SectionLabel>
          {group.payments.map((p) => (
            <View key={p.id} style={styles.payment}>
              <Ionicons name="swap-horizontal" size={18} color={colors.success} />
              <Text style={styles.paymentText} numberOfLines={2}>
                {i18n.tr('settle.paymentLine', {
                  from: name(p.from),
                  to: name(p.to),
                  amount: <Text style={t.bold}>{money(p.amount)}</Text>,
                })}
                <Text style={t.small}> · {shortDate(p.createdAt)}</Text>
              </Text>
              <Pressable
                hitSlop={10}
                accessibilityLabel={i18n.t('settle.undoTitle')}
                onPress={() =>
                  confirmAction(
                    i18n.t('settle.undoTitle'),
                    `${names[p.from]} → ${names[p.to]} ${money(p.amount)}`,
                    i18n.t('common.undo'),
                    () => {
                      deletePayment(group.id, p.id);
                      showUndo(i18n.t('settle.removed'), () => restorePayment(group.id, p));
                    },
                  )
                }
              >
                <Ionicons name="arrow-undo-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  transferText: { flex: 1, marginLeft: spacing(3) },
  transferLine: { fontSize: font.md, color: c.textPrimary },
  transferAmount: { fontSize: font.lg, fontWeight: '800', color: c.tint, marginTop: 2 },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: c.success,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    marginLeft: spacing(2),
  },
  paidText: { color: c.onSuccess, fontWeight: '700', fontSize: font.sm + 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1.5,
    borderColor: c.tint,
    borderRadius: radii.lg,
    paddingVertical: spacing(3.5),
    marginTop: spacing(3),
    backgroundColor: c.surface,
  },
  shareText: { color: c.tint, fontWeight: '700', fontSize: font.md },
  history: { marginTop: spacing(8) },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  paymentText: { flex: 1, fontSize: font.sm + 1, color: c.textPrimary },
}));
