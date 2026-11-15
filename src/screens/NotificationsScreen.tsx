import React, { useEffect } from 'react';
import { Linking, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { SettingsRow } from '../components/SettingsRow';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupsContext';
import { usePush } from '../context/PushContext';
import { notify } from '../lib/confirm';
import { groupKindOf } from '../data/categories';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { IconName } from '../data/categories';
import type { PushKind } from '../lib/api/push';
import type { ScreenProps } from '../navigation/types';

const KINDS: { kind: PushKind; icon: IconName; title: Key; sub: Key }[] = [
  { kind: 'expenses', icon: 'receipt-outline', title: 'push.expenses', sub: 'push.expensesSub' },
  { kind: 'payments', icon: 'cash-outline', title: 'push.payments', sub: 'push.paymentsSub' },
  { kind: 'reminders', icon: 'alarm-outline', title: 'push.reminders', sub: 'push.remindersSub' },
  { kind: 'members', icon: 'people-outline', title: 'push.members', sub: 'push.membersSub' },
  { kind: 'requests', icon: 'person-add-outline', title: 'push.requests', sub: 'push.requestsSub' },
  { kind: 'news', icon: 'megaphone-outline', title: 'push.news', sub: 'push.newsSub' },
];

/**
 * Settings → Notifications: whether this phone gets them at all (the
 * permission), which kinds, and which live groups are muted. The switches
 * belong to your account, so every phone you're signed in on follows them.
 */
export function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { groups } = useGroups();
  const push = usePush();
  const live = groups.filter((g) => g.online);
  const canChange = !!user;

  useEffect(() => {
    push.refresh();
    // once, on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = () => notify(t('push.saveFailed'), t('push.saveFailedBody'));
  const setKind = (kind: PushKind, on: boolean) => void push.setKind(kind, on).catch(failed);
  const setGroup = (groupId: string, on: boolean) => void push.setMuted(groupId, !on).catch(failed);

  // What the top says: where notifications stand on this phone. Nothing
  // where they can't work at all (Expo Go, the web): no warning for that.
  let status: { icon: IconName; text: string; tone: 'ok' | 'warn' | 'info'; action?: { label: string; run: () => void } } | null;
  if (!push.supported) status = null;
  else if (!user)
    status = {
      icon: 'person-circle-outline',
      text: t('push.signedOut'),
      tone: 'info',
      action: { label: t('account.signIn'), run: () => navigation.navigate('Auth', { mode: 'signIn' }) },
    };
  else if (push.permission === 'denied')
    status = {
      icon: 'notifications-off-outline',
      text: t('push.denied'),
      tone: 'warn',
      action: { label: t('push.openSettings'), run: () => void push.turnOn() },
    };
  else if (push.permission !== 'granted')
    status = { icon: 'notifications-outline', text: t('push.off'), tone: 'warn', action: { label: t('push.turnOn'), run: () => void push.turnOn() } };
  else status = { icon: 'checkmark-circle', text: t('push.on'), tone: 'ok' };

  const toneColor = status?.tone === 'ok' ? colors.success : status?.tone === 'warn' ? colors.danger : colors.tint;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {status ? (
          <View style={styles.status}>
            <View style={styles.statusRow}>
              <Ionicons name={status.icon} size={22} color={toneColor} />
              <Text style={styles.statusText}>{status.text}</Text>
            </View>
            {status.action ? <PrimaryButton label={status.action.label} onPress={status.action.run} style={styles.statusBtn} /> : null}
          </View>
        ) : null}

        <SectionLabel>{t('push.whatTitle')}</SectionLabel>
        <View style={[styles.group, !canChange && styles.dim]}>
          {KINDS.map((k, i) => (
            <React.Fragment key={k.kind}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <ToggleRow
                icon={k.icon}
                title={t(k.title)}
                subtitle={t(k.sub)}
                value={push.prefs[k.kind]}
                disabled={!canChange}
                onChange={(on) => setKind(k.kind, on)}
              />
            </React.Fragment>
          ))}
        </View>

        {canChange && live.length ? (
          <>
            <SectionLabel>{t('push.groupsTitle')}</SectionLabel>
            <Text style={styles.hint}>{t('push.groupsHint')}</Text>
            <View style={styles.group}>
              {live.map((g, i) => (
                <React.Fragment key={g.id}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <ToggleRow
                    icon={groupKindOf(g.kind).icon}
                    title={g.name}
                    value={!push.isMuted(g.id)}
                    oneLine
                    onChange={(on) => setGroup(g.id, on)}
                  />
                </React.Fragment>
              ))}
            </View>
          </>
        ) : null}

        {push.supported ? (
          <>
            <SectionLabel>{t('push.phoneTitle')}</SectionLabel>
            <View style={styles.group}>
              <SettingsRow
                icon="volume-medium-outline"
                title={t('push.sound')}
                subtitle={t('push.soundSub')}
                onPress={() => void Linking.openSettings().catch(() => {})}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.footer}>{t('push.footer')}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  disabled,
  oneLine,
  onChange,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  /** Group names: one line. The kinds wrap. */
  oneLine?: boolean;
  onChange: (on: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.tint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={oneLine ? 1 : undefined}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.surfaceAlt}
        // react-native-web colours the "on" thumb with its own prop.
        {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.primary } as object) : {})}
        accessibilityLabel={title}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5), paddingBottom: spacing(10) },
  status: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
    marginBottom: spacing(2),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  statusText: { flex: 1, fontSize: font.md, color: c.textPrimary, lineHeight: 21 },
  statusBtn: { marginTop: spacing(4) },
  group: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  dim: { opacity: 0.55 },
  divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing(4) + 36 + spacing(3) },
  hint: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19, marginBottom: spacing(2.5), marginLeft: spacing(1) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    backgroundColor: c.surface,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: font.md + 1, fontWeight: '600', color: c.textPrimary },
  subtitle: { fontSize: font.sm, color: c.textSecondary, marginTop: 2, lineHeight: 18 },
  footer: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19, marginTop: spacing(6), marginHorizontal: spacing(1) },
}));
