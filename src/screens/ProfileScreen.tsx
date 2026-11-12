import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomSheet } from '../components/BottomSheet';
import { Input } from '../components/Input';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { HERO_LIGHT } from '../components/HeroBackground';
import { useGroups } from '../context/GroupsContext';
import { useAuth } from '../context/AuthContext';
import { useOpenGroups } from '../context/LockContext';
import { UpiSection } from './profile/UpiSection';
import { SignInRow } from './profile/AccountSection';
import { myNets, nameTakenIn, totals } from '../lib/people';
import { money } from '../lib/money';
import { initials } from '../lib/format';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { TabProps } from '../navigation/types';

/**
 * You, kept quiet: your initial, name and email; what you get back and owe
 * (group by group on Balances → Groups); UPI ids. Log out and Delete
 * account are in Settings.
 */
export function ProfileScreen({ navigation }: TabProps<'Profile'>) {
  const { groups, profile, meMap, setProfileName } = useGroups();
  const { user } = useAuth();
  const { groups: openGroups } = useOpenGroups();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);

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

        {user ? null : <SignInRow onOpen={() => navigation.navigate('Auth', { mode: 'signIn' })} />}

        <UpiSection />

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
  me: { alignItems: 'center' },
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
    marginTop: spacing(5),
    paddingVertical: spacing(3.5),
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  balanceDone: { justifyContent: 'center', gap: spacing(2) },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceValue: { fontFamily: DISPLAY_FONT, fontSize: font.xxl },
  balanceLabel: { fontSize: font.xs + 1, color: c.textSecondary, marginTop: 2 },
  divider: { width: 1, height: 36, backgroundColor: c.border },
  done: { fontSize: font.md, fontWeight: '700', color: c.success },
  pos: { color: c.success },
  neg: { color: c.danger },
  sheetHint: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18, marginTop: -spacing(2) },
}));
