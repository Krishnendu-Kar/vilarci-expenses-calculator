import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { isSettled, type MemberBalance } from '../../lib/split';
import { searchMembers } from '../../lib/search';
import { money } from '../../lib/money';
import { makeStyles } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';

interface Props {
  /** All-time, whatever the Expenses filter shows. */
  balances: MemberBalance[];
  names: Record<string, string>;
  meId: string | null;
}

/** One row per member: what they paid, their fair share, and what they owe or get back. */
export function MembersTab({ balances, names, meId }: Props) {
  const t = useTabStyles();
  const styles = useStyles();
  const i18n = useI18n();
  const [query, setQuery] = useState('');

  const rows = searchMembers(
    balances.map((b) => ({ ...b, name: names[b.memberId] ?? '?' })),
    query,
  ).sort((a, b) => b.net - a.net);

  return (
    <ScrollView contentContainerStyle={t.list} keyboardShouldPersistTaps="handled">
      <SearchBar value={query} onChangeText={setQuery} placeholder={i18n.t('members.search')} />
      <Text style={t.explain}>{i18n.t('members.explain')}</Text>
      {rows.length === 0 ? (
        <EmptyState icon="search-outline" title={i18n.t('members.noMatch.title')} body={i18n.t('members.noMatch.body', { query: query.trim() })} />
      ) : null}
      {rows.map((b) => {
        const me = b.memberId === meId;
        return (
          <View key={b.memberId} style={[t.row, me && t.rowMe]}>
            <Avatar name={b.name} />
            <View style={[t.rowBody, styles.gap]}>
              <View style={styles.nameRow}>
                <Text style={[t.rowTitle, styles.name]} numberOfLines={1}>
                  {b.name}
                </Text>
                {me ? <Text style={t.youTag}>{i18n.t('common.you')}</Text> : null}
              </View>
              <Text style={t.rowMeta}>
                {i18n.t('members.paidShare', { paid: money(b.paid), share: money(b.share) })}
                {b.sent ? ` · ${i18n.t('members.sent', { amount: money(b.sent) })}` : ''}
                {b.received ? ` · ${i18n.t('members.got', { amount: money(b.received) })}` : ''}
              </Text>
            </View>
            <View style={t.rowRight}>
              {isSettled(b.net) ? (
                <Text style={styles.settled}>{i18n.t('common.settled')}</Text>
              ) : (
                <>
                  <Text style={[t.rowAmount, b.net > 0 ? t.pos : t.neg]}>{money(Math.abs(b.net))}</Text>
                  <Text style={[t.small, b.net > 0 ? t.pos : t.neg]}>
                    {b.net > 0 ? i18n.t('common.getsBack') : i18n.t('common.owes')}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  gap: { marginLeft: spacing(3) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  name: { flexShrink: 1 },
  settled: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
}));
