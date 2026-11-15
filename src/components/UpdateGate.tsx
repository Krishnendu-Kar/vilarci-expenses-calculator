import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { HeroBackground } from './HeroBackground';
import { DISPLAY_FONT } from './LuxeCard';
import { PrimaryButton } from './PrimaryButton';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { loadSetting, saveSetting } from '../lib/storage';
import { fetchRelease } from '../lib/api/release';
import { PLAY_EVERY, parseRelease, releaseState, type Release } from '../lib/appRelease';
import { appVersion, offerPlayUpdate, updateNow } from '../lib/appUpdate';
import { longDate, todayISO } from '../lib/format';

// Outdated versions (lib/appRelease, app_release.md): the server's answer is
// asked for on opening and coming back to the app (at most every 10
// minutes) and kept
// for offline starts. Outdated before the day: a warning once a day. From the
// day: the Update needed page instead of the app. A newer, optional version:
// Play's own update dialog, at most every 3 days.

const CHECK_EVERY = 10 * 60 * 1000;
const LOGO = require('../../assets/logo.png');

interface Asked {
  /** The day the outdated warning was last shown. */
  warnDay?: string;
  /** When Play's update dialog was last shown. */
  playAt?: number;
}

const parseAsked = (raw: string | null): Asked => {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const version = useMemo(appVersion, []);
  const [release, setRelease] = useState<Release | null>(null);
  // The saved answer is read before the app shows, so an outdated phone never flashes the app.
  const [ready, setReady] = useState(!version);
  const [now, setNow] = useState(Date.now);
  const [warnOpen, setWarnOpen] = useState(false);
  const lastFetch = useRef(0);

  useEffect(() => {
    if (!version) return;
    let alive = true;
    const check = async () => {
      if (Date.now() - lastFetch.current < CHECK_EVERY) return;
      lastFetch.current = Date.now();
      try {
        const r = await fetchRelease('android');
        if (!r || !alive) return;
        setRelease(r);
        setNow(Date.now());
        await saveSetting('appRelease', JSON.stringify(r));
      } catch {
        // Offline or no answer: the saved one stands; try again next time.
        lastFetch.current = 0;
      }
    };
    loadSetting('appRelease')
      .then((raw) => {
        if (alive && raw) setRelease(parseRelease(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setReady(true);
        void check();
      });
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setNow(Date.now());
      void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [version]);

  const state = releaseState(release, version?.code ?? null, now);

  useEffect(() => {
    if (state.kind !== 'warn' && state.kind !== 'update') return;
    let alive = true;
    // If the record of when we last asked can't be read or written, ask
    // anyway: a warning shown twice beats one never shown.
    const remember = (next: Asked) => saveSetting('updateAsked', JSON.stringify(next)).catch(() => {});
    loadSetting('updateAsked')
      .catch(() => null)
      .then(async (raw) => {
        const asked = parseAsked(raw);
        if (!alive) return;
        if (state.kind === 'warn') {
          const today = todayISO();
          if (asked.warnDay === today) return;
          await remember({ ...asked, warnDay: today });
          if (alive) setWarnOpen(true);
        } else if (Date.now() - (asked.playAt ?? 0) >= PLAY_EVERY && (await offerPlayUpdate())) {
          await remember({ ...asked, playAt: Date.now() });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [state.kind, now]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (state.kind === 'blocked') {
    return <UpdateNeeded date={state.minFrom ? longDate(state.minFrom) : ''} min={state.minName} version={version?.name ?? ''} />;
  }

  return (
    <>
      {children}
      {state.kind === 'warn' ? (
        <BottomSheet
          visible={warnOpen}
          title={t('update.warnTitle')}
          onClose={() => setWarnOpen(false)}
          footer={
            <>
              <PrimaryButton
                label={t('update.store')}
                onPress={() => {
                  setWarnOpen(false);
                  void updateNow();
                }}
              />
              <PrimaryButton label={t('update.later')} variant="outline" onPress={() => setWarnOpen(false)} style={styles.gap} />
            </>
          }
        >
          <Text style={styles.sheetBody}>
            {t('update.warnBody', {
              date: state.minFrom ? longDate(state.minFrom) : '',
              version: version?.name ?? '',
              min: state.minName,
            })}
          </Text>
          <Text style={styles.sheetNote}>{t('update.safe')}</Text>
        </BottomSheet>
      ) : null}
    </>
  );
}

/**
 * Instead of the app, once this version can't be used any more: the night
 * sky of the welcome pages, the logo, what's out of date and one way on, to
 * the Play Store. (The pendulum can't be used here: it needs the navigator.)
 */
function UpdateNeeded({ date, min, version }: { date: string; min: string; version: string }) {
  const styles = useStyles();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  // The logo's ring breathes, slowly.
  const p = useSharedValue(0);
  useEffect(() => {
    if (!still) p.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [still, p]);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * p.value }], opacity: 0.85 + 0.15 * p.value }));

  return (
    <HeroBackground kind="stars" style={styles.sky}>
      <StatusBar style="light" />
      <SkyMotion />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(6) }]}
      >
        <Text style={styles.brand}>Vilarci E-Split</Text>

        <View style={styles.middle}>
          <Animated.View style={[styles.logoRing, breathe]}>
            <View style={styles.logoGlow}>
              <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
            </View>
          </Animated.View>
          <Text style={styles.title}>{t('update.neededTitle')}</Text>
          <Text style={styles.body}>{t('update.neededBody', { date })}</Text>

          <View style={styles.versions}>
            <View style={styles.versionSide}>
              <Text style={styles.versionCaption}>{t('update.yours')}</Text>
              <Text style={styles.versionOld}>{version}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.55)" />
            <View style={styles.versionSide}>
              <Text style={styles.versionCaption}>{t('update.required')}</Text>
              <Text style={styles.versionNew}>{min}+</Text>
            </View>
          </View>
        </View>

        <View>
          <Pressable
            onPress={() => void updateNow()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Ionicons name="logo-google-playstore" size={18} color="#2A0B30" />
            <Text style={styles.buttonText}>{t('update.store')}</Text>
          </Pressable>
          <View style={styles.safeRow}>
            <Ionicons name="shield-checkmark-outline" size={15} color="rgba(255,255,255,0.65)" />
            <Text style={styles.safeText}>{t('update.safe')}</Text>
          </View>
        </View>
      </ScrollView>
    </HeroBackground>
  );
}

const GOLD = '#FFD978';

/**
 * Behind the Update needed page: two soft glows drifting across the sky and
 * now and then a shooting star. Nothing moves with Reduce motion on.
 */
function SkyMotion() {
  const still = useReducedMotion();
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Drift rgb="255,217,120" size={340} from={[-0.3, 0.02]} to={[0.2, 0.16]} ms={16000} still={still} width={width} height={height} />
      <Drift rgb="244,114,182" size={380} from={[0.55, 0.6]} to={[0.1, 0.72]} ms={21000} still={still} width={width} height={height} />
      {still ? null : (
        <>
          <ShootingStar x={width * 0.92} y={height * 0.06} delay={1800} gap={7500} />
          <ShootingStar x={width * 0.7} y={height * 0.32} delay={6200} gap={9800} />
        </>
      )}
    </View>
  );
}

