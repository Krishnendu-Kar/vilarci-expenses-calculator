import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { spacing } from '../theme/tokens';

interface Props {
  /** Always showing, above the drawer (none: only the handle shows when shut). */
  head?: React.ReactNode;
  /** Hidden until pulled down. Mounted only while it's open or opening. */
  children: React.ReactNode;
  showLabel: string;
  hideLabel: string;
  /** Start open (it is laid out at its own height first, so nothing jumps). */
  initiallyOpen?: boolean;
}

const SPRING = { damping: 18, stiffness: 180, mass: 0.9 };
/** Pulled past fully open, it gives this much more, then springs back. */
const STRETCH = 0.15;
/** Until the drawer has measured itself. */
const GUESS_HEIGHT = 250;

/**
 * A pull-down drawer for a dark page top: `head` always shows; `children`
 * opens under it when you pull down anywhere on the top (or tap the handle
 * at the bottom), and closes when you push it back up or tap again. It
 * follows the finger, then springs open or shut from how far and how fast
 * you pulled. Closed by default; nothing in it runs while it's shut.
 */
export function PullDrawer({ head, children, showLabel, hideLabel, initiallyOpen = false }: Props) {
  const open = useSharedValue(initiallyOpen ? 1 : 0);
  const start = useSharedValue(0);
  const height = useSharedValue(GUESS_HEIGHT);
  // Open from the start: the box takes the drawer's own height until it has measured it.
  const known = useSharedValue(initiallyOpen ? 0 : 1);
  const [free, setFree] = useState(initiallyOpen);
  const [mounted, setMounted] = useState(initiallyOpen);
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  const pan = useMemo(() => {
    const settle = (to: number) => {
      'worklet';
      scheduleOnRN(setIsOpen, to === 1);
      open.value = withSpring(to, SPRING, (done) => {
        if (done && to === 0) scheduleOnRN(setMounted, false);
      });
    };
    return (
      Gesture.Pan()
        // Up and down only; sideways drags (spinning what's inside) are left alone.
        .activeOffsetY([-8, 8])
        .failOffsetX([-14, 14])
        .onStart(() => {
          start.value = open.value;
          scheduleOnRN(setMounted, true);
        })
        .onUpdate((e) => {
          const raw = start.value + e.translationY / Math.max(1, height.value);
          open.value = raw > 1 ? 1 + (raw - 1) * STRETCH : Math.max(0, raw);
        })
        .onEnd((e) => {
          settle(e.velocityY > 500 ? 1 : e.velocityY < -500 ? 0 : open.value > 0.4 ? 1 : 0);
        })
    );
  }, [open, start, height]);

  const toggle = () => {
    const to = isOpen ? 0 : 1;
    setMounted(true);
    setIsOpen(!isOpen);
    open.value = withSpring(to, SPRING, (done) => {
      if (done && to === 0) scheduleOnRN(setMounted, false);
    });
  };

  const box = useAnimatedStyle(() => (known.value ? { height: Math.max(0, open.value) * height.value } : {}));
  // Slides down from under the head and fades in as it opens.
  const inner = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0.1, 0.7], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(open.value, [0, 1], [-28, 0], 'clamp') }],
  }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.min(1, open.value) * 180}deg` }] }));

  return (
    <GestureDetector gesture={pan}>
      <View>
        {head}
        <Animated.View style={[styles.box, box]}>
          {mounted ? (
            <Animated.View
              style={[styles.inner, free && styles.innerFree, inner]}
              onLayout={(e) => {
                height.value = e.nativeEvent.layout.height;
                known.value = 1;
                if (free) setFree(false);
              }}
            >
              {children}
            </Animated.View>
          ) : null}
        </Animated.View>
        <Pressable
          onPress={toggle}
          hitSlop={{ top: 6, bottom: 10, left: 40, right: 40 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={isOpen ? hideLabel : showLabel}
          style={styles.handle}
        >
          <View style={styles.bar} />
          <Animated.View style={chevron}>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
          </Animated.View>
        </Pressable>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  // Laid out at its own height, whatever the box is at the moment.
  inner: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Before it has measured itself (open from the start): in the flow, so the box fits it.
  innerFree: { position: 'relative' },
  handle: { alignSelf: 'center', alignItems: 'center', paddingTop: spacing(3), gap: 2 },
  bar: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
});
