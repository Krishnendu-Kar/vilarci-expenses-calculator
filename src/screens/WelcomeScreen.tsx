import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroBackground } from '../components/HeroBackground';
import { Pager } from '../components/Pager';
import { DISPLAY_FONT } from '../components/LuxeCard';
import { saveSetting } from '../lib/storage';
import { makeStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';
import type { Key } from '../i18n';
import type { ScreenProps } from '../navigation/types';

/** One page: a big icon, a title, a few lines. In the order they show. */
const PAGES: { icon: IconName; title: Key; body: Key }[] = [
  { icon: 'wallet-outline', title: 'welcome.p1Title', body: 'welcome.p1Body' },
  { icon: 'receipt-outline', title: 'welcome.p2Title', body: 'welcome.p2Body' },
  { icon: 'swap-horizontal-outline', title: 'welcome.p3Title', body: 'welcome.p3Body' },
  { icon: 'people-outline', title: 'welcome.p4Title', body: 'welcome.p4Body' },
  { icon: 'shield-checkmark-outline', title: 'welcome.p5Title', body: 'welcome.p5Body' },
];

/**
 * What the app does and how to use it, in five swipeable pages. Shows once
 * on the first start (Home opens it), and any time from Settings → How to
 * use. Skip or Get started closes it for good.
 */
export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const styles = useStyles();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const last = index === PAGES.length - 1;

  const done = useCallback(() => {
    void saveSetting('welcomeSeen', String(Date.now())).catch(() => {});
    navigation.goBack();
  }, [navigation]);

  return (
    <HeroBackground kind="stars" style={styles.fill}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + spacing(2) }]}>
        <Text style={styles.brand}>Vilarci E-Split</Text>
        {last ? null : (
          <Pressable onPress={done} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>{t('welcome.skip')}</Text>
          </Pressable>
        )}
      </View>

      <Pager index={index} onIndexChange={setIndex}>
        {PAGES.map((p) => (
          <View key={p.title} style={styles.page}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <Ionicons name={p.icon} size={48} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.title}>{t(p.title)}</Text>
            <Text style={styles.body}>{t(p.body)}</Text>
          </View>
        ))}
      </Pager>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing(6) }]}>
        <View style={styles.dots} accessibilityLabel={t('welcome.page', { n: index + 1, count: PAGES.length })}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Pressable
          onPress={() => (last ? done() : setIndex(index + 1))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{last ? t('welcome.start') : t('welcome.next')}</Text>
          <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={18} color="#5A132E" />
        </Pressable>
      </View>
    </HeroBackground>
  );
}

const useStyles = makeStyles(() => ({
  // The hero is rounded at the bottom elsewhere; here it's the whole screen.
  fill: { flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(6),
  },
  brand: { fontFamily: DISPLAY_FONT, fontSize: font.lg, color: 'rgba(255,255,255,0.85)' },
  skip: { color: 'rgba(255,255,255,0.75)', fontSize: font.md, fontWeight: '600' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(8) },
  iconRing: {
    padding: spacing(2),
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing(8),
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontFamily: DISPLAY_FONT,
    fontSize: font.hero,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: font.hero * 1.2,
  },
  body: {
    fontSize: font.md + 1,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing(4),
    maxWidth: 360,
  },
  bottom: { paddingHorizontal: spacing(6), gap: spacing(6) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing(2) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    paddingVertical: spacing(4),
  },
  pressed: { opacity: 0.85 },
  buttonText: { fontSize: font.md + 1, fontWeight: '800', color: '#5A132E' },
}));
