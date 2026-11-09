import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { Avatar } from '../../components/Avatar';
import { GOLD } from '../../components/LuxeCard';
import { font, spacing } from '../../theme/tokens';

export type Tone = 'up' | 'down' | 'even';
/** Ring colours on the night sky (as r,g,b): gets back, owes, settled. */
const TONE_RGB: Record<Tone, string> = { up: '134,239,172', down: '252,165,165', even: '255,255,255' };
export const TONE_COLOR: Record<Tone, string> = {
  up: `rgb(${TONE_RGB.up})`,
  down: `rgb(${TONE_RGB.down})`,
  even: `rgba(${TONE_RGB.even},0.45)`,
};

/** Someone's colour from their balance across groups (a few paise either way is settled). */
export function toneOf(net: number): Tone {
  return net > 0.005 ? 'up' : net < -0.005 ? 'down' : 'even';
}

export interface OrbitPerson {
  id: string;
  name: string;
  tone: Tone;
}

interface Props {
  /** You in the middle (ringed in your own colour), or null before you've set a name. */
  me: OrbitPerson | null;
  meLabel: string;
  /** Everyone else, the ones with money open first. */
  people: OrbitPerson[];
  onOpen: (personId: string) => void;
}

const HEIGHT = 204;
const TOP_GAP = spacing(2);
const INNER_MAX = 4;
const OUTER_MAX = 7;
const CENTRE = 56;
const NODE_IN = 38;
const NODE_OUT = 32;
/** Turning speed when nobody touches it (rad/s); the outer ring turns slower. */
const CRUISE = 0.16;
const OUTER_RATE = 0.6;
/** How quickly a spin slows down (per second), and the fastest a flick can spin it. */
const FRICTION = 1.3;
const MAX_SPIN = 5;
/** How long a tapped face shows as active before their page opens. */
const ACTIVE_MS = 220;

type Ring = { rx: number; ry: number };

/**
 * Your people on two slow rings around you, like a little solar system. Each
 * ring shows who gets back (green), who owes (red) or who's settled. Nearer
 * faces (lower on the ring) are bigger and brighter. Swipe across it to spin
 * it: a finger stops it, a flick keeps it going and it slows down by itself,
 * the faces swinging out a little while it spins fast. Tap a face and it
 * lifts, glows in its colour and shows the name, then their page opens.
 */
