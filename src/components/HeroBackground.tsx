import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type FrameInfo,
} from 'react-native-reanimated';
import { radii } from '../theme/tokens';
import { useAfterPaint } from './useAfterPaint';

// Dark page tops. Type on them is white; the same in both themes.
// - 'pendulum' (Home): the Vilarci buyer app's idea, a dark maroon "dark place"
//   with a glowing light on a wire that swings like a real one.
// - 'stars' (People): a night sky running from violet into wine, softly twinkling.

/** The brand's crimson into coral (Profile's ring uses its last colour). */
export const HERO_LIGHT = ['#7A1F2B', '#C2183F', '#FF5A5F'] as const;
/** Dark enough for the pendulum's light to glow. */
export const HERO_NIGHT = ['#24060A', '#43090C', '#5E0D19'] as const;
export const HERO_SKY = ['#13071F', '#2A0B30', '#5A132E'] as const;

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  kind?: 'pendulum' | 'stars';
  /** Pendulum only: how far down from the top the light reaches, so it ends above what's under it. */
  reach?: number;
}

export function HeroBackground({ kind = 'stars', reach = REACH, ...rest }: Props) {
  return kind === 'pendulum' ? <PendulumHero reach={reach} {...rest} /> : <StarsHero {...rest} />;
}

// ---- Pendulum ----

const BOB = 26;
const MIN_WIRE = 24;
const REACH = 134;
/** Stand-in for gravity, in px/s²: a longer wire swings slower, as a real one does. */
const GRAVITY = 360;
/** The swing it falls back into after a push. */
const AMPLITUDE = (60 * Math.PI) / 180;
/** A throw never carries it past this, so it can't loop over the top. */
const MAX_ANGLE = (150 * Math.PI) / 180;
/** How quickly a push fades back into the usual swing (higher is quicker). */
const SETTLE = 0.6;
/** A finger this close to the light picks it up. */
const GRAB = 40;
/**
 * The glow: one gradient that fades evenly to nothing (separate rings showed
 * as visible steps), wide enough to light the dark around it.
 */
const GLOW_SIZE = 132;
const GLOW =
  'radial-gradient(circle closest-side, rgba(253,224,71,0.75) 0%, rgba(253,224,71,0.44) 18%, ' +
  'rgba(253,224,71,0.2) 40%, rgba(253,224,71,0.07) 66%, rgba(253,224,71,0) 100%)';
/** The light itself: white-hot near the middle, deeper yellow at the edge. */
const CORE =
  'radial-gradient(circle at 42% 38%, #FFFEF2 0%, #FEF3A0 30%, #FDE047 68%, #F5C518 100%)';

/**
 * A light on a wire from the top centre, moved by a small physics step each
 * frame (gravity, plus a gentle pull back to its usual swing), so it's slow
 * at the ends and fastest through the bottom. Touch the light to catch it,
 * drag it and let go to throw it; a flick anywhere else on the top pushes
 * it. It glows brighter the faster it moves. With less motion asked for, it
 * hangs still and settles after a push.
 */
