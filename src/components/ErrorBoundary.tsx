import React, { useState } from 'react';
import { reloadAppAsync } from 'expo';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { exportSavedData } from '../lib/rescueExport';
import { shareMessage } from '../lib/files';
import { notify } from '../lib/confirm';
import appConfig from '../../app.json';

// When something breaks while drawing a screen, or a crash would otherwise
// close the app. The Play Store app never shows an error page (user,
// 2026-11-15): it quietly starts the screens again from Home, with the data
// read fresh from the phone. Crashing again and again (4 times in 30 s)
// restarts the whole app instead. The groups are on the phone the whole
// time, so nothing is lost. Development builds show the error page, to see
// what broke.

interface State {
  error: Error | null;
  /** Bumped to start the screens again from scratch. */
  round: number;
}

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
/** React Native's global error hook (not on web). */
const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler(): ErrorHandler; setGlobalHandler(h: ErrorHandler): void } })
  .ErrorUtils;

const QUIET = !__DEV__;
const WINDOW_MS = 30_000;
const MAX_ROUNDS = 3;

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, round: 0 };
  private previousHandler?: ErrorHandler;
  private crashes: number[] = [];

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    // Errors outside rendering (a button handler, a timer) would close the
    // app in a release build: recover the same quiet way. Development keeps
    // React Native's red error screen.
    if (!errorUtils || __DEV__) return;
    this.previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal) {
        console.warn('Fatal error', error);
        this.recover();
      } else this.previousHandler?.(error, isFatal);
    });
  }

  componentWillUnmount() {
    if (errorUtils && this.previousHandler) errorUtils.setGlobalHandler(this.previousHandler);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Screen crashed', error, info.componentStack);
    if (QUIET) this.recover();
  }

  /** Start again from Home; if that keeps failing, restart the app. */
  private recover() {
    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < WINDOW_MS), now];
    if (this.crashes.length > MAX_ROUNDS) {
      this.crashes = [];
      reloadAppAsync('Recovering from repeated crashes').catch(() => this.restartScreens());
      return;
    }
    this.restartScreens();
  }

  private restartScreens() {
    this.setState((s) => ({ error: null, round: s.round + 1 }));
  }

  render() {
    if (this.state.error) {
      // Only ever seen in development; the Play Store app is already starting again.
      return QUIET ? <Blank /> : <ErrorScreen error={this.state.error} onRetry={() => this.restartScreens()} />;
    }
    return <React.Fragment key={this.state.round}>{this.props.children}</React.Fragment>;
  }
}

/** The app's background for the moment it takes to start again. */
function Blank() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const details = `${appConfig.expo.name} ${appConfig.expo.version}\n${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();

  // Straight from storage: the app's own state may be what broke.
  const exportData = async () => {
    setBusy(true);
    try {
      if (!(await exportSavedData())) notify(t('error.noData'), t('error.noDataBody'));
    } catch (e) {
      notify(t('export.failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="bandage-outline" size={36} color={colors.tint} />
        </View>
        <Text style={styles.title}>{t('error.title')}</Text>
        <Text style={styles.body}>{t('error.body')}</Text>

        <PrimaryButton label={t('error.retry')} onPress={onRetry} style={styles.btn} />
        <PrimaryButton
          label={busy ? t('export.preparing') : t('error.export')}
          variant="outline"
          onPress={exportData}
          disabled={busy}
          style={styles.btnGap}
        />
        <PrimaryButton
          label={t('error.share')}
          variant="outline"
          onPress={() => shareMessage(details).catch(() => {})}
          style={styles.btnGap}
        />

        <Pressable onPress={() => setShowDetails((v) => !v)} hitSlop={8} style={styles.detailsToggle}>
          <Text style={styles.link}>{showDetails ? t('error.hideDetails') : t('error.showDetails')}</Text>
        </Pressable>
        {showDetails ? <Text style={styles.details}>{details}</Text> : null}
        {busy ? <ActivityIndicator color={colors.tint} style={styles.btnGap} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing(6), paddingTop: spacing(16), alignItems: 'stretch' },
  iconWrap: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(5),
  },
  title: { fontSize: font.xl, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
  body: { fontSize: font.md, color: c.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: spacing(2) },
  btn: { marginTop: spacing(8) },
  btnGap: { marginTop: spacing(3) },
  detailsToggle: { alignSelf: 'center', marginTop: spacing(6), padding: spacing(1) },
  link: { color: c.tint, fontWeight: '700', fontSize: font.sm + 1 },
  details: {
    marginTop: spacing(3),
    fontFamily: 'monospace',
    fontSize: font.xs,
    color: c.textSecondary,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: spacing(3),
  },
}));
