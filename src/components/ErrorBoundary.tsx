import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { loadRawGroups } from '../lib/storage';
import { buildBackup } from '../lib/backup';
import { sanitizeGroups } from '../lib/migrate';
import { shareMessage, shareTextFile } from '../lib/files';
import { todayISO } from '../lib/format';
import { notify } from '../lib/confirm';
import appConfig from '../../app.json';

// When something breaks while drawing a screen (or a crash would otherwise
// close the app), this shows a calm page instead: try again, and a way to
// save your data and send the details to us.

interface State {
  error: Error | null;
}

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
/** React Native's global error hook (not on web). */
const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler(): ErrorHandler; setGlobalHandler(h: ErrorHandler): void } })
  .ErrorUtils;

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };
  private previousHandler?: ErrorHandler;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    // Errors outside rendering (a button handler, a timer) would close the
    // app in a release build. Show this page instead. Development keeps
    // React Native's red error screen.
    if (!errorUtils || __DEV__) return;
    this.previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal) this.setState({ error: error instanceof Error ? error : new Error(String(error)) });
      else this.previousHandler?.(error, isFatal);
    });
  }

  componentWillUnmount() {
    if (errorUtils && this.previousHandler) errorUtils.setGlobalHandler(this.previousHandler);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Screen crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
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
      const raw = await loadRawGroups();
      if (!raw) return notify(t('error.noData'), t('error.noDataBody'));
      let content = raw;
      try {
        const groups = sanitizeGroups(JSON.parse(raw)?.groups).groups;
        if (groups.length) content = buildBackup(groups);
      } catch {
        // Unreadable: share it exactly as stored so nothing is lost.
      }
      await shareTextFile(`vilarci-e-split-backup-${todayISO()}.json`, content, 'application/json');
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
