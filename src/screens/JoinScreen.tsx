import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroBackground } from '../components/HeroBackground';
import { PrimaryButton } from '../components/PrimaryButton';
import { Input } from '../components/Input';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupsContext';
import { useSync } from '../context/SyncContext';
import { useUndo } from '../context/UndoContext';
import { joinGroup, previewInvite, type InvitePreview } from '../lib/api/groups';
import { inviteCode } from '../lib/invite';
import { groupKindOf } from '../data/categories';
import { notify } from '../lib/confirm';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';
import type { ScreenProps } from '../navigation/types';

// Codes are 8 letters and digits; a pasted link works too.
const CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const readCode = (text: string) => {
  const s = text.trim();
  const plain = s.toUpperCase().replace(/[\s-]/g, '');
  return CODE.test(plain) ? plain : inviteCode(s);
};

/**
 * Joining a live group (onlinedb.md §15), as a card over Home: the group's
 * name and size on the night-sky header, then Join (or Ask to join when an
 * admin approves new members). Saying which guest you are only happens in
 * groups where an admin approves: they check the claim before anything
 * moves. In an open group you join as yourself; an admin can link a guest
 * to you later.
 */
export function JoinScreen({ navigation, route }: ScreenProps<'Join'>) {
  const { user } = useAuth();
  const { peekGroups } = useGroups();
  const { syncNow } = useSync();
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState<string | null>(route.params?.code ?? null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [claim, setClaim] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState<'pending' | null>(null);

  const close = () => navigation.goBack();

  const look = useCallback(
    async (c: string) => {
      setLoading(true);
      try {
        setPreview(await previewInvite(c));
      } catch (e) {
        notify(t('join.failed'), e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (code && user) void look(code);
  }, [code, user, look]);

  const openGroup = async (groupId?: string) => {
    // The group comes down with the next sync; open it once it's here.
    await syncNow();
    if (groupId && peekGroups().some((g) => g.id === groupId)) navigation.replace('GroupDetail', { groupId });
    else navigation.goBack();
  };

  const join = async () => {
    if (!code || !preview) return;
    setLoading(true);
    try {
      // A claim only means anything where an admin approves (the server ignores it otherwise).
      const res = await joinGroup(code, preview.require_approval ? claim : null);
      if (res.status === 'joined' || res.status === 'member') {
        showNote(t('join.joined', { name: preview.name ?? '' }));
        await openGroup(res.group_id);
      } else if (res.status === 'pending') setJoined('pending');
      else setPreview({ ...preview, status: res.status });
    } catch (e) {
      notify(t('join.failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // ---- what the card says ----
  let body: React.ReactNode;
  let headTitle = t('join.title');
  let headSub: string | null = null;
  let headIcon: IconName = 'people-outline';

  if (!user) {
    body = (
      <>
        <Text style={styles.message}>{t('join.signInBody')}</Text>
        <PrimaryButton label={t('account.signIn')} onPress={() => navigation.navigate('Auth', { mode: 'signIn' })} />
      </>
    );
    headTitle = t('join.signIn');
  } else if (!code) {
    const found = readCode(typed);
    body = (
      <>
        <Input
          label={t('join.codeLabel')}
          placeholder={t('join.codePlaceholder')}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={() => found && setCode(found)}
          returnKeyType="go"
        />
        <PrimaryButton label={t('join.find')} disabled={!found} onPress={() => found && setCode(found)} />
      </>
    );
  } else if (!preview) {
    body = <ActivityIndicator style={styles.loader} color={colors.tint} />;
  } else {
    const status = joined ?? preview.status;
    const guests = preview.require_approval ? (preview.guests ?? []) : [];
    if (status !== 'invalid' && preview.name) {
      headTitle = preview.name;
      headSub = t('join.members', { count: preview.members ?? 0 });
      if (preview.kind) headIcon = groupKindOf(preview.kind).icon;
    }
    body =
      status === 'open' ? (
        <>
          {preview.require_approval ? (
            <View style={styles.tag}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.tint} />
              <Text style={styles.tagText}>{t('join.approvalTag')}</Text>
            </View>
          ) : null}
          {guests.length ? (
            <>
              <Text style={styles.label}>{t('join.whoTitle')}</Text>
              <Text style={styles.hint}>{t('join.whoBody')}</Text>
              <View style={styles.chips}>
                {[...guests, { id: '', name: t('join.none') }].map((g) => {
                  const on = (claim ?? '') === g.id;
                  return (
                    <Pressable
                      key={g.id || 'none'}
                      onPress={() => setClaim(g.id || null)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      {on ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.hint}>{preview.require_approval ? t('join.approvalNote') : t('join.claimLater')}</Text>
          )}
          <PrimaryButton
            label={loading ? t('account.working') : preview.require_approval ? t('join.ask') : t('join.button')}
            disabled={loading}
            onPress={() => void join()}
          />
          <Pressable onPress={close} hitSlop={8} style={styles.notNow}>
            <Text style={styles.notNowText}>{t('join.notNow')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.statusRow}>
            <Ionicons
              name={
                status === 'member'
                  ? 'checkmark-circle'
                  : status === 'pending'
                    ? 'time-outline'
                    : status === 'full'
                      ? 'people-circle-outline'
                      : 'alert-circle-outline'
              }
              size={22}
              color={status === 'member' ? colors.success : colors.textSecondary}
            />
            <Text style={styles.message}>
              {status === 'member'
                ? t('join.member')
                : status === 'pending'
                  ? t('join.pending')
                  : status === 'full'
                    ? t('join.full')
                    : t('join.invalid')}
            </Text>
          </View>
          {status === 'member' ? (
            <PrimaryButton label={t('join.open')} onPress={() => void openGroup(preview.group_id)} />
          ) : (
            <PrimaryButton label={t('join.done')} variant="outline" onPress={close} />
          )}
        </>
      );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Home stays behind, dimmed; tapping it closes the card. */}
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t('common.cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(5) }]}>
        <HeroBackground kind="stars" style={styles.head}>
          <View style={styles.handle} />
          <Pressable onPress={close} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <Ionicons name={headIcon} size={30} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.headTitle} numberOfLines={2}>
            {headTitle}
          </Text>
          {headSub ? <Text style={styles.headSub}>{headSub}</Text> : <Text style={styles.headSub}>{t('join.subtitle')}</Text>}
        </HeroBackground>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
          {body}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: c.backdrop },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl + 6,
    borderTopRightRadius: radii.xl + 6,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  head: {
    alignItems: 'center',
    paddingTop: spacing(3),
    paddingBottom: spacing(6),
    paddingHorizontal: spacing(6),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', marginBottom: spacing(4) },
  closeBtn: {
    position: 'absolute',
    top: spacing(3),
    right: spacing(4),
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  iconRing: { padding: 5, borderRadius: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: spacing(3) },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headTitle: { fontFamily: DISPLAY_FONT, fontSize: font.xxl, color: '#FFFFFF', textAlign: 'center' },
  headSub: { fontSize: font.sm + 1, color: 'rgba(255,255,255,0.75)', marginTop: spacing(1) },
  body: { padding: spacing(5), gap: spacing(3) },
  loader: { marginVertical: spacing(8) },
  message: { flex: 1, fontSize: font.md, color: c.textPrimary, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3), marginBottom: spacing(2) },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing(1.5),
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  tagText: { fontSize: font.sm, fontWeight: '600', color: c.textPrimary },
  label: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing(1),
  },
  hint: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: font.sm + 1, fontWeight: '600', color: c.textPrimary },
  chipTextOn: { color: c.onPrimary },
  notNow: { alignSelf: 'center', paddingVertical: spacing(1) },
  notNowText: { fontSize: font.sm + 1, fontWeight: '600', color: c.textSecondary },
}));
