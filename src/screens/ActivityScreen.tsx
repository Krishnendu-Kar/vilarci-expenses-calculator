import React, { useEffect, useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { useGroup } from '../context/GroupsContext';
import { useSync } from '../context/SyncContext';
import { loadEvents } from '../lib/storage';
import { markActivitySeen } from './group/activitySeen';
import { describeEvent, type ActivityEvent } from '../lib/activity';
import { dayLabel, toISODate } from '../lib/format';
import { dateLocale } from '../i18n';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

/**
 * A live group's Activity (onlinedb.md §18): every change, who made it and
 * when, in this phone's time, newest first. The server writes each line in
 * the same step as the change, so nobody can fake or hide one.
 */
export function ActivityScreen({ route }: ScreenProps<'Activity'>) {
  const group = useGroup(route.params.groupId);
  const { syncNow } = useSync();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  // Fresh on opening; read again whenever a sync changes the group.
  useEffect(() => {
    void syncNow();
  }, [syncNow]);
  useEffect(() => {
    loadEvents(route.params.groupId)
      .then((list) => {
        setEvents(list);
        // On screen, so seen: the bell's dot goes.
        if (list[0]) void markActivitySeen(route.params.groupId, list[0].seq);
      })
      .catch(() => setEvents([]));
  }, [route.params.groupId, group]);

  const sections = useMemo(() => {
    if (!group || !events) return [];
    const names = new Map(group.members.map((m) => [m.id, m.name]));
    const byDay = new Map<string, { e: ActivityEvent; line: ReturnType<typeof describeEvent> }[]>();
    for (const e of events) {
      const day = toISODate(new Date(e.createdAt));
      const list = byDay.get(day) ?? [];
      list.push({ e, line: describeEvent(e, (id) => names.get(id)) });
      byDay.set(day, list);
    }
    return [...byDay].map(([day, data]) => ({ title: dayLabel(day), data }));
    // Language changes the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, events, lang]);

  const time = (ms: number) => new Date(ms).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' });

  return (
    <ScreenContainer>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.e.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.tint} />
            <Text style={styles.noteText}>{t('activity.note')}</Text>
          </View>
        }
        ListEmptyComponent={
          // A View, not a fragment: the list passes onLayout to this element.
          <View>{events ? <EmptyState icon="notifications-outline" title={t('activity.title')} body={t('activity.empty')} /> : null}</View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item: { e, line } }) => (
          <View style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={line.icon} size={17} color={colors.tint} />
            </View>
            <View style={styles.body}>
              <Text style={styles.text}>{line.text}</Text>
              {line.detail ? <Text style={styles.detail}>{line.detail}</Text> : null}
            </View>
            <Text style={styles.time}>{time(e.createdAt)}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  list: { padding: spacing(4), paddingBottom: spacing(12) },
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
  day: {
    fontSize: font.sm,
    fontWeight: '700',
    color: c.textSecondary,
    marginTop: spacing(4),
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
  time: { fontSize: font.xs, color: c.textSecondary, marginTop: 2 },
}));
