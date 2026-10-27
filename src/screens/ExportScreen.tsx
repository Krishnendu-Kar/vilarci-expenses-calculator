import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { buildBackup } from '../lib/backup';
import { shareTextFile } from '../lib/files';
import { getLastBackup, setLastBackup } from '../lib/storage';
import { plural, shortDate, todayISO } from '../lib/format';
import { notify } from '../lib/confirm';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';

const STALE_MS = 14 * 24 * 3600 * 1000;

export function ExportScreen() {
  const { groups } = useGroups();
  const [lastBackup, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getLastBackup().then(setLast).catch(() => {});
  }, []);

  const expenseCount = groups.reduce((s, g) => s + g.expenses.length, 0);
  const stale = !lastBackup || Date.now() - lastBackup > STALE_MS;

  const exportAll = async () => {
    setBusy(true);
    try {
      await shareTextFile(`vilarci-split-backup-${todayISO()}.json`, buildBackup(groups), 'application/json');
      const now = Date.now();
      await setLastBackup(now);
      setLast(now);
    } catch (e) {
      notify("Couldn't export", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>
          Saves all your groups into one file. Keep it in Google Drive, email, or WhatsApp. On a new phone, use
          Import data to get everything back.
        </Text>

        <View style={styles.card}>
          <Text style={styles.title}>
            {plural(groups.length, 'group')} · {plural(expenseCount, 'expense')}
          </Text>
          <Text style={[styles.meta, stale && groups.length > 0 && styles.warn]}>
            {lastBackup ? `Last exported ${shortDate(lastBackup)}` : 'Never exported'}
          </Text>
          <PrimaryButton
            label={busy ? 'Preparing…' : 'Export'}
            onPress={exportAll}
            disabled={busy || groups.length === 0}
            style={styles.btn}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5) },
  explain: { fontSize: font.md, color: colors.textSecondary, lineHeight: 21, marginBottom: spacing(5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: font.sm + 1, color: colors.textSecondary, marginTop: spacing(1) },
  warn: { color: colors.danger, fontWeight: '600' },
  btn: { marginTop: spacing(4) },
});
