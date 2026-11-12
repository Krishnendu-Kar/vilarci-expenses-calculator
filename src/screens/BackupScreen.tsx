import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { Segmented } from '../components/Segmented';
import { useGroups } from '../context/GroupsContext';
import { useUndo } from '../context/UndoContext';
import { disconnectGoogle, driveAccess, driveConnectedEmail, googleAvailable } from '../lib/api/google';
import { downloadBackup, listBackups, setRestoreFile, type DriveFile } from '../lib/drive';
import { backUpToDrive, readAutoEvery, readLastBackup, saveAutoEvery, type AutoEvery, type LastBackup } from '../lib/autoBackup';
import { notify } from '../lib/confirm';
import { shortDate } from '../lib/format';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const when = (ms: number) => `${shortDate(ms)}, ${new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

/**
 * Settings → Google Drive backup (onlinedb.md §21): your groups in Drive's
 * hidden app folder (only this app can read it), the newest two kept. Back
 * up now, automatically (daily or weekly, when the app opens), or restore
 * through the usual Import preview.
 */
export function BackupScreen({ navigation }: ScreenProps<'Backup'>) {
  const { groups } = useGroups();
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const available = googleAvailable();
  const [email, setEmail] = useState<string | null>(() => (available ? driveConnectedEmail() : null));
  const [last, setLast] = useState<LastBackup | null>(null);
  const [every, setEvery] = useState<AutoEvery>(0);
  const [busy, setBusy] = useState<'backup' | 'list' | string | null>(null);
  const [files, setFiles] = useState<DriveFile[] | null>(null);

  useEffect(() => {
    void readLastBackup().then(setLast);
    void readAutoEvery().then(setEvery);
  }, []);

  const failed = (e: unknown) => notify(t('backup.failed'), e instanceof Error ? e.message : String(e));

  const backUp = async () => {
    setBusy('backup');
    try {
      const done = await backUpToDrive(groups, true);
      if (!done) return;
      setLast(done);
      setEmail(driveConnectedEmail());
      showNote(t('backup.done'));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const showRestore = async () => {
    setBusy('list');
    try {
      const access = await driveAccess(true);
      if (!access) return;
      setEmail(access.email);
      setFiles(await listBackups(access.token));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  // The file goes to the Import page, which previews it before anything changes.
  const restore = async (f: DriveFile) => {
    setBusy(f.id);
    try {
      const access = await driveAccess(true);
      if (!access) return;
      setRestoreFile({ name: f.name, text: await downloadBackup(access.token, f.id) });
      navigation.navigate('Import');
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const changeEvery = (v: AutoEvery) => {
    setEvery(v);
    void saveAutoEvery(v);
  };

  const disconnect = async () => {
    await disconnectGoogle();
    setEmail(null);
    setFiles(null);
  };

  if (!available) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.body}>{t('backup.unavailable')}</Text>
          <PrimaryButton label={t('export.title')} variant="outline" onPress={() => navigation.navigate('Export')} style={styles.wide} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>{t('backup.explain')}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="logo-google" size={18} color={colors.tint} />
            <Text style={styles.rowText} numberOfLines={1}>
              {email ?? t('backup.notConnected')}
            </Text>
            {email ? (
              <Pressable onPress={() => void disconnect()} hitSlop={8}>
                <Text style={styles.link}>{t('backup.disconnect')}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.row, styles.rowLine]}>
            <Ionicons name="time-outline" size={18} color={colors.tint} />
            <Text style={styles.rowText}>
              {last ? t('backup.last', { when: when(last.at), size: kb(last.size) }) : t('backup.never')}
            </Text>
          </View>
        </View>

        <PrimaryButton
          label={busy === 'backup' ? t('backup.working') : t('backup.now')}
          onPress={() => void backUp()}
          disabled={!!busy}
          style={styles.button}
        />

        <SectionLabel>{t('backup.auto')}</SectionLabel>
        <Segmented<'0' | '1' | '7'>
          options={[
            { key: '0', label: t('backup.off') },
            { key: '1', label: t('backup.daily') },
            { key: '7', label: t('backup.weekly') },
          ]}
          value={String(every) as '0' | '1' | '7'}
          onChange={(k) => changeEvery(Number(k) as AutoEvery)}
        />
        <Text style={styles.hint}>{t('backup.autoHint')}</Text>

        <SectionLabel>{t('backup.restore')}</SectionLabel>
        {files === null ? (
          <PrimaryButton
            label={busy === 'list' ? t('backup.looking') : t('backup.findBackups')}
            variant="outline"
            onPress={() => void showRestore()}
            disabled={!!busy}
          />
        ) : files.length === 0 ? (
          <Text style={styles.hint}>{t('backup.none')}</Text>
        ) : (
          <View style={styles.card}>
            {files.map((f, i) => (
              <Pressable
                key={f.id}
                onPress={() => void restore(f)}
                disabled={!!busy}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.tint} />
                <Text style={styles.rowText}>
                  {when(Date.parse(f.createdTime))}
                  {f.size ? ` · ${kb(Number(f.size))}` : ''}
                </Text>
                <Text style={styles.link}>{busy === f.id ? t('backup.opening') : t('backup.restoreThis')}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  explain: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19, marginBottom: spacing(4) },
  card: { backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3.5) },
  rowLine: { borderTopWidth: 1, borderTopColor: c.border },
  rowText: { flex: 1, fontSize: font.md, color: c.textPrimary },
  link: { fontSize: font.sm, fontWeight: '700', color: c.tint },
  pressed: { backgroundColor: c.surfaceAlt },
  button: { marginTop: spacing(4) },
  hint: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18, marginTop: spacing(2) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(8), gap: spacing(4) },
  body: { fontSize: font.md, color: c.textPrimary, textAlign: 'center', lineHeight: 22 },
  wide: { alignSelf: 'stretch' },
}));
