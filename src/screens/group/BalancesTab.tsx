import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { isSettled, type MemberBalance } from '../../lib/split';
import { money } from '../../lib/money';
import { colors } from '../../theme/colors';
import { font, spacing } from '../../theme/tokens';
import { tabStyles as t } from './styles';

export function BalancesTab({ balances, names }: { balances: MemberBalance[]; names: Record<string, string> }) {
  const sorted = [...balances].sort((a, b) => b.net - a.net);
  return (
    <ScrollView contentContainerStyle={t.list}>
      <Text style={t.explain}>
        "Paid" is what each person spent for the group. "Share" is their fair part of the expenses they were in.
      </Text>
      {sorted.map((b) => (
        <View key={b.memberId} style={t.row}>
          <Avatar name={names[b.memberId]} />
          <View style={[t.rowBody, styles.gap]}>
            <Text style={t.rowTitle}>{names[b.memberId]}</Text>
            <Text style={t.rowMeta}>
              Paid {money(b.paid)} · Share {money(b.share)}
              {b.sent ? ` · Sent ${money(b.sent)}` : ''}
              {b.received ? ` · Got ${money(b.received)}` : ''}
            </Text>
          </View>
          <View style={t.rowRight}>
            {isSettled(b.net) ? (
              <Text style={styles.settled}>settled</Text>
            ) : (
              <>
                <Text style={[t.rowAmount, b.net > 0 ? t.pos : t.neg]}>{money(Math.abs(b.net))}</Text>
                <Text style={[t.small, b.net > 0 ? t.pos : t.neg]}>{b.net > 0 ? 'gets back' : 'owes'}</Text>
              </>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gap: { marginLeft: spacing(3) },
  settled: { fontSize: font.sm, fontWeight: '700', color: colors.textSecondary },
});
