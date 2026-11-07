import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { memberIsInvolved } from '../lib/split';
import { groupsWith, nameTakenIn, personForProfile, resolveMe } from '../lib/people';
import { searchMembers } from '../lib/search';
import { notify } from '../lib/confirm';
import { newId } from '../lib/id';
import { GROUP_KINDS } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { GroupKind, Member, Person } from '../types';
import type { ScreenProps } from '../navigation/types';

/** People shown before "Show all". */
const SHORT_LIST = 8;

export function GroupFormScreen({ navigation, route }: ScreenProps<'GroupForm'>) {
  const groupId = route.params?.groupId;
  const existing = useGroup(groupId ?? '');
  const { groups, people, profile, meMap, createGroup, updateGroup, moveToBin, restoreFromBin, linkProfile, setProfileName } =
    useGroups();
  const { showUndo } = useUndo();
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();

  // You: your person in the People directory (found from your profile), or a new one made here.
  const [freshId] = useState(newId);
  const myName = profile.name.trim();
  const youPerson = myName ? personForProfile(profile, people, groups) : null;
  const youId = youPerson?.id ?? freshId;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<GroupKind>(existing?.kind ?? route.params?.kind ?? 'trip');
  // A new group starts with you in it once the app knows your name.
  const [members, setMembers] = useState<Member[]>(() =>
    existing ? existing.members : myName ? [{ id: youId, name: youPerson?.name ?? myName }] : [],
  );
  // Which member is you here, and whether saving should link your profile to them.
  const [meId, setMeId] = useState<string | null>(() =>
    existing ? resolveMe(existing, profile, meMap[existing.id]) : myName ? youId : null,
  );
  const [linkOnSave, setLinkOnSave] = useState(!existing && !!myName);
  const [askName, setAskName] = useState(false);
  const [nameForMe, setNameForMe] = useState('');
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherGroups = useMemo(() => groups.filter((g) => g.id !== existing?.id), [groups, existing?.id]);
  const inGroup = new Set(members.map((m) => m.id));
  const meInGroup = !!meId && inGroup.has(meId);

  // Everyone from your other groups who isn't in this one, filtered by what's typed.
  const candidates = useMemo(() => {
    const list = people.filter((p) => !inGroup.has(p.id) && p.id !== youPerson?.id);
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    const q = draft.trim().toLowerCase();
    const found = searchMembers(sorted, draft);
    // Exact matches first: probably the same person as the one being typed.
    return q ? [...found.filter((p) => p.name.toLowerCase() === q), ...found.filter((p) => p.name.toLowerCase() !== q)] : found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, members, draft, youPerson?.id]);
  const shown = showAll || draft.trim() ? candidates : candidates.slice(0, SHORT_LIST);

  const groupNames = (p: Person) => {
    const gs = groupsWith(otherGroups, p.id).map((g) => g.name);
    return gs.length ? gs.join(' · ') : t('groupForm.noGroupsYet');
  };

  const addMember = (m: Member) => {
    if (members.some((x) => x.name.toLowerCase() === m.name.toLowerCase())) {
      setError(t('groupForm.alreadyIn', { name: m.name }));
      return false;
    }
    setMembers((ms) => [...ms, m]);
    setError(null);
    return true;
  };

  // Typing a name and tapping + always makes a new person.
  const addNew = () => {
    const n = draft.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (addMember({ id: newId(), name: n })) setDraft('');
  };

  const addPerson = (p: Person) => {
    if (addMember({ id: p.id, name: p.name })) setDraft('');
  };

  const addMeAs = (id: string, n: string) => {
    if (!addMember({ id, name: n })) return;
    setMeId(id);
    setLinkOnSave(true);
    setAskName(false);
    setNameForMe('');
  };

  // "Me": one tap when your name is known, else type it once (it's saved to your profile).
  const addMe = () => {
    if (myName) addMeAs(youId, youPerson?.name ?? myName);
    else setAskName(true);
  };

  const confirmMyName = () => {
    const n = nameForMe.trim().replace(/\s+/g, ' ');
    if (!n) return setError(t('person.errEmpty'));
    setProfileName(n);
    const p = personForProfile({ name: n, personId: profile.personId }, people, groups);
    // Your linked person is renamed to what you typed; someone else found by name keeps theirs.
    addMeAs(p?.id ?? freshId, p && p.id !== profile.personId ? p.name : n);
  };

  const removeMember = (m: Member) => {
    if (existing && memberIsInvolved(existing, m.id)) {
      notify(t('groupForm.cantRemove', { name: m.name }), t('groupForm.cantRemoveBody', { name: m.name }));
      return;
    }
    setMembers((ms) => ms.filter((x) => x.id !== m.id));
  };

  const renameMember = (id: string, newName: string) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, name: newName } : m)));
  };

  // People already in other groups: renaming them here renames them there too.
  const sharedIds = new Set(members.filter((m) => groupsWith(otherGroups, m.id).length).map((m) => m.id));

  const save = () => {
    const trimmedName = name.trim();
    const cleaned = members.map((m) => ({ ...m, name: m.name.trim().replace(/\s+/g, ' ') }));
    if (!trimmedName) return setError(t('groupForm.errName'));
    if (cleaned.length < 2) return setError(t('groupForm.errTwo'));
    if (cleaned.some((m) => !m.name)) return setError(t('groupForm.errEmptyName'));
    const lower = cleaned.map((m) => m.name.toLowerCase());
    if (new Set(lower).size !== lower.length) return setError(t('groupForm.errSameName'));
    for (const m of cleaned) {
      const person = people.find((p) => p.id === m.id);
      if (!person || person.name === m.name) continue;
      const clash = nameTakenIn(otherGroups, m.id, m.name);
      if (clash) return setError(t('groupForm.errNameTaken', { name: m.name, group: clash.name }));
    }

    const input = { name: trimmedName, kind, members: cleaned };
    // Adding yourself links your profile to that person.
    if (linkOnSave && meId && cleaned.some((m) => m.id === meId) && profile.personId !== meId) linkProfile(meId);
    if (existing) {
      updateGroup(existing.id, input);
      navigation.goBack();
    } else {
      const id = createGroup(input);
      navigation.replace('GroupDetail', { groupId: id });
    }
  };

  // Into the Bin: restorable for 30 days, so no "are you sure".
  const remove = () => {
    if (!existing) return;
    const removed = moveToBin(existing.id);
    navigation.popToTop();
    if (removed) showUndo(t('bin.moved', { name: removed.name }), () => restoreFromBin(removed.id));
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input
          label={t('groupForm.name')}
          placeholder={t('groupForm.namePlaceholder')}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <SectionLabel>{t('groupForm.type')}</SectionLabel>
        <View style={styles.chips}>
          {GROUP_KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>
        {kind === 'hostel' ? <Text style={styles.kindHint}>{t('groupForm.hostelHint')}</Text> : null}

        <SectionLabel>{t('groupForm.people', { count: members.length })}</SectionLabel>
        <View style={styles.memberList}>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar name={m.name || '?'} size={32} />
              <TextInput
                style={styles.memberName}
                value={m.name}
                onChangeText={(v) => renameMember(m.id, v)}
                keyboardAppearance={dark ? 'dark' : 'light'}
                maxLength={30}
              />
              {m.id === meId ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
              <Pressable onPress={() => removeMember(m)} hitSlop={10}>
                <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          {members.length === 0 ? <Text style={styles.hint}>{t('groupForm.emptyHint')}</Text> : null}
        </View>
        {sharedIds.size ? <Text style={styles.renameHint}>{t('groupForm.renameHint')}</Text> : null}

        {/* ---------- Adding people ---------- */}
        <View style={styles.addBox}>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={t('groupForm.addPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardAppearance={dark ? 'dark' : 'light'}
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                setError(null);
              }}
              onSubmitEditing={addNew}
              submitBehavior="submit"
              returnKeyType="done"
              maxLength={30}
            />
            <Pressable
              onPress={addNew}
              style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
              accessibilityLabel={t('groupForm.addNew')}
            >
              <Ionicons name="person-add" size={18} color={colors.onPrimary} />
            </Pressable>
          </View>

          {!meInGroup ? (
            askName ? (
              <View style={styles.meBox}>
                <Text style={styles.fromLabel}>{t('groupForm.myNameLabel')}</Text>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    placeholder={t('profile.namePlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardAppearance={dark ? 'dark' : 'light'}
                    value={nameForMe}
                    onChangeText={(v) => {
                      setNameForMe(v);
                      setError(null);
                    }}
                    onSubmitEditing={confirmMyName}
                    submitBehavior="submit"
                    returnKeyType="done"
                    autoFocus
                    maxLength={30}
                  />
                  <Pressable
                    onPress={confirmMyName}
                    style={[styles.addMeBtn, !nameForMe.trim() && styles.addBtnDisabled]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.addMeText}>{t('groupForm.addMe')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.personSub}>{t('groupForm.myNameHint')}</Text>
              </View>
            ) : (
              <PersonRow
                name={myName ? t('groupForm.you', { name: youPerson?.name ?? myName }) : t('groupForm.me')}
                avatar={youPerson?.name ?? (myName || t('groupForm.me'))}
                sub={t('groupForm.youSub')}
                onPress={addMe}
              />
            )
          ) : null}

          {candidates.length ? (
            <>
              <Text style={styles.fromLabel}>{t('groupForm.fromGroups')}</Text>
              {shown.map((p) => (
                <PersonRow key={p.id} name={p.name} avatar={p.name} sub={groupNames(p)} onPress={() => addPerson(p)} />
              ))}
              {shown.length < candidates.length ? (
                <Pressable onPress={() => setShowAll(true)} hitSlop={8} style={styles.showAll}>
                  <Text style={styles.link}>{t('groupForm.showAll', { count: candidates.length })}</Text>
                </Pressable>
              ) : null}
            </>
          ) : draft.trim() ? (
            <Text style={styles.noMatch}>{t('groupForm.noMatch', { name: draft.trim() })}</Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton label={existing ? t('groupForm.save') : t('groupForm.create')} onPress={save} style={styles.saveBtn} />
        {existing ? <PrimaryButton label={t('groupForm.delete')} variant="danger" onPress={remove} style={styles.deleteBtn} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function PersonRow({ name, avatar, sub, onPress }: { name: string; avatar: string; sub: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}>
      <Avatar name={avatar} size={30} />
      <View style={styles.personBody}>
        <Text style={styles.personName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.personSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="add-circle" size={24} color={colors.tint} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(6) },
  kindHint: { fontSize: font.sm, color: c.textSecondary, marginTop: -spacing(4), marginBottom: spacing(6), lineHeight: 18 },
  memberList: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(2),
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  memberName: { flex: 1, fontSize: font.md + 1, color: c.textPrimary, paddingVertical: spacing(1) },
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
  hint: { color: c.textSecondary, fontSize: font.sm + 1, paddingVertical: spacing(4), textAlign: 'center' },
  renameHint: { fontSize: font.sm, color: c.textSecondary, marginBottom: spacing(2), marginLeft: spacing(1) },
  addBox: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3),
    marginTop: spacing(2),
    marginBottom: spacing(4),
  },
  addRow: { flexDirection: 'row', gap: spacing(2) },
  addInput: {
    flex: 1,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    fontSize: font.md + 1,
    color: c.textPrimary,
  },
  addBtn: {
    width: 50,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  meBox: { marginTop: spacing(1) },
  addMeBtn: {
    paddingHorizontal: spacing(4),
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMeText: { color: c.onPrimary, fontWeight: '700', fontSize: font.md },
  fromLabel: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(4),
    marginBottom: spacing(1),
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  pressed: { opacity: 0.7 },
  personBody: { flex: 1 },
  personName: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  personSub: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  showAll: { alignSelf: 'center', paddingTop: spacing(3), paddingBottom: spacing(1) },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  noMatch: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(3), textAlign: 'center' },
  error: { color: c.danger, fontSize: font.sm + 1, marginBottom: spacing(3), fontWeight: '600' },
  saveBtn: { marginTop: spacing(2) },
  deleteBtn: { marginTop: spacing(3) },
}));
