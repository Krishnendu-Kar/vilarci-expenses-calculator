import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { useGroups } from '../context/GroupsContext';
import { useOpenGroups } from '../context/LockContext';
import { useAuth } from '../context/AuthContext';
import { useUndo } from '../context/UndoContext';
import * as Clipboard from 'expo-clipboard';
import { useAccountUpi } from './group/useMemberUpi';
import { nameTakenIn, netsFor, totals } from '../lib/people';
import { isSettled } from '../lib/split';
import { money } from '../lib/money';
import { confirmAction } from '../lib/confirm';
import { groupKindOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

/**
 * One person: their groups and balances, their UPI ids (accounts), rename
 * (everywhere). "This is me" only while the app doesn't know who you are.
 */
export function PersonScreen({ navigation, route }: ScreenProps<'Person'>) {
  const { groups, people, profile, upiIds, renamePerson, deletePerson, linkProfile } = useGroups();
  const { user } = useAuth();
  const { showNote } = useUndo();
  const { groups: openGroups } = useOpenGroups();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const person = people.find((p) => p.id === route.params.personId);
  // Someone with an account in one of your live groups: their id is their account id.
  const hasAccount = !!person && groups.some((g) => g.online && g.members.some((m) => m.id === person.id && m.account));
  const isMeHere = !!person && (profile.personId === person.id || user?.id === person.id);
  const theirUpi = useAccountUpi(hasAccount && !isMeHere ? person!.id : null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: person?.name ?? '' });
  }, [navigation, person?.name]);

  if (!person) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>{t('person.missing')}</Text>
      </ScreenContainer>
    );
  }

  const nets = netsFor(openGroups, person.id);
  const { owed, owes } = totals(nets);
  const isMe = isMeHere;
  const shownUpi = isMe ? upiIds : theirUpi;
  const askWhoIsMe = !isMe && !hasAccount && !user && !people.some((p) => p.id === profile.personId);

  const copy = async (vpa: string) => {
    try {
      await Clipboard.setStringAsync(vpa);
      showNote(t('upi.copied', { id: vpa }));
    } catch {
      // Nothing was copied; the id is still there to read.
    }
  };

  const saveName = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return setError(t('person.errEmpty'));
    const clash = nameTakenIn(groups, person.id, n);
    if (clash) return setError(t('groupForm.errNameTaken', { name: n, group: clash.name }));
    renamePerson(person.id, n);
    setEditing(false);
    setError(null);
  };

  const remove = () =>
    confirmAction(t('person.deleteTitle', { name: person.name }), t('person.deleteBody'), t('common.delete'), () => {
      deletePerson(person.id);
      navigation.goBack();
    });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Avatar name={person.name} size={72} />
          {editing ? (
            <View style={styles.editWrap}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
                keyboardAppearance={dark ? 'dark' : 'light'}
                autoFocus
                maxLength={30}
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <Text style={styles.hint}>{t('groupForm.renameHint')}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.editActions}>
                <PrimaryButton
                  label={t('common.cancel')}
                  variant="outline"
                  onPress={() => {
                    setEditing(false);
                    setName(person.name);
                    setError(null);
                  }}
                  style={styles.flex}
                />
                <PrimaryButton label={t('person.saveName')} onPress={saveName} style={styles.flex} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{person.name}</Text>
                {isMe ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
              </View>
              <Pressable onPress={() => setEditing(true)} hitSlop={8} style={styles.renameBtn}>
                <Ionicons name="create-outline" size={16} color={colors.tint} />
                <Text style={styles.link}>{t('person.rename')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {nets.length ? (
          <View style={styles.totals}>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>{t('person.getsBack')}</Text>
              <Text style={[styles.totalValue, styles.pos]}>{money(owed)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>{t('person.owes')}</Text>
              <Text style={[styles.totalValue, styles.neg]}>{money(owes)}</Text>
            </View>
          </View>
        ) : null}

        {/* Where to pay them: from their account (or yours). Guests have none. */}
        {isMe || hasAccount ? (
          <>
            <SectionLabel>{t('upi.title.short')}</SectionLabel>
            {shownUpi.length ? (
              <View style={styles.upiList}>
                {shownUpi.map((u, i) => (
                  <Pressable
                    key={u.vpa}
                    onPress={() => void copy(u.vpa)}
                    accessibilityLabel={t('upi.copy', { id: u.vpa })}
                    style={({ pressed }) => [styles.upiRow, i > 0 && styles.upiLine, pressed && styles.pressed]}
                  >
                    <Ionicons name="wallet-outline" size={18} color={colors.tint} />
                    <View style={styles.flex}>
                      <Text style={styles.upiVpa} selectable numberOfLines={1}>
                        {u.vpa}
                      </Text>
                      {u.label ? <Text style={styles.upiLabel}>{u.label}</Text> : null}
                    </View>
                    <Ionicons name="copy-outline" size={17} color={colors.tint} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>{isMe ? t('person.noUpiMine') : t('person.noUpi', { name: person.name })}</Text>
            )}
          </>
        ) : null}

        <SectionLabel>{t('person.groups', { count: nets.length })}</SectionLabel>
        {nets.length === 0 ? <Text style={styles.empty}>{t('person.noGroups')}</Text> : null}
        <Text style={styles.empty}>{t('lock.notCounted')}</Text>
        {nets.map(({ group, net }) => (
          <Pressable
            key={group.id}
            onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={groupKindOf(group.kind).icon} size={20} color={colors.tint} />
            </View>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            {isSettled(net) ? (
              <Text style={styles.settled}>{t('common.settled')}</Text>
            ) : (
              <View style={styles.right}>
                <Text style={[styles.amount, net > 0 ? styles.pos : styles.neg]}>{money(Math.abs(net))}</Text>
                <Text style={[styles.small, net > 0 ? styles.pos : styles.neg]}>
                  {net > 0 ? t('common.getsBack') : t('common.owes')}
                </Text>
              </View>
            )}
          </Pressable>
        ))}

        {/* Only while the app doesn't know who you are yet (signed out, no
            person linked): once it does, nobody else's page offers it. */}
        {askWhoIsMe ? (
          <PrimaryButton
            label={t('person.thisIsMe')}
            variant="outline"
            onPress={() => linkProfile(person.id, person.name)}
            style={styles.btn}
          />
        ) : null}
        {nets.length === 0 ? (
          <PrimaryButton label={t('person.delete', { name: person.name })} variant="danger" onPress={remove} style={styles.btnGap} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  upiList: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden', marginBottom: spacing(2) },
  upiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  upiLine: { borderTopWidth: 1, borderTopColor: c.background },
  upiVpa: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  upiLabel: { fontSize: font.sm - 1, color: c.textSecondary, marginTop: 1 },
  missing: { textAlign: 'center', marginTop: spacing(16), color: c.textSecondary },
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  flex: { flex: 1 },
  head: { alignItems: 'center', marginBottom: spacing(6) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  name: { fontSize: font.xxl, fontWeight: '800', color: c.textPrimary, textAlign: 'center', flexShrink: 1 },
  youTag: {
    flexShrink: 0,
    fontSize: font.xs,
    fontWeight: '700',
    color: c.tint,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  renameBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(2), padding: spacing(1) },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  editWrap: { alignSelf: 'stretch', marginTop: spacing(4) },
  nameInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: font.lg,
    color: c.textPrimary,
    textAlign: 'center',
  },
  hint: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(2), textAlign: 'center' },
  error: { color: c.danger, fontSize: font.sm + 1, marginTop: spacing(2), fontWeight: '600', textAlign: 'center' },
  editActions: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(4) },
  totals: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing(4),
    marginBottom: spacing(6),
  },
  totalCol: { flex: 1, alignItems: 'center' },
  totalLabel: { fontSize: font.xs + 1, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: font.xl, fontWeight: '800', marginTop: spacing(1) },
  divider: { width: 1, backgroundColor: c.border },
  empty: { fontSize: font.sm + 1, color: c.textSecondary, marginBottom: spacing(4) },
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
  groupName: { flex: 1, fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: font.md, fontWeight: '800' },
  small: { fontSize: font.xs, marginTop: 1 },
  settled: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  pos: { color: c.success },
  neg: { color: c.danger },
  btn: { marginTop: spacing(6) },
  btnGap: { marginTop: spacing(3) },
}));