function OrbitStage({ me, meLabel, people, onOpen }: Props) {
  const still = useReducedMotion();
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const angle = useSharedValue(0);
  const spin = useSharedValue(0);
  const fling = useSharedValue(0);
  const held = useSharedValue(false);
  const start = useSharedValue(0);

  // The face under a finger, or the one just tapped while its page opens.
  const [active, setActive] = useState<string | null>(null);
  const opening = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // Back on People: nothing is active any more.
  useEffect(() => {
    if (!focused) return;
    opening.current = null;
    setActive(null);
  }, [focused]);

  const press = useMemo(
    () => ({
      in: (id: string) => setActive(id),
      // A press that slides off (or turns into a spin) lets go of the face;
      // a tap goes on to open, which keeps it active.
      out: (id: string) =>
        requestAnimationFrame(() => {
          if (opening.current !== id) setActive((a) => (a === id ? null : a));
        }),
      tap: (id: string) => {
        opening.current = id;
        setActive(id);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onOpen(id), ACTIVE_MS);
      },
    }),
    [onOpen],
  );

  const inner = people.slice(0, INNER_MAX);
  const rest = people.slice(INNER_MAX);
  // One spot on the outer ring turns into "+N" when there are too many.
  const outer = rest.length > OUTER_MAX ? rest.slice(0, OUTER_MAX - 1) : rest;
  const more = rest.length - outer.length;
  const outerCount = outer.length + (more ? 1 : 0);

  const cx = width / 2;
  const cy = HEIGHT / 2;
  // Phone-shaped; no wider on a tablet or a computer.
  const innerRing = useMemo<Ring>(() => ({ rx: Math.min(width * 0.25, 110), ry: 48 }), [width]);
  const outerRing = useMemo<Ring>(() => ({ rx: Math.min(width * 0.42, 190), ry: 78 }), [width]);

  const step = useCallback(
    (f: FrameInfo) => {
      'worklet';
      if (held.value) return;
      const dt = Math.min(f.timeSincePreviousFrame ?? 16, 34) / 1000;
      spin.value *= Math.exp(-FRICTION * dt);
      angle.value += ((still ? 0 : CRUISE) + spin.value) * dt;
      fling.value = Math.min(0.06, Math.abs(spin.value) * 0.015);
    },
    [still, held, spin, angle, fling],
  );
  const frame = useFrameCallback(step, false);
  // Only while People is showing, and held still while a tapped face opens.
  useEffect(() => {
    frame.setActive(focused && width > 0 && !active);
  }, [focused, width, active, frame]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        // A finger on it stops it, like a hand on a spinning record.
        .onBegin(() => {
          held.value = true;
          spin.value = 0;
        })
        .onStart(() => {
          start.value = angle.value;
        })
        // The near faces follow the finger.
        .onUpdate((e) => {
          angle.value = start.value - e.translationX / Math.max(1, innerRing.rx);
        })
        .onEnd((e) => {
          spin.value = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, -e.velocityX / Math.max(1, innerRing.rx)));
        })
        .onFinalize(() => {
          held.value = false;
        }),
    [held, spin, start, angle, innerRing],
  );

  const orbiter = (p: OrbitPerson, at: number, rate: number, ring: Ring, size: number) => (
    <Orbiter key={p.id} at={at} rate={rate} ring={ring} size={size} cx={cx} cy={cy} angle={angle} fling={fling} raised={active === p.id}>
      <Lift active={active === p.id} tone={p.tone} name={p.name} size={size}>
        <Pressable
          onPressIn={() => press.in(p.id)}
          onPressOut={() => press.out(p.id)}
          onPress={() => press.tap(p.id)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={p.name}
          style={[styles.face, { width: size, height: size, borderRadius: size / 2, borderColor: TONE_COLOR[p.tone] }]}
        >
          <Avatar name={p.name} size={size - 6} />
        </Pressable>
      </Lift>
    </Orbiter>
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.stage} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <>
            <Ellipse ring={outerRing} cx={cx} cy={cy} />
            <Ellipse ring={innerRing} cx={cx} cy={cy} />
            {inner.map((p, i) => orbiter(p, (i / inner.length) * 2 * Math.PI, 1, innerRing, NODE_IN))}
            {outer.map((p, i) => orbiter(p, ((i + 0.5) / outerCount) * 2 * Math.PI, OUTER_RATE, outerRing, NODE_OUT))}
            {more ? (
              <Orbiter
                at={((outerCount - 0.5) / outerCount) * 2 * Math.PI}
                rate={OUTER_RATE}
                ring={outerRing}
                size={NODE_OUT}
                cx={cx}
                cy={cy}
                angle={angle}
                fling={fling}
                raised={false}
              >
                <View style={[styles.more, { width: NODE_OUT, height: NODE_OUT, borderRadius: NODE_OUT / 2 }]}>
                  <Text style={styles.moreText}>+{more}</Text>
                </View>
              </Orbiter>
            ) : null}

            {/* You, in the middle, drawn after the rings so the far side passes behind. */}
            <View
              pointerEvents="box-none"
              style={[styles.centre, { left: cx - CENTRE / 2, top: cy - CENTRE / 2 }, me && active === me.id && styles.raised]}
            >
              <View pointerEvents="none" style={styles.glow} />
              <Lift active={!!me && active === me.id} tone={me?.tone ?? 'even'} name={me?.name ?? ''} size={CENTRE}>
                <Pressable
                  disabled={!me}
                  onPressIn={() => me && press.in(me.id)}
                  onPressOut={() => me && press.out(me.id)}
                  onPress={() => me && press.tap(me.id)}
                  accessibilityRole="button"
                  accessibilityLabel={me ? `${me.name} (${meLabel})` : meLabel}
                  style={[styles.meRing, me && { borderColor: TONE_COLOR[me.tone] }]}
                >
                  {me ? (
                    <Avatar name={me.name} size={CENTRE - 8} />
                  ) : (
                    <View style={styles.meBlank}>
                      <Ionicons name="person" size={22} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </Lift>
              <Text pointerEvents="none" style={styles.youTag}>
                {meLabel}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

// Typing in People's search box doesn't redraw the orbit.
export const PeopleOrbit = React.memo(OrbitStage);

/**
 * A face's active look: it springs up a little, a soft glow in its colour
 * comes up behind it and the name shows above it.
 */
function Lift({ active, tone, name, size, children }: { active: boolean; tone: Tone; name: string; size: number; children: React.ReactNode }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = active ? withSpring(1, { damping: 11, stiffness: 260 }) : withTiming(0, { duration: 160 });
  }, [active, lift]);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.22 * lift.value }] }));
  const glow = useAnimatedStyle(() => ({ opacity: Math.min(1, lift.value), transform: [{ scale: 0.6 + 0.4 * lift.value }] }));
  const tag = useAnimatedStyle(() => ({
    opacity: Math.min(1, lift.value),
    transform: [{ translateY: 6 * (1 - lift.value) }],
  }));
  const halo = size * 2.4;
  const rgb = TONE_RGB[tone];
  return (
    <View style={styles.lift}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            backgroundImage: `radial-gradient(circle closest-side, rgba(${rgb},0.55) 0%, rgba(${rgb},0.22) 35%, rgba(${rgb},0) 100%)`,
          },
          glow,
        ]}
      />
      <Animated.View style={face}>{children}</Animated.View>
      {name ? (
        <Animated.View pointerEvents="none" style={[styles.nameWrap, { bottom: size * 1.11 + 6 }, tag]}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A ring's path: a circle squashed flat, so it reads as tilted away. */
function Ellipse({ ring, cx, cy }: { ring: Ring; cx: number; cy: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ellipse,
        {
          width: ring.rx * 2,
          height: ring.rx * 2,
          borderRadius: ring.rx,
          left: cx - ring.rx,
          top: cy - ring.rx,
          transform: [{ scaleY: ring.ry / ring.rx }],
        },
      ]}
    />
  );
}

