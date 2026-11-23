import React, { useLayoutEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { DISPLAY_FONT, GOLD } from '../components/LuxeCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { MoreButton } from '../components/MoreButton';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { useMenu } from '../context/MenuContext';
import { activeIn, counted, expenseShares } from '../lib/split';
import { can } from '../lib/permissions';
import { resolveMe } from '../lib/people';
import { expenseMonth } from '../lib/months';
import { money, paiseToInput } from '../lib/money';
import { longDate, monthLabel } from '../lib/format';
import { splitShort } from '../lib/describe';
import { categoryOf } from '../data/categories';
import { FormSection } from './expense/FormSection';
import { useExpenseMenu } from './expense/useExpenseMenu';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One expense, to read: who paid, who it's split between and each person's
 * part. Everyone in the group can open it, also where only admins may change
 * expenses; the pencil at the top right (when you may) opens the Edit page,
 * and ⋮ beside it has the expense's menu, with Info (its history).
 */
export function ExpenseScreen({ navigation, route }: ScreenProps<'Expense'>) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const { names: shown, profile, meMap } = useGroups();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const expense = group?.expenses.find((e) => e.id === expenseId);
  const editable = !!group && !!expense && can('edit_expenses', group);
  // A shared link can land here without passing the group page: a locked group asks first.
  const { isOpen, open } = useLock();
  const closed = !!group && !isOpen(group.id);
  const unlock = () => {
    if (group) void open(group.id, t('lock.promptOpen', { name: group.name }));
  };

  // ⋮ at the top right: the same menu as on the expense in the group's list (Info, Share,
  // Copy link, and for editors Make a copy, Pin, Archive, Delete). Deleting closes this page.
  const menu = useExpenseMenu(group, () => navigation.goBack());
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const { openMenu } = useMenu();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        group && expense && !closed
          ? () => (
              <View style={styles.headerActions}>
                {editable ? (
                  <Pressable
                    onPress={() => navigation.navigate('ExpenseForm', { groupId, expenseId })}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('expense.editTitle')}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.white} />
                  </Pressable>
                ) : null}
                <MoreButton
                  size={22}
                  color={colors.white}
                  hitSlop={12}
                  onOpen={(anchor) =>
                    openMenu(anchor, menuRef.current.items(expense), (key) => menuRef.current.pick(expense, key))
                  }
                />
              </View>
            )
          : () => null,
    });
  }, [navigation, group, expense, closed, editable, groupId, expenseId, colors, styles, t, openMenu]);

  if (!group || !expense) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>{group ? t('expense.missing') : t('common.missingGroup')}</Text>
      </ScreenContainer>
    );
  }

  if (closed) {
    return (
      <ScreenContainer>
        <View style={styles.locked}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={34} color={colors.tint} />
          </View>
          <Text style={styles.lockedTitle}>{t('lock.title')}</Text>
          <Text style={styles.lockedBody}>{t('lock.body')}</Text>
          <PrimaryButton label={t('lock.unlockButton')} onPress={unlock} style={styles.unlockBtn} />
        </View>
      </ScreenContainer>
    );
  }

  const names = shown.all(group);
  const meId = resolveMe(group, profile, meMap[group.id]);
  const nameOf = (id: string) => {
    const name = names[id] ?? '?';
    return id === meId ? t('common.youName', { name }) : name;
  };
  // In the group's order, so the lists read the same as everywhere else.
  const order = (ids: string[]) => {
    const pos = new Map(group.members.map((m, i) => [m.id, i]));
    return [...ids].sort((a, b) => (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9));
  };

  const cat = categoryOf(expense.category);
  const archived = !counted(expense);
  const shares = expenseShares(expense);
  const payers = order(Object.keys(expense.payers));
  const among = order(expense.splitAmong);
  const hostelMonth = group.kind === 'hostel' && expense.month ? expenseMonth(expense) : null;
  // Live groups where only admins change expenses: say why there's no pencil.
  const adminsOnly = group.online?.status === 'active' && !editable;

  /** What each person's part was set as, beside the amount: "2x", "33.5%". */
  const setAs = (id: string) => {
    const v = expense.splitValues?.[id];
    if (v == null) return null;
    if (expense.splitMode === 'shares') return `${v}x`;
    if (expense.splitMode === 'percent') return `${paiseToInput(v)}%`;
    return null;
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {/* The header colour carries on into the amount, like the Add expense page. */}
        <View style={styles.hero}>
          <View style={styles.catIcon}>
            <Ionicons name={cat.icon} size={22} color={GOLD} />
          </View>
          <Text style={styles.title}>{expense.title}</Text>
          <Text style={[styles.amount, archived && styles.struck]} numberOfLines={1} adjustsFontSizeToFit>
            {money(expense.amount)}
          </Text>
          <Text style={styles.meta}>
            {cat.label} · {longDate(expense.date)}
          </Text>
          {expense.pinnedAt != null || archived || hostelMonth ? (
            <View style={styles.tags}>
              {expense.pinnedAt != null && !archived ? <Tag icon="pin" label={t('expenses.pinned')} /> : null}
              {archived ? <Tag icon="archive-outline" label={t('expenses.archivedTag')} /> : null}
              {hostelMonth ? <Tag icon="calendar-clear-outline" label={t('expenses.forMonth', { month: monthLabel(hostelMonth) })} /> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {archived ? (
            <View style={styles.banner}>
              <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.bannerText}>{t('expense.archivedBanner')}</Text>
            </View>
          ) : null}
          {adminsOnly ? (
            <View style={styles.banner}>
              <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.bannerText}>{t('expenses.onlyAdmins')}</Text>
            </View>
          ) : null}

          <FormSection icon="wallet-outline" title={t('expense.paidBy')}>
            {payers.map((id, i) => (
              <PersonLine key={id} name={nameOf(id)} amount={expense.payers[id]} me={id === meId} first={i === 0} />
            ))}
          </FormSection>

          <FormSection icon="git-branch-outline" title={t('expense.split')}>
            <Text style={styles.splitHow}>{capitalize(splitShort(expense, activeIn(group).length))}</Text>
            {among.map((id, i) => (
              <PersonLine
                key={id}
                name={nameOf(id)}
                amount={shares[id] ?? 0}
                detail={setAs(id)}
                me={id === meId}
                first={i === 0}
              />
            ))}
          </FormSection>

          {expense.note ? (
            <FormSection icon="document-text-outline" title={t('expense.noteHeading')}>
              <Text style={styles.note} selectable>
                {expense.note}
              </Text>
            </FormSection>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function PersonLine({
  name,
  amount,
  detail,
  me,
  first,
}: {
  name: string;
  amount: number;
  detail?: string | null;
  me: boolean;
  first: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.person, !first && styles.personLine]}>
      <Avatar name={name} size={32} />
      <Text style={[styles.personName, me && styles.mine]} numberOfLines={1}>
        {name}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <Text style={[styles.personAmount, me && styles.mine]}>{money(amount)}</Text>
    </View>
  );
}

function Tag({ icon, label }: { icon: 'pin' | 'archive-outline' | 'calendar-clear-outline'; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={12} color={GOLD} />
      <Text style={styles.tagText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingBottom: spacing(12) },
  missing: { textAlign: 'center', marginTop: spacing(16), marginHorizontal: spacing(8), color: c.textSecondary, lineHeight: 21 },
  pressed: { opacity: 0.6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(5) },
  locked: { alignItems: 'center', paddingTop: spacing(20), paddingHorizontal: spacing(8) },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  lockedTitle: { fontSize: font.xl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
  lockedBody: { fontSize: font.md, color: c.textSecondary, textAlign: 'center', marginTop: spacing(2), lineHeight: 21 },
  unlockBtn: { alignSelf: 'stretch', marginTop: spacing(6) },
  hero: {
    backgroundColor: c.header,
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
    paddingBottom: spacing(5),
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: { color: c.white, fontSize: font.lg, fontWeight: '700', textAlign: 'center', marginTop: spacing(2.5) },
  amount: { color: c.white, fontFamily: DISPLAY_FONT, fontSize: 44, lineHeight: 52, marginTop: spacing(1), maxWidth: '100%' },
  struck: { textDecorationLine: 'line-through', opacity: 0.7 },
  meta: { color: c.white, opacity: 0.75, fontSize: font.sm, marginTop: spacing(0.5), textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(2), marginTop: spacing(3) },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tagText: { color: c.white, fontSize: font.xs + 1, fontWeight: '700' },
  body: { paddingHorizontal: spacing(3.5), paddingTop: spacing(3) },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(3),
  },
  bannerText: { flex: 1, fontSize: font.sm + 1, color: c.textPrimary, lineHeight: 19 },
  splitHow: { fontSize: font.sm + 1, color: c.textSecondary, fontWeight: '600', marginBottom: spacing(1) },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5) },
  personLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  personName: { flex: 1, fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  detail: { fontSize: font.sm, fontWeight: '600', color: c.textSecondary, fontVariant: ['tabular-nums'] },
  personAmount: { fontSize: font.md, fontWeight: '700', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  mine: { color: c.tint, fontWeight: '800' },
  note: { fontSize: font.md, color: c.textPrimary, lineHeight: 22 },
}));
