import React, { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { useNews } from '../context/NewsContext';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { dateLocale } from '../i18n';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';
import type { NewsItem, NewsKind } from '../lib/newsData';
import type { Key } from '../i18n';

const KIND: Record<NewsKind, { icon: IconName; label: Key }> = {
  important: { icon: 'alert-circle', label: 'news.important' },
  update: { icon: 'arrow-up-circle', label: 'news.update' },
  news: { icon: 'megaphone', label: 'news.news' },
};

/**
 * News from Vilarci: important notices, updates and news from us, newest
 * first. Group activity isn't here: each live group has its own (the bell
 * inside the group).
 */
export function NewsScreen() {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { items, refresh, markSeen } = useNews();
  const [refreshing, setRefreshing] = useState(false);

  // Opening the page (and anything new arriving while it's open) counts as read.
  useEffect(() => {
    markSeen();
  }, [items, markSeen]);

  const pull = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };

  return (
    <ScreenContainer>
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} colors={[colors.tint]} tintColor={colors.tint} />}
        ListHeaderComponent={items.length ? <Text style={styles.intro}>{t('news.intro')}</Text> : undefined}
        ListEmptyComponent={<EmptyState icon="megaphone-outline" title={t('news.emptyTitle')} body={t('news.emptyBody')} />}
        renderItem={({ item }) => <NewsCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
      />
    </ScreenContainer>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const styles = useStyles();
  const { t } = useI18n();
  const { colors } = useTheme();
  const kind = KIND[item.kind];
  const tone = item.kind === 'important' ? colors.danger : item.kind === 'update' ? colors.accent : colors.tint;
  const when = item.at
    ? new Date(item.at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <View style={[styles.card, item.kind === 'important' && { borderColor: colors.danger }]}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tone + '1F' }]}>
          <Ionicons name={kind.icon} size={13} color={tone} />
          <Text style={[styles.badgeText, { color: tone }]}>{t(kind.label)}</Text>
        </View>
        <Text style={styles.date}>{when}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      {item.body ? (
        <Text style={styles.body} selectable>
          {item.body}
        </Text>
      ) : null}
      {item.url ? (
        <Pressable
          onPress={() => void Linking.openURL(item.url!).catch(() => {})}
          accessibilityRole="link"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkText}>{item.kind === 'update' ? t('news.openUpdate') : t('news.open')}</Text>
          <Ionicons name="open-outline" size={14} color={colors.tint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  list: { padding: spacing(5), paddingBottom: spacing(10) },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: spacing(5) },
  intro: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19, marginBottom: spacing(4), marginLeft: spacing(1) },
  gap: { height: spacing(3) },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2.5) },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  date: { fontSize: font.xs + 1, color: c.textSecondary },
  title: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary, lineHeight: font.lg * 1.3 },
  body: { fontSize: font.md, color: c.textPrimary, lineHeight: 22, marginTop: spacing(1.5), opacity: 0.88 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), alignSelf: 'flex-start', marginTop: spacing(3), paddingVertical: spacing(1) },
  linkText: { fontSize: font.md, fontWeight: '700', color: c.tint },
  pressed: { opacity: 0.7 },
}));