interface OrbiterProps {
  /** Where on the ring it sits when the angle is 0 (radians). */
  at: number;
  rate: number;
  ring: Ring;
  size: number;
  cx: number;
  cy: number;
  angle: SharedValue<number>;
  fling: SharedValue<number>;
  /** Drawn above everything else (the active face). */
  raised: boolean;
  children: React.ReactNode;
}

function Orbiter({ at, rate, ring, size, cx, cy, angle, fling, raised, children }: OrbiterProps) {
  const style = useAnimatedStyle(() => {
    const a = at + angle.value * rate;
    // 0 at the back of the ring (top), 1 at the front (bottom).
    const near = (Math.sin(a) + 1) / 2;
    const out = 1 + fling.value;
    return {
      // The active face comes up to full brightness, even from the back.
      opacity: raised ? 1 : 0.55 + 0.45 * near,
      transform: [
        { translateX: cx + ring.rx * out * Math.cos(a) - size / 2 },
        { translateY: cy + ring.ry * out * Math.sin(a) - size / 2 },
        { scale: 0.8 + 0.2 * near },
      ],
    };
  });
  return (
    <Animated.View style={[styles.orbiter, { width: size, height: size }, raised && styles.raised, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { height: HEIGHT, marginTop: TOP_GAP },
  ellipse: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(251,191,36,0.22)' },
  orbiter: { position: 'absolute', left: 0, top: 0 },
  raised: { zIndex: 10 },
  lift: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  nameWrap: { position: 'absolute', alignItems: 'center', width: 160 },
  name: {
    color: '#241012',
    backgroundColor: '#FFFFFF',
    fontSize: font.xs + 1,
    fontWeight: '800',
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  face: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  moreText: { color: '#FFFFFF', fontSize: font.xs, fontWeight: '800' },
  centre: { position: 'absolute', width: CENTRE, height: CENTRE, alignItems: 'center', justifyContent: 'center' },
  // A soft gold glow round you, fading evenly (no rings).
  glow: {
    position: 'absolute',
    width: CENTRE * 2,
    height: CENTRE * 2,
    borderRadius: CENTRE,
    backgroundImage: 'radial-gradient(circle closest-side, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.12) 45%, rgba(251,191,36,0) 100%)',
  },
  meRing: {
    width: CENTRE,
    height: CENTRE,
    borderRadius: CENTRE / 2,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meBlank: {
    width: CENTRE - 8,
    height: CENTRE - 8,
    borderRadius: (CENTRE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  youTag: {
    position: 'absolute',
    bottom: -8,
    color: '#241012',
    backgroundColor: GOLD,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
