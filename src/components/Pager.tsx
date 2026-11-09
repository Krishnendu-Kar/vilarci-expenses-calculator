import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface Props {
  /** Which page is showing. */
  index: number;
  onIndexChange: (index: number) => void;
  /** One child per page, in tab order. */
  children: React.ReactNode;
  /**
   * Pulling right past the first page, like WhatsApp's old camera: `hint`
   * shows in the gap and grows, and letting go far enough calls `onPull`.
   */
  pullStart?: { hint: React.ReactNode; onPull: () => void };
}

const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };
/** Fraction of the width (or fling speed) that commits to the next page. */
const COMMIT_FRACTION = 0.22;
const COMMIT_VELOCITY = 450;
/** How much of the drag shows past the first/last page. */
const EDGE_RESISTANCE = 0.25;
/** With a pull action the first page gives more, so the hint has room. */
const PULL_RESISTANCE = 0.55;
/** How far (after resistance) the first page must move to trigger the pull. */
const PULL_TRIGGER = 72;
const HINT_SIZE = 56;

/**
 * Full-screen pages side by side, like WhatsApp's tabs. The row tracks the
 * finger 1:1 on the UI thread and eases onto the chosen page, so it stays
 * smooth even while React is busy. Every page stays mounted, which keeps
 * each tab's scroll position and means nothing renders mid-swipe.
 */
export function Pager({ index, onIndexChange, children, pullStart }: Props) {
  const pages = React.Children.toArray(children);
  const count = pages.length;
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);

  const x = useSharedValue(-index * width);
  const w = useSharedValue(width);
  const current = useSharedValue(index);
  const startX = useSharedValue(0);
  const onPull = pullStart?.onPull;

  // A tapped tab (index changed from outside) slides over; a swipe has
  // already set `current` and started its own slide, so it's skipped.
  useEffect(() => {
    if (current.value === index) return;
    current.value = index;
    x.value = withTiming(-index * w.value, SLIDE);
  }, [index, current, x, w]);

  // Size changes (rotation, first layout) jump straight to the page.
  useEffect(() => {
    w.value = width;
    x.value = -current.value * width;
  }, [width, w, x, current]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onStart(() => {
          startX.value = x.value;
        })
        .onUpdate((e) => {
          const min = -(count - 1) * w.value;
          let next = startX.value + e.translationX;
          if (next > 0) next *= onPull ? PULL_RESISTANCE : EDGE_RESISTANCE;
          else if (next < min) next = min + (next - min) * EDGE_RESISTANCE;
          x.value = next;
        })
        .onEnd((e) => {
          const from = current.value;
          if (onPull && from === 0 && x.value >= PULL_TRIGGER) {
            x.value = withTiming(0, SLIDE);
            scheduleOnRN(onPull);
            return;
          }
          const moved = x.value - -from * w.value;
          let target = from;
          if (e.velocityX < -COMMIT_VELOCITY || moved < -w.value * COMMIT_FRACTION) target = from + 1;
          else if (e.velocityX > COMMIT_VELOCITY || moved > w.value * COMMIT_FRACTION) target = from - 1;
          target = Math.max(0, Math.min(count - 1, target));
          x.value = withTiming(-target * w.value, SLIDE);
          if (target !== from) {
            current.value = target;
            scheduleOnRN(onIndexChange, target);
          }
        }),
    [count, onIndexChange, onPull, current, startX, w, x],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Centred in the gap the first page leaves; full size once letting go would trigger.
  const hintStyle = useAnimatedStyle(() => {
    const pulled = Math.max(0, x.value);
    return {
      opacity: interpolate(pulled, [0, PULL_TRIGGER * 0.6], [0, 1], 'clamp'),
      transform: [
        { translateX: pulled / 2 - HINT_SIZE / 2 },
        { scale: pulled >= PULL_TRIGGER ? 1.12 : interpolate(pulled, [0, PULL_TRIGGER], [0.5, 1], 'clamp') },
      ],
    };
  });

  return (
    <View style={styles.clip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, { width: width * count }, rowStyle]}>
          {pages.map((page, i) => (
            <View key={i} style={{ width }}>
              {page}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
      {pullStart ? (
        <Animated.View pointerEvents="none" style={[styles.hint, hintStyle]}>
          {pullStart.hint}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  hint: { position: 'absolute', top: 0, bottom: 0, left: 0, width: HINT_SIZE, alignItems: 'center', justifyContent: 'center' },
});
