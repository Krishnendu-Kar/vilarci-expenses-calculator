import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { SettingsRow } from '../components/SettingsRow';
import { ActionSheet } from '../components/ActionSheet';
import { useGroups } from '../context/GroupsContext';
import { nameTakenIn, resolveMe, totals } from '../lib/people';
import { computeBalances, isSettled } from '../lib/split';
import { money } from '../lib/money';
import { groupKindOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Group } from '../types';
import type { TabProps } from '../navigation/types';

/** You: your name (on this phone only) and where you stand across all your groups. */
export function ProfileScreen({ navigation }: TabProps<'Profile'>) {
  const { groups, profile, meMap, setMe, setProfileName } = useGroups();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<Group | null>(null);

  // Picks up a name set elsewhere ("This is me" on a person's page).
  useEffect(() => setName(profile.name), [profile.name]);

  const rows = useMemo(
    () =>
      groups.map((group) => {
        const me = resolveMe(group, profile, meMap[group.id]);
        const net = me ? (computeBalances(group).find((b) => b.memberId === me)?.net ?? 0) : null;
        return { group, me, net, meName: group.members.find((m) => m.id === me)?.name };
      }),
    [groups, profile, meMap],
  );
  const known = rows.filter((r) => r.net !== null);
  const { owed, owes } = totals(known.map((r) => ({ net: r.net! })));
  const changed = name.trim() !== profile.name;

  const saveName = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (profile.personId && n) {
      const clash = nameTakenIn(groups, profile.personId, n);
      if (clash) return setError(t('groupForm.errNameTaken', { name: n, group: clash.name }));
    }
    setProfileName(n);
    setError(null);
  };

  return (
    <ScreenContainer tabs>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Avatar name={profile.name || '?'} size={64} />
          <View style={styles.flex}>
            <Text style={styles.label}>{t('profile.yourName')}</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardAppearance={dark ? 'dark' : 'light'}
              maxLength={30}
              onSubmitEditing={saveName}
              returnKeyType="done"
            />
          </View>
        </View>
        <Text style={styles.hint}>{t('profile.nameHint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {changed ? <PrimaryButton label={t('profile.saveName')} onPress={saveName} style={styles.saveBtn} /> : null}

        <SectionLabel>{t('profile.balance')}</SectionLabel>
        <View style={styles.totals}>
          {known.length && !owed && !owes ? (
            <View style={styles.totalCol}>
              <Ionicons name="checkmark-done-circle" size={26} color={colors.success} />
              <Text style={styles.allSettled}>{t('profile.allSettled')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>{t('profile.youGetBack')}</Text>
                <Text style={[styles.totalValue, styles.pos]}>{money(owed)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>{t('profile.youOwe')}</Text>
                <Text style={[styles.totalValue, styles.neg]}>{money(owes)}</Text>
              </View>
            </>
          )}
        </View>
        {!profile.name.trim() && rows.some((r) => !r.me) ? <Text style={styles.hint}>{t('profile.setNameFirst')}</Text> : null}

        {rows.length ? <SectionLabel>{t('profile.groups')}</SectionLabel> : null}
        {rows.length === 0 ? <Text style={styles.empty}>{t('profile.noGroups')}</Text> : null}
        {rows.map(({ group, me, net, meName }) => (
          <Pressable
            key={group.id}
            onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={groupKindOf(group.kind).icon} size={20} color={colors.tint} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Pressable onPress={() => setPickFor(group)} hitSlop={8}>
                <Text style={me ? styles.meta : styles.ask}>
                  {me ? t('profile.youAre', { name: meName ?? '' }) : t('profile.whoAreYou')}
                </Text>
              </Pressable>
            </View>
            {net === null ? null : isSettled(net) ? (
              <Text style={styles.settled}>{t('common.settled')}</Text>
            ) : (
              <View style={styles.right}>
                <Text style={[styles.amount, net > 0 ? styles.pos : styles.neg]}>{money(Math.abs(net))}</Text>
                <Text style={[styles.small, net > 0 ? styles.pos : styles.neg]}>
                  {net > 0 ? t('profile.rowGetBack') : t('profile.rowOwe')}
                </Text>
              </View>
            )}
          </Pressable>
        ))}

        <View style={styles.settings}>
          <SettingsRow icon="settings-outline" title={t('settings.title')} onPress={() => navigation.navigate('Settings')} />
        </View>
      </ScrollView>

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
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: c.textSecondary,
    marginBottom: spacing(1.5),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nameInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: font.lg,
    fontWeight: '600',
    color: c.textPrimary,
  },
  hint: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(2), marginBottom: spacing(5), lineHeight: 18 },
  error: { color: c.danger, fontSize: font.sm + 1, marginBottom: spacing(3), fontWeight: '600' },
  saveBtn: { marginBottom: spacing(5) },
  totals: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing(4),
    marginBottom: spacing(3),
  },
  totalCol: { flex: 1, alignItems: 'center', paddingHorizontal: spacing(1) },
  totalLabel: { fontSize: font.xs + 1, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  totalValue: { fontSize: font.xl, fontWeight: '800', marginTop: spacing(1) },
  allSettled: { fontSize: font.md, fontWeight: '700', color: c.success, marginTop: spacing(1) },
  divider: { width: 1, backgroundColor: c.border },
  empty: { fontSize: font.sm + 1, color: c.textSecondary, marginTop: spacing(2) },
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
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  ask: { fontSize: font.sm, color: c.tint, fontWeight: '700', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: font.md, fontWeight: '800' },
  small: { fontSize: font.xs, marginTop: 1 },
  settled: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  pos: { color: c.success },
  neg: { color: c.danger },
  settings: {
    marginTop: spacing(6),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
}));
