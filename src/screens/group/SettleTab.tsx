import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { ActionSheet } from '../../components/ActionSheet';
import { SectionLabel } from '../../components/SectionLabel';
import { useGroups } from '../../context/GroupsContext';
import { useUndo } from '../../context/UndoContext';
import type { Transfer } from '../../lib/split';
import { money } from '../../lib/money';
import { shortDate } from '../../lib/format';
import { confirmAction, notify } from '../../lib/confirm';
import { upiPayUrl } from '../../lib/upi';
import { canRecordPayment } from '../../lib/permissions';
import { useMemberUpi } from './useMemberUpi';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';
import type { Group, UpiId } from '../../types';

interface Props {
  group: Group;
  transfers: Transfer[];
  names: Record<string, string>;
  meId: string | null;
  onShare: () => void;
}

/**
 * All-time: who pays whom so everyone is even, and the payments already
 * recorded. Under a row, where the money goes: your UPI ids, or (live
 * groups) the other person's from their account, with Copy; when it's you
 * paying, **Pay** opens your UPI app and asks on the way back whether to
 * mark it paid (onlinedb.md §19).
 */
export function SettleTab({ group, transfers, names, meId, onShare }: Props) {
  const { addPayment, deletePayment, restorePayment, upiIds } = useGroups();
  const { showUndo, showNote } = useUndo();
  const t = useTabStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const i18n = useI18n();
  const name = (id: string) => (id === meId ? i18n.t('common.youName', { name: names[id] }) : names[id]);
  const short = (id: string) => (id === meId ? i18n.t('common.you') : names[id]);

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
  const theirUpi = useMemberUpi(group);

  // Back from the UPI app: did the payment go through?
  const paying = useRef<Transfer | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const tr = paying.current;
      if (state !== 'active' || !tr) return;
      paying.current = null;
      // Not yours to mark (e.g. only admins add expenses): don't ask.
      if (!canRecordPayment(group, meId, tr.from, tr.to)) return;
      confirmAction(
        i18n.t('settle.didPayTitle', { name: names[tr.to], amount: money(tr.amount) }),
        i18n.t('settle.didPayBody'),
        i18n.t('settle.markPaid'),
        () => markPaid(tr),
      );
    });
    return () => sub.remove();
  });

  // Several UPI ids: the payer picks which one to pay.
  const [pickUpi, setPickUpi] = useState<{ tr: Transfer; ids: UpiId[] } | null>(null);
  const startPay = (tr: Transfer, ids: UpiId[]) => {
    if (ids.length === 1) void pay(tr, ids[0]);
    else setPickUpi({ tr, ids });
  };

  const pay = async (tr: Transfer, upi: UpiId) => {
    const url = upiPayUrl({
      vpa: upi.vpa,
      // The UPI app shows the payee as they named themselves, not your saved name.
      name: group.members.find((m) => m.id === tr.to)?.name ?? names[tr.to],
      amount: tr.amount,
      note: group.name,
    });
    try {
      paying.current = tr;
      await Linking.openURL(url);
    } catch {
      paying.current = null;
      notify(i18n.t('settle.payTitle'), i18n.t('settle.noUpiApp'));
    }
  };

  const markPaid = (tr: Transfer) => {
    const p = addPayment(group.id, tr);
    showUndo(i18n.t('settle.markedPaid', { from: names[tr.from], to: names[tr.to], amount: money(tr.amount) }), () =>
      deletePayment(group.id, p.id),
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={t.list}>
        {transfers.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={group.expenses.length ? i18n.t('settle.allSettled.title') : i18n.t('settle.nothing.title')}
            body={group.expenses.length ? i18n.t('settle.allSettled.body') : i18n.t('settle.nothing.body')}
          />
        ) : (
          <>
            <Text style={styles.hint}>{i18n.t('settle.explainShort')}</Text>
            {/* One card; each payment a row: who pays, to whom, how much, Paid. */}
            <View style={styles.card}>
              {transfers.map((tr, i) => {
                const iPay = tr.from === meId;
                const iGet = tr.to === meId;
                // Where the money goes: your UPI ids (once, first row paid to you),
                // or theirs from their account (live groups).
                const ids = iGet ? (tr === firstToMe ? upiIds : []) : (theirUpi[tr.to] ?? []);
                // Your payment: straight to the UPI app (phones only; a browser has none).
                const canPay = iPay && !iGet && ids.length > 0 && Platform.OS !== 'web';
                const askUpi = tr === firstToMe && !upiIds.length;
                // Live groups: only the two people in it, or an admin, mark it paid.
                const mayMark = canRecordPayment(group, meId, tr.from, tr.to);
                return (
                  <View key={`${tr.from}-${tr.to}`} style={[styles.row, i > 0 && styles.rowLine]}>
                    <Avatar name={names[tr.from]} size={40} />
                    <View style={styles.middle}>
                      <Text style={styles.payer} numberOfLines={1}>
                        {iPay ? i18n.t('common.you') : names[tr.from]}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {iGet
                          ? i18n.t('settle.paysYou')
                          : iPay
                            ? i18n.t('settle.youPayTo', { name: names[tr.to] })
                            : i18n.t('settle.paysTo', { name: names[tr.to] })}
                      </Text>
                      {askUpi ? (
                        <Text style={styles.upiHint}>{i18n.t('settle.addUpiHint')}</Text>
                      ) : ids.length ? (
                        <View style={styles.upiLine}>
                          {iGet ? <Text style={styles.upiLabel}>{i18n.t('settle.yourUpi')}</Text> : null}
                          {ids.map((u) => (
                            <Pressable
                              key={u.vpa}
                              onPress={() => copy(u.vpa)}
                              hitSlop={6}
                              accessibilityLabel={i18n.t('upi.copy', { id: u.vpa })}
                              style={({ pressed }) => [styles.upi, pressed && t.pressed]}
                            >
                              <Text style={styles.upiText} numberOfLines={1}>
                                {u.vpa}
                              </Text>
                              <Ionicons name="copy-outline" size={12} color={colors.tint} />
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.right}>
                      <Text style={[styles.amount, iPay && styles.neg, iGet && styles.pos]}>{money(tr.amount)}</Text>
                      <View style={styles.actions}>
                        {canPay ? (
                          <Pressable
                            onPress={() => startPay(tr, ids)}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.payBtn, pressed && t.pressed]}
                          >
                            <Text style={styles.payText}>{i18n.t('settle.payShort')}</Text>
                          </Pressable>
                        ) : null}
                        {mayMark ? (
                          <Pressable
                            onPress={() => markPaid(tr)}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('settle.markPaidLabel', {
                              from: names[tr.from],
                              to: names[tr.to],
                              amount: money(tr.amount),
                            })}
                            style={({ pressed }) => [styles.paidBtn, pressed && t.pressed]}
                          >
                            <Ionicons name="checkmark" size={13} color={colors.success} />
                            <Text style={styles.paidText}>{i18n.t('settle.paidShort')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {group.expenses.length ? (
          <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && t.pressed]}>
            <Ionicons name="share-social-outline" size={16} color={colors.tint} />
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
                {/* Undo: the same people who may mark it paid. */}
                {canRecordPayment(group, meId, p.from, p.to) ? (
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
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={!!pickUpi}
        title={i18n.t('settle.pickUpiTitle', {
          name: pickUpi ? names[pickUpi.tr.to] : '',
          amount: pickUpi ? money(pickUpi.tr.amount) : '',
        })}
        options={(pickUpi?.ids ?? []).map((u) => ({ key: u.vpa, icon: 'wallet-outline' as const, title: u.vpa, body: u.label }))}
        onPick={(vpa) => {
          const p = pickUpi;
          setPickUpi(null);
          const upi = p?.ids.find((u) => u.vpa === vpa);
          if (p && upi) void pay(p.tr, upi);
        }}
        onClose={() => setPickUpi(null)}
      />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  hint: {
    fontSize: font.sm - 1,
    color: c.textSecondary,
    marginBottom: spacing(2.5),
    marginHorizontal: spacing(1),
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  middle: { flex: 1, minWidth: 0 },
  payer: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  sub: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  upiLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing(2.5),
    rowGap: 2,
    marginTop: spacing(1),
  },
  upiLabel: { fontSize: font.xs + 1, color: c.textSecondary },
  upi: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  upiText: {
    fontSize: font.xs + 1,
    fontWeight: '600',
    color: c.tint,
    flexShrink: 1,
  },
  upiHint: {
    fontSize: font.xs + 1,
    color: c.textSecondary,
    marginTop: spacing(1),
    lineHeight: 15,
  },
  right: { alignItems: 'flex-end', gap: spacing(1.5) },
  amount: {
    fontSize: font.lg,
    fontWeight: '800',
    color: c.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  neg: { color: c.danger },
  pos: { color: c.success },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: c.success,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
  },
  paidText: { fontSize: font.xs + 1, fontWeight: '700', color: c.success },
  payBtn: {
    backgroundColor: c.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 4,
  },
  payText: { fontSize: font.xs + 1, fontWeight: '700', color: c.onPrimary },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: c.tint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    marginTop: spacing(3),
  },
  shareText: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
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
