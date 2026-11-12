import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { SettingsRow } from '../components/SettingsRow';
import { SectionLabel } from '../components/SectionLabel';
import { Avatar } from '../components/Avatar';
import { useGroup } from '../context/GroupsContext';
import { useSync } from '../context/SyncContext';
import { useUndo } from '../context/UndoContext';
import { decideRequest, inviteLink, inviteUrl, pendingRequests, type JoinRequest } from '../lib/api/groups';
import { can } from '../lib/permissions';
import { confirmAction, notify } from '../lib/confirm';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

/**
 * A live group's way in (onlinedb.md §15): the code, the link and its QR,
 * to copy or share. Admins also see who's asking to join, can reset the
 * link and open the group's settings. Everything here needs the internet.
 */
export function InviteScreen({ navigation, route }: ScreenProps<'Invite'>) {
  const group = useGroup(route.params.groupId);
  const { syncNow } = useSync();
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const admin = !!group && can('decide_requests', group);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setCode(await inviteLink(route.params.groupId));
      if (admin) setRequests(await pendingRequests(route.params.groupId));
    } catch {
      setFailed(true);
    }
  }, [route.params.groupId, admin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!group) return <ScreenContainer>{null}</ScreenContainer>;
  const link = code ? inviteUrl(code) : null;

  const reset = () =>
    confirmAction(t('invite.resetTitle'), t('invite.resetBody'), t('invite.resetButton'), async () => {
      try {
        setCode(await inviteLink(group.id, true));
      } catch {
        notify(t('invite.reset'), t('invite.failed'));
      }
    });

  const decide = async (r: JoinRequest, approve: boolean) => {
    setBusy(r.id);
    try {
      // Letting someone in who says "I'm Rahul" links them to that guest.
      await decideRequest(r.id, approve, approve ? r.claim_member : null);
      setRequests((list) => list.filter((x) => x.id !== r.id));
      void syncNow();
    } catch {
      notify(t('invite.requests'), t('members.failed'));
    } finally {
      setBusy(null);
    }
  };

  const nameOf = (id: string | null) => group.members.find((m) => m.id === id)?.name;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          {t(group.online?.settings.requireApproval ? 'invite.bodyApproval' : 'invite.body', { name: group.name })}
        </Text>

        {code === undefined && !failed ? <ActivityIndicator style={styles.loader} color={colors.tint} /> : null}
        {failed ? (
          <View style={styles.card}>
            <Text style={styles.note}>{t('invite.failed')}</Text>
            <PrimaryButton label={t('error.retry')} variant="outline" onPress={() => void load()} style={styles.gap} />
          </View>
        ) : null}
        {code === null ? (
          <View style={styles.card}>
            <Ionicons name="link-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.note}>{t('invite.off')}</Text>
          </View>
        ) : null}

        {link ? (
          <View style={styles.card}>
            {/* White behind the code, so any camera reads it in dark mode too. */}
            <View style={styles.qr}>
              <QRCode value={link} size={196} backgroundColor="#FFFFFF" color="#241012" />
            </View>
            <Text style={styles.codeLabel}>{t('invite.code')}</Text>
            <Text style={styles.code} selectable>
              {code}
            </Text>
            <Text style={styles.link} selectable numberOfLines={1}>
              {link}
            </Text>
            <View style={styles.actions}>
              <PrimaryButton
                label={t('invite.copy')}
                variant="outline"
                style={styles.flex}
                onPress={() =>
                  Clipboard.setStringAsync(link)
                    .then(() => showNote(t('invite.copied')))
                    .catch(() => {})
                }
              />
              <PrimaryButton
                label={t('invite.share')}
                style={styles.flex}
                onPress={() => Share.share({ message: t('invite.shareText', { name: group.name, link }) }).catch(() => {})}
              />
            </View>
            {can('reset_invite', group) ? (
              <Pressable onPress={reset} hitSlop={8} style={styles.reset}>
                <Text style={styles.resetText}>{t('invite.reset')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {admin && requests.length ? (
          <>
            <SectionLabel>{t('invite.requests')}</SectionLabel>
            {requests.map((r) => (
              <View key={r.id} style={styles.request}>
                <Avatar name={r.name} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.reqName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  {nameOf(r.claim_member) ? (
                    <Text style={styles.reqClaim} numberOfLines={1}>
                      {t('invite.claims', { name: nameOf(r.claim_member)! })}
                    </Text>
                  ) : null}
                </View>
                {busy === r.id ? (
                  <ActivityIndicator color={colors.tint} />
                ) : (
                  <>
                    <Pressable onPress={() => void decide(r, false)} hitSlop={6} style={styles.reqBtn}>
                      <Text style={styles.reqReject}>{t('invite.reject')}</Text>
                    </Pressable>
                    <Pressable onPress={() => void decide(r, true)} hitSlop={6} style={[styles.reqBtn, styles.reqApprove]}>
                      <Text style={styles.reqApproveText}>{t('invite.approve')}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </>
        ) : null}

        {can('change_settings', group) ? (
          <View style={styles.settings}>
            <SettingsRow
              icon="options-outline"
              title={t('invite.settings')}
              subtitle={t('invite.settingsBody')}
              onPress={() => navigation.navigate('GroupSettings', { groupId: group.id })}
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: spacing(3), alignSelf: 'stretch' },
  loader: { marginTop: spacing(10) },
  body: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 20, marginBottom: spacing(4) },
  card: {
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(5),
    gap: spacing(1),
  },
  note: { fontSize: font.sm + 1, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  qr: { backgroundColor: '#FFFFFF', padding: spacing(3), borderRadius: radii.md, marginBottom: spacing(3) },
  codeLabel: { fontSize: font.xs, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  code: { fontSize: font.xl + 2, fontWeight: '800', letterSpacing: 4, color: c.textPrimary },
  link: { fontSize: font.sm, color: c.tint, marginTop: spacing(1), maxWidth: '100%' },
  actions: { flexDirection: 'row', gap: spacing(2), alignSelf: 'stretch', marginTop: spacing(4) },
  reset: { marginTop: spacing(3) },
  resetText: { fontSize: font.sm, fontWeight: '700', color: c.danger },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  reqName: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  reqClaim: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  reqBtn: { paddingHorizontal: spacing(3), paddingVertical: spacing(2), borderRadius: radii.pill },
  reqReject: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  reqApprove: { backgroundColor: c.primary },
  reqApproveText: { fontSize: font.sm, fontWeight: '700', color: c.onPrimary },
  settings: { marginTop: spacing(5) },
}));