function Drift({
  rgb,
  size,
  from,
  to,
  ms,
  still,
  width,
  height,
}: {
  rgb: string;
  size: number;
  /** Where it drifts between, as shares of the screen. */
  from: [number, number];
  to: [number, number];
  ms: number;
  still: boolean;
  width: number;
  height: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!still) t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [still, ms, t]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (from[0] + (to[0] - from[0]) * t.value) * width },
      { translateY: (from[1] + (to[1] - from[1]) * t.value) * height },
    ],
  }));
  return (
    <Animated.View
      style={[
        motion.drift,
        {
          width: size,
          height: size,
          backgroundImage: `radial-gradient(circle closest-side, rgba(${rgb},0.2) 0%, rgba(${rgb},0.07) 55%, rgba(${rgb},0) 100%)`,
        },
        style,
      ]}
    />
  );
}

/** How far a shooting star travels, and its slant (degrees below level). */
const SHOOT = 280;
const SLANT = 32;
const COS = Math.cos((SLANT * Math.PI) / 180);
const SIN = Math.sin((SLANT * Math.PI) / 180);

function ShootingStar({ x, y, delay, gap }: { x: number; y: number; delay: number; gap: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withDelay(gap, withTiming(0, { duration: 0 }))),
        -1,
      ),
    );
  }, [delay, gap, t]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.7, 1], [0, 1, 0.8, 0]),
    transform: [{ translateX: -SHOOT * COS * t.value }, { translateY: SHOOT * SIN * t.value }, { rotate: `-${SLANT}deg` }],
  }));
  // The bright head leads on the left, the tail fades out behind it.
  return <Animated.View style={[motion.shooting, { left: x, top: y }, style]} />;
}

const motion = StyleSheet.create({
  drift: { position: 'absolute', left: 0, top: 0, borderRadius: 999 },
  shooting: {
    position: 'absolute',
    width: 96,
    height: 2,
    borderRadius: 1,
    backgroundImage: 'linear-gradient(to right, rgba(255,247,224,1) 0%, rgba(255,247,224,0.35) 35%, rgba(255,247,224,0) 100%)',
  },
});

const useStyles = makeStyles((c) => ({
  gap: { marginTop: spacing(3) },
  sheetBody: { fontSize: font.md, color: c.textPrimary, lineHeight: 22 },
  sheetNote: { fontSize: font.sm, color: c.textSecondary, lineHeight: 19, marginTop: spacing(3), marginBottom: spacing(2) },

  // ---- Update needed ----
  // The hero is rounded at the bottom elsewhere; here it's the whole screen.
  sky: { flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: spacing(6), gap: spacing(8) },
  brand: { fontFamily: DISPLAY_FONT, fontSize: font.lg, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  middle: { alignItems: 'center' },
  logoRing: {
    padding: spacing(2),
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,217,120,0.35)',
    marginBottom: spacing(8),
  },
  logoGlow: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 0 48px 8px rgba(255,217,120,0.28)',
  },
  logo: { width: 72, height: 72, borderRadius: 16 },
  title: { fontFamily: DISPLAY_FONT, fontSize: font.hero, color: '#FFFFFF', textAlign: 'center', lineHeight: font.hero * 1.2 },
  body: {
    fontSize: font.md + 1,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing(4),
    maxWidth: 360,
  },
  versions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(5),
    marginTop: spacing(8),
    paddingVertical: spacing(4),
    paddingHorizontal: spacing(6),
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  versionSide: { alignItems: 'center', minWidth: 96 },
  versionCaption: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  versionOld: {
    fontSize: font.xl,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing(1),
    textDecorationLine: 'line-through',
  },
  versionNew: { fontSize: font.xl, fontWeight: '800', color: GOLD, marginTop: spacing(1) },
  // White, like the welcome pages' button.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    paddingVertical: spacing(3.5),
  },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#2A0B30', fontSize: font.md + 1, fontWeight: '700' },
  safeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1.5), marginTop: spacing(4) },
  safeText: { fontSize: font.sm, color: 'rgba(255,255,255,0.65)', textAlign: 'center', flexShrink: 1 },
}));
