import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { ActionSheet } from '../../components/ActionSheet';
import { MoreButton } from '../../components/MoreButton';
import { useAuth } from '../../context/AuthContext';
import { useMenu, type MenuAnchor, type MenuItem } from '../../context/MenuContext';
import { useSync } from '../../context/SyncContext';
import { useUndo } from '../../context/UndoContext';
import { isSettled, type MemberBalance } from '../../lib/split';
import { searchMembers } from '../../lib/search';
import { money } from '../../lib/money';
import { can } from '../../lib/permissions';
import { linkGuest, setRole } from '../../lib/api/groups';
import { notify } from '../../lib/confirm';
import { makeStyles } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { useTabStyles } from './styles';
import { useGroupExit } from './useGroupExit';
import type { Group, Member } from '../../types';

interface Props {
  group: Group;
  /** All-time, whatever the Expenses filter shows. */
  balances: MemberBalance[];
  names: Record<string, string>;
  meId: string | null;
}

/**
 * One row per member: what they paid, their fair share, and what they owe or
 * get back. Tags say who's who: Creator / Admin in a live group, Guest for
 * someone with no account (only added for the sums). Tapping someone with an
 * account opens their page; in a live group admins get a ⋮ menu (roles,
 * linking a guest to a member, onlinedb.md §13, §16).
 */
export function MembersTab({ group, balances, names, meId }: Props) {
  const t = useTabStyles();
  const styles = useStyles();
  const i18n = useI18n();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { openMenu } = useMenu();
  const { syncNow } = useSync();
  const { showNote } = useUndo();
  const [query, setQuery] = useState('');
  const [linkFrom, setLinkFrom] = useState<Member | null>(null);
  const exit = useGroupExit(group);
  const live = !!group.online;
  const byId = new Map(group.members.map((m) => [m.id, m]));

  // Has an account: in a live group the server says; in a local one only you can (once signed in).
  const hasAccount = (m: Member | undefined) => (live ? !!m?.account : !!user && m?.id === meId);

  const rows = searchMembers(
    balances
      // A guest merged into someone is that someone now.
      .filter((b) => byId.get(b.memberId)?.gone !== 'merged')
      .map((b) => ({ ...b, name: names[b.memberId] ?? '?' })),
    query,
  ).sort((a, b) => b.net - a.net);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await syncNow();
    } catch {
      notify(i18n.t('detail.tabMembers'), i18n.t('members.failed'));
    }
  };

  const menuFor = (m: Member): MenuItem[] => {
    if (!live || m.gone) return [];
    const items: MenuItem[] = [];
    if (m.account && m.role !== 'creator' && can('set_role', group)) {
      items.push(
        m.role === 'admin'
          ? { key: 'member', icon: 'remove-circle-outline', title: i18n.t('members.dismissAdmin') }
          : { key: 'admin', icon: 'shield-checkmark-outline', title: i18n.t('members.makeAdmin') },
      );
    }
    if (!m.account && can('link_guest', group)) items.push({ key: 'link', icon: 'link-outline', title: i18n.t('members.link') });
    // Anyone but the creator and yourself (that's Leave), only once settled (the server checks).
    if (m.role !== 'creator' && m.id !== meId && can('remove_member', group)) {
      items.push({ key: 'remove', icon: 'person-remove-outline', title: i18n.t('exit.remove'), danger: true });
    }
    return items;
  };

  const pick = (m: Member, key: string) => {
    if (key === 'link') setLinkFrom(m);
    else if (key === 'remove') exit.remove(m);
    else
      void act(async () => {
        const res = await setRole(group.id, m.id, key as 'admin' | 'member');
        if (res.status === 'last_admin') notify(i18n.t('members.dismissAdmin'), i18n.t('members.lastAdmin'));
      });
  };

  return (
    <ScrollView contentContainerStyle={t.list} keyboardShouldPersistTaps="handled">
      <SearchBar value={query} onChangeText={setQuery} placeholder={i18n.t('members.search')} />
      <Text style={t.explain}>{i18n.t('members.explain')}</Text>
      {rows.length === 0 ? (
        <EmptyState icon="search-outline" title={i18n.t('members.noMatch.title')} body={i18n.t('members.noMatch.body', { query: query.trim() })} />
      ) : null}
      {rows.map((b) => {
        const m = byId.get(b.memberId);
        const me = b.memberId === meId;
        const account = hasAccount(m);
        const items = m ? menuFor(m) : [];
        const tag = m?.gone === 'left' ? 'members.left' : m?.gone === 'removed' ? 'members.removed' : null;
        return (
          <Pressable
            key={b.memberId}
            disabled={!account}
            onPress={() => navigation.navigate('Person', { personId: b.memberId })}
            style={({ pressed }) => [t.row, me && t.rowMe, pressed && styles.pressed]}
          >
            <Avatar name={b.name} />
            <View style={[t.rowBody, styles.gap]}>
              <View style={styles.nameRow}>
                <Text style={[t.rowTitle, styles.name]} numberOfLines={1}>
                  {b.name}
                </Text>
                {me ? <Text style={t.youTag}>{i18n.t('common.you')}</Text> : null}
                {m?.role === 'creator' && live ? <Text style={[styles.tag, styles.tagRole]}>{i18n.t('members.creator')}</Text> : null}
                {m?.role === 'admin' && live ? <Text style={[styles.tag, styles.tagRole]}>{i18n.t('members.admin')}</Text> : null}
                {!account ? <Text style={styles.tag}>{i18n.t('members.guest')}</Text> : null}
                {tag ? <Text style={styles.tag}>{i18n.t(tag)}</Text> : null}
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
            {items.length && m ? (
              <MoreButton onOpen={(anchor: MenuAnchor) => openMenu(anchor, items, (key) => pick(m, key))} hitSlop={10} style={styles.more} />
            ) : null}
          </Pressable>
        );
      })}

      <ActionSheet
        visible={!!linkFrom}
        title={i18n.t('members.linkTitle', { name: linkFrom?.name ?? '' })}
        subtitle={i18n.t('members.linkBody')}
        options={group.members
          .filter((m) => !m.gone && m.id !== linkFrom?.id)
          .map((m) => ({ key: m.id, icon: m.account ? 'person' : 'person-outline', title: m.name }))}
        onPick={(intoId) => {
          const from = linkFrom;
          setLinkFrom(null);
          if (!from) return;
          void act(async () => {
            await linkGuest(group.id, from.id, intoId);
            showNote(i18n.t('members.linked', { guest: from.name, name: names[intoId] ?? '' }));
          });
        }}
        onClose={() => setLinkFrom(null)}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  gap: { marginLeft: spacing(3) },
  pressed: { opacity: 0.85 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  tag: {
    fontSize: font.xs - 1,
    fontWeight: '700',
    color: c.textSecondary,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  tagRole: { color: c.tint },
  settled: { fontSize: font.sm, fontWeight: '700', color: c.textSecondary },
  more: { paddingLeft: spacing(1), paddingVertical: spacing(2) },
}));
