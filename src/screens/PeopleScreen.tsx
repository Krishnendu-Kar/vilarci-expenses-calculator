import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { HeroBackground } from '../components/HeroBackground';
import { PullDrawer } from '../components/PullDrawer';
import { PeopleOrbit, TONE_COLOR, toneOf, type OrbitPerson, type Tone } from './people/PeopleOrbit';
import { PersonCard } from './people/PersonCard';
import { useGroups } from '../context/GroupsContext';
import { useAuth } from '../context/AuthContext';
import { useOpenGroups } from '../context/LockContext';
import { groupsWith, netsByPerson, totals } from '../lib/people';
import { searchMembers } from '../lib/search';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { TabProps } from '../navigation/types';

/** Everyone from every group, once. Tap someone to see their groups or rename them everywhere. */
export function PeopleScreen({ navigation }: TabProps<'People'>) {
  const { groups, people, profile } = useGroups();
  const { user } = useAuth();
  // Money from locked groups stays out until they are unlocked.
  const { groups: openGroups, hidden } = useOpenGroups();
  const styles = useStyles();
  const { dark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    // Each group worked out once, not once per person in it.
    const nets = netsByPerson(openGroups);
    const list = people.map((p) => ({ ...p, groups: groupsWith(groups, p.id), ...totals(nets.get(p.id) ?? []) }));
    // You first, then by name.
    return list.sort((a, b) => Number(b.id === profile.personId) - Number(a.id === profile.personId) || a.name.localeCompare(b.name));
  }, [groups, openGroups, people, profile.personId]);
  const shown = searchMembers(rows, query);

  // You in the middle, everyone else round you; the ones with money open sit nearest.
  const { meDot, orbit } = useMemo(() => {
    const all = rows.map((r): OrbitPerson & { size: number } => {
      const net = r.owed - r.owes;
      return { id: r.id, name: r.name, tone: toneOf(net), size: Math.abs(net) };
    });
    return {
      meDot: all.find((p) => p.id === profile.personId) ?? null,
      orbit: all.filter((p) => p.id !== profile.personId).sort((a, b) => b.size - a.size),
    };
  }, [rows, profile.personId]);
  const openPerson = useCallback((personId: string) => navigation.navigate('Person', { personId }), [navigation]);
  const toneCount = (tone: Tone) => orbit.filter((p) => p.tone === tone).length + (meDot?.tone === tone ? 1 : 0);

  const search = (
    <View style={styles.search}>
      <Ionicons name="search" size={17} color="rgba(255,255,255,0.7)" />
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder={t('people.search')}
        placeholderTextColor="rgba(255,255,255,0.55)"
        keyboardAppearance={dark ? 'dark' : 'light'}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={t('common.search')}
      />
      {query ? (
        <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t('common.clear')}>
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
      ) : null}
    </View>
  );
  const titleRow = (
    <View style={styles.heroTop}>
      <Text style={styles.heroTitle}>{t('tabs.people')}</Text>
      <View style={styles.countPill}>
        <Ionicons name="people" size={13} color="#FFFFFF" />
        <Text style={styles.countText}>{people.length}</Text>
      </View>
    </View>
  );

  // Stays put while the list scrolls under it. Compact: the orbit waits in a
  // drawer that opens when you pull the top down.
  const hero = (
    // Runs up under the status bar, so the white status icons stay readable.
    <HeroBackground kind="stars" style={[styles.hero, { paddingTop: insets.top + spacing(4) }]}>
      {people.length ? (
        <PullDrawer
          head={
            <>
              {titleRow}
              {search}
            </>
          }
          showLabel={t('people.showCircle')}
          hideLabel={t('people.hideCircle')}
        >
          <PeopleOrbit me={meDot} meLabel={t('common.you')} people={orbit} onOpen={openPerson} />
          <View style={styles.legend}>
            <Legend tone="up" label={t('common.getsBack')} count={toneCount('up')} />
            <Legend tone="down" label={t('common.owes')} count={toneCount('down')} />
            <Legend tone="even" label={t('common.settled')} count={toneCount('even')} />
          </View>
        </PullDrawer>
      ) : (
        <>
          {titleRow}
          <Text style={styles.heroSub}>{t('people.explain')}</Text>
        </>
      )}
    </HeroBackground>
  );

  return (
    <ScreenContainer tabs>
      {hero}
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hidden ? <Text style={styles.note}>{t('lock.notCounted', { count: hidden })}</Text> : undefined}
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
          const me = item.id === profile.personId;
          return (
            <PersonCard
              name={item.name}
              groups={item.groups}
              owed={item.owed}
              owes={item.owes}
              me={me}
              // Nobody is linked to an account yet; you are, once you sign in.
              hasAccount={me && !!user}
              onPress={() => navigation.navigate('Person', { personId: item.id })}
            />
          );
        }}
      />
    </ScreenContainer>
  );
}

/** What a ring colour on the orbit means, and how many have it. */
function Legend({ tone, label, count }: { tone: Tone; label: string; count: number }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: TONE_COLOR[tone] }]} />
      <Text style={styles.legendLabel} numberOfLines={1}>
        {/* The shared words are lower case ("gets back"); a label starts with a capital. */}
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
      <Text style={styles.legendCount}>{count}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  list: { paddingTop: spacing(4), paddingBottom: spacing(12) },
  // Square at the top, where it meets the screen edge; rounded below.
  hero: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(2),
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontFamily: DISPLAY_FONT, fontSize: font.hero, fontWeight: '700', color: '#FFFFFF' },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  countText: { color: '#FFFFFF', fontWeight: '800', fontSize: font.sm + 1 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: font.sm, lineHeight: 18, marginTop: spacing(1.5) },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(2), marginTop: spacing(3) },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: 'rgba(255,255,255,0.75)', fontSize: font.xs + 1, fontWeight: '600' },
  legendCount: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
    paddingHorizontal: spacing(3.5),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: font.md, paddingVertical: spacing(2.5) },
  note: { fontSize: font.sm, color: c.textSecondary, marginHorizontal: spacing(5), marginBottom: spacing(3), lineHeight: 18 },
}));
