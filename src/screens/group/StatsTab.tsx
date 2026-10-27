import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../components/EmptyState';
import { SectionLabel } from '../../components/SectionLabel';
import { categoryTotals, dailyTotals, type MemberBalance } from '../../lib/split';
import { money } from '../../lib/money';
import { dayLabel, plural } from '../../lib/format';
import { categoryOf } from '../../data/categories';
import { colors } from '../../theme/colors';
import { font, radii, spacing } from '../../theme/tokens';
import { tabStyles as t } from './styles';
import type { Group } from '../../types';

interface Props {
  group: Group;
  balances: MemberBalance[];
  names: Record<string, string>;
}

// Every chart here is a single series, so bars share one brand hue and the
// label next to each bar carries identity. Values are printed, not implied.
export function StatsTab({ group, balances, names }: Props) {
  const cats = useMemo(() => categoryTotals(group), [group]);
  const days = useMemo(() => dailyTotals(group), [group]);
  const total = cats.reduce((s, c) => s + c.amount, 0);

  if (group.expenses.length === 0) {
    return (
      <ScrollView contentContainerStyle={t.list}>
        <EmptyState icon="stats-chart-outline" title="No stats yet" body="Add a few expenses to see where the money went." />
      </ScrollView>
    );
  }

  const biggest = group.expenses.reduce((a, b) => (b.amount > a.amount ? b : a));
  const payers = [...balances].sort((a, b) => b.paid - a.paid);
  const maxCat = Math.max(...cats.map((c) => c.amount));
  const maxPaid = Math.max(1, ...payers.map((b) => b.paid));
  const maxDay = Math.max(...days.map((d) => d.amount));

  return (
    <ScrollView contentContainerStyle={t.list}>
      <View style={styles.tiles}>
        <Tile label="Biggest expense" value={money(biggest.amount)} sub={biggest.title} />
        <Tile
          label={days.length > 1 ? 'Per day' : 'Expenses'}
          value={days.length > 1 ? money(Math.round(total / days.length)) : String(group.expenses.length)}
          sub={days.length > 1 ? `over ${plural(days.length, 'day')}` : money(total)}
        />
      </View>

      <SectionLabel>Where the money went</SectionLabel>
      <View style={t.card}>
        {cats.map((c) => {
          const cat = categoryOf(c.key);
          return (
            <View key={c.key} style={styles.item}>
              <View style={styles.itemHead}>
                <Ionicons name={cat.icon} size={16} color={colors.textSecondary} />
                <Text style={styles.itemLabel}>{cat.label}</Text>
                <Text style={styles.itemMeta}>{Math.round((c.amount / total) * 100)}%</Text>
                <Text style={styles.itemValue}>{money(c.amount)}</Text>
              </View>
              <Bar fraction={c.amount / maxCat} />
            </View>
          );
        })}
      </View>

      <SectionLabel>Who paid</SectionLabel>
      <View style={t.card}>
        {payers.map((b) => (
          <View key={b.memberId} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.itemLabel}>{names[b.memberId]}</Text>
              <Text style={styles.itemValue}>{money(b.paid)}</Text>
            </View>
            <Bar fraction={b.paid / maxPaid} />
            <Text style={styles.itemSub}>Fair share {money(b.share)}</Text>
          </View>
        ))}
      </View>

      {days.length > 1 ? (
        <>
          <SectionLabel>Day by day</SectionLabel>
          <View style={t.card}>
            {days.map((d) => (
              <View key={d.date} style={styles.item}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemLabel}>{dayLabel(d.date)}</Text>
                  <Text style={styles.itemValue}>{money(d.amount)}</Text>
                </View>
                <Bar fraction={d.amount / maxDay} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={[t.card, styles.tile]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function Bar({ fraction }: { fraction: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(1.5, fraction * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing(3) },
  tile: { flex: 1, padding: spacing(3.5) },
  tileLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: font.xl, fontWeight: '800', color: colors.textPrimary, marginTop: spacing(1) },
  tileSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  item: { marginBottom: spacing(3.5) },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(1.5) },
  itemLabel: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  itemMeta: { fontSize: font.sm, color: colors.textSecondary },
  itemValue: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary, minWidth: 70, textAlign: 'right' },
  itemSub: { fontSize: font.xs + 1, color: colors.textSecondary, marginTop: spacing(1) },
  track: { height: 8, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
