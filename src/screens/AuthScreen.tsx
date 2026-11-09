import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { resendConfirmation, sendPasswordReset, signIn, signUp } from '../lib/api/account';
import { authErrorKey, isEmail, PASSWORD_MIN } from '../lib/accountRules';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

type Mode = 'signIn' | 'signUp' | 'reset';

/** Sign in, create an account, or get a password reset link. An account is optional. */
export function AuthScreen({ navigation, route }: ScreenProps<'Auth'>) {
  const { profile } = useGroups();
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'signIn');
  // Profile's name, so most people don't type it twice.
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After sign-up (when the email must be confirmed) or a reset request.
  const [sent, setSent] = useState<'confirm' | 'reset' | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t(mode === 'signUp' ? 'account.createAccount' : mode === 'reset' ? 'account.resetTitle' : 'account.signIn'),
    });
  }, [navigation, mode, t]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  const done = () => {
    showNote(t('account.signedIn', { email: email.trim() }));
    navigation.goBack();
  };

  const submit = async () => {
    setError(null);
    if (mode === 'signUp' && !name.trim()) return setError(t('account.err.name'));
    if (!isEmail(email)) return setError(t('account.err.email'));
    if (mode === 'signUp' && password.length < PASSWORD_MIN) return setError(t('account.err.password'));
    if (mode === 'signIn' && !password) return setError(t('account.err.noPassword'));
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        done();
      } else if (mode === 'signUp') {
        const { needsConfirm } = await signUp(name, email, password);
        if (needsConfirm) setSent('confirm');
        else done();
      } else {
        await sendPasswordReset(email);
        setSent('reset');
      }
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await resendConfirmation(email);
      showNote(t('account.resent'));
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.tint} />
          </View>
          <Text style={styles.sentTitle}>{t('account.checkEmail')}</Text>
          <Text style={styles.sentBody}>
            {sent === 'confirm' ? t('account.confirmSent', { email: email.trim() }) : t('account.resetSent', { email: email.trim() })}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={t('account.backToSignIn')} onPress={() => switchTo('signIn')} style={styles.button} />
          {sent === 'confirm' ? (
            <PrimaryButton label={t('account.resend')} variant="outline" onPress={resend} disabled={busy} style={styles.second} />
          ) : null}
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{mode === 'reset' ? t('account.resetBody') : t('account.intro')}</Text>

        {mode === 'signUp' ? (
          <Input
            label={t('account.name')}
            placeholder={t('account.namePlaceholder')}
            value={name}
            onChangeText={setName}
            maxLength={30}
            autoComplete="name"
          />
        ) : null}
        <Input
          label={t('account.email')}
          placeholder={t('account.emailPlaceholder')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
        />
        {mode !== 'reset' ? (
          <>
            <Input
              label={t('account.password')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              onSubmitEditing={submit}
              returnKeyType="go"
              maxLength={72}
            />
            <View style={styles.passwordRow}>
              {mode === 'signUp' ? <Text style={styles.hint}>{t('account.passwordHint')}</Text> : <View />}
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Text style={styles.link}>{showPassword ? t('account.hidePassword') : t('account.showPassword')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={busy ? t('account.working') : t(mode === 'signUp' ? 'account.createAccount' : mode === 'reset' ? 'account.sendLink' : 'account.signIn')}
          onPress={submit}
          disabled={busy}
          style={styles.button}
        />

        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <Pressable onPress={() => switchTo('reset')} hitSlop={8}>
                <Text style={styles.link}>{t('account.forgot')}</Text>
              </Pressable>
              <Pressable onPress={() => switchTo('signUp')} hitSlop={8}>
                <Text style={styles.link}>{t('account.newHere')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => switchTo('signIn')} hitSlop={8}>
              <Text style={styles.link}>{mode === 'signUp' ? t('account.haveAccount') : t('account.backToSignIn')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5), paddingBottom: spacing(16) },
  intro: { fontSize: font.md, color: c.textSecondary, lineHeight: 21, marginBottom: spacing(5) },
  passwordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -spacing(2), marginBottom: spacing(4) },
  hint: { fontSize: font.sm, color: c.textSecondary },
  error: { color: c.danger, fontSize: font.sm + 1, fontWeight: '600', marginBottom: spacing(3), lineHeight: 19 },
  button: { marginTop: spacing(1) },
  second: { marginTop: spacing(3) },
  links: { alignItems: 'center', gap: spacing(4), marginTop: spacing(6) },
  link: { color: c.tint, fontWeight: '700', fontSize: font.md },
  sentIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing(8),
    marginBottom: spacing(4),
  },
  sentTitle: { fontSize: font.xl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
  sentBody: { fontSize: font.md, color: c.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: spacing(2), marginBottom: spacing(6) },
}));
