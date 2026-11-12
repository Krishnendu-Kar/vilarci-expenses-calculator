import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { Segmented } from '../components/Segmented';
import { useGroup } from '../context/GroupsContext';
import { useSync } from '../context/SyncContext';
import { updateSettings } from '../lib/api/groups';
import { supabase } from '../lib/api/supabase';
import { can, DEFAULT_SETTINGS } from '../lib/permissions';
import { notify } from '../lib/confirm';
import { makeStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { GroupSettings } from '../types';
import type { ScreenProps } from '../navigation/types';

type Who = 'all' | 'admins';

/**
 * A live group's settings (onlinedb.md §14), admins only. Each choice is
 * saved at once on the server and reaches every phone with its next sync.
 */
export function GroupSettingsScreen({ navigation, route }: ScreenProps<'GroupSettings'>) {
  const group = useGroup(route.params.groupId);
  const { syncNow } = useSync();
  const styles = useStyles();
  const { t } = useI18n();
  const [settings, setSettings] = useState<GroupSettings>(group?.online?.settings ?? DEFAULT_SETTINGS);
  const [inviteOn, setInviteOn] = useState<boolean | null>(null);

  // The link's state isn't kept on the phone; read it from the group's row.
  useEffect(() => {
    supabase
      .from('groups')
      .select('invite_code')
      .eq('id', route.params.groupId)
      .maybeSingle()
      .then(({ data }) => setInviteOn(data ? data.invite_code !== null : null));
  }, [route.params.groupId]);

  useEffect(() => {
    if (group && !can('change_settings', group)) navigation.goBack();
  }, [group, navigation]);

  if (!group?.online) return <ScreenContainer>{null}</ScreenContainer>;

  const save = async (change: Partial<GroupSettings> & { inviteOn?: boolean }) => {
    const before = { settings, inviteOn };
    const { inviteOn: on, ...rest } = change;
    setSettings((s) => ({ ...s, ...rest }));
    if (on !== undefined) setInviteOn(on);
    try {
      await updateSettings(group.id, change);
      void syncNow();
    } catch {
      setSettings(before.settings);
      setInviteOn(before.inviteOn);
      notify(t('gsettings.title'), t('gsettings.failed'));
    }
  };

  const who = (key: 'editInfo' | 'addExpenses' | 'addGuests', label: Key) => (
    <View style={styles.block}>
      <Text style={styles.label}>{t(label)}</Text>
      <Segmented<Who>
        options={[
          { key: 'all', label: t('gsettings.everyone') },
          { key: 'admins', label: t('gsettings.admins') },
        ]}
        value={settings[key]}
        onChange={(v) => void save({ [key]: v })}
      />
    </View>
  );

  const onOff = (value: boolean, onChange: (v: boolean) => void) => (
    <Segmented<'on' | 'off'>
      options={[
        { key: 'on', label: t('gsettings.on') },
        { key: 'off', label: t('gsettings.off') },
      ]}
      value={value ? 'on' : 'off'}
      onChange={(v) => onChange(v === 'on')}
    />
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <Text style={styles.label}>{t('gsettings.approval')}</Text>
          <Text style={styles.hint}>{t('gsettings.approvalBody')}</Text>
          {onOff(settings.requireApproval, (v) => void save({ requireApproval: v }))}
        </View>
        {who('addExpenses', 'gsettings.addExpenses')}
        {who('addGuests', 'gsettings.addGuests')}
        {who('editInfo', 'gsettings.editInfo')}
        {inviteOn !== null ? (
          <View style={styles.block}>
            <Text style={styles.label}>{t('gsettings.invite')}</Text>
            <Text style={styles.hint}>{t('gsettings.inviteBody')}</Text>
            {onOff(inviteOn, (v) => void save({ inviteOn: v }))}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  block: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3.5),
    marginBottom: spacing(3),
    gap: spacing(2),
  },
  label: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  hint: { fontSize: font.sm, color: c.textSecondary, marginTop: -spacing(1) },
}));
