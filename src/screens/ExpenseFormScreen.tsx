import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { Segmented } from '../components/Segmented';
import { SectionLabel } from '../components/SectionLabel';
import { PrimaryButton } from '../components/PrimaryButton';
import { DateField } from '../components/DateField';
import { PersonAmountRow } from '../components/PersonAmountRow';
import { SwipeView } from '../components/SwipeView';
import { useGroup, useGroups } from '../context/GroupsContext';
import { allocate } from '../lib/split';
import { evalAmount, isSum, money, paiseToInput, toPaise } from '../lib/money';
import { todayISO } from '../lib/format';
import { clearDraft, loadDraft, saveDraft, type ManyForm, type OneForm } from '../lib/drafts';
import { QuickAddPanel } from './expense/QuickAddPanel';
import { confirmAction } from '../lib/confirm';
import { newId } from '../lib/id';
import { CATEGORIES, categoryOf } from '../data/categories';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { CategoryKey, Expense, SplitMode } from '../types';
import type { ScreenProps } from '../navigation/types';

type CustomMode = Exclude<SplitMode, 'equal'>;
type Texts = Record<string, string>;

const SPLIT_OPTIONS: { key: SplitMode; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: '₹ Exact' },
  { key: 'shares', label: 'Shares' },
  { key: 'percent', label: '%' },
];

const SPLIT_HELP: Record<SplitMode, string> = {
  equal: 'Everyone picked pays the same.',
  exact: 'Type what each person owes. It must add up to the total.',
  shares: 'Give bigger portions more shares, e.g. 2 for someone who ate double.',
  percent: 'Give each person a percentage. It must add up to 100%.',
};

/** Basis points → editable text: 3350 → "33.5". */
const bpToInput = (bp: number) => paiseToInput(bp);

