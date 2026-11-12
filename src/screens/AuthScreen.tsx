import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Input } from '../components/Input';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { resendConfirmation, sendPasswordReset, signIn, signUp, verifySignUpCode } from '../lib/api/account';
import { googleAvailable, signInWithGoogle } from '../lib/api/google';
import { authErrorKey, cleanCode, isCode, isEmail, PASSWORD_MIN } from '../lib/accountRules';
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
  // The code from the sign-up email, and seconds until it may be sent again.
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

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

  const withGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const signedInAs = await signInWithGoogle();
      if (signedInAs !== null) {
        showNote(t('account.signedIn', { email: signedInAs }));
        navigation.goBack();
      }
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
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
        if (needsConfirm) {
          setCode('');
          setWait(RESEND_WAIT);
          setSent('confirm');
        } else done();
      } else {
        await sendPasswordReset(email);
        setSent('reset');
      }
    } catch (e) {
      if (mode === 'signIn' && (e as { code?: string })?.code === 'email_not_confirmed') {
        await resendConfirmation(email).catch(() => {});
        setCode('');
        setWait(RESEND_WAIT);
        setSent('confirm');
        showNote(t('account.codeSentAgain', { email: email.trim() }));
      } else setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!isCode(code)) return setError(t('account.err.code'));
    setBusy(true);
    try {
      await verifySignUpCode(email, cleanCode(code));
      done();
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
      setWait(RESEND_WAIT);
      showNote(t('account.codeSentAgain', { email: email.trim() }));
    } catch (e) {
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  if (sent === 'confirm') {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sentIcon}>
            <Ionicons name="keypad-outline" size={34} color={colors.tint} />
          </View>
          <Text style={styles.sentTitle}>{t('account.codeTitle')}</Text>
          <Text style={styles.sentBody}>{t('account.codeBody', { email: email.trim() })}</Text>
          <Input
            label={t('account.codeLabel')}
            placeholder="123456"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/[^\d\s-]/g, ''));
              setError(null);
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={12}
            autoFocus
            onSubmitEditing={verify}
            returnKeyType="done"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={busy ? t('account.working') : t('account.verify')}
            onPress={verify}
            disabled={busy || !code.trim()}
            style={styles.button}
          />
          <PrimaryButton
            label={wait ? t('account.resendIn', { seconds: wait }) : t('account.resendCode')}
            variant="outline"
            onPress={resend}
            disabled={busy || wait > 0}
            style={styles.second}
          />
          <Pressable onPress={() => switchTo('signUp')} hitSlop={8} style={styles.changeEmail}>
            <Text style={styles.link}>{t('account.changeEmail')}</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Password reset: the link is on its way.
  if (sent) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.tint} />
          </View>
          <Text style={styles.sentTitle}>{t('account.checkEmail')}</Text>
          <Text style={styles.sentBody}>{t('account.resetSent', { email: email.trim() })}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={t('account.backToSignIn')} onPress={() => switchTo('signIn')} style={styles.button} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{mode === 'reset' ? t('account.resetBody') : t('account.intro')}</Text>

        {/* One tap with the Google account on the phone; email below for everyone else. */}
        {mode !== 'reset' && googleAvailable() ? (
          <>
            <Pressable
              onPress={() => void withGoogle()}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.google, pressed && styles.pressed]}
            >
              <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
              <Text style={styles.googleText}>{t('account.google')}</Text>
            </Pressable>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>{t('account.orEmail')}</Text>
              <View style={styles.orLine} />
            </View>
          </>
        ) : null}

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

/** Seconds before a new code may be asked for. */
const RESEND_WAIT = 60;

const useStyles = makeStyles((c) => ({
  changeEmail: { alignSelf: 'center', marginTop: spacing(5) },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2.5),
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingVertical: spacing(3.5),
  },
  googleText: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  pressed: { opacity: 0.8 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginVertical: spacing(5) },
  orLine: { flex: 1, height: 1, backgroundColor: c.border },
  orText: { fontSize: font.sm, color: c.textSecondary },
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
