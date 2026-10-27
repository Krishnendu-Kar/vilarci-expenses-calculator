import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Segmented } from '../components/Segmented';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { SectionLabel } from '../components/SectionLabel';
import { useGroup, useGroups } from '../context/GroupsContext';
import {
  computeBalances,
  expenseShares,
  groupTotal,
  isSettled,
  suggestTransfers,
  type MemberBalance,
  type Transfer,
} from '../lib/split';
import { money } from '../lib/money';
import { plural, shortDate } from '../lib/format';
import { confirmAction } from '../lib/confirm';
import { categoryOf } from '../data/categories';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { Expense, Group } from '../types';
import type { ScreenProps } from '../navigation/types';

type Tab = 'expenses' | 'balances' | 'settle';

export function GroupDetailScreen({ navigation, route }: ScreenProps<'GroupDetail'>) {
  const group = useGroup(route.params.groupId);
  const [tab, setTab] = useState<Tab>('expenses');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
      headerRight: () =>
        group ? (
          <Pressable onPress={() => navigation.navigate('GroupForm', { groupId: group.id })} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={colors.white} />
          </Pressable>
        ) : null,
    });
  }, [navigation, group]);

  const balances = useMemo(() => (group ? computeBalances(group) : []), [group]);
  const transfers = useMemo(() => suggestTransfers(balances), [balances]);

  if (!group) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>This group no longer exists.</Text>
      </ScreenContainer>
    );
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
  const total = groupTotal(group);

  return (
    <ScreenContainer>
      <View style={styles.top}>
        <View style={styles.summary}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total spent</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Per person avg</Text>
            <Text style={styles.summaryValue}>{money(Math.round(total / group.members.length))}</Text>
          </View>
        </View>
        <Segmented
          options={[
            { key: 'expenses', label: `Expenses (${group.expenses.length})` },
            { key: 'balances', label: 'Balances' },
            { key: 'settle', label: transfers.length ? `Settle (${transfers.length})` : 'Settle up' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'expenses' ? (
        <ExpensesTab
          group={group}
          names={names}
          onOpen={(e) => navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: e.id })}
        />
      ) : tab === 'balances' ? (
        <BalancesTab balances={balances} names={names} />
      ) : (
        <SettleTab group={group} transfers={transfers} names={names} />
      )}

      {tab === 'expenses' ? (
        <Fab label="Add expense" onPress={() => navigation.navigate('ExpenseForm', { groupId: group.id })} />
      ) : null}
    </ScreenContainer>
  );
}