export function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const { saveExpense, deleteExpense } = useGroups();
  const existing = group?.expenses.find((e) => e.id === expenseId);
  const members = group?.members ?? [];
  const allIds = members.map((m) => m.id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amountText, setAmountText] = useState(existing ? paiseToInput(existing.amount) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [note, setNote] = useState(existing?.note ?? '');

  const existingPayers = existing ? Object.keys(existing.payers) : [];
  const [multiPay, setMultiPay] = useState(existingPayers.length > 1);
  const [payer, setPayer] = useState(existingPayers[0] ?? allIds[0] ?? '');
  const [payerTexts, setPayerTexts] = useState<Texts>(() =>
    existingPayers.length > 1 ? mapValues(existing!.payers, paiseToInput) : {},
  );

  const [mode, setMode] = useState<SplitMode>(existing?.splitMode ?? 'equal');
  const [selected, setSelected] = useState<string[]>(
    existing?.splitMode === 'equal' ? existing.splitAmong : allIds,
  );
  // Each custom mode keeps its own entries, so flipping between tabs loses nothing.
  const [values, setValues] = useState<Record<CustomMode, Texts>>(() => {
    const v: Record<CustomMode, Texts> = { exact: {}, shares: {}, percent: {} };
    if (existing && existing.splitMode !== 'equal' && existing.splitValues) {
      const fmt = existing.splitMode === 'shares' ? String : existing.splitMode === 'exact' ? paiseToInput : bpToInput;
      v[existing.splitMode] = mapValues(existing.splitValues, fmt);
    }
    return v;
  });
  const [error, setError] = useState<string | null>(null);

  // ---- "One expense" / "Many at once", and drafts (new expenses only) ----
  const isNew = !existing;
  const [formMode, setFormMode] = useState<'one' | 'many'>('one');
  const [draftReady, setDraftReady] = useState(!isNew);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [manyInitial, setManyInitial] = useState<ManyForm | undefined>();
  const [panelKey, setPanelKey] = useState(0);
  const many = useRef<ManyForm | undefined>(undefined);
  // Set once the expense is added or the draft is thrown away, so leaving
  // the page afterwards doesn't save it again.
  const finished = useRef(false);

  const oneForm: OneForm = useMemo(
    () => ({ title, amountText, category, date, note, multiPay, payer, payerTexts, mode, selected, values }),
    [title, amountText, category, date, note, multiPay, payer, payerTexts, mode, selected, values],
  );
  // Editing: "Update changes" only lights up once something changed.
  const initialForm = useRef(JSON.stringify(oneForm));
  const dirty = JSON.stringify(oneForm) !== initialForm.current;

  const applyOne = (f: OneForm) => {
    const ids = new Set(allIds);
    setTitle(f.title);
    setAmountText(f.amountText);
    setCategory(f.category);
    setDate(f.date);
    setNote(f.note);
    setMultiPay(f.multiPay);
    if (ids.has(f.payer)) setPayer(f.payer);
    setPayerTexts(f.payerTexts);
    setMode(f.mode);
    setSelected(f.selected.filter((id) => ids.has(id)));
    setValues(f.values);
  };

  useEffect(() => {
    if (!isNew) return;
    loadDraft(groupId)
      .then((d) => {
        if (!d) return;
        if (d.one) applyOne(d.one);
        if (d.many) {
          many.current = d.many;
          setManyInitial(d.many);
        }
        setFormMode(d.formMode);
        setRestoredAt(d.savedAt);
      })
      .catch(() => {})
      .finally(() => setDraftReady(true));
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, isNew]);

  const latest = useRef({ formMode, oneForm });
  latest.current = { formMode, oneForm };
  const persist = useCallback(() => {
    if (!isNew || finished.current) return;
    const { formMode: fm, oneForm: one } = latest.current;
    const oneEmpty = !one.title.trim() && !one.amountText.trim() && !one.note.trim();
    const manyEmpty = !many.current?.text.trim();
    if (oneEmpty && manyEmpty) clearDraft(groupId).catch(() => {});
    else
      saveDraft(groupId, {
        formMode: fm,
        ...(oneEmpty ? {} : { one }),
        ...(manyEmpty ? {} : { many: many.current }),
        savedAt: Date.now(),
      }).catch(() => {});
  }, [groupId, isNew]);

  // Save shortly after each change, and right away when leaving the page.
  // A plain timer, not state: setting state on every keystroke from the
  // panel's updates chained renders until React gave up ("Maximum update
  // depth exceeded") when typing fast.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 400);
  }, [persist]);
  useEffect(() => {
    if (draftReady) scheduleSave();
  }, [oneForm, formMode, draftReady, scheduleSave]);
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      persist();
    },
    [persist],
  );

  const onManyChange = useCallback(
    (f: ManyForm) => {
      many.current = f;
      scheduleSave();
    },
    [scheduleSave],
  );

  const discardDraft = () => {
    finished.current = true;
    clearDraft(groupId).catch(() => {});
    applyOne({
      title: '',
      amountText: '',
      category: 'food',
      date: todayISO(),
      note: '',
      multiPay: false,
      payer: allIds[0] ?? '',
      payerTexts: {},
      mode: 'equal',
      selected: allIds,
      values: { exact: {}, shares: {}, percent: {} },
    });
    many.current = undefined;
    setManyInitial(undefined);
    setPanelKey((k) => k + 1);
    setRestoredAt(null);
    // Typing again starts a fresh draft.
    setTimeout(() => (finished.current = false), 0);
  };

  const finish = () => {
    finished.current = true;
    if (isNew) clearDraft(groupId).catch(() => {});
    navigation.goBack();
  };

  if (!group) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>This group no longer exists.</Text>
      </ScreenContainer>
    );
  }

  // Sums like 48+80+64 are added up; a trailing "+" is ignored while typing.
  const amount = evalAmount(amountText.replace(/[+\-*x×\s]+$/i, '')) ?? 0;
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const splitAmong = allIds.filter((id) => selected.includes(id));
  const allSelected = splitAmong.length === allIds.length;

  // ---- live numbers for the hints under each section ----
  const payerSum = sumTexts(payerTexts, toPaise);
  const customTexts = mode === 'equal' ? {} : values[mode];
  const exactSum = sumTexts(values.exact, toPaise);
  const shareWeights: [string, number][] = allIds.map((id) => [id, parseInt(values.shares[id] || '0', 10) || 0]);
  const totalShares = shareWeights.reduce((s, [, w]) => s + w, 0);
  const shareAmounts = amount && totalShares ? allocate(amount, shareWeights.filter(([, w]) => w > 0)) : {};
  const pctSum = sumTexts(values.percent, toPaise);
  const pctAmounts = amount && pctSum
    ? allocate(amount, allIds.map((id) => [id, toPaise(values.percent[id] ?? '') ?? 0] as [string, number]).filter(([, w]) => w > 0))
    : {};

  const setValue = (m: CustomMode, id: string, t: string) =>
    setValues((v) => ({ ...v, [m]: { ...v[m], [id]: t } }));

  const changeMode = (m: SplitMode) => {
    setMode(m);
    setError(null);
    // Shares only make sense with a starting point: one share each.
    if (m === 'shares' && Object.keys(values.shares).length === 0) {
      setValues((v) => ({ ...v, shares: Object.fromEntries(allIds.map((id) => [id, '1'])) }));
    }
  };

  /** Fills the exact/percent fields with an even split. */
  const fillEvenly = () => {
    if (mode === 'exact') {
      if (!amount) return setError('Enter the total amount first.');
      const parts = allocate(amount, allIds.map((id) => [id, 1]));
      setValues((v) => ({ ...v, exact: mapValues(parts, paiseToInput) }));
    } else if (mode === 'percent') {
      const parts = allocate(10000, allIds.map((id) => [id, 1]));
      setValues((v) => ({ ...v, percent: mapValues(parts, bpToInput) }));
    }
    setError(null);
  };

  const togglePayerMode = () => {
    if (!multiPay && amount) {
      // Start from "the one payer paid it all" so the numbers already add up.
      setPayerTexts({ [payer]: paiseToInput(amount) });
    }
    setMultiPay(!multiPay);
    setError(null);
  };

  const save = () => {
    if (amountText.trim() && evalAmount(amountText) == null) return setError("The amount can't be read. Use numbers with + - or x.");
    if (!amount || amount <= 0) return setError('Enter how much was spent.');

    // Who paid
    let payers: Record<string, number> = {};
    if (multiPay) {
      for (const m of members) {
        const text = payerTexts[m.id]?.trim();
        if (!text) continue;
        const v = toPaise(text);
        if (v == null) return setError(`${m.name}'s paid amount isn't a valid number.`);
        if (v > 0) payers[m.id] = v;
      }
      if (Object.keys(payers).length === 0) return setError('Enter how much each person paid.');
      const paid = Object.values(payers).reduce((s, v) => s + v, 0);
      if (paid !== amount) return setError(`Paid amounts add up to ${money(paid)}, but the expense is ${money(amount)}.`);
    } else {
      if (!payer) return setError('Pick who paid.');
      payers = { [payer]: amount };
    }

    // How it's split
    let split: Pick<Expense, 'splitMode' | 'splitAmong' | 'splitValues'>;
    if (mode === 'equal') {
      if (splitAmong.length === 0) return setError('Pick at least one person to split with.');
      split = { splitMode: 'equal', splitAmong };
    } else {
      const parsed: Record<string, number> = {};
      for (const m of members) {
        const text = values[mode][m.id]?.trim();
        if (!text) continue;
        const v = mode === 'shares' ? (/^\d+$/.test(text) ? parseInt(text, 10) : null) : toPaise(text);
        if (v == null) return setError(`${m.name}'s ${mode === 'shares' ? 'shares' : 'amount'} isn't a valid number.`);
        if (v > 0) parsed[m.id] = v;
      }
      const ids = Object.keys(parsed);
      if (ids.length === 0) return setError('Give at least one person a part of this expense.');
      const total = Object.values(parsed).reduce((s, v) => s + v, 0);
      if (mode === 'exact' && total !== amount) {
        return setError(`Shares add up to ${money(total)}, but the expense is ${money(amount)}.`);
      }
      if (mode === 'percent' && total !== 10000) {
        return setError(`Percentages add up to ${bpToInput(total)}%, they need to make 100%.`);
      }
      split = { splitMode: mode, splitAmong: allIds.filter((id) => id in parsed), splitValues: parsed };
    }

    const trimmedNote = note.trim();
    saveExpense(group.id, {
      id: existing?.id ?? newId(),
      title: title.trim() || categoryOf(category).label,
      amount,
      category,
      payers,
      ...split,
      date,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      createdAt: existing?.createdAt ?? Date.now(),
    });
    finish();
  };

  const remove = () => {
    if (!existing) return;
    confirmAction('Delete expense?', `"${existing.title}" will be removed.`, 'Delete', () => {
      deleteExpense(group.id, existing.id);
      navigation.goBack();
    });
  };

  const perHead = amount && splitAmong.length ? Math.floor(amount / splitAmong.length) : 0;
  const uneven = !!amount && splitAmong.length > 0 && amount % splitAmong.length !== 0;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isNew ? (
          <View style={styles.modeSwitch}>
            <Segmented
              options={[
                { key: 'one', label: 'One expense' },
                { key: 'many', label: 'Many at once' },
              ]}
              value={formMode}
              onChange={setFormMode}
            />
          </View>
        ) : null}

        {restoredAt ? (
          <View style={styles.draftBanner}>
            <Text style={styles.draftText}>Draft restored from where you left off.</Text>
            <Pressable onPress={discardDraft} hitSlop={8}>
              <Text style={styles.link}>Discard</Text>
            </Pressable>
          </View>
        ) : null}

        {isNew && formMode === 'many' ? (
          draftReady ? (
            <QuickAddPanel key={panelKey} group={group} initial={manyInitial} onChange={onManyChange} onDone={finish} />
          ) : null
        ) : (
          <>
            <View style={styles.amountCard}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={(t) => setAmountText(t.replace(/[^0-9.+\-*x×]/gi, ''))}
                placeholder="0"
                placeholderTextColor={colors.border}
                keyboardType="decimal-pad"
                autoFocus={isNew && formMode === 'one' && !restoredAt}
                maxLength={60}
                multiline
              />
              {/* The number keyboard has no "+", so sums get a button. */}
              <Pressable
                onPress={() => setAmountText((t) => (t && !/[+\-*x×]$/i.test(t) ? `${t}+` : t))}
                style={styles.plusBtn}
                hitSlop={6}
                accessibilityLabel="Add another amount"
              >
                <Text style={styles.plusText}>+</Text>
              </Pressable>
            </View>
            {isSum(amountText) ? (
              <Text style={styles.sumHint}>{amount ? `= ${money(amount)}` : "Can't add that up yet"}</Text>
            ) : null}

            <Input
              label="What was it for?"
              placeholder="e.g. Boat ride, Rice, Ice cream"
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />

            <SectionLabel>Date</SectionLabel>
            <DateField value={date} onChange={setDate} />

            <SectionLabel>Category</SectionLabel>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip key={c.key} label={c.label} icon={c.icon} selected={category === c.key} onPress={() => setCategory(c.key)} />
              ))}
            </View>

            {/* ---------- Paid by ---------- */}
            <View style={styles.sectionHead}>
              <SectionLabel>Paid by</SectionLabel>
              <Pressable onPress={togglePayerMode} hitSlop={8}>
                <Text style={styles.link}>{multiPay ? 'One person paid' : 'More than one person paid?'}</Text>
              </Pressable>
            </View>
            {multiPay ? (
              <View style={styles.box}>
                {members.map((m) => (
                  <PersonAmountRow
                    key={m.id}
                    name={m.name}
                    prefix="₹"
                    value={payerTexts[m.id] ?? ''}
                    onChangeText={(t) => setPayerTexts((s) => ({ ...s, [m.id]: t }))}
                  />
                ))}
                <Remaining assigned={payerSum} total={amount} format={money} />
              </View>
            ) : (
              <View style={styles.chips}>
                {members.map((m) => (
                  <Chip key={m.id} label={m.name} selected={payer === m.id} onPress={() => setPayer(m.id)} />
                ))}
              </View>
            )}

            {/* ---------- Split ---------- */}
            <SectionLabel>Split</SectionLabel>
            <Segmented options={SPLIT_OPTIONS} value={mode} onChange={changeMode} />
            {/* Swipe left/right here to change the split mode. */}
            <SwipeView
              index={SPLIT_OPTIONS.findIndex((o) => o.key === mode)}
              count={SPLIT_OPTIONS.length}
              onIndexChange={(i) => changeMode(SPLIT_OPTIONS[i].key)}
              fill={false}
            >
              <Text style={styles.help}>{SPLIT_HELP[mode]}</Text>

              {mode === 'equal' ? (
                <View style={styles.box}>
                  <View style={styles.boxHead}>
                    <Text style={styles.boxInfo}>
                      {splitAmong.length
                        ? `${splitAmong.length} of ${members.length} people${amount ? ` · ${uneven ? '~' : ''}${money(perHead)} each` : ''}`
                        : 'Nobody selected'}
                    </Text>
                    <Pressable onPress={() => setSelected(allSelected ? [] : allIds)} hitSlop={8}>
                      <Text style={styles.link}>{allSelected ? 'Clear' : 'Everyone'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.chipsTight}>
                    {members.map((m) => (
                      <Chip
                        key={m.id}
                        label={m.name}
                        selected={selected.includes(m.id)}
                        onPress={() =>
                          setSelected((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.box}>
                  {mode !== 'shares' ? (
                    <Pressable onPress={fillEvenly} hitSlop={8} style={styles.fill}>
                      <Text style={styles.link}>Fill evenly</Text>
                    </Pressable>
                  ) : null}
                  {members.map((m) => (
                    <PersonAmountRow
                      key={m.id}
                      name={m.name}
                      value={customTexts[m.id] ?? ''}
                      onChangeText={(t) => setValue(mode, m.id, t)}
                      prefix={mode === 'exact' ? '₹' : undefined}
                      suffix={mode === 'percent' ? '%' : mode === 'shares' ? 'x' : undefined}
                      integer={mode === 'shares'}
                      hint={
                        mode === 'shares' && shareAmounts[m.id]
                          ? money(shareAmounts[m.id])
                          : mode === 'percent' && pctAmounts[m.id]
                            ? money(pctAmounts[m.id])
                            : undefined
                      }
                    />
                  ))}
                  {mode === 'exact' ? <Remaining assigned={exactSum} total={amount} format={money} /> : null}
                  {mode === 'percent' ? <Remaining assigned={pctSum} total={10000} format={(bp) => `${bpToInput(bp)}%`} /> : null}
                  {mode === 'shares' ? (
                    <Text style={[styles.remaining, styles.muted]}>
                      {totalShares
                        ? `${totalShares} shares${amount ? ` · ${money(Math.floor(amount / totalShares))} per share` : ''}`
                        : 'Give someone at least 1 share'}
                    </Text>
                  ) : null}
                </View>
              )}
            </SwipeView>

            <Input
              label="Note (optional)"
              placeholder="Anything to remember, e.g. bill no. or who it was for"
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
              style={styles.note}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              label={existing ? 'Update changes' : 'Add expense'}
              onPress={save}
              disabled={!!existing && !dirty}
              style={styles.saveBtn}
            />
            {existing ? <PrimaryButton label="Delete expense" variant="danger" onPress={remove} style={styles.deleteBtn} /> : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Remaining({ assigned, total, format }: { assigned: number; total: number; format: (n: number) => string }) {
  const left = total - assigned;
  return (
    <Text style={[styles.remaining, left === 0 && total > 0 ? styles.ok : styles.bad]}>
      {total === 0
        ? 'Enter the total first'
        : left === 0
          ? 'All of it is assigned ✓'
          : left > 0
            ? `${format(left)} left to assign`
            : `${format(-left)} too much`}
    </Text>
  );
}

function mapValues<T, U>(r: Record<string, T>, fn: (v: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fn(v)]));
}

function sumTexts(texts: Texts, parse: (t: string) => number | null) {
  return Object.values(texts).reduce((s, t) => s + (parse(t) ?? 0), 0);
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
  modeSwitch: { marginBottom: spacing(4) },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(4),
  },
  draftText: { flex: 1, fontSize: font.sm + 1, color: colors.textPrimary },
  plusBtn: {
    position: 'absolute',
    right: spacing(4),
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 24, fontWeight: '700', color: colors.primary, marginTop: -2 },
  sumHint: { textAlign: 'center', fontSize: font.md, fontWeight: '700', color: colors.primary, marginTop: -spacing(3), marginBottom: spacing(5) },
  rupee: { fontSize: 34, fontWeight: '700', color: colors.textSecondary, marginRight: spacing(1) },
  amountInput: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 80,
    maxWidth: '75%',
    textAlign: 'center',
    padding: 0,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(5) },
  chipsTight: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  help: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing(2) },
  box: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    marginTop: spacing(2),
    marginBottom: spacing(5),
  },
  boxHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  boxInfo: { fontSize: font.sm + 1, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  fill: { alignSelf: 'flex-end', marginBottom: spacing(1) },
  link: { color: colors.primary, fontWeight: '700', fontSize: font.sm + 1 },
  remaining: { marginTop: spacing(3), fontSize: font.sm + 1, fontWeight: '700', textAlign: 'right' },
  ok: { color: colors.success },
  bad: { color: colors.danger },
  muted: { color: colors.textSecondary },
  note: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: font.sm + 1, marginBottom: spacing(3), fontWeight: '600' },
  saveBtn: { marginTop: spacing(2) },
  deleteBtn: { marginTop: spacing(3) },
});
