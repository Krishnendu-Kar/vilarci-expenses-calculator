import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { useGroups } from '../context/GroupsContext';
import { buildBackup, parseBackup, planImport, type ImportPlan } from '../lib/backup';
import { pickTextFile, shareTextFile } from '../lib/files';
import { getLastBackup, setLastBackup } from '../lib/storage';
import { groupTotal } from '../lib/split';
import { money } from '../lib/money';
import { plural, shortDate, todayISO } from '../lib/format';
import { notify } from '../lib/confirm';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { Group } from '../types';
import type { ScreenProps } from '../navigation/types';

interface Pending {
  fileName: string;
  exportedAt?: string;
  groups: Group[];
  skipped: number;
  plan: ImportPlan;
}

export function BackupScreen({ navigation }: ScreenProps<'Backup'>) {
  const { groups, importGroups } = useGroups();
  const [lastBackup, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getLastBackup().then(setLast).catch(() => {});
  }, []);

  const expenseCount = groups.reduce((s, g) => s + g.expenses.length, 0);

  const exportAll = async () => {
    setBusy('export');
    setDone(null);
    try {
      await shareTextFile(`vilarci-split-backup-${todayISO()}.json`, buildBackup(groups), 'application/json');
      const now = Date.now();
      await setLastBackup(now);
      setLast(now);
    } catch (e) {
      notify("Couldn't export", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    setBusy('import');
    setDone(null);
    try {
      const file = await pickTextFile();
      if (!file) return;
      const parsed = parseBackup(file.text);
      setPending({ fileName: file.name, ...parsed, plan: planImport(groups, parsed.groups) });
    } catch (e) {
      notify("Couldn't import", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    importGroups(pending.groups);
    setDone(`Imported ${plural(pending.groups.length, 'group')}.`);
    setPending(null);
  };

  const stale = !lastBackup || Date.now() - lastBackup > 14 * 24 * 3600 * 1000;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
          <Text style={styles.infoText}>
            Your groups are saved only on this phone. If you uninstall the app or switch phones, they're gone, so
            export a backup now and then and keep it in Google Drive, email, or a WhatsApp chat with yourself.
          </Text>
        </View>

        <SectionLabel>Export</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {plural(groups.length, 'group')} · {plural(expenseCount, 'expense')}
          </Text>
          <Text style={[styles.cardMeta, stale && groups.length > 0 && styles.warn]}>
            {lastBackup ? `Last exported ${shortDate(lastBackup)}` : 'Never backed up'}
          </Text>
          <PrimaryButton
            label={busy === 'export' ? 'Preparing…' : 'Export backup file'}
            onPress={exportAll}
            disabled={!!busy || groups.length === 0}
            style={styles.btn}
          />
        </View>

        <SectionLabel>Import</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.cardMeta}>
            Restore a backup, or open a group file a friend sent you. Groups you already have are updated, and
            new ones are added. Nothing changes until you confirm.
          </Text>
          <PrimaryButton
            label={busy === 'import' ? 'Opening…' : 'Choose a file'}
            variant="outline"
            onPress={pick}
            disabled={!!busy}
            style={styles.btn}
          />
        </View>

        {done ? (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.doneText}>{done}</Text>
            <PrimaryButton label="See groups" variant="outline" onPress={() => navigation.popToTop()} style={styles.doneBtn} />
          </View>
        ) : null}

        {pending ? (
          <View style={[styles.card, styles.preview]}>
            <Text style={styles.cardTitle}>Ready to import</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {pending.fileName}
              {pending.exportedAt ? ` · exported ${shortDate(Date.parse(pending.exportedAt))}` : ''}
            </Text>

            {pending.plan.added.map((g) => (
              <PreviewRow key={g.id} group={g} badge="New" tone="good" />
            ))}
            {pending.plan.replaced.map(({ incoming, localIsNewer }) => (
              <PreviewRow
                key={incoming.id}
                group={incoming}
                badge="Updates your copy"
                tone="warn"
                warning={localIsNewer ? 'Your copy was changed more recently. Those changes will be replaced.' : undefined}
              />
            ))}

            {pending.skipped ? (
              <Text style={styles.skipped}>
                {plural(pending.skipped, 'broken item')} in the file couldn't be read and will be skipped.
              </Text>
            ) : null}

            <PrimaryButton label={`Import ${plural(pending.groups.length, 'group')}`} onPress={confirmImport} style={styles.btn} />
            <PrimaryButton label="Cancel" variant="outline" onPress={() => setPending(null)} style={styles.btnSmallGap} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function PreviewRow({
  group,
  badge,
  tone,
  warning,
}: {
  group: Group;
  badge: string;
  tone: 'good' | 'warn';
  warning?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowName} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={[styles.badge, tone === 'good' ? styles.badgeGood : styles.badgeWarn]}>
          <Text style={[styles.badgeText, tone === 'good' ? styles.badgeTextGood : styles.badgeTextWarn]}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {plural(group.members.length, 'person')} · {plural(group.expenses.length, 'expense')} · {money(groupTotal(group))}
      </Text>
      {warning ? <Text style={styles.rowWarning}>{warning}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingBottom: spacing(12) },
  info: {
    flexDirection: 'row',
    gap: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing(4),
    marginBottom: spacing(6),
  },
  infoText: { flex: 1, fontSize: font.sm + 1, color: colors.textPrimary, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(6),
  },
  cardTitle: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: font.sm + 1, color: colors.textSecondary, marginTop: spacing(1), lineHeight: 19 },
  warn: { color: colors.danger, fontWeight: '600' },
  btn: { marginTop: spacing(4) },
  btnSmallGap: { marginTop: spacing(2.5) },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), flexWrap: 'wrap', borderColor: colors.success },
  doneText: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.success },
  doneBtn: { paddingVertical: spacing(2.5), paddingHorizontal: spacing(4) },
  preview: { borderColor: colors.primary, borderWidth: 1.5 },
  row: { paddingVertical: spacing(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  rowName: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  rowWarning: { fontSize: font.sm, color: colors.danger, marginTop: spacing(1) },
  badge: { paddingHorizontal: spacing(2), paddingVertical: 2, borderRadius: radii.pill },
  badgeGood: { backgroundColor: colors.successBg },
  badgeWarn: { backgroundColor: colors.dangerBg },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  badgeTextGood: { color: colors.success },
  badgeTextWarn: { color: colors.danger },
  skipped: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing(3), fontStyle: 'italic' },
});
