import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { Segmented } from '../components/Segmented';
import { Fab } from '../components/Fab';
import { ActionSheet, type SheetOption } from '../components/ActionSheet';
import { useGroup } from '../context/GroupsContext';
import { computeBalances, groupTotal, suggestTransfers } from '../lib/split';
import { money } from '../lib/money';
import { buildHtmlReport, buildTextReport } from '../lib/report';
import { buildBackup } from '../lib/backup';
import { fileSafe, shareMessage, sharePdf, shareTextFile } from '../lib/files';
import { notify } from '../lib/confirm';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import { ExpensesTab } from './group/ExpensesTab';
import { BalancesTab } from './group/BalancesTab';
import { SettleTab } from './group/SettleTab';
import { StatsTab } from './group/StatsTab';
import type { ScreenProps } from '../navigation/types';

type Tab = 'expenses' | 'balances' | 'settle' | 'stats';

const SHARE_OPTIONS: SheetOption[] = [
  {
    key: 'pdf',
    icon: 'document-text-outline',
    title: 'PDF report',
    body: 'Every expense, balances and who pays whom. Opens on any phone, no app needed.',
  },
  {
    key: 'text',
    icon: 'logo-whatsapp',
    title: 'Message (WhatsApp, SMS)',
    body: 'The same summary as a text message you can paste into the group chat.',
  },
  {
    key: 'file',
    icon: 'phone-portrait-outline',
    title: 'Group file for the app',
    body: 'Friends with Vilarci Split can import it and see the whole group.',
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GroupDetailScreen({ navigation, route }: ScreenProps<'GroupDetail'>) {
  const group = useGroup(route.params.groupId);
  const [tab, setTab] = useState<Tab>('expenses');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
      headerRight: () =>
        group ? (
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setSheetOpen(true)} hitSlop={10} accessibilityLabel="Share">
              <Ionicons name="share-social-outline" size={22} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('GroupForm', { groupId: group.id })}
              hitSlop={10}
              accessibilityLabel="Edit group"
            >
              <Ionicons name="create-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
        ) : null,
    });
  }, [navigation, group]);

  const balances = useMemo(() => (group ? computeBalances(group) : []), [group]);
  const transfers = useMemo(() => suggestTransfers(balances), [balances]);

  if (!group) {
    return (
      <ScreenContainer>
        <Text style={styles.missing}>This group no longer exists.</Text>
      </ScreenContainer>
    );
  }

  const names = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
  const total = groupTotal(group);

  const closeSheet = async () => {
    setSheetOpen(false);
    // Let the modal finish sliding away so iOS can present the share sheet.
    if (Platform.OS === 'ios') await wait(450);
  };

  const share = async (key: string) => {
    setBusy(key);
    const base = fileSafe(group.name);
    try {
      if (key === 'pdf') await sharePdf(`${base}-expenses.pdf`, buildHtmlReport(group), closeSheet);
      else if (key === 'text') await shareMessage(buildTextReport(group), closeSheet);
      else await shareTextFile(`${base}.vilarci.json`, buildBackup([group]), 'application/json', closeSheet);
      setSheetOpen(false);
    } catch (e) {
      notify("Couldn't share", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.top}>
        <View style={styles.summary}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total spent</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Per person avg</Text>
            <Text style={styles.summaryValue}>{money(Math.round(total / group.members.length))}</Text>
          </View>
        </View>
        <Segmented
          options={[
            { key: 'expenses', label: 'Expenses' },
            { key: 'balances', label: 'Balances' },
            { key: 'settle', label: transfers.length ? `Settle (${transfers.length})` : 'Settle' },
            { key: 'stats', label: 'Stats' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'expenses' ? (
        <ExpensesTab
          group={group}
          names={names}
          onOpen={(e) => navigation.navigate('ExpenseForm', { groupId: group.id, expenseId: e.id })}
        />
      ) : tab === 'balances' ? (
        <BalancesTab balances={balances} names={names} />
      ) : tab === 'settle' ? (
        <SettleTab group={group} transfers={transfers} names={names} onShare={() => setSheetOpen(true)} />
      ) : (
        <StatsTab group={group} balances={balances} names={names} />
      )}

      {tab === 'expenses' ? (
        <Fab label="Add expense" onPress={() => navigation.navigate('ExpenseForm', { groupId: group.id })} />
      ) : null}

      <ActionSheet
        visible={sheetOpen}
        title="Send to someone"
        subtitle={`Share "${group.name}" with people who don't have the app.`}
        options={SHARE_OPTIONS}
        busy={busy}
        onPick={share}
        onClose={() => setSheetOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', marginTop: spacing(16), color: colors.textSecondary },
  headerIcons: { flexDirection: 'row', gap: spacing(5), alignItems: 'center' },
  top: { paddingHorizontal: spacing(4), paddingTop: spacing(4), paddingBottom: spacing(2) },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing(4),
    marginBottom: spacing(4),
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: colors.white, opacity: 0.75, fontSize: font.xs + 1, fontWeight: '600', letterSpacing: 0.4 },
  summaryValue: { color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
});
