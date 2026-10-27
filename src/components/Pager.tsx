import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface Props {
  /** Which page is showing. */
  index: number;
  onIndexChange: (index: number) => void;
  /** One child per page, in tab order. */
  children: React.ReactNode;
}

const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };
/** Fraction of the width (or fling speed) that commits to the next page. */
const COMMIT_FRACTION = 0.22;
const COMMIT_VELOCITY = 450;
/** How much of the drag shows past the first/last page. */
const EDGE_RESISTANCE = 0.25;

/**
 * Full-screen pages side by side, like WhatsApp's tabs. The row tracks the
 * finger 1:1 on the UI thread and eases onto the chosen page, so it stays
 * smooth even while React is busy. Every page stays mounted, which keeps
 * each tab's scroll position and means nothing renders mid-swipe.
 */
export function Pager({ index, onIndexChange, children }: Props) {
  const pages = React.Children.toArray(children);
  const count = pages.length;
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);

  const x = useSharedValue(-index * width);
  const w = useSharedValue(width);
  const current = useSharedValue(index);
  const startX = useSharedValue(0);

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
          if (next > 0) next *= EDGE_RESISTANCE;
          else if (next < min) next = min + (next - min) * EDGE_RESISTANCE;
          x.value = next;
        })
        .onEnd((e) => {
          const from = current.value;
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
    [count, onIndexChange, current, startX, w, x],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
