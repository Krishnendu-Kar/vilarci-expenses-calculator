import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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

const COMMIT_DISTANCE = 70;
const COMMIT_VELOCITY = 600;
const ENTER_OFFSET = 80;
const native = Platform.OS !== 'web';

/**
 * Swipe left/right to move between tabs. The content follows the finger,
 * then the next tab slides in from the side it came from (tapping a tab
 * gets the same slide). Vertical scrolling inside still works: the pan
 * only starts on a clearly horizontal drag and gives up on a vertical one.
 */
export function SwipeView({ index, count, onIndexChange, children, fill = true, style }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const shown = useRef(index);

  useEffect(() => {
    const dir = Math.sign(index - shown.current);
    shown.current = index;
    if (!dir) return;
    x.setValue(dir * ENTER_OFFSET);
    Animated.spring(x, { toValue: 0, speed: 22, bounciness: 0, useNativeDriver: native }).start();
  }, [index, x]);

  const pan = useMemo(() => {
    const settle = () => Animated.spring(x, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: native }).start();
    return Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-20, 20])
      .failOffsetY([-14, 14])
      .onUpdate((e) => {
        // Resist at the first/last tab so it's clear there's nothing further.
        const atEdge = (e.translationX > 0 && index === 0) || (e.translationX < 0 && index === count - 1);
        x.setValue(e.translationX * (atEdge ? 0.15 : 0.5));
      })
      .onEnd((e) => {
        const next = e.translationX < 0 ? index + 1 : index - 1;
        const far = Math.abs(e.translationX) > COMMIT_DISTANCE || Math.abs(e.velocityX) > COMMIT_VELOCITY;
        if (far && next >= 0 && next < count) onIndexChange(next);
        else settle();
      })
      .onFinalize((_e, success) => {
        if (!success) settle();
      });
  }, [index, count, onIndexChange, x]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[fill && styles.fill, style, { transform: [{ translateX: x }] }]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
