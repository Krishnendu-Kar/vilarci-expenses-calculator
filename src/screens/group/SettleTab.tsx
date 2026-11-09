import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
  onShare: () => void;
}

/** All-time: who pays whom so everyone is even, and the payments already recorded. */
export function SettleTab({ group, transfers, names, meId, onShare }: Props) {
  const { addPayment, deletePayment, restorePayment, upiIds } = useGroups();
  const { showUndo, showNote } = useUndo();
  const t = useTabStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const i18n = useI18n();
  const name = (id: string) => (id === meId ? i18n.t('common.youName', { name: names[id] }) : names[id]);

  const copy = async (vpa: string) => {
    try {
      await Clipboard.setStringAsync(vpa);
      showNote(i18n.t('upi.copied', { id: vpa }));
    } catch {
      // Nothing was copied; the id is still there to read.
    }
  };
  // Where to pay you: shown once, under the first row where someone pays you.
  const firstToMe = transfers.find((tr) => tr.to === meId);

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
          {transfers.map((tr) => (
            <React.Fragment key={`${tr.from}-${tr.to}`}>
              <View style={[t.row, (tr.from === meId || tr.to === meId) && t.rowMe]}>
                {/* Who pays, overlapped by who gets it, like the website. */}
                <View style={styles.pair}>
                  <View style={styles.avatarRing}>
                    <Avatar name={names[tr.from]} size={32} />
                  </View>
                  <View style={[styles.avatarRing, styles.second]}>
                    <Avatar name={names[tr.to]} size={32} />
                  </View>
                </View>
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
              {tr === firstToMe ? (
                upiIds.length ? (
                  <View style={styles.upiBox}>
                    <Text style={styles.upiTitle}>{i18n.t('settle.yourUpi')}</Text>
                    {upiIds.map((u) => (
                      <Pressable
                        key={u.vpa}
                        onPress={() => copy(u.vpa)}
                        accessibilityLabel={i18n.t('upi.copy', { id: u.vpa })}
                        style={({ pressed }) => [styles.upiChip, pressed && t.pressed]}
                      >
                        <Text style={styles.upiText} numberOfLines={1}>
                          {u.vpa}
                        </Text>
                        <Ionicons name="copy-outline" size={15} color={colors.tint} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={[t.explain, styles.upiHint]}>{i18n.t('settle.addUpiHint')}</Text>
                )
              ) : null}
            </React.Fragment>
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
  pair: { flexDirection: 'row' },
  // A ring in the card's colour, so the overlap reads as two coins.
  avatarRing: { borderRadius: 18, borderWidth: 2, borderColor: c.surface },
  second: { marginLeft: -12 },
  transferText: { flex: 1, marginLeft: spacing(3) },
  upiBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: -spacing(1),
    marginBottom: spacing(3),
    paddingHorizontal: spacing(1),
  },
  upiTitle: { fontSize: font.sm, fontWeight: '600', color: c.textSecondary },
  upiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  upiText: { fontSize: font.sm + 1, fontWeight: '700', color: c.textPrimary },
  upiHint: { marginTop: -spacing(1), paddingHorizontal: spacing(1) },
  transferLine: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  transferAmount: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: c.success,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.md,
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
