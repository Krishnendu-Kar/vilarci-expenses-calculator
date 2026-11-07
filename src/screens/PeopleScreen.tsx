import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { SearchBar } from '../components/SearchBar';
import { useGroups } from '../context/GroupsContext';
import { groupsWith, netsFor, totals } from '../lib/people';
import { searchMembers } from '../lib/search';
import { money } from '../lib/money';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { TabProps } from '../navigation/types';

/** Everyone from every group, once. Tap someone to see their groups or rename them everywhere. */
export function PeopleScreen({ navigation }: TabProps<'People'>) {
  const { groups, people, profile } = useGroups();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const list = people.map((p) => {
      const nets = netsFor(groups, p.id);
      return { ...p, groups: groupsWith(groups, p.id), ...totals(nets) };
    });
    // You first, then by name.
    return list.sort((a, b) => Number(b.id === profile.personId) - Number(a.id === profile.personId) || a.name.localeCompare(b.name));
  }, [groups, people, profile.personId]);
  const shown = searchMembers(rows, query);

  return (
    <ScreenContainer tabs>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          people.length ? (
            <View>
              <SearchBar value={query} onChangeText={setQuery} placeholder={t('people.search')} />
              <Text style={styles.explain}>{t('people.explain')}</Text>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View>
            {people.length ? (
              <EmptyState icon="search-outline" title={t('members.noMatch.title')} body={t('members.noMatch.body', { query: query.trim() })} />
            ) : (
              <EmptyState icon="people-outline" title={t('people.empty.title')} body={t('people.empty.body')} />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const net = item.owed - item.owes;
          return (
            <Pressable
              onPress={() => navigation.navigate('Person', { personId: item.id })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar name={item.name} size={40} />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.id === profile.personId ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.groups.length ? item.groups.map((g) => g.name).join(' · ') : t('groupForm.noGroupsYet')}
                </Text>
              </View>
              {item.owed || item.owes ? (
                <View style={styles.right}>
                  <Text style={[styles.amount, net >= 0 ? styles.pos : styles.neg]}>{money(Math.abs(net))}</Text>
                  <Text style={[styles.small, net >= 0 ? styles.pos : styles.neg]}>
                    {net >= 0 ? t('common.getsBack') : t('common.owes')}
                  </Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  list: { padding: spacing(4), paddingBottom: spacing(12) },
  explain: { fontSize: font.sm, color: c.textSecondary, marginBottom: spacing(3), lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  name: { flexShrink: 1, fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  youTag: {
    flexShrink: 0,
    fontSize: font.xs,
    fontWeight: '700',
    color: c.tint,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(2),
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: font.md, fontWeight: '800' },
  small: { fontSize: font.xs, marginTop: 1 },
  pos: { color: c.success },
  neg: { color: c.danger },
}));
