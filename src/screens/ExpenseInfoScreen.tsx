import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { useSync } from '../context/SyncContext';
import { loadEvents } from '../lib/storage';
import { describeEvent, type ActivityEvent, type ActivityLine } from '../lib/activity';
import { money } from '../lib/money';
import { longDate, shortDate } from '../lib/format';
import { categoryOf } from '../data/categories';
import { dateLocale } from '../i18n';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

/** The server keeps at most this many Activity lines per group (onlinedb.md §10.8). */
const KEPT = 1000;

interface Row {
  key: string;
  line: ActivityLine;
  at: number;
}

/**
 * ⋮ → Info on an expense: its own history, oldest first. In a live group,
 * from the group's Activity: who added it, every edit (with what changed),
 * archive and unarchive, a delete brought back. A group on this phone only
 * has no such log: just when it was added here.
 */
export function ExpenseInfoScreen({ route }: ScreenProps<'ExpenseInfo'>) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const { names: shown } = useGroups();
  const { syncNow } = useSync();
  const { isOpen } = useLock();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const expense = group?.expenses.find((e) => e.id === expenseId);
  const live = !!group?.online;
  const [events, setEvents] = useState<ActivityEvent[] | null>(live ? null : []);

  // Fresh on opening; read again whenever a sync changes the group.
  useEffect(() => {
    if (live) void syncNow();
  }, [live, syncNow]);
  useEffect(() => {
    if (!live) return;
    let current = true;
    loadEvents(groupId, KEPT)
      .then((list) => {
        if (!current) return;
        const mine = list.filter((e) => e.type.startsWith('expense_') && e.data.id === expenseId);
        setEvents(mine.sort((a, b) => a.seq - b.seq));
      })
      .catch(() => current && setEvents([]));
    return () => {
      current = false;
    };
  }, [groupId, expenseId, live, group]);

  const rows = useMemo((): Row[] => {
    if (!group || !events) return [];
    const names = shown.all(group);
    return events.map((e) => ({ key: e.id, line: describeEvent(e, (id) => names[id]), at: e.createdAt }));
    // Language changes the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, events, lang, shown]);

  if (!group || !expense || !isOpen(group.id)) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>
          {!group ? t('common.missingGroup') : !expense ? t('expense.missing') : t('lock.title')}
        </Text>
      </ScreenContainer>
    );
  }

  // Where the log doesn't start with the expense being added (a group on this phone, an
  // expense from before the group went online, or one older than the server keeps): when
  // it was added, from the expense itself.
  const started = !!events?.some((e) => e.type === 'expense_added' && !e.data.restored);
  const addedRow: Row | null =
    events && !started
      ? {
          key: 'added',
          line: { icon: 'add-circle-outline', text: live ? t('expInfo.added') : t('expInfo.addedHere') },
          at: expense.createdAt,
        }
      : null;
  const list = addedRow ? [addedRow, ...rows] : rows;
  const cat = categoryOf(expense.category);
  const when = (ms: number) =>
    `${shortDate(ms)}, ${new Date(ms).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View style={styles.catIcon}>
            <Ionicons name={cat.icon} size={20} color={colors.tint} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={2}>
              {expense.title}
            </Text>
            <Text style={styles.meta}>
              {money(expense.amount)} · {longDate(expense.date)}
            </Text>
          </View>
        </View>

        {live ? (
          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.tint} />
            <Text style={styles.noteText}>{t('activity.note')}</Text>
          </View>
        ) : null}

        <Text style={styles.heading}>{t('expInfo.history')}</Text>
        {list.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={r.line.icon} size={17} color={colors.tint} />
            </View>
            <View style={styles.body}>
              <Text style={styles.text}>{r.line.text}</Text>
              {r.line.detail ? <Text style={styles.detail}>{r.line.detail}</Text> : null}
              <Text style={styles.time}>{when(r.at)}</Text>
            </View>
          </View>
        ))}

        {events && !started ? (
          <Text style={styles.foot}>{live ? t('expInfo.olderNote') : t('expInfo.localNote')}</Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  missing: { textAlign: 'center', marginTop: spacing(16), marginHorizontal: spacing(8), color: c.textSecondary, lineHeight: 21 },
  flex: { flex: 1, minWidth: 0 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2),
  },
  noteText: { flex: 1, fontSize: font.sm - 1, color: c.textSecondary, lineHeight: 17 },
  heading: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing(3),
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(1.5),
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  body: { flex: 1, minWidth: 0 },
  text: { fontSize: font.sm + 1, color: c.textPrimary, lineHeight: 19 },
  detail: { fontSize: font.sm - 1, color: c.textSecondary, marginTop: 2 },
  time: { fontSize: font.xs, color: c.textSecondary, marginTop: spacing(1) },
  foot: { fontSize: font.sm - 1, color: c.textSecondary, lineHeight: 17, marginTop: spacing(2), paddingHorizontal: spacing(1) },
}));
