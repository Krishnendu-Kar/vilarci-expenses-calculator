import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { SectionLabel } from '../components/SectionLabel';
import { useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { groupsWith } from '../lib/people';
import { searchMembers } from '../lib/search';
import { groupTotal, peopleIn } from '../lib/split';
import { money } from '../lib/money';
import { groupKindOf } from '../data/categories';
import { kindTint } from '../theme/colors';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

/** From Home's search pill: groups and people whose names match every word typed. */
export function SearchScreen({ navigation }: ScreenProps<'Search'>) {
  const { groups, people, names } = useGroups();
  const { isOpen } = useLock();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim();

  // Locked groups stay hidden here too, unless they're open right now.
  const groupHits = useMemo(() => (q ? searchMembers(groups.filter((g) => isOpen(g.id)), q) : []), [groups, q, isOpen]);
  const peopleHits = useMemo(
    () => (q ? searchMembers(people.map((p) => ({ ...p, name: names.person(p) })), q) : []),
    [people, q, names],
  );

  return (
    <ScreenContainer>
      <View style={[styles.top, { paddingTop: insets.top + spacing(2) }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
        <View style={styles.box}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor="rgba(255,255,255,0.55)"
            selectionColor="#FDE047"
            keyboardAppearance={dark ? 'dark' : 'light'}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('common.search')}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t('common.clear')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.75)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {!q ? (
          <EmptyState icon="search-outline" title={t('search.hintTitle')} body={t('search.hintBody')} />
        ) : !groupHits.length && !peopleHits.length ? (
          <EmptyState icon="search-outline" title={t('search.noneTitle')} body={t('search.noneBody', { query: q })} />
        ) : null}

        {groupHits.length ? <SectionLabel>{t('search.groups')}</SectionLabel> : null}
        {groupHits.map((g) => {
          const tint = kindTint(g.kind, dark);
          const closed = !isOpen(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                <Ionicons name={groupKindOf(g.kind).icon} size={20} color={tint.fg} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {t('count.member', { count: peopleIn(g).length })} · {closed ? t('home.card.locked') : money(groupTotal(g))}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          );
        })}

        {peopleHits.length ? (
          <View style={groupHits.length ? styles.gap : undefined}>
            <SectionLabel>{t('search.people')}</SectionLabel>
          </View>
        ) : null}
        {peopleHits.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => navigation.navigate('Person', { personId: p.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar name={p.name} size={40} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {groupsWith(groups, p.id)
                  .map((g) => g.name)
                  .join(' · ') || t('groupForm.noGroupsYet')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.header,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(3),
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3.5),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  input: { flex: 1, color: c.white, fontSize: font.md, paddingVertical: spacing(2.5) },
  list: { padding: spacing(4), paddingBottom: spacing(12) },
  gap: { marginTop: spacing(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3),
    marginBottom: spacing(2.5),
  },
  pressed: { opacity: 0.8 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  name: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
}));
