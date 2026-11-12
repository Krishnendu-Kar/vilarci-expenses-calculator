import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { makeStyles } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props<K extends string> {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}

const PAD = spacing(1);
// Quick and soft, like the iOS switch: no bounce.
const SLIDE = { duration: 240, easing: Easing.out(Easing.cubic) };

/**
 * Two or more choices in one track. The white pill slides to the chosen one
 * (on the UI thread), instead of jumping.
 */
export function Segmented<K extends string>({ options, value, onChange }: Props<K>) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const segWidth = width ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!segWidth) return;
    const to = index * segWidth;
    // The first placement (and reduced motion) doesn't slide.
    x.value = placed.value && !reduceMotion ? withTiming(to, SLIDE) : to;
    placed.value = true;
  }, [index, segWidth, reduceMotion, x, placed]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {segWidth ? <Animated.View pointerEvents="none" style={[styles.pill, { width: segWidth }, pill]} /> : null}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            // Before the track is measured there's no pill yet: the chosen one gets its own.
            style={[styles.seg, active && !segWidth && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => {
  const raised = {
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  };
  return {
    track: {
      flexDirection: 'row',
      backgroundColor: c.surfaceAlt,
      borderRadius: radii.md,
      padding: PAD,
    },
    pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radii.sm, ...raised },
    seg: { flex: 1, paddingVertical: spacing(2.5), paddingHorizontal: spacing(0.5), borderRadius: radii.sm, alignItems: 'center' },
    segActive: raised,
    label: { fontSize: font.sm + 1, fontWeight: '600', color: c.textSecondary },
    labelActive: { color: c.tint },
  };
});
