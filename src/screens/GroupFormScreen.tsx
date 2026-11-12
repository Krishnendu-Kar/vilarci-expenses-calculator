import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { BottomSheet } from '../components/BottomSheet';
import { MoreButton } from '../components/MoreButton';
import { useMenu, type MenuItem } from '../context/MenuContext';
import { useGroupExit } from './group/useGroupExit';
import { useGroup, useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { memberIsInvolved } from '../lib/split';
import { groupsWith, nameTakenIn, personForProfile, resolveMe } from '../lib/people';
import { searchMembers } from '../lib/search';
import { notify } from '../lib/confirm';
import { can } from '../lib/permissions';
import { newId } from '../lib/id';
import { membersFromContacts } from '../lib/contacts';
import { ContactPicker } from './groupForm/ContactPicker';
import { GROUP_KINDS } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { GroupKind, Member, Person } from '../types';
import type { ScreenProps } from '../navigation/types';

/** People shown before "Show all". */
const SHORT_LIST = 8;
/** Members listed on the form itself; the rest are counted. */
const PREVIEW = 5;

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
  // Adding, renaming and removing people happens in a popup.
  const [peopleOpen, setPeopleOpen] = useState(false);
  // The form's own list: the first few, or everyone; renaming in a small popup.
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const { openMenu } = useMenu();
  const exit = useGroupExit(existing);
  // Who was in the group when the popup opened: they aren't listed there,
  // only the people added since (with × to take them back out).
  const [openedWith, setOpenedWith] = useState<ReadonlySet<string>>(() => new Set());
  const openPeople = () => {
    setOpenedWith(new Set(members.map((m) => m.id)));
    setPeopleOpen(true);
  };
  // In that popup: picking several from the phone's contacts.
  const [fromContacts, setFromContacts] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const otherGroups = useMemo(() => groups.filter((g) => g.id !== existing?.id), [groups, existing?.id]);
  const canInvite = !!existing?.online && can('share_invite', existing);
  const inGroup = new Set(members.map((m) => m.id));
  const meInGroup = !!meId && inGroup.has(meId);
  // A live group where only admins add guests: contacts would only be refused.
  const canAddGuests = !existing?.online || can('add_guests', existing);

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
    if (!n) return true;
    if (!addMember({ id: newId(), name: n })) return false;
    setDraft('');
    return true;
  };

  const closePeople = () => {
    setPeopleOpen(false);
    setFromContacts(false);
    setPicked([]);
    setDraft('');
    setAskName(false);
    setNameForMe('');
    setShowAll(false);
    setError(null);
  };

  // Done also adds a name still sitting in the box, so it isn't lost.
  const donePeople = () => {
    if (addNew()) closePeople();
  };

  const togglePicked = (n: string) =>
    setPicked((ps) => (ps.some((x) => x.toLowerCase() === n.toLowerCase()) ? ps.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...ps, n]));

  // Picked contacts join as guests, or as the person already in your People
  // with that name (the people list is where every member comes from).
  const addContacts = () => {
    const { add, already } = membersFromContacts(picked, people, members, newId);
    setMembers((ms) => [...ms, ...add]);
    setError(already.length ? t('groupForm.alreadyIn', { name: already.join(', ') }) : null);
    setPicked([]);
    setFromContacts(false);
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

  const addedNow = members.filter((m) => !openedWith.has(m.id));

  // A live group's list leaves out guests merged into someone and people who left.
  const listed = members.filter((m) => !m.gone);
  const live = !!existing?.online;
  const saved = (m: Member) => !!existing?.members.some((x) => x.id === m.id);

  // ⋮ on each person: rename, remove. In a live group only guests are renamed
  // here, and removing someone already in it goes through the server (settled
  // only, admins only, never the creator or you: that's Leave).
  const memberMenu = (m: Member): MenuItem[] => {
    const items: MenuItem[] = [];
    if (!live || (!m.account && canAddGuests)) items.push({ key: 'rename', icon: 'create-outline', title: t('groupForm.rename') });
    if (!live || !saved(m) || (existing && can('remove_member', existing) && m.role !== 'creator' && m.id !== meId)) {
      items.push({ key: 'remove', icon: 'person-remove-outline', title: t('groupForm.removeMember'), danger: true });
    }
    return items;
  };
  const pickMemberMenu = (m: Member, key: string) => {
    if (key === 'rename') setRenaming({ id: m.id, value: m.name });
    else if (key === 'remove') {
      if (live && saved(m)) exit.remove(m);
      else removeMember(m);
    }
  };
  const saveRename = () => {
    if (!renaming) return;
    const n = renaming.value.trim().replace(/\s+/g, ' ');
    if (!n) return;
    renameMember(renaming.id, n);
    setRenaming(null);
  };

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
    // A live group you're still in belongs to everyone in it: leave it first,
    // then your copy can go to the Bin.
    if (existing.online?.status === 'active') {
      notify(t('groupForm.leaveFirstTitle'), t('groupForm.leaveFirstBody', { name: existing.name }));
      return;
    }
    const removed = moveToBin(existing.id);
    navigation.popToTop();
    if (removed) showUndo(t('bin.moved', { name: removed.name }), () => restoreFromBin(removed.id));
  };

  // Editing: Save, then the Bin icon, sit at the top right of the header bar.
  // They always run the latest functions (with what's typed now), without
  // re-setting the header on every keystroke.
  const saveRef = useRef(save);
  saveRef.current = save;
  const removeRef = useRef(remove);
  removeRef.current = remove;
  useLayoutEffect(() => {
    if (!existing) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => saveRef.current()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('groupForm.save')}
            style={({ pressed }) => [styles.headerSave, pressed && styles.pressed]}
          >
            <Text style={styles.headerSaveText}>{t('groupForm.saveShort')}</Text>
          </Pressable>
          <Pressable
            onPress={() => removeRef.current()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('groupForm.delete')}
            style={({ pressed }) => [styles.headerBin, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.white} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, existing, styles, colors, t]);

  const typedMember = members.find((m) => m.name.toLowerCase() === draft.trim().toLowerCase());
  // People from your other groups, filtered by what's typed.
  const candidateList = candidates.length ? (
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
  ) : draft.trim() && !error ? (
    // Typing someone already in the group says so, instead of "nobody called…".
    <Text style={styles.noMatch}>
      {typedMember ? t('groupForm.alreadyIn', { name: typedMember.name }) : t('groupForm.noMatch', { name: draft.trim() })}
    </Text>
  ) : null;

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

        <View style={styles.peopleHead}>
          <View style={styles.flex}>
            <SectionLabel>{t('groupForm.people', { count: listed.length })}</SectionLabel>
          </View>
          {/* A live group: its QR and invite link, to bring more people in. */}
          {canInvite && existing ? (
            <Pressable
              onPress={() => navigation.navigate('Invite', { groupId: existing.id })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('invite.title')}
              style={({ pressed }) => [styles.qrBtn, pressed && styles.pressed]}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.tint} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.memberList}>
          {(showAllMembers ? listed : listed.slice(0, PREVIEW)).map((m) => {
            const items = memberMenu(m);
            return (
              <View key={m.id} style={styles.memberRow}>
                <Avatar name={m.name || '?'} size={32} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.id === meId ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
                {items.length ? (
                  <MoreButton size={20} hitSlop={10} onOpen={(anchor) => openMenu(anchor, items, (key) => pickMemberMenu(m, key))} />
                ) : null}
              </View>
            );
          })}
          {!showAllMembers && listed.length > PREVIEW ? (
            <Pressable onPress={() => setShowAllMembers(true)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.more, styles.link]}>{t('groupForm.showAllMembers', { count: listed.length })}</Text>
            </Pressable>
          ) : null}
          {listed.length === 0 ? <Text style={styles.hint}>{t('groupForm.emptyHint')}</Text> : null}
        </View>
        <PrimaryButton label={t('groupForm.addPeople')} variant="outline" onPress={openPeople} style={styles.manageBtn} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Editing saves and bins from the header; a new group is made here. */}
        {existing ? null : <PrimaryButton label={t('groupForm.create')} onPress={save} style={styles.saveBtn} />}
      </ScrollView>

      <BottomSheet
        visible={peopleOpen}
        title={fromContacts ? t('groupForm.fromContacts') : t('groupForm.addPeople')}
        onClose={closePeople}
        tall
        footer={
          fromContacts ? (
            <PrimaryButton
              label={picked.length ? t('contacts.add', { count: picked.length }) : t('contacts.pick')}
              disabled={!picked.length}
              onPress={addContacts}
            />
          ) : (
            <PrimaryButton label={t('groupForm.done')} onPress={donePeople} />
          )
        }
      >
        {fromContacts ? (
          <ContactPicker
            picked={picked}
            onToggle={togglePicked}
            inGroup={new Set(members.map((m) => m.name.toLowerCase()))}
            known={new Set(people.map((p) => p.name.toLowerCase()))}
            onBack={() => {
              setFromContacts(false);
              setPicked([]);
            }}
          />
        ) : (
          <>
        {/* Adding someone comes first, so the keyboard never covers the box. */}
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
        {error ? <Text style={[styles.error, styles.sheetError]}>{error}</Text> : null}
        {/* Several at once from the phone; they come in as guests. */}
        {canAddGuests && !draft.trim() ? (
          <Pressable
            onPress={() => {
              setError(null);
              setFromContacts(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.personRow, styles.contactsRow, pressed && styles.pressed]}
          >
            <View style={styles.contactsIcon}>
              <Ionicons name="call-outline" size={16} color={colors.tint} />
            </View>
            <View style={styles.personBody}>
              <Text style={styles.personName}>{t('groupForm.fromContacts')}</Text>
              <Text style={styles.personSub} numberOfLines={2}>
                {t('groupForm.fromContactsSub')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {draft.trim() ? candidateList : null}

        {/* Picked in this go: shown so you can see who's coming in, or take them back out. */}
        {addedNow.length ? (
          <>
            <Text style={styles.fromLabel}>{t('groupForm.adding', { count: addedNow.length })}</Text>
            <View style={styles.memberList}>
              {addedNow.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  <Avatar name={m.name || '?'} size={32} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {m.id === meId ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
                  <Pressable
                    onPress={() => setMembers((ms) => ms.filter((x) => x.id !== m.id))}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('groupForm.takeOut', { name: m.name })}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}
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
            <View style={styles.meBox}>
              <PersonRow
                name={myName ? t('groupForm.you', { name: youPerson?.name ?? myName }) : t('groupForm.me')}
                avatar={youPerson?.name ?? (myName || t('groupForm.me'))}
                sub={t('groupForm.youSub')}
                onPress={addMe}
              />
            </View>
          )
        ) : null}

        {draft.trim() ? null : candidateList}
          </>
        )}
      </BottomSheet>

      <BottomSheet
        visible={!!renaming}
        title={t('groupForm.renameTitle', { name: members.find((m) => m.id === renaming?.id)?.name ?? '' })}
        onClose={() => setRenaming(null)}
        footer={<PrimaryButton label={t('groupForm.saveShort')} onPress={saveRename} disabled={!renaming?.value.trim()} />}
      >
        <Input
          label={t('groupForm.rename')}
          value={renaming?.value ?? ''}
          onChangeText={(v) => renaming && setRenaming({ ...renaming, value: v })}
          maxLength={30}
          autoFocus
          onSubmitEditing={saveRename}
          returnKeyType="done"
        />
        {renaming && sharedIds.has(renaming.id) ? <Text style={styles.renameHint}>{t('groupForm.renameHint')}</Text> : null}
      </BottomSheet>
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
  contactsRow: { marginTop: spacing(1) },
  contactsIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
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
  // The People label, with the QR button at its right end (live groups).
  peopleHead: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  qrBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
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
  more: { fontSize: font.sm, color: c.textSecondary, paddingVertical: spacing(2.5), textAlign: 'center' },
  manageBtn: { marginBottom: spacing(5) },
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
  meBox: { marginTop: spacing(3) },
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
  sheetError: { marginTop: spacing(2), marginBottom: 0 },
  saveBtn: { marginTop: spacing(2) },
  // On the dark header bar, like the other header actions.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  headerBin: { padding: spacing(1) },
  headerSave: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.5),
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerSaveText: { color: c.white, fontSize: font.md, fontWeight: '700' },
}));