function ExpensesTab({
  group,
  names,
  onOpen,
}: {
  group: Group;
  names: Record<string, string>;
  onOpen: (e: Expense) => void;
}) {
  const sorted = useMemo(() => [...group.expenses].sort((a, b) => b.createdAt - a.createdAt), [group.expenses]);
  return (
    <FlatList
      data={sorted}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No expenses yet"
          body="Add what each person paid for — travel, food, rice, a boat ride for just 3 of you — and pick who it's for."
        />
      }
      renderItem={({ item }) => {
        const cat = categoryOf(item.category);
        const everyone = item.splitAmong.length === group.members.length;
        const splitText =
          item.splitMode === 'exact'
            ? `custom split, ${plural(item.splitAmong.length, 'person')}`
            : everyone
              ? 'split with everyone'
              : `split ${item.splitAmong.length} ways`;
        return (
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.catIcon}>
              <Ionicons name={cat.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {names[item.paidBy] ?? '?'} paid · {splitText}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>{money(item.amount)}</Text>
              <Text style={styles.rowDate}>{shortDate(item.createdAt)}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function BalancesTab({ balances, names }: { balances: MemberBalance[]; names: Record<string, string> }) {
  const sorted = [...balances].sort((a, b) => b.net - a.net);
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.explain}>
        "Paid" is what each person spent for the group. "Share" is their fair part of the expenses they were in.
      </Text>
      {sorted.map((b) => (
        <View key={b.memberId} style={styles.row}>
          <Avatar name={names[b.memberId]} />
          <View style={[styles.rowBody, styles.avatarGap]}>
            <Text style={styles.rowTitle}>{names[b.memberId]}</Text>
            <Text style={styles.rowMeta}>
              Paid {money(b.paid)} · Share {money(b.share)}
              {b.sent ? ` · Sent ${money(b.sent)}` : ''}
              {b.received ? ` · Got ${money(b.received)}` : ''}
            </Text>
          </View>
          <View style={styles.rowRight}>
            {isSettled(b.net) ? (
              <Text style={styles.settled}>settled</Text>
            ) : (
              <>
                <Text style={[styles.rowAmount, b.net > 0 ? styles.pos : styles.neg]}>{money(Math.abs(b.net))}</Text>
                <Text style={[styles.rowDate, b.net > 0 ? styles.pos : styles.neg]}>{b.net > 0 ? 'gets back' : 'owes'}</Text>
              </>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function SettleTab({
  group,
  transfers,
  names,
}: {
  group: Group;
  transfers: Transfer[];
  names: Record<string, string>;
}) {
  const { addPayment, deletePayment } = useGroups();

  const share = () => {
    const total = groupTotal(group);
    const lines = [
      `${group.name} — expense summary`,
      `Total spent: ${money(total)} by ${plural(group.members.length, 'person')}`,
      '',
      ...group.expenses
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((e) => {
          const shares = expenseShares(e);
          const who = e.splitAmong.length === group.members.length ? 'everyone' : e.splitAmong.map((id) => names[id]).join(', ');
          return `• ${e.title}: ${money(e.amount)} paid by ${names[e.paidBy]} for ${who}${
            e.splitMode === 'exact' ? ` (${e.splitAmong.map((id) => `${names[id]} ${money(shares[id])}`).join(', ')})` : ''
          }`;
        }),
      '',
      transfers.length ? 'To settle up:' : 'Everyone is settled up 🎉',
      ...transfers.map((t) => `→ ${names[t.from]} pays ${names[t.to]} ${money(t.amount)}`),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
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
          <Text style={styles.explain}>
            The fewest payments that make everyone even. Tap "Paid" once the money has actually been sent.
          </Text>
          {transfers.map((t) => (
            <View key={`${t.from}-${t.to}`} style={styles.transfer}>
              <View style={styles.transferPeople}>
                <Avatar name={names[t.from]} size={32} />
                <View style={styles.transferText}>
                  <Text style={styles.transferLine} numberOfLines={2}>
                    <Text style={styles.bold}>{names[t.from]}</Text> pays <Text style={styles.bold}>{names[t.to]}</Text>
                  </Text>
                  <Text style={styles.transferAmount}>{money(t.amount)}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => addPayment(group.id, t)}
                style={({ pressed }) => [styles.paidBtn, pressed && styles.pressed]}
              >
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.paidText}>Paid</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      {group.expenses.length ? (
        <Pressable onPress={share} style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}>
          <Ionicons name="share-social-outline" size={18} color={colors.primary} />
          <Text style={styles.shareText}>Share summary</Text>
        </Pressable>
      ) : null}

      {group.payments.length ? (
        <View style={styles.history}>
          <SectionLabel>Payments recorded</SectionLabel>
          {group.payments.map((p) => (
            <View key={p.id} style={styles.payment}>
              <Ionicons name="swap-horizontal" size={18} color={colors.success} />
              <Text style={styles.paymentText} numberOfLines={2}>
                {names[p.from]} paid {names[p.to]} <Text style={styles.bold}>{money(p.amount)}</Text>
                <Text style={styles.rowDate}> · {shortDate(p.createdAt)}</Text>
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
  missing: { textAlign: 'center', marginTop: spacing(16), color: colors.textSecondary },
  top: { paddingHorizontal: spacing(4), paddingTop: spacing(4), paddingBottom: spacing(2) },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing(4),
    marginBottom: spacing(4),
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: colors.white, opacity: 0.75, fontSize: font.xs + 1, fontWeight: '600', letterSpacing: 0.4 },
  summaryValue: { color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  list: { padding: spacing(4), paddingBottom: spacing(28) },
  explain: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing(3), lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  avatarGap: { marginLeft: spacing(3) },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.md + 1, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: spacing(2) },
  rowAmount: { fontSize: font.md + 1, fontWeight: '800', color: colors.textPrimary },
  rowDate: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  pos: { color: colors.success },
  neg: { color: colors.danger },
  settled: { fontSize: font.sm, fontWeight: '700', color: colors.textSecondary },
  transfer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  transferPeople: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  transferText: { flex: 1, marginLeft: spacing(3) },
  transferLine: { fontSize: font.md, color: colors.textPrimary },
  transferAmount: { fontSize: font.lg, fontWeight: '800', color: colors.primary, marginTop: 2 },
  bold: { fontWeight: '700' },
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
