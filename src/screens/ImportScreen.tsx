import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { parseBackup, planImport, type ImportPlan } from '../lib/backup';
import { adoptIds } from '../lib/storage';
import { pickTextFile } from '../lib/files';
import { groupTotal } from '../lib/split';
import { money } from '../lib/money';
import { shortDate } from '../lib/format';
import { notify } from '../lib/confirm';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
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

export function ImportScreen({ navigation }: ScreenProps<'Import'>) {
  const { groups, importGroups } = useGroups();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pick = async () => {
    setBusy(true);
    setDone(null);
    try {
      const file = await pickTextFile();
      if (!file) return;
      const parsed = parseBackup(file.text);
      // Files from before 1.2 have short ids: they become the UUIDs used here.
      const incoming = await adoptIds(parsed.groups);
      setPending({ fileName: file.name, ...parsed, groups: incoming, plan: planImport(groups, incoming) });
    } catch (e) {
      notify(t('import.failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    importGroups(pending.groups);
    setDone(t('import.done', { count: pending.groups.length }));
    setPending(null);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>{t('import.explain')}</Text>

        {!pending ? (
          <PrimaryButton label={busy ? t('import.opening') : t('import.choose')} onPress={pick} disabled={busy} />
        ) : (
          <View style={[styles.card, styles.preview]}>
            <Text style={styles.title}>{t('import.ready')}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {pending.fileName}
              {pending.exportedAt ? ` · ${t('import.exported', { date: shortDate(Date.parse(pending.exportedAt)) })}` : ''}
            </Text>

            {pending.plan.added.map((g) => (
              <PreviewRow key={g.id} group={g} badge={t('import.new')} tone="good" />
            ))}
            {pending.plan.replaced.map(({ incoming, localIsNewer }) => (
              <PreviewRow
                key={incoming.id}
                group={incoming}
                badge={t('import.updates')}
                tone="warn"
                warning={localIsNewer ? t('import.newerWarning') : undefined}
              />
            ))}

            {pending.skipped ? (
              <Text style={styles.skipped}>{t('import.skipped', { items: t('count.brokenItem', { count: pending.skipped }) })}</Text>
            ) : null}

            <PrimaryButton label={t('import.button', { count: pending.groups.length })} onPress={confirmImport} style={styles.btn} />
            <PrimaryButton label={t('common.cancel')} variant="outline" onPress={() => setPending(null)} style={styles.btnSmallGap} />
          </View>
        )}

        {done ? (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.doneText}>{done}</Text>
            <PrimaryButton label={t('import.seeGroups')} variant="outline" onPress={() => navigation.popToTop()} style={styles.doneBtn} />
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
  const styles = useStyles();
  const { t } = useI18n();
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
      <Text style={styles.meta}>
        {t('count.person', { count: group.members.length })} · {t('count.expense', { count: group.expenses.length })} ·{' '}
        {money(groupTotal(group))}
      </Text>
      {warning ? <Text style={styles.rowWarning}>{warning}</Text> : null}
    </View>
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
    marginTop: spacing(4),
  },
  preview: { borderColor: c.tint, borderWidth: 1.5, marginTop: 0 },
  title: { fontSize: font.lg, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: font.sm + 1, color: c.textSecondary, marginTop: spacing(1) },
  btn: { marginTop: spacing(4) },
  btnSmallGap: { marginTop: spacing(2.5) },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), flexWrap: 'wrap', borderColor: c.success },
  doneText: { flex: 1, fontSize: font.md, fontWeight: '700', color: c.success },
  doneBtn: { paddingVertical: spacing(2.5), paddingHorizontal: spacing(4) },
  row: { paddingVertical: spacing(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  rowName: { flex: 1, fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  rowWarning: { fontSize: font.sm, color: c.danger, marginTop: spacing(1) },
  badge: { paddingHorizontal: spacing(2), paddingVertical: 2, borderRadius: radii.pill },
  badgeGood: { backgroundColor: c.successBg },
  badgeWarn: { backgroundColor: c.dangerBg },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  badgeTextGood: { color: c.success },
  badgeTextWarn: { color: c.danger },
  skipped: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(3), fontStyle: 'italic' },
}));
