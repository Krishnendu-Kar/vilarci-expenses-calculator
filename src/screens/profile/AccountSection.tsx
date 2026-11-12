import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUndo } from '../../context/UndoContext';
import { useAuth } from '../../context/AuthContext';
import { SettingsRow } from '../../components/SettingsRow';
import { useSync } from '../../context/SyncContext';
import { deleteAccount, signOut } from '../../lib/api/account';
import { accountBlockers } from '../../lib/api/groups';
import { problemText } from '../group/useGroupExit';
import { authErrorKey } from '../../lib/accountRules';
import { confirmAction, notify } from '../../lib/confirm';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';

/** Profile, signed out: one quiet row that says what an account adds. */
export function SignInRow({ onOpen }: { onOpen: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
      <View style={styles.signInIcon}>
        <Ionicons name="cloud-done-outline" size={20} color={colors.onPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.signInTitle}>{t('profile.unlockButton')}</Text>
        <Text style={styles.signInBody} numberOfLines={2}>
          {t('profile.unlockShort')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/** Settings, signed in: Log out (with the email you're signed in as) and Delete account. */
export function AccountActions() {
  const { user } = useAuth();
  const { showNote } = useUndo();
  const { waiting } = useSync();
  const styles = useStyles();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  // Always asked first. Changes not uploaded yet would be lost: then it says so.
  const askLogOut = () => {
    const count = Object.values(waiting).reduce((s, n) => s + n, 0);
    if (count) {
      confirmAction(
        t('account.logOutWaitingTitle'),
        t('account.logOutWaitingBody', { count }),
        t('account.logOut'),
        () => void logOut(),
      );
    } else {
      confirmAction(t('account.logOutTitle'), t('account.logOutAsk'), t('account.logOut'), () => void logOut());
    }
  };

  const logOut = async () => {
    setBusy(true);
    try {
      await signOut();
      showNote(t('account.loggedOut'));
    } catch (e) {
      notify(t('account.logOut'), t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  // Deleting leaves every live group, so the same rules as leaving apply
  // (onlinedb.md §11.5). The warning comes first; only then is the server
  // asked what stands in the way; then one last "this can't be undone".
  const remove = () =>
    confirmAction(t('account.deleteTitle'), t('account.deleteBody'), t('account.deleteContinue'), () => void check());

  const check = async () => {
    setBusy(true);
    let blockers;
    try {
      blockers = await accountBlockers();
    } catch (e) {
      notify(t('account.delete'), t(authErrorKey(e)));
      return;
    } finally {
      setBusy(false);
    }
    if (blockers.length) {
      notify(t('account.blockedTitle'), blockers.map((b) => `${b.name}: ${problemText(b)}`).join('\n\n'));
      return;
    }
    confirmAction(
      t('account.deleteSureTitle'),
      t('account.deleteSureBody', { email: user?.email ?? '' }),
      t('account.deleteButton'),
      () => void destroy(),
    );
  };

  const destroy = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      showNote(t('account.deleted'));
    } catch (e) {
      notify(t('account.delete'), t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingsRow
        icon="log-out-outline"
        title={t('account.logOut')}
        subtitle={user?.email}
        action
        disabled={busy}
        onPress={askLogOut}
      />
      <View style={styles.divider} />
      <SettingsRow icon="trash-outline" title={t('account.delete')} danger disabled={busy} onPress={remove} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginTop: spacing(4),
    padding: spacing(3.5),
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  signInIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  signInTitle: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  signInBody: { fontSize: font.sm, color: c.textSecondary, marginTop: 1, lineHeight: 17 },
  // Same line as between the other Settings rows.
  divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing(4) + 36 + spacing(3) },
}));