function PendulumHero({ children, style, reach }: Omit<Props, 'kind' | 'reach'> & { reach: number }) {
  const still = useReducedMotion();
  const focused = useIsFocused();
  const height = Math.max(MIN_WIRE + BOB, reach);
  /** Pivot to the light's centre. */
  const r = height - BOB / 2;
  /** Its natural swing speed (rad/s). */
  const w0 = Math.sqrt(GRAVITY / r);

  const theta = useSharedValue(still ? 0 : AMPLITUDE);
  const omega = useSharedValue(0);
  const held = useSharedValue(false);
  const width = useSharedValue(0);

  // Kept between renders, so the frame callback isn't re-registered each time.
  const step = useCallback(
    (f: FrameInfo) => {
      'worklet';
      if (held.value) return;
      const dt = Math.min(f.timeSincePreviousFrame ?? 16, 34) / 1000;
      // Energy as a share of what lifting the light one wire length takes.
      const target = still ? 0 : 1 - Math.cos(AMPLITUDE);
      const steps = 4;
      const h = dt / steps;
      let th = theta.value;
      let om = omega.value;
      for (let i = 0; i < steps; i++) {
        const e = 0.5 * (om / w0) ** 2 + 1 - Math.cos(th);
        const alpha = -w0 * w0 * Math.sin(th) + SETTLE * (target - e) * om - (still ? 1.2 * om : 0);
        om += alpha * h;
        th += om * h;
      }
      theta.value = th;
      omega.value = om;
    },
    [still, w0, theta, omega, held],
  );
  const frame = useFrameCallback(step, false);

  // Only while Home is showing.
  useEffect(() => {
    frame.setActive(focused);
  }, [focused, frame]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onBegin((e) => {
          const bx = width.value / 2 + r * Math.sin(theta.value);
          const by = r * Math.cos(theta.value);
          // A finger on the light catches it.
          if (Math.hypot(e.x - bx, e.y - by) < GRAB) {
            held.value = true;
            omega.value = 0;
          }
        })
        .onUpdate((e) => {
          if (held.value) theta.value = Math.atan2(e.x - width.value / 2, Math.max(1, e.y));
        })
        .onEnd((e) => {
          const th = theta.value;
          // Thrown: the finger's speed along the swing. A flick elsewhere: a push its way.
          const om = held.value
            ? (e.velocityX * Math.cos(th) - e.velocityY * Math.sin(th)) / r
            : omega.value + (e.velocityX / r) * 0.35;
          const room = Math.max(0, Math.cos(th) - Math.cos(MAX_ANGLE));
          const cap = w0 * Math.sqrt(2 * room);
          omega.value = Math.max(-cap, Math.min(cap, om));
        })
        .onFinalize(() => {
          held.value = false;
        }),
    [r, w0, theta, omega, held, width],
  );

  // Turning about the top: up half the length, turn, back down.
  const arm = useAnimatedStyle(() => ({
    transform: [
      { translateY: -height / 2 },
      { rotate: `${(-theta.value * 180) / Math.PI}deg` },
      { translateY: height / 2 },
    ],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * Math.min(1, Math.abs(omega.value) / w0) }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrap, style]} onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
        <LinearGradient colors={HERO_NIGHT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        <View pointerEvents="none" style={styles.pendAnchor}>
          <Animated.View style={[styles.arm, { height }, arm]}>
            <View style={styles.wire} />
            <View style={styles.bob}>
              <Animated.View style={[styles.halo, halo]} />
              <View style={styles.core} />
            </View>
          </Animated.View>
        </View>
        {children}
      </View>
    </GestureDetector>
  );
}

// ---- Stars ----

interface StarSpot {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  ms: number;
}

// Fixed spots, so the sky looks the same every time.
const STARS: StarSpot[] = [
  { top: '8%', left: '12%', size: 2, ms: 2600 },
  { top: '14%', left: '46%', size: 3, ms: 3400 },
  { top: '6%', left: '78%', size: 2, ms: 2200 },
  { top: '24%', left: '90%', size: 2, ms: 3000 },
  { top: '30%', left: '6%', size: 3, ms: 3800 },
  { top: '38%', left: '62%', size: 2, ms: 2400 },
  { top: '46%', left: '28%', size: 2, ms: 3200 },
  { top: '52%', left: '94%', size: 3, ms: 2800 },
  { top: '60%', left: '4%', size: 2, ms: 3600 },
  { top: '66%', left: '72%', size: 2, ms: 2000 },
  { top: '74%', left: '40%', size: 3, ms: 3000 },
  { top: '82%', left: '86%', size: 2, ms: 2600 },
  { top: '88%', left: '16%', size: 2, ms: 3400 },
  { top: '92%', left: '56%', size: 2, ms: 2200 },
];

function Star({ star, still }: { star: StarSpot; still: boolean }) {
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(star.ms / 3, withRepeat(withTiming(1, { duration: star.ms, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [still, star.ms, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.2 + 0.7 * t.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.star, { top: star.top, left: star.left, width: star.size, height: star.size, borderRadius: star.size }, style]}
    />
  );
}

function StarsHero({ children, style }: Omit<Props, 'kind' | 'reach'>) {
  const still = useReducedMotion();
  // The sky first; its stars join a moment later, so the page shows at once.
  const ready = useAfterPaint();
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient colors={HERO_SKY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
      {ready ? STARS.map((s, i) => <Star key={i} star={s} still={still} />) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderBottomLeftRadius: radii.xl + 4, borderBottomRightRadius: radii.xl + 4 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pendAnchor: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  arm: { width: BOB, alignItems: 'center' },
  wire: { width: 2, flex: 1, backgroundColor: 'rgba(255,240,200,0.5)', borderRadius: 1 },
  bob: { width: BOB, height: BOB, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2, backgroundImage: GLOW },
  // The plain colour shows only where gradients aren't drawn.
  core: { width: BOB, height: BOB, borderRadius: BOB / 2, backgroundColor: '#FDE047', backgroundImage: CORE },
  star: { position: 'absolute', backgroundColor: '#FFF7E0' },
});
