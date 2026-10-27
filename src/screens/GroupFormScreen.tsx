import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { useGroup, useGroups } from '../context/GroupsContext';
import { memberIsInvolved } from '../lib/split';
import { confirmAction, notify } from '../lib/confirm';
import { newId } from '../lib/id';
import { GROUP_KINDS } from '../data/categories';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { GroupKind, Member } from '../types';
import type { ScreenProps } from '../navigation/types';

export function GroupFormScreen({ navigation, route }: ScreenProps<'GroupForm'>) {
  const groupId = route.params?.groupId;
  const existing = useGroup(groupId ?? '');
  const { createGroup, updateGroup, deleteGroup } = useGroups();

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<GroupKind>(existing?.kind ?? 'trip');
  const [members, setMembers] = useState<Member[]>(existing?.members ?? []);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMember = () => {
    const n = draft.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (members.some((m) => m.name.toLowerCase() === n.toLowerCase())) {
      setError(`${n} is already in the group.`);
      return;
    }
    setMembers((ms) => [...ms, { id: newId(), name: n }]);
    setDraft('');
    setError(null);
  };

  const removeMember = (m: Member) => {
    if (existing && memberIsInvolved(existing, m.id)) {
      notify(
        `Can't remove ${m.name}`,
        `${m.name} is part of some expenses or payments. Edit or delete those first.`,
      );
      return;
    }
    setMembers((ms) => ms.filter((x) => x.id !== m.id));
  };

  const renameMember = (id: string, newName: string) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, name: newName } : m)));
  };

  const save = () => {
    const trimmedName = name.trim();
    const cleaned = members.map((m) => ({ ...m, name: m.name.trim() }));
    if (!trimmedName) return setError('Give the group a name.');
    if (cleaned.length < 2) return setError('Add at least 2 people to split with.');
    if (cleaned.some((m) => !m.name)) return setError("A member's name is empty.");
    const lower = cleaned.map((m) => m.name.toLowerCase());
    if (new Set(lower).size !== lower.length) return setError('Two members have the same name.');

    const input = { name: trimmedName, kind, members: cleaned };
    if (existing) {
      updateGroup(existing.id, input);
      navigation.goBack();
    } else {
      const id = createGroup(input);
      navigation.replace('GroupDetail', { groupId: id });
    }
  };

  const remove = () => {
    if (!existing) return;
    confirmAction(
      'Delete group?',
      `"${existing.name}" and all its expenses will be removed from this phone.`,
      'Delete',
      () => {
        deleteGroup(existing.id);
        navigation.popToTop();
      },
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input
          label="Group name"
          placeholder="e.g. Goa trip, Room 204 mess"
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <SectionLabel>Type</SectionLabel>
        <View style={styles.chips}>
          {GROUP_KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>

        <SectionLabel>People ({members.length})</SectionLabel>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add a name"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addMember}
            submitBehavior="submit"
            returnKeyType="done"
            maxLength={30}
          />
          <Pressable onPress={addMember} style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}>
            <Ionicons name="person-add" size={18} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.memberList}>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar name={m.name || '?'} size={32} />
              <TextInput
                style={styles.memberName}
                value={m.name}
                onChangeText={(t) => renameMember(m.id, t)}
                maxLength={30}
              />
              <Pressable onPress={() => removeMember(m)} hitSlop={10}>
                <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          {members.length === 0 ? (
            <Text style={styles.hint}>Add everyone who shares costs — e.g. all 6 friends on the trip.</Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton label={existing ? 'Save changes' : 'Create group'} onPress={save} style={styles.saveBtn} />
        {existing ? <PrimaryButton label="Delete group" variant="danger" onPress={remove} style={styles.deleteBtn} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(6) },
  addRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3) },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: font.md + 1,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 50,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  memberList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(4),
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberName: { flex: 1, fontSize: font.md + 1, color: colors.textPrimary, paddingVertical: spacing(1) },
  hint: { color: colors.textSecondary, fontSize: font.sm + 1, paddingVertical: spacing(4), textAlign: 'center' },
  error: { color: colors.danger, fontSize: font.sm + 1, marginBottom: spacing(3), fontWeight: '600' },
  saveBtn: { marginTop: spacing(2) },
  deleteBtn: { marginTop: spacing(3) },
});
