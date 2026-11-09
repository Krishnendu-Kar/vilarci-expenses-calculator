import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { ActionSheet } from '../components/ActionSheet';
import { BottomSheet } from '../components/BottomSheet';
import { Input } from '../components/Input';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { HERO_LIGHT } from '../components/HeroBackground';
import { useGroups } from '../context/GroupsContext';
import { useAuth } from '../context/AuthContext';
import { useOpenGroups } from '../context/LockContext';
import { UpiSection } from './profile/UpiSection';
import { AccountActions, SignInRow } from './profile/AccountSection';
import { myNets, nameTakenIn, totals } from '../lib/people';
import { isSettled } from '../lib/split';
import { money } from '../lib/money';
import { initials } from '../lib/format';
import { groupKindOf } from '../data/categories';
import { kindTint } from '../theme/colors';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Group } from '../types';
import type { TabProps } from '../navigation/types';

/**
 * You, kept quiet: your initial, name and email; what you get back and owe;
 * then short lists (UPI ids, groups, more) with plenty of room between them.
 */
export function ProfileScreen({ navigation }: TabProps<'Profile'>) {
  const { groups, profile, meMap, setMe, setProfileName } = useGroups();
  const { user } = useAuth();
  const { groups: openGroups, hidden } = useOpenGroups();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<Group | null>(null);

  const rows = useMemo(() => myNets(openGroups, profile, meMap), [openGroups, profile, meMap]);
  const known = rows.filter((r) => r.net !== null);
  const { owed, owes } = totals(known.map((r) => ({ net: r.net! })));
  const settled = known.length > 0 && !owed && !owes;

  const editName = () => {
    setName(profile.name);
    setError(null);
    setEditing(true);
  };

  const saveName = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (profile.personId && n) {
      const clash = nameTakenIn(groups, profile.personId, n);
      if (clash) return setError(t('groupForm.errNameTaken', { name: n, group: clash.name }));
    }
    setProfileName(n);
    setEditing(false);
  };

  return (
    <ScreenContainer tabs>
      {/* No header bar here: the page shows under the status bar, so its icons follow the theme. */}
      {focused ? <StatusBar style={dark ? 'light' : 'dark'} /> : null}
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing(2) }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Who you are. Tapping the name edits it. */}
        <View style={styles.me}>
          <View style={styles.ring}>
            <View style={styles.avatar}>
              {profile.name ? (
                <Text style={styles.avatarText}>{initials(profile.name)}</Text>
              ) : (
                <Ionicons name="person" size={34} color={colors.onPrimary} />
              )}
            </View>
          </View>
          <Pressable onPress={editName} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('profile.editName')} style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name || t('profile.addName')}
            </Text>
            <Ionicons name="pencil" size={15} color={colors.textSecondary} />
          </Pressable>
          {user ? (
            <View style={styles.subRow}>
              <Text style={styles.sub} numberOfLines={1}>
                {user.email}
              </Text>
              {user.emailConfirmed ? <Ionicons name="checkmark-circle" size={15} color={colors.success} /> : null}
            </View>
          ) : (
            <Text style={styles.sub}>{t('profile.guestSub')}</Text>
          )}
        </View>

        {/* Where you stand, across the groups that aren't locked shut. */}
        {known.length ? (
          settled ? (
            <View style={[styles.balance, styles.balanceDone]}>
              <Ionicons name="checkmark-done-circle" size={20} color={colors.success} />
              <Text style={styles.done}>{t('profile.allSettled')}</Text>
            </View>
          ) : (
            <View style={styles.balance}>
              <View style={styles.balanceCol}>
                <Text style={[styles.balanceValue, styles.pos]}>{money(owed)}</Text>
                <Text style={styles.balanceLabel}>{t('profile.youGetBack')}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.balanceCol}>
                <Text style={[styles.balanceValue, styles.neg]}>{money(owes)}</Text>
                <Text style={styles.balanceLabel}>{t('profile.youOwe')}</Text>
              </View>
            </View>
          )
        ) : null}
        {!profile.name.trim() && rows.some((r) => !r.me) ? <Text style={styles.hint}>{t('profile.setNameFirst')}</Text> : null}

        {user ? null : <SignInRow onOpen={() => navigation.navigate('Auth', { mode: 'signIn' })} />}

        <UpiSection />

        <Text style={styles.label}>{t('profile.groups')}</Text>
        {rows.length ? (
          <View style={styles.list}>
            {rows.map(({ group, me, net }, i) => {
              const tint = kindTint(group.kind, dark);
              const meName = group.members.find((m) => m.id === me)?.name;
              return (
                <Pressable
                  key={group.id}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
                >
                  <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                    <Ionicons name={groupKindOf(group.kind).icon} size={17} color={tint.fg} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.groupName} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Pressable onPress={() => setPickFor(group)} hitSlop={8}>
                      <Text style={me ? styles.meta : styles.ask} numberOfLines={1}>
                        {me ? t('profile.youAre', { name: meName ?? '' }) : t('profile.whoAreYou')}
                      </Text>
                    </Pressable>
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
            })}
          </View>
        ) : (
          <Text style={styles.empty}>{t('profile.noGroups')}</Text>
        )}
        {hidden ? <Text style={styles.footnote}>{t('lock.notCounted', { count: hidden })}</Text> : null}

        {user ? <AccountActions /> : null}
      </ScrollView>

      <BottomSheet
        visible={editing}
        title={t('profile.editName')}
        onClose={() => setEditing(false)}
        footer={<PrimaryButton label={t('profile.saveName')} onPress={saveName} />}
      >
        <Input
          label={t('profile.yourName')}
          placeholder={t('profile.namePlaceholder')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          maxLength={30}
          autoFocus
          onSubmitEditing={saveName}
          returnKeyType="done"
          error={error ?? undefined}
        />
        <Text style={styles.sheetHint}>{t('profile.nameHint')}</Text>
      </BottomSheet>

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
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing(5), paddingBottom: spacing(12) },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  me: { alignItems: 'center', marginTop: spacing(1) },
  // The brand's bright red as a thin ring: the one splash of colour up top.
  ring: { padding: 3, borderRadius: 50, borderWidth: 2, borderColor: HERO_LIGHT[2] },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  avatarText: { color: c.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 32 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(4), maxWidth: '90%' },
  name: { flexShrink: 1, fontFamily: DISPLAY_FONT, fontSize: font.xxl, color: c.textPrimary },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: spacing(1), maxWidth: '90%' },
  sub: { flexShrink: 1, fontSize: font.sm + 1, color: c.textSecondary, marginTop: spacing(1), textAlign: 'center' },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing(6),
    paddingVertical: spacing(4),
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  balanceDone: { justifyContent: 'center', gap: spacing(2) },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceValue: { fontFamily: DISPLAY_FONT, fontSize: font.xxl },
  balanceLabel: { fontSize: font.xs + 1, color: c.textSecondary, marginTop: 2 },
  divider: { width: 1, height: 36, backgroundColor: c.border },
  done: { fontSize: font.md, fontWeight: '700', color: c.success },
  hint: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(3), lineHeight: 18, textAlign: 'center' },
  label: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing(8),
    marginBottom: spacing(2.5),
    marginLeft: spacing(1),
  },
  list: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3.5) },
  rowLine: { borderTopWidth: 1, borderTopColor: c.background },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  ask: { fontSize: font.sm, color: c.tint, fontWeight: '700', marginTop: 1 },
  amount: { fontSize: font.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  settled: { fontSize: font.sm, color: c.textSecondary },
  pos: { color: c.success },
  neg: { color: c.danger },
  empty: { fontSize: font.sm + 1, color: c.textSecondary, marginLeft: spacing(1) },
  footnote: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(2), marginLeft: spacing(1), lineHeight: 18 },
  sheetHint: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18, marginTop: -spacing(2) },
}));
