import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SectionLabel } from '../../components/SectionLabel';
import { useGroups } from '../../context/GroupsContext';
import type { Transfer } from '../../lib/split';
import { money } from '../../lib/money';
import { shortDate } from '../../lib/format';
import { confirmAction } from '../../lib/confirm';
import { colors } from '../../theme/colors';
import { font, radii, spacing } from '../../theme/tokens';
import { tabStyles as t } from './styles';
import type { Group } from '../../types';

interface Props {
  group: Group;
  transfers: Transfer[];
  names: Record<string, string>;
  onShare: () => void;
}

export function SettleTab({ group, transfers, names, onShare }: Props) {
  const { addPayment, deletePayment } = useGroups();

  return (
    <ScrollView contentContainerStyle={t.list}>
      {transfers.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title={group.expenses.length ? 'All settled up' : 'Nothing to settle yet'}
          body={
            group.expenses.length
              ? 'Everyone has paid their fair share.'
              : 'Add some expenses and this tab will show who should pay whom.'
          }
        />
      ) : (
        <>
          <Text style={t.explain}>
            The fewest payments that make everyone even. Tap "Paid" once the money has actually been sent.
          </Text>
          {transfers.map((tr) => (
            <View key={`${tr.from}-${tr.to}`} style={t.row}>
              <Avatar name={names[tr.from]} size={32} />
              <View style={styles.transferText}>
                <Text style={styles.transferLine} numberOfLines={2}>
                  <Text style={t.bold}>{names[tr.from]}</Text> pays <Text style={t.bold}>{names[tr.to]}</Text>
                </Text>
                <Text style={styles.transferAmount}>{money(tr.amount)}</Text>
              </View>
              <Pressable
                onPress={() => addPayment(group.id, tr)}
                style={({ pressed }) => [styles.paidBtn, pressed && t.pressed]}
              >
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.paidText}>Paid</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      {group.expenses.length ? (
        <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && t.pressed]}>
          <Ionicons name="share-social-outline" size={18} color={colors.primary} />
          <Text style={styles.shareText}>Send to the group</Text>
        </Pressable>
      ) : null}

      {group.payments.length ? (
        <View style={styles.history}>
          <SectionLabel>Payments recorded</SectionLabel>
          {group.payments.map((p) => (
            <View key={p.id} style={styles.payment}>
              <Ionicons name="swap-horizontal" size={18} color={colors.success} />
              <Text style={styles.paymentText} numberOfLines={2}>
                {names[p.from]} paid {names[p.to]} <Text style={t.bold}>{money(p.amount)}</Text>
                <Text style={t.small}> · {shortDate(p.createdAt)}</Text>
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  confirmAction('Undo payment?', `${names[p.from]} → ${names[p.to]} ${money(p.amount)}`, 'Undo', () =>
                    deletePayment(group.id, p.id),
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

const styles = StyleSheet.create({
  transferText: { flex: 1, marginLeft: spacing(3) },
  transferLine: { fontSize: font.md, color: colors.textPrimary },
  transferAmount: { fontSize: font.lg, fontWeight: '800', color: colors.primary, marginTop: 2 },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.success,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    marginLeft: spacing(2),
  },
  paidText: { color: colors.white, fontWeight: '700', fontSize: font.sm + 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing(3.5),
    marginTop: spacing(3),
    backgroundColor: colors.surface,
  },
  shareText: { color: colors.primary, fontWeight: '700', fontSize: font.md },
  history: { marginTop: spacing(8) },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  paymentText: { flex: 1, fontSize: font.sm + 1, color: colors.textPrimary },
});
