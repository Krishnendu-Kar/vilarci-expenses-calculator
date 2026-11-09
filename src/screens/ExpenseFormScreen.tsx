import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { Segmented } from '../components/Segmented';
import { PrimaryButton } from '../components/PrimaryButton';
import { DateField } from '../components/DateField';
import { MonthPicker } from '../components/MonthPicker';
import { DISPLAY_FONT, GOLD } from '../components/LuxeCard';
import { PersonAmountRow } from '../components/PersonAmountRow';
import { SwipeView } from '../components/SwipeView';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { allocate } from '../lib/split';
import { lastPickableMonth, monthOf } from '../lib/months';
import { evalAmount, isSum, money, paiseToInput, toPaise } from '../lib/money';
import { monthLabel, todayISO } from '../lib/format';
import { clearDraft, loadDraft, saveDraft, type ManyForm, type OneForm } from '../lib/drafts';
import { QuickAddPanel } from './expense/QuickAddPanel';
import { CategoryTiles } from './expense/CategoryTiles';
import { FormSection } from './expense/FormSection';
import { confirmAction } from '../lib/confirm';
import { newId } from '../lib/id';
import { categoryOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { CategoryKey, Expense, SplitMode } from '../types';
import type { ScreenProps } from '../navigation/types';

type CustomMode = Exclude<SplitMode, 'equal'>;
type Texts = Record<string, string>;

const SPLIT_OPTIONS: { key: SplitMode; label: Key; help: Key }[] = [
  { key: 'equal', label: 'expense.mode.equal', help: 'expense.help.equal' },
  { key: 'exact', label: 'expense.mode.exact', help: 'expense.help.exact' },
  { key: 'shares', label: 'expense.mode.shares', help: 'expense.help.shares' },
  { key: 'percent', label: 'expense.mode.percent', help: 'expense.help.percent' },
];

/** Basis points → editable text: 3350 → "33.5". */
const bpToInput = (bp: number) => paiseToInput(bp);

export function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const { saveExpense, deleteExpense } = useGroups();
  const { showUndo } = useUndo();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const existing = group?.expenses.find((e) => e.id === expenseId);
  const members = group?.members ?? [];
  const allIds = members.map((m) => m.id);
  const hostel = group?.kind === 'hostel';

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amountText, setAmountText] = useState(existing ? paiseToInput(existing.amount) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date ?? route.params.date ?? todayISO());
  // Hostel/flat groups: a month picked by hand ("counts for"); null follows the date.
  const [monthPick, setMonthPick] = useState<string | null>(existing?.month ?? null);
  const [monthOpen, setMonthOpen] = useState(false);
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
  // Hostel/flat groups: on when this expense's monthly repeat is still running.
  const [repeat, setRepeat] = useState(
    () => !!existing?.recurringId && !!group?.recurring?.some((r) => r.id === existing.recurringId),
  );
  const [error, setError] = useState<string | null>(null);

  // ---- "Paste from chat", and drafts (new expenses only) ----
  const isNew = !existing;
  // Paste from chat was converted: its preview takes the place of the form.
  const [chat, setChat] = useState(false);
  const onConvert = useCallback(() => setChat(true), []);
  const onClearChat = useCallback(() => setChat(false), []);
  const [draftReady, setDraftReady] = useState(!isNew);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [manyInitial, setManyInitial] = useState<ManyForm | undefined>();
  const [panelKey, setPanelKey] = useState(0);
  const many = useRef<ManyForm | undefined>(undefined);
  // Set once the expense is added or the draft is thrown away, so leaving
  // the page afterwards doesn't save it again.
  const finished = useRef(false);

  const oneForm: OneForm = useMemo(
    () => ({ title, amountText, category, date, month: monthPick, note, multiPay, payer, payerTexts, mode, selected, values, repeat }),
    [title, amountText, category, date, monthPick, note, multiPay, payer, payerTexts, mode, selected, values, repeat],
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
    setMonthPick(f.month ?? null);
    setNote(f.note);
    setMultiPay(f.multiPay);
    if (ids.has(f.payer)) setPayer(f.payer);
    setPayerTexts(f.payerTexts);
    setMode(f.mode);
    setSelected(f.selected.filter((id) => ids.has(id)));
    setValues(f.values);
    setRepeat(!!f.repeat && hostel);
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
        // 'many': the chat had been converted (the old "Many at once" tab saved it too).
        setChat(d.formMode === 'many' && !!d.many?.text.trim());
        setRestoredAt(d.savedAt);
      })
      .catch(() => {})
      .finally(() => setDraftReady(true));
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, isNew]);

  const latest = useRef({ chat, oneForm });
  latest.current = { chat, oneForm };
  const persist = useCallback(() => {
    if (!isNew || finished.current) return;
    const { chat: converted, oneForm: one } = latest.current;
    const oneEmpty = !one.title.trim() && !one.amountText.trim() && !one.note.trim();
    const manyEmpty = !many.current?.text.trim();
    if (oneEmpty && manyEmpty) clearDraft(groupId).catch(() => {});
    else
      saveDraft(groupId, {
        formMode: converted ? 'many' : 'one',
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
  }, [oneForm, chat, draftReady, scheduleSave]);
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
      date: route.params.date ?? todayISO(),
      month: null,
      note: '',
      multiPay: false,
      payer: allIds[0] ?? '',
      payerTexts: {},
      mode: 'equal',
      selected: allIds,
      values: { exact: {}, shares: {}, percent: {} },
      repeat: false,
    });
    many.current = undefined;
    setManyInitial(undefined);
    setPanelKey((k) => k + 1);
    setChat(false);
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
        <Text style={styles.missing}>{t('common.missingGroup')}</Text>
      </ScreenContainer>
    );
  }

  const countsFor = monthPick ?? monthOf(date);

  // Sums like 48+80+64 are added up; a trailing "+" is ignored while typing.
  const amount = evalAmount(amountText.replace(/[+\-*x×\s]+$/i, '')) ?? 0;
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

  const setValue = (m: CustomMode, id: string, v: string) =>
    setValues((s) => ({ ...s, [m]: { ...s[m], [id]: v } }));

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
      if (!amount) return setError(t('expense.errEnterTotalFirst'));
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
    if (amountText.trim() && evalAmount(amountText) == null) return setError(t('expense.errRead'));
    if (!amount || amount <= 0) return setError(t('expense.errAmount'));

    // Who paid
    let payers: Record<string, number> = {};
    if (multiPay) {
      for (const m of members) {
        const text = payerTexts[m.id]?.trim();
        if (!text) continue;
        const v = toPaise(text);
        if (v == null) return setError(t('expense.errPaidInvalid', { name: m.name }));
        if (v > 0) payers[m.id] = v;
      }
      if (Object.keys(payers).length === 0) return setError(t('expense.errPaidEmpty'));
      const paid = Object.values(payers).reduce((s, v) => s + v, 0);
      if (paid !== amount) return setError(t('expense.errPaidSum', { paid: money(paid), amount: money(amount) }));
    } else {
      if (!payer) return setError(t('expense.errPickPayer'));
      payers = { [payer]: amount };
    }

    // How it's split
    let split: Pick<Expense, 'splitMode' | 'splitAmong' | 'splitValues'>;
    if (mode === 'equal') {
      if (splitAmong.length === 0) return setError(t('expense.errPickSplit'));
      split = { splitMode: 'equal', splitAmong };
    } else {
      const parsed: Record<string, number> = {};
      for (const m of members) {
        const text = values[mode][m.id]?.trim();
        if (!text) continue;
        const v = mode === 'shares' ? (/^\d+$/.test(text) ? parseInt(text, 10) : null) : toPaise(text);
        if (v == null) return setError(t(mode === 'shares' ? 'expense.errShares' : 'expense.errValue', { name: m.name }));
        if (v > 0) parsed[m.id] = v;
      }
      const ids = Object.keys(parsed);
      if (ids.length === 0) return setError(t('expense.errNoPart'));
      const total = Object.values(parsed).reduce((s, v) => s + v, 0);
      if (mode === 'exact' && total !== amount) {
        return setError(t('expense.errExactSum', { total: money(total), amount: money(amount) }));
      }
      if (mode === 'percent' && total !== 10000) {
        return setError(t('expense.errPercentSum', { total: bpToInput(total) }));
      }
      split = { splitMode: mode, splitAmong: allIds.filter((id) => id in parsed), splitValues: parsed };
    }

    const trimmedNote = note.trim();
    saveExpense(
      group.id,
      {
        id: existing?.id ?? newId(),
        title: title.trim() || categoryOf(category).label,
        amount,
        category,
        payers,
        ...split,
        date,
        // Only when it isn't the date's own month.
        ...(countsFor !== monthOf(date) ? { month: countsFor } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        ...(existing?.recurringId ? { recurringId: existing.recurringId } : {}),
        ...(existing?.pinnedAt != null ? { pinnedAt: existing.pinnedAt } : {}),
        ...(existing?.archivedAt != null ? { archivedAt: existing.archivedAt } : {}),
        createdAt: existing?.createdAt ?? Date.now(),
      },
      hostel ? { repeat } : undefined,
    );
    finish();
  };

  const remove = () => {
    if (!existing) return;
    confirmAction(t('expense.deleteTitle'), t('expense.deleteBody', { name: existing.title }), t('common.delete'), () => {
      deleteExpense(group.id, existing.id);
      navigation.goBack();
      showUndo(t('expense.deleted', { name: existing.title }), () => saveExpense(group.id, existing));
    });
  };

  const perHead = amount && splitAmong.length ? Math.floor(amount / splitAmong.length) : 0;
  const uneven = !!amount && splitAmong.length > 0 && amount % splitAmong.length !== 0;
  // Exactly what each person is charged, the same way the balances work it out.
  const equalShares = amount && splitAmong.length ? allocate(amount, splitAmong.map((id) => [id, 1])) : {};
  const repeatDay = Number(date.slice(8, 10));
  const showForm = !(isNew && chat);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {showForm ? (
          // The header colour carries on into the amount, like the group page.
          <View style={styles.hero}>
            <View style={styles.amountRow}>
              <View style={styles.side} />
              <View style={styles.amountCenter}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountText}
                  onChangeText={(v) => setAmountText(v.replace(/[^0-9.+\-*x×]/gi, ''))}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  selectionColor={GOLD}
                  keyboardType="decimal-pad"
                  keyboardAppearance={dark ? 'dark' : 'light'}
                  autoFocus={isNew && !chat && !restoredAt}
                  maxLength={60}
                  // Grows for long sums on phones; a browser's text area would start two lines tall.
                  multiline={Platform.OS !== 'web'}
                  accessibilityLabel={t('expense.amount')}
                />
              </View>
              {/* The number keyboard has no "+", so sums get a button. */}
              <Pressable
                onPress={() => setAmountText((v) => (v && !/[+\-*x×]$/i.test(v) ? `${v}+` : v))}
                style={({ pressed }) => [styles.plusBtn, pressed && styles.glassPressed]}
                hitSlop={6}
                accessibilityLabel={t('expense.addAnother')}
              >
                <Ionicons name="add" size={22} color={colors.white} />
              </Pressable>
            </View>
            {isSum(amountText) ? (
              <Text style={styles.sumHint}>{amount ? t('expense.sumEquals', { amount: money(amount) }) : t('expense.sumBad')}</Text>
            ) : null}
            <View style={styles.titleField}>
              <View style={styles.titleIcon}>
                <Ionicons name={categoryOf(category).icon} size={16} color={GOLD} />
              </View>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder={t('expense.what')}
                placeholderTextColor="rgba(255,255,255,0.6)"
                selectionColor={GOLD}
                keyboardAppearance={dark ? 'dark' : 'light'}
                maxLength={50}
                accessibilityLabel={t('expense.what')}
              />
            </View>
          </View>
        ) : null}

        <View style={[styles.body, !showForm && styles.bodyTop]}>
          {restoredAt ? (
            <View style={styles.banner}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.bannerText}>{t('expense.draftRestored')}</Text>
              <Pressable onPress={discardDraft} hitSlop={8}>
                <Text style={styles.link}>{t('expense.discard')}</Text>
              </Pressable>
            </View>
          ) : null}

          {existing?.archivedAt != null ? (
            <View style={styles.banner}>
              <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.bannerText}>{t('expense.archivedBanner')}</Text>
            </View>
          ) : null}

          {isNew && draftReady ? (
            <QuickAddPanel
              key={panelKey}
              group={group}
              initial={manyInitial}
              converted={chat}
              onConvert={onConvert}
              onClear={onClearChat}
              onChange={onManyChange}
              onDone={finish}
            />
          ) : null}

          {showForm ? (
            <>
              <FormSection icon="pricetags-outline" title={t('expense.category')}>
                <CategoryTiles value={category} onChange={setCategory} />
              </FormSection>

              <FormSection icon="calendar-outline" title={t('expense.details')}>
                <DateField value={date} onChange={setDate} />
                {hostel ? (
                  <>
                    <Text style={styles.fieldLabel}>{t('expense.countsFor')}</Text>
                    <Pressable
                      onPress={() => setMonthOpen(true)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.monthField, pressed && styles.pressed]}
                    >
                      <Ionicons name="calendar-clear-outline" size={18} color={colors.tint} />
                      <Text style={styles.monthText}>{monthLabel(countsFor)}</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Text style={styles.monthHint}>
                      {countsFor !== monthOf(date)
                        ? t('expense.countsForOther', { month: monthLabel(countsFor) })
                        : t('expense.countsForHint')}
                    </Text>
                  </>
                ) : null}
                <Text style={styles.fieldLabel}>{t('expense.note')}</Text>
                <TextInput
                  style={styles.note}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('expense.notePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardAppearance={dark ? 'dark' : 'light'}
                  maxLength={200}
                  multiline
                  textAlignVertical="top"
                />
              </FormSection>

              <FormSection
                icon="wallet-outline"
                title={t('expense.paidBy')}
                right={
                  <Pressable onPress={togglePayerMode} hitSlop={8}>
                    <Text style={styles.link}>{multiPay ? t('expense.onePaid') : t('expense.multiPaid')}</Text>
                  </Pressable>
                }
              >
                {multiPay ? (
                  <>
                    {members.map((m) => (
                      <PersonAmountRow
                        key={m.id}
                        name={m.name}
                        prefix="₹"
                        value={payerTexts[m.id] ?? ''}
                        onChangeText={(v) => setPayerTexts((s) => ({ ...s, [m.id]: v }))}
                      />
                    ))}
                    <Remaining assigned={payerSum} total={amount} format={money} />
                  </>
                ) : (
                  <View style={styles.payers} accessibilityRole="radiogroup">
                    {members.map((m) => {
                      const on = payer === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setPayer(m.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={({ pressed }) => [styles.payer, on && styles.payerOn, pressed && styles.pressed]}
                        >
                          <View style={[styles.ring, on && styles.ringOn]}>
                            <Avatar name={m.name} size={26} />
                          </View>
                          <Text style={[styles.payerName, on && styles.payerNameOn]} numberOfLines={1}>
                            {m.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </FormSection>

              <FormSection icon="git-branch-outline" title={t('expense.split')}>
                <Segmented options={SPLIT_OPTIONS.map((o) => ({ key: o.key, label: t(o.label) }))} value={mode} onChange={changeMode} />
                {/* Swipe left/right here to change the split mode. */}
                <SwipeView
                  index={SPLIT_OPTIONS.findIndex((o) => o.key === mode)}
                  count={SPLIT_OPTIONS.length}
                  onIndexChange={(i) => changeMode(SPLIT_OPTIONS[i].key)}
                  fill={false}
                >
                  <Text style={styles.help}>{t(SPLIT_OPTIONS.find((o) => o.key === mode)!.help)}</Text>

                  {mode === 'equal' ? (
                    <View>
                      <View style={styles.splitHead}>
                        <Text style={styles.splitInfo}>
                          {splitAmong.length
                            ? `${t('expense.pickedOf', { picked: splitAmong.length, total: members.length })}${
                                amount ? ` · ${t('expense.each', { amount: `${uneven ? '~' : ''}${money(perHead)}` })}` : ''
                              }`
                            : t('expense.nobody')}
                        </Text>
                        <Pressable onPress={() => setSelected(allSelected ? [] : allIds)} hitSlop={8}>
                          <Text style={styles.link}>{allSelected ? t('common.clear') : t('expense.everyone')}</Text>
                        </Pressable>
                      </View>
                      {members.map((m, i) => {
                        const on = selected.includes(m.id);
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => setSelected((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                            style={({ pressed }) => [styles.person, i > 0 && styles.personLine, pressed && styles.pressed]}
                          >
                            <Avatar name={m.name} size={32} />
                            <Text style={[styles.personName, !on && styles.personOff]} numberOfLines={1}>
                              {m.name}
                            </Text>
                            {on && equalShares[m.id] != null ? <Text style={styles.personShare}>{money(equalShares[m.id])}</Text> : null}
                            <View style={[styles.check, on && styles.checkOn]}>
                              {on ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View>
                      {mode !== 'shares' ? (
                        <Pressable onPress={fillEvenly} hitSlop={8} style={styles.fill}>
                          <Text style={styles.link}>{t('expense.fillEvenly')}</Text>
                        </Pressable>
                      ) : null}
                      {members.map((m) => (
                        <PersonAmountRow
                          key={m.id}
                          name={m.name}
                          value={customTexts[m.id] ?? ''}
                          onChangeText={(v) => setValue(mode, m.id, v)}
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
                            ? `${t('count.share', { count: totalShares })}${
                                amount ? ` · ${t('expense.perShare', { amount: money(Math.floor(amount / totalShares)) })}` : ''
                              }`
                            : t('expense.needShare')}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </SwipeView>
              </FormSection>

              {hostel ? (
                <View style={styles.repeatRow}>
                  <View style={styles.repeatIcon}>
                    <Ionicons name="repeat" size={18} color={colors.tint} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.repeatTitle}>{t('expense.repeat')}</Text>
                    <Text style={styles.repeatHint}>
                      {repeat && existing?.recurringId ? t('expense.repeatEditHint') : t('expense.repeatHint', { day: repeatDay })}
                    </Text>
                  </View>
                  <Switch
                    value={repeat}
                    onValueChange={setRepeat}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={repeat ? colors.primary : colors.surface}
                    ios_backgroundColor={colors.border}
                  />
                </View>
              ) : null}

              {error ? (
                <View style={styles.error}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={existing ? t('expense.update') : t('expense.add')}
                onPress={save}
                disabled={!!existing && !dirty}
              />
              {existing ? <PrimaryButton label={t('expense.delete')} variant="danger" onPress={remove} style={styles.deleteBtn} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <MonthPicker
        visible={monthOpen}
        title={t('expense.countsFor')}
        value={countsFor}
        max={lastPickableMonth()}
        onPick={(m) => {
          // Picking the date's own month goes back to following the date.
          setMonthPick(m === monthOf(date) ? null : m);
          setMonthOpen(false);
        }}
        onClose={() => setMonthOpen(false)}
      />
    </ScreenContainer>
  );
}

function Remaining({ assigned, total, format }: { assigned: number; total: number; format: (n: number) => string }) {
  const styles = useStyles();
  const { t } = useI18n();
  const left = total - assigned;
  return (
    <Text style={[styles.remaining, left === 0 && total > 0 ? styles.ok : styles.bad]}>
      {total === 0
        ? t('expense.enterTotal')
        : left === 0
          ? t('expense.allAssigned')
          : left > 0
            ? t('expense.left', { amount: format(left) })
            : t('expense.tooMuch', { amount: format(-left) })}
    </Text>
  );
}

function mapValues<T, U>(r: Record<string, T>, fn: (v: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fn(v)]));
}

function sumTexts(texts: Texts, parse: (t: string) => number | null) {
  return Object.values(texts).reduce((s, t) => s + (parse(t) ?? 0), 0);
}

const useStyles = makeStyles((c) => ({
  content: { paddingBottom: spacing(12) },
  missing: { textAlign: 'center', marginTop: spacing(16), color: c.textSecondary },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  // Same colour as the header bar above it, rounded off at the bottom.
  hero: {
    backgroundColor: c.header,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    paddingBottom: spacing(6),
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  side: { width: 40 },
  amountCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rupee: { fontFamily: DISPLAY_FONT, fontSize: 30, color: GOLD, marginRight: spacing(1.5) },
  amountInput: {
    fontFamily: DISPLAY_FONT,
    fontSize: 48,
    color: c.white,
    minWidth: 60,
    maxWidth: '85%',
    textAlign: 'center',
    padding: 0,
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glassPressed: { backgroundColor: 'rgba(255,255,255,0.26)' },
  sumHint: { textAlign: 'center', fontSize: font.md, fontWeight: '700', color: GOLD, marginTop: spacing(1) },
  titleField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    marginTop: spacing(5),
    paddingLeft: spacing(1.5),
    paddingRight: spacing(4),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  titleInput: { flex: 1, color: c.white, fontSize: font.md + 1, fontWeight: '600', paddingVertical: spacing(3), paddingHorizontal: 0 },
  body: { paddingHorizontal: spacing(4), paddingTop: spacing(5) },
  bodyTop: { paddingTop: spacing(4) },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(4),
  },
  bannerText: { flex: 1, fontSize: font.sm + 1, color: c.textPrimary },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  fieldLabel: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing(4),
    marginBottom: spacing(2),
  },
  monthField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  monthText: { flex: 1, fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  monthHint: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(1.5), lineHeight: 18 },
  note: {
    minHeight: 64,
    backgroundColor: c.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    fontSize: font.md,
    color: c.textPrimary,
  },
  payers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  payer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingLeft: spacing(1),
    paddingRight: spacing(3.5),
    paddingVertical: spacing(1),
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  payerOn: { backgroundColor: c.primary, borderColor: c.primary },
  // On the maroon fill, a white ring keeps a maroon avatar visible.
  ring: { borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: c.white },
  payerName: { fontSize: font.sm + 1, fontWeight: '600', color: c.textPrimary, maxWidth: 140 },
  payerNameOn: { color: c.onPrimary, fontWeight: '700' },
  help: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(3), marginBottom: spacing(2), lineHeight: 18 },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2), paddingVertical: spacing(1) },
  splitInfo: { fontSize: font.sm + 1, color: c.textSecondary, fontWeight: '600', flex: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5) },
  personLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  personName: { flex: 1, fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  personOff: { color: c.textSecondary, fontWeight: '500' },
  personShare: { fontSize: font.md, fontWeight: '700', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.primary, borderColor: c.primary },
  fill: { alignSelf: 'flex-end', marginBottom: spacing(1) },
  remaining: { marginTop: spacing(3), fontSize: font.sm + 1, fontWeight: '700', textAlign: 'right' },
  ok: { color: c.success },
  bad: { color: c.danger },
  muted: { color: c.textSecondary },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  repeatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatTitle: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  repeatHint: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.dangerBg,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    marginBottom: spacing(4),
  },
  errorText: { flex: 1, color: c.danger, fontSize: font.sm + 1, fontWeight: '600' },
  deleteBtn: { marginTop: spacing(3) },
}));
