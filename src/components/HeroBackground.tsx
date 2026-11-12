import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type SharedValue,
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
const glow = (rgb: string) =>
  `radial-gradient(circle closest-side, rgba(${rgb},0.75) 0%, rgba(${rgb},0.44) 18%, ` +
  `rgba(${rgb},0.2) 40%, rgba(${rgb},0.07) 66%, rgba(${rgb},0) 100%)`;
/** The light itself: white-hot near the middle, deeper colour at the edge. */
const core = (light: string, mid: string, deep: string) =>
  `radial-gradient(circle at 42% 38%, #FFFEF2 0%, ${light} 30%, ${mid} 68%, ${deep} 100%)`;

interface Shade {
  glow: string;
  core: string;
  /** Shows only where gradients aren't drawn. */
  plain: string;
}
const shade = (rgb: string, light: string, mid: string, deep: string): Shade => ({
  glow: glow(rgb),
  core: core(light, mid, deep),
  plain: mid,
});
/** The colours the light runs through, each fading into the next. */
const SHADES: Shade[] = [
  shade('253,224,71', '#FEF3A0', '#FDE047', '#F5C518'), // yellow
  shade('255,138,101', '#FFD3C2', '#FF8A65', '#F4511E'), // coral
  shade('244,114,182', '#FBCFE8', '#F472B6', '#DB2777'), // pink
  shade('167,139,250', '#DDD6FE', '#A78BFA', '#7C3AED'), // violet
  shade('56,189,248', '#BAE6FD', '#38BDF8', '#0284C7'), // sky
  shade('52,211,153', '#A7F3D0', '#34D399', '#059669'), // mint
];
/** The first colour again at the end, so the last one fades back into it without a jump. */
const LAYERS = [...SHADES, SHADES[0]];
/** Seconds each colour takes to fade into the next. */
const SHADE_SECONDS = 2.5;

