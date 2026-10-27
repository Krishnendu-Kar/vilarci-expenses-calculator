import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGroups } from '../context/GroupsContext';
import { parseBackup, planImport, type ImportPlan } from '../lib/backup';
import { pickTextFile } from '../lib/files';
import { groupTotal } from '../lib/split';
import { money } from '../lib/money';
import { plural, shortDate } from '../lib/format';
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

export function ImportScreen({ navigation }: ScreenProps<'Import'>) {
  const { groups, importGroups } = useGroups();
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
      setPending({ fileName: file.name, ...parsed, plan: planImport(groups, parsed.groups) });
    } catch (e) {
      notify("Couldn't import", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    importGroups(pending.groups);
    setDone(`Imported ${plural(pending.groups.length, 'group')}.`);
    setPending(null);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>
          Pick a file exported from Vilarci Split, or a group a friend sent you. You'll see what changes before
          anything is saved.
        </Text>

        {!pending ? (
          <PrimaryButton label={busy ? 'Opening…' : 'Choose a file'} onPress={pick} disabled={busy} />
        ) : (
          <View style={[styles.card, styles.preview]}>
            <Text style={styles.title}>Ready to import</Text>
            <Text style={styles.meta} numberOfLines={1}>
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
        )}

        {done ? (
          <View style={[styles.card, styles.doneCard]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.doneText}>{done}</Text>
            <PrimaryButton label="See groups" variant="outline" onPress={() => navigation.popToTop()} style={styles.doneBtn} />
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
      <Text style={styles.meta}>
        {plural(group.members.length, 'person')} · {plural(group.expenses.length, 'expense')} · {money(groupTotal(group))}
      </Text>
      {warning ? <Text style={styles.rowWarning}>{warning}</Text> : null}
    </View>
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
    marginTop: spacing(4),
  },
  preview: { borderColor: colors.primary, borderWidth: 1.5, marginTop: 0 },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: font.sm + 1, color: colors.textSecondary, marginTop: spacing(1) },
  btn: { marginTop: spacing(4) },
  btnSmallGap: { marginTop: spacing(2.5) },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), flexWrap: 'wrap', borderColor: colors.success },
  doneText: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.success },
  doneBtn: { paddingVertical: spacing(2.5), paddingHorizontal: spacing(4) },
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
