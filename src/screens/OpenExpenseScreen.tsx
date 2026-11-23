import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroBackground } from '../components/HeroBackground';
import { PrimaryButton } from '../components/PrimaryButton';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupsContext';
import { useLock } from '../context/LockContext';
import { useSync } from '../context/SyncContext';
import { useConnection } from '../lib/network';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';
import type { Key } from '../i18n';
import type { ScreenProps } from '../navigation/types';

type Status = 'loading' | 'broken' | 'signIn' | 'notMember' | 'missing' | 'offline';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAYS: Record<Exclude<Status, 'loading'>, { icon: IconName; title: Key; body: Key }> = {
  broken: { icon: 'link-outline', title: 'openExp.brokenTitle', body: 'openExp.brokenBody' },
  signIn: { icon: 'person-circle-outline', title: 'openExp.signInTitle', body: 'openExp.signInBody' },
  notMember: { icon: 'people-outline', title: 'openExp.notMemberTitle', body: 'openExp.notMemberBody' },
  missing: { icon: 'receipt-outline', title: 'openExp.missingTitle', body: 'openExp.missingBody' },
  offline: { icon: 'cloud-offline-outline', title: 'net.offline', body: 'openExp.offlineBody' },
};

/**
 * A shared expense link (https://esplit.vilarci.in/e/…) opened the app: a
 * card over Home while it finds the expense. In the group: the group opens
 * with the expense on top (after the fingerprint, for a locked group).
 * Otherwise the card says why not: sign in, not in this group, not here
 * (deleted or not uploaded yet), no internet, or a broken link. It never
 * shows anything about a group this phone doesn't have.
 */
export function OpenExpenseScreen({ navigation, route }: ScreenProps<'OpenExpense'>) {
  const { groupId, expenseId } = route.params ?? {};
  const { user } = useAuth();
  const { ready, peekGroups } = useGroups();
  const { syncNow, state: syncState } = useSync();
  const { isOpen, open } = useLock();
  const connection = useConnection();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>(groupId && expenseId ? 'loading' : 'broken');
  const [tries, setTries] = useState(0);

  // Read inside the search below, which outlives a render.
  const latest = useRef({ syncState, connection, isOpen, open, t });
  latest.current = { syncState, connection, isOpen, open, t };

  const close = () => navigation.goBack();

  useEffect(() => {
    if (!groupId || !expenseId || !ready) return;
    let current = true;
    const find = () => peekGroups().find((g) => g.id === groupId);
    const here = () => !!find()?.expenses.some((e) => e.id === expenseId);

    void (async () => {
      setStatus('loading');
      // Not on this phone yet (a new phone, just joined, or added a moment ago): fetch first.
      if (!here() && user) {
        await syncNow();
        // A sync already running answers at once: wait for it to finish (at most ~15 s).
        for (let i = 0; i < 60 && latest.current.syncState === 'syncing'; i++) await wait(250);
      }
      if (!current) return;
      const group = find();
      const offline = latest.current.connection === 'offline' || latest.current.syncState === 'failed';
      if (group && here()) {
        const { isOpen: unlocked, open: ask, t: tr } = latest.current;
        if (!unlocked(group.id) && !(await ask(group.id, tr('lock.promptOpen', { name: group.name })))) {
          // Not unlocked: nothing about it is shown.
          if (current) navigation.goBack();
          return;
        }
        if (!current) return;
        // This card makes way for the group, with the expense on top; back goes to the group.
        navigation.dispatch((state) => {
          const below = state.routes.slice(0, -1);
          const last = below[below.length - 1];
          const sameGroup = last?.name === 'GroupDetail' && (last.params as { groupId?: string } | undefined)?.groupId === groupId;
          const routes = [
            ...below,
            ...(sameGroup ? [] : [{ name: 'GroupDetail' as const, params: { groupId } }]),
            { name: 'Expense' as const, params: { groupId, expenseId } },
          ];
          return CommonActions.reset({ ...state, routes, index: routes.length - 1 } as Parameters<typeof CommonActions.reset>[0]);
        });
        return;
      }
      if (group) setStatus(offline ? 'offline' : 'missing');
      else if (!user) setStatus('signIn');
      else setStatus(offline ? 'offline' : 'notMember');
    })();
    return () => {
      current = false;
    };
    // Again after signing in, and on Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, expenseId, ready, user?.id, tries]);

  const says = status === 'loading' ? null : SAYS[status];

  return (
    <View style={styles.fill}>
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
              <Ionicons name={says?.icon ?? 'receipt-outline'} size={30} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.headTitle} numberOfLines={2}>
            {says ? t(says.title) : t('openExp.loading')}
          </Text>
        </HeroBackground>
        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          {!says ? (
            <ActivityIndicator style={styles.loader} color={colors.tint} />
          ) : (
            <>
              <Text style={styles.message}>{t(says.body)}</Text>
              {status === 'signIn' ? (
                <PrimaryButton label={t('account.signIn')} onPress={() => navigation.navigate('Auth', { mode: 'signIn' })} />
              ) : status === 'missing' || status === 'offline' ? (
                <PrimaryButton label={t('error.retry')} onPress={() => setTries((n) => n + 1)} />
              ) : (
                <PrimaryButton label={t('join.done')} variant="outline" onPress={close} />
              )}
              {status === 'signIn' || status === 'missing' || status === 'offline' ? (
                <Pressable onPress={close} hitSlop={8} style={styles.notNow}>
                  <Text style={styles.notNowText}>{t('join.notNow')}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
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
  body: { padding: spacing(5), gap: spacing(3) },
  loader: { marginVertical: spacing(8) },
  message: { fontSize: font.md, color: c.textPrimary, lineHeight: 22, marginBottom: spacing(2) },
  notNow: { alignSelf: 'center', paddingVertical: spacing(1) },
  notNowText: { fontSize: font.sm + 1, fontWeight: '600', color: c.textSecondary },
}));