/**
 * A light on a wire from the top centre, moved by a small physics step each
 * frame (gravity, plus a gentle pull back to its usual swing), so it's slow
 * at the ends and fastest through the bottom. Touch the light to catch it,
 * drag it and let go to throw it; a flick anywhere else on the top pushes
 * it. It glows brighter the faster it moves, and slowly runs through its
 * colours. With less motion asked for, it hangs still and settles after a push.
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
  /** Where it is in its colours: 0 up to SHADES.length, the fraction being how far into the next. */
  const hue = useSharedValue(0);

  // Kept between renders, so the frame callback isn't re-registered each time.
  const step = useCallback(
    (f: FrameInfo) => {
      'worklet';
      const dt = Math.min(f.timeSincePreviousFrame ?? 16, 34) / 1000;
      hue.value = (hue.value + dt / SHADE_SECONDS) % SHADES.length;
      if (held.value) return;
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
    [still, w0, theta, omega, held, hue],
  );
  const frame = useFrameCallback(step, false);

  // Only while Home is showing.
  useEffect(() => {
    frame.setActive(focused);
  }, [focused, frame]);

  // Now and then a firecracker goes up behind it: one every 15-25 s, only
  // while Home is showing, and none with less motion asked for.
  const box = useRef({ width: 0, height: 0 });
  const [burst, setBurst] = useState<Burst | null>(null);
  useEffect(() => {
    if (!focused || still) return;
    let timer: ReturnType<typeof setTimeout>;
    const queue = () => {
      timer = setTimeout(() => {
        if (box.current.width > 0) setBurst(makeBurst(box.current.width, box.current.height));
        timer = setTimeout(() => {
          setBurst(null);
          queue();
        }, BURST_MS);
      }, BURST_GAP_MS + Math.random() * BURST_GAP_SPREAD_MS);
    };
    queue();
    return () => {
      clearTimeout(timer);
      setBurst(null);
    };
  }, [focused, still]);

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
      <View
        style={[styles.wrap, style]}
        onLayout={(e) => {
          const { width: w, height: hh } = e.nativeEvent.layout;
          width.value = w;
          box.current = { width: w, height: hh };
        }}
      >
        <LinearGradient colors={HERO_NIGHT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        {burst ? <Firework key={burst.id} burst={burst} /> : null}
        <View pointerEvents="none" style={styles.pendAnchor}>
          <Animated.View style={[styles.arm, { height }, arm]}>
            <View style={styles.wire} />
            <View style={styles.bob}>
              <Animated.View style={[styles.halo, halo]}>
                {LAYERS.map((s, i) => (
                  <ShadeLayer key={i} hue={hue} i={i} style={[styles.fill, { backgroundImage: s.glow }]} />
                ))}
              </Animated.View>
              <View style={styles.core}>
                {LAYERS.map((s, i) => (
                  <ShadeLayer
                    key={i}
                    hue={hue}
                    i={i}
                    cover
                    style={[styles.fill, styles.coreShade, { backgroundColor: s.plain, backgroundImage: s.core }]}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
        {children}
      </View>
    </GestureDetector>
  );
}

/**
 * One colour of the light. The glow's colours cross-fade (they're see-through,
 * so two at full would glow twice as bright); the solid core's next colour
 * fades in over the current one instead, so it never turns see-through midway.
 */
function ShadeLayer({ hue, i, cover = false, style }: { hue: SharedValue<number>; i: number; cover?: boolean; style: StyleProp<ViewStyle> }) {
  const fade = useAnimatedStyle(() => {
    const k = Math.floor(hue.value);
    const f = hue.value - k;
    if (i === k) return { opacity: cover ? 1 : 1 - f };
    if (i === k + 1) return { opacity: f };
    return { opacity: 0 };
  });
  return <Animated.View style={[style, fade]} />;
}

// ---- Firecracker ----

/** How long one goes on, from leaving the bottom to the last spark fading. */
const BURST_MS = 1900;
/** The quiet between two: this, plus up to the spread. */
const BURST_GAP_MS = 15000;
const BURST_GAP_SPREAD_MS = 10000;
/** Share of the time the rocket spends climbing before it bursts. */
const RISE = 0.24;
const SPARKS = 18;
const SPARK = 4;
/** How far the sparks fall while they fade, in px. */
const SPARK_DROP = 22;
const FLASH = 76;
const BURST_COLOURS = ['#FDE047', '#FF8A65', '#F472B6', '#A78BFA', '#38BDF8', '#34D399', '#FFFFFF'];

interface Spark {
  dx: number;
  dy: number;
  colour: string;
}
interface Burst {
  id: number;
  x: number;
  y: number;
  /** Where the rocket starts (the bottom of the top). */
  from: number;
  colour: string;
  sparks: Spark[];
}

let burstId = 0;

/** Somewhere in the upper half, off the edges, in two colours. */
function makeBurst(width: number, height: number): Burst {
  const pick = () => BURST_COLOURS[Math.floor(Math.random() * BURST_COLOURS.length)];
  const colour = pick();
  const second = pick();
  const radius = 34 + Math.random() * 18;
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const a = (i / SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    // Every other spark a little shorter, so it reads as two rings.
    const d = radius * (i % 2 ? 0.62 : 1) * (0.9 + Math.random() * 0.2);
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, colour: i % 2 ? second : colour };
  });
  return {
    id: ++burstId,
    x: width * (0.12 + Math.random() * 0.76),
    y: height * (0.18 + Math.random() * 0.32),
    from: height,
    colour,
    sparks,
  };
}

/** A rocket climbs to its spot, flashes, and throws sparks that fall and fade. */
function Firework({ burst }: { burst: Burst }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: BURST_MS, easing: Easing.linear });
  }, [t]);

  const rocket = useAnimatedStyle(() => {
    const p = Math.min(1, t.value / RISE);
    const eased = 1 - (1 - p) * (1 - p);
    return {
      opacity: t.value < RISE ? 0.9 : 0,
      transform: [{ translateY: (burst.y - burst.from) * eased }],
    };
  });
  const flash = useAnimatedStyle(() => {
    const p = Math.max(0, (t.value - RISE) / (1 - RISE));
    const on = t.value >= RISE ? Math.max(0, 1 - p / 0.3) : 0;
    return { opacity: on * 0.8, transform: [{ scale: 0.4 + 1.6 * Math.min(1, p / 0.3) }] };
  });

  return (
    <View pointerEvents="none" style={styles.fill}>
      <Animated.View style={[styles.rocket, { left: burst.x - 1, top: burst.from - 12 }, rocket]} />
      <Animated.View
        style={[
          styles.flash,
          { left: burst.x - FLASH / 2, top: burst.y - FLASH / 2, backgroundImage: flashOf(burst.colour) },
          flash,
        ]}
      />
      {burst.sparks.map((s, i) => (
        <SparkDot key={i} t={t} spark={s} x={burst.x} y={burst.y} />
      ))}
    </View>
  );
}

function SparkDot({ t, spark, x, y }: { t: SharedValue<number>; spark: Spark; x: number; y: number }) {
  const style = useAnimatedStyle(() => {
    if (t.value < RISE) return { opacity: 0 };
    const p = (t.value - RISE) / (1 - RISE);
    // Fast out, then slowing, while it drops and dims.
    const out = 1 - (1 - p) ** 3;
    return {
      opacity: (1 - p) ** 1.3,
      transform: [
        { translateX: spark.dx * out },
        { translateY: spark.dy * out + SPARK_DROP * p * p },
        { scale: 1 - 0.5 * p },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.spark,
        { left: x - SPARK / 2, top: y - SPARK / 2, backgroundColor: spark.colour, boxShadow: `0 0 6px 1px ${spark.colour}` },
        style,
      ]}
    />
  );
}

const flashOf = (hex: string) => `radial-gradient(circle closest-side, ${hex}AA 0%, ${hex}33 45%, ${hex}00 100%)`;

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
  halo: { position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2 },
  core: { width: BOB, height: BOB, borderRadius: BOB / 2, overflow: 'hidden' },
  coreShade: { borderRadius: BOB / 2 },
  rocket: { position: 'absolute', width: 2, height: 12, borderRadius: 1, backgroundColor: '#FFF3C4', boxShadow: '0 0 6px 1px #FFE9A0' },
  flash: { position: 'absolute', width: FLASH, height: FLASH, borderRadius: FLASH / 2 },
  spark: { position: 'absolute', width: SPARK, height: SPARK, borderRadius: SPARK / 2 },
  star: { position: 'absolute', backgroundColor: '#FFF7E0' },
});
