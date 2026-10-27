import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface Props {
  /** Which tab is showing. */
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode;
  /**
   * Stretch to fill the screen (default). Pass false inside a ScrollView so
   * the area is sized by its content instead.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

const COMMIT_DISTANCE = 60;
const COMMIT_VELOCITY = 450;
const ENTER_OFFSET = 60;
const EDGE_RESISTANCE = 0.2;
const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };

/**
 * Swipe left/right to switch tabs whose content differs in height (so they
 * can't sit side by side like in Pager). The content follows the finger on
 * the UI thread, then the next tab slides in from the side it came from.
 * Vertical scrolling still works: the pan only starts on a clearly
 * horizontal drag and gives up on a vertical one.
 */
export function SwipeView({ index, count, onIndexChange, children, fill = true, style }: Props) {
  const x = useSharedValue(0);
  const shown = useRef(index);

  useEffect(() => {
    const dir = Math.sign(index - shown.current);
    shown.current = index;
    if (!dir) return;
    x.value = withSequence(withTiming(dir * ENTER_OFFSET, { duration: 0 }), withTiming(0, SLIDE));
  }, [index, x]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-16, 16])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          // Resist at the first/last tab so it's clear there's nothing further.
          const atEdge = (e.translationX > 0 && index === 0) || (e.translationX < 0 && index === count - 1);
          x.value = atEdge ? e.translationX * EDGE_RESISTANCE : e.translationX;
        })
        .onEnd((e) => {
          const next = e.translationX < 0 ? index + 1 : index - 1;
          const far = Math.abs(e.translationX) > COMMIT_DISTANCE || Math.abs(e.velocityX) > COMMIT_VELOCITY;
          if (far && next >= 0 && next < count) scheduleOnRN(onIndexChange, next);
          else x.value = withTiming(0, SLIDE);
        })
        .onFinalize((_e, success) => {
          if (!success) x.value = withTiming(0, SLIDE);
        }),
    [index, count, onIndexChange, x],
  );

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[fill && styles.fill, style, animated]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
