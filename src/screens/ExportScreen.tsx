import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { buildBackup } from '../lib/backup';
import { shareTextFile } from '../lib/files';
import { getLastBackup, setLastBackup } from '../lib/storage';
import { shortDate, todayISO } from '../lib/format';
import { notify } from '../lib/confirm';
import { makeStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

const STALE_MS = 14 * 24 * 3600 * 1000;

export function ExportScreen() {
  const { groups } = useGroups();
  const styles = useStyles();
  const { t } = useI18n();
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
      await shareTextFile(`vilarci-e-split-backup-${todayISO()}.json`, buildBackup(groups), 'application/json');
      const now = Date.now();
      await setLastBackup(now);
      setLast(now);
    } catch (e) {
      notify(t('export.failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>{t('export.explain')}</Text>

        <View style={styles.card}>
          <Text style={styles.title}>
            {t('count.group', { count: groups.length })} · {t('count.expense', { count: expenseCount })}
          </Text>
          <Text style={[styles.meta, stale && groups.length > 0 && styles.warn]}>
            {lastBackup ? t('export.last', { date: shortDate(lastBackup) }) : t('export.never')}
          </Text>
          <PrimaryButton
            label={busy ? t('export.preparing') : t('export.button')}
            onPress={exportAll}
            disabled={busy || groups.length === 0}
            style={styles.btn}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5) },
  explain: { fontSize: font.md, color: c.textSecondary, lineHeight: 21, marginBottom: spacing(5) },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm + 1, color: c.textSecondary, marginTop: spacing(1) },
  warn: { color: c.danger, fontWeight: '600' },
  btn: { marginTop: spacing(4) },
}));
