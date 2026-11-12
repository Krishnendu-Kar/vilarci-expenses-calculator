import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActionSheet } from '../../components/ActionSheet';
import { EmptyState } from '../../components/EmptyState';
import { useGroups } from '../../context/GroupsContext';
import { useOpenGroups } from '../../context/LockContext';
import { myNets } from '../../lib/people';
import { isSettled } from '../../lib/split';
import { money } from '../../lib/money';
import { groupKindOf } from '../../data/categories';
import { kindTint } from '../../theme/colors';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import type { Group } from '../../types';

interface Props {
  /** The search box above: matches group names. */
  query: string;
  onOpen: (groupId: string) => void;
}

/**
 * Balances → Groups: every open group with who you are in it and where you
 * stand. "Who are you here?" picks your member in a group that's only on
 * this phone; in a live group you are your account, so there's no choice.
 */
export function GroupBalances({ query, onOpen }: Props) {
  const { profile, meMap, setMe } = useGroups();
  const { groups: openGroups } = useOpenGroups();
  const styles = useStyles();
  const { dark } = useTheme();
  const { t } = useI18n();
  const [pickFor, setPickFor] = useState<Group | null>(null);

  const rows = useMemo(() => myNets(openGroups, profile, meMap), [openGroups, profile, meMap]);
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.group.name.toLowerCase().includes(q)) : rows;

  return (
    <>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.group.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          // Plain, like the note on the People tab.
          <Text style={styles.note}>
            {!profile.name.trim() && rows.some((r) => !r.me) ? `${t('profile.setNameFirst')} ` : ''}
            {t('lock.notCounted')}
          </Text>
        }
        ListEmptyComponent={
          // A View, not a fragment: the list passes onLayout to this element.
          <View>
            {rows.length ? (
              <EmptyState icon="search-outline" title={t('members.noMatch.title')} body={t('people.noGroupMatch', { query: query.trim() })} />
            ) : (
              <EmptyState icon="albums-outline" title={t('profile.noGroups')} body="" />
            )}
          </View>
        }
        renderItem={({ item: { group, me, net }, index }) => {
          const tint = kindTint(group.kind, dark);
          const meName = group.members.find((m) => m.id === me)?.name;
          return (
            <Pressable
              onPress={() => onOpen(group.id)}
              style={({ pressed }) => [
                styles.row,
                index === 0 && styles.first,
                index === shown.length - 1 && styles.last,
                index > 0 && styles.rowLine,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                <Ionicons name={groupKindOf(group.kind).icon} size={17} color={tint.fg} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {group.name}
                </Text>
                {group.online ? (
                  // A live group knows you by your account: nothing to pick or change.
                  me ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('profile.youAreLive', { name: meName ?? '' })}
                    </Text>
                  ) : null
                ) : (
                  // Only on this phone: whose side the numbers are shown from.
                  <Pressable onPress={() => setPickFor(group)} hitSlop={8}>
                    <Text style={me ? styles.meta : styles.ask} numberOfLines={1}>
                      {me ? t('profile.youAre', { name: meName ?? '' }) : t('profile.whoAreYou')}
                    </Text>
                  </Pressable>
                )}
              </View>
              {net === null ? null : isSettled(net) ? (
                <Text style={styles.settled}>{t('common.settled')}</Text>
              ) : (
                <Text style={[styles.amount, net > 0 ? styles.pos : styles.neg]}>
                  {net > 0 ? '+' : '−'}
                  {money(Math.abs(net))}
                </Text>
              )}
            </Pressable>
          );
        }}
      />

      <ActionSheet
        visible={!!pickFor}
        title={t('profile.pickTitle', { name: pickFor?.name ?? '' })}
        subtitle={t('profile.pickSubtitle')}
        options={(pickFor?.members ?? []).map((m) => ({ key: m.id, icon: 'person-outline', title: m.name }))}
        onPick={(memberId) => {
          if (pickFor) setMe(pickFor.id, memberId);
          setPickFor(null);
        }}
        onClose={() => setPickFor(null)}
      />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing(3), paddingTop: spacing(2.5), paddingBottom: spacing(12) },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  note: { fontSize: font.sm, color: c.textSecondary, marginHorizontal: spacing(2), marginBottom: spacing(3), lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    backgroundColor: c.surface,
  },
  first: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  last: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
  rowLine: { borderTopWidth: 1, borderTopColor: c.background },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  ask: { fontSize: font.sm, color: c.tint, fontWeight: '700', marginTop: 1 },
  amount: { fontSize: font.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  settled: { fontSize: font.sm, color: c.textSecondary },
  pos: { color: c.success },
  neg: { color: c.danger },
}));
