import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

// Side padding with the label, and without it: 14 + 22 (icon) + 14 = 50,
// the button's height, so the folded button is a circle.
const PAD_OPEN = spacing(5);
const PAD_FOLDED = 14;
const GAP = spacing(1.5);

/**
 * The round "+" button at the bottom right. With `shrinkAfter` (ms), its
 * label shows first and then folds away, leaving just the "+" (Home: 5 s
 * after the app opens). The label stays as the button's accessibility name.
 */
export function Fab({ label, onPress, shrinkAfter }: { label: string; onPress: () => void; shrinkAfter?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const still = useReducedMotion();
  const open = useSharedValue(1);
  // The label's own width, measured once, so it can fold to 0 without wrapping.
  const [labelW, setLabelW] = useState(0);

  useEffect(() => {
    if (!shrinkAfter) return;
    const timer = setTimeout(() => {
      open.value = still ? 0 : withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    }, shrinkAfter);
    return () => clearTimeout(timer);
  }, [shrinkAfter, still, open]);

  const bodyStyle = useAnimatedStyle(() => ({
    paddingHorizontal: PAD_FOLDED + (PAD_OPEN - PAD_FOLDED) * open.value,
  }));
  const labelStyle = useAnimatedStyle(() =>
    labelW ? { width: labelW * open.value, marginLeft: GAP * open.value, opacity: open.value } : { marginLeft: GAP },
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.body, bodyStyle]}>
        <Ionicons name="add" size={22} color={colors.onPrimary} />
        <Animated.View style={[styles.labelWrap, labelStyle]}>
          <Text
            style={[styles.label, labelW ? { width: labelW } : null]}
            numberOfLines={1}
            onLayout={(e) => !labelW && setLabelW(Math.ceil(e.nativeEvent.layout.width))}
          >
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  fab: {
    position: 'absolute',
    right: spacing(5),
    bottom: spacing(6),
    backgroundColor: c.primary,
    borderRadius: radii.pill,
    shadowColor: c.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  body: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(3.5) },
  labelWrap: { overflow: 'hidden' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  label: { color: c.onPrimary, fontSize: font.md, fontWeight: '700' },
}));
