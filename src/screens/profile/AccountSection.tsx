import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUndo } from '../../context/UndoContext';
import { deleteAccount, signOut } from '../../lib/api/account';
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

/** Profile, signed in: Log out and Delete account, as a short list at the bottom. */
export function AccountActions() {
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

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

  const remove = () =>
    confirmAction(t('account.deleteTitle'), t('account.deleteBody'), t('account.deleteButton'), async () => {
      setBusy(true);
      try {
        await deleteAccount();
        showNote(t('account.deleted'));
      } catch (e) {
        notify(t('account.delete'), t(authErrorKey(e)));
      } finally {
        setBusy(false);
      }
    });

  return (
    <View style={styles.list}>
      <Pressable onPress={logOut} disabled={busy} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.rowText}>{t('account.logOut')}</Text>
      </Pressable>
      <Pressable onPress={remove} disabled={busy} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.pressed]}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
        <Text style={[styles.rowText, styles.danger]}>{t('account.delete')}</Text>
      </Pressable>
    </View>
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
  list: { marginTop: spacing(8), backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(4) },
  rowLine: { borderTopWidth: 1, borderTopColor: c.background },
  rowText: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  danger: { color: c.danger },
}));
