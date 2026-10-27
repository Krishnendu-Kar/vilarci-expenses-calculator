import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { Avatar } from '../components/Avatar';
import { Segmented } from '../components/Segmented';
import { SectionLabel } from '../components/SectionLabel';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroup, useGroups } from '../context/GroupsContext';
import { money, paiseToInput, toPaise } from '../lib/money';
import { confirmAction } from '../lib/confirm';
import { newId } from '../lib/id';
import { CATEGORIES, categoryOf } from '../data/categories';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { CategoryKey, Expense, SplitMode } from '../types';
import type { ScreenProps } from '../navigation/types';

export function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const { saveExpense, deleteExpense } = useGroups();
  const existing = group?.expenses.find((e) => e.id === expenseId);
  const members = group?.members ?? [];

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amountText, setAmountText] = useState(existing ? paiseToInput(existing.amount) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'food');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? members[0]?.id ?? '');
  const [mode, setMode] = useState<SplitMode>(existing?.splitMode ?? 'equal');
  const [selected, setSelected] = useState<string[]>(existing?.splitAmong ?? members.map((m) => m.id));
  const [exactTexts, setExactTexts] = useState<Record<string, string>>(() => {
    if (existing?.splitMode !== 'exact') return {};
    const out: Record<string, string> = {};
    for (const [id, amt] of Object.entries(existing.exactShares ?? {})) out[id] = paiseToInput(amt);
    return out;
  });
  const [error, setError] = useState<string | null>(null);

  const amount = toPaise(amountText);
  // Keep the member order stable regardless of tap order.
  const splitAmong = members.map((m) => m.id).filter((id) => selected.includes(id));

  const exactSum = useMemo(
    () => Object.values(exactTexts).reduce((s, t) => s + (toPaise(t) ?? 0), 0),
    [exactTexts],
  );

  if (!group) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>This group no longer exists.</Text>
      </ScreenContainer>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = splitAmong.length === members.length;

  const save = () => {
    if (amount == null || amount <= 0) return setError('Enter how much was spent.');
    if (!paidBy) return setError('Pick who paid.');

    let expense: Expense;
    const base = {
      id: existing?.id ?? newId(),
      title: title.trim() || categoryOf(category).label,
      amount,
      category,
      paidBy,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    if (mode === 'equal') {
      if (splitAmong.length === 0) return setError('Pick at least one person to split with.');
      expense = { ...base, splitMode: 'equal', splitAmong };
    } else {
      const shares: Record<string, number> = {};
      for (const m of members) {
        const text = exactTexts[m.id]?.trim();
        if (!text) continue;
        const v = toPaise(text);
        if (v == null) return setError(`${m.name}'s amount isn't a valid number.`);
        if (v > 0) shares[m.id] = v;
      }
      const sum = Object.values(shares).reduce((s, v) => s + v, 0);
      if (sum !== amount) {
        return setError(`Shares add up to ${money(sum)}, but the expense is ${money(amount)}.`);
      }
      expense = { ...base, splitMode: 'exact', splitAmong: Object.keys(shares), exactShares: shares };
    }
    saveExpense(group.id, expense);
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    confirmAction('Delete expense?', `"${existing.title}" will be removed.`, 'Delete', () => {
      deleteExpense(group.id, existing.id);
      navigation.goBack();
    });
  };

  // Paise that don't divide evenly go one each to the first few people.
  const perHead = amount && splitAmong.length ? Math.floor(amount / splitAmong.length) : 0;
  const unevenSplit = !!amount && splitAmong.length > 0 && amount % splitAmong.length !== 0;
  const remaining = (amount ?? 0) - exactSum;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.amountCard}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.border}
            keyboardType="decimal-pad"
            autoFocus={!existing}
            maxLength={10}
          />
        </View>

        <Input
          label="What was it for?"
          placeholder="e.g. Boat ride, Rice, Ice cream"
          value={title}
          onChangeText={setTitle}
          maxLength={50}
        />

        <SectionLabel>Category</SectionLabel>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} icon={c.icon} selected={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </View>

        <SectionLabel>Paid by</SectionLabel>
        <View style={styles.chips}>
          {members.map((m) => (
            <Chip key={m.id} label={m.name} selected={paidBy === m.id} onPress={() => setPaidBy(m.id)} />
          ))}
        </View>

        <SectionLabel>Split</SectionLabel>
        <Segmented
          options={[
            { key: 'equal', label: 'Equally' },
            { key: 'exact', label: 'Exact amounts' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'equal' ? (
          <View style={styles.splitBox}>
            <View style={styles.splitHeader}>
              <Text style={styles.splitInfo}>
                {splitAmong.length
                  ? `${splitAmong.length} of ${members.length} people${amount ? ` · ${unevenSplit ? '~' : ''}${money(perHead)} each` : ''}`
                  : 'Nobody selected'}
              </Text>
              <Pressable
                onPress={() => setSelected(allSelected ? [] : members.map((m) => m.id))}
                hitSlop={8}
              >
                <Text style={styles.link}>{allSelected ? 'Clear' : 'Everyone'}</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {members.map((m) => (
                <Chip key={m.id} label={m.name} selected={selected.includes(m.id)} onPress={() => toggle(m.id)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.splitBox}>
            {members.map((m) => (
              <View key={m.id} style={styles.exactRow}>
                <Avatar name={m.name} size={30} />
                <Text style={styles.exactName} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.exactRupee}>₹</Text>
                <TextInput
                  style={styles.exactInput}
                  value={exactTexts[m.id] ?? ''}
                  onChangeText={(t) => setExactTexts((s) => ({ ...s, [m.id]: t.replace(/[^0-9.]/g, '') }))}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
              </View>
            ))}
            <Text style={[styles.remaining, remaining === 0 ? styles.ok : styles.bad]}>
              {remaining === 0
                ? 'All of it is assigned ✓'
                : remaining > 0
                  ? `${money(remaining)} left to assign`
                  : `${money(-remaining)} too much`}
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton label={existing ? 'Save changes' : 'Add expense'} onPress={save} style={styles.saveBtn} />
        {existing ? <PrimaryButton label="Delete expense" variant="danger" onPress={remove} style={styles.deleteBtn} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  missing: { textAlign: 'center', marginTop: spacing(16), color: colors.textSecondary },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(5),
    marginBottom: spacing(5),
  },
  rupee: { fontSize: 34, fontWeight: '700', color: colors.textSecondary, marginRight: spacing(1) },
  amountInput: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(5) },
  splitBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    marginTop: spacing(3),
    marginBottom: spacing(4),
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  splitInfo: { fontSize: font.sm + 1, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  link: { color: colors.primary, fontWeight: '700', fontSize: font.sm + 1 },
  exactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exactName: { flex: 1, fontSize: font.md, color: colors.textPrimary, fontWeight: '600' },
  exactRupee: { fontSize: font.md, color: colors.textSecondary },
  exactInput: {
    width: 100,
    textAlign: 'right',
    fontSize: font.md + 1,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
  },
  remaining: { marginTop: spacing(3), fontSize: font.sm + 1, fontWeight: '700', textAlign: 'right' },
  ok: { color: colors.success },
  bad: { color: colors.danger },
  error: { color: colors.danger, fontSize: font.sm + 1, marginBottom: spacing(3), fontWeight: '600' },
  saveBtn: { marginTop: spacing(2) },
  deleteBtn: { marginTop: spacing(3) },
});
