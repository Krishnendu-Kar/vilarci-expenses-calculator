import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

interface Props<K extends string> {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
}

/** WhatsApp-style row of filter pills. Scrolls sideways if it doesn't fit. */
export function FilterBar<K extends string>({ options, value, onChange }: Props<K>) {
  const scroll = useRef<ScrollViewInstance>(null);
  const xs = useRef<Record<string, number>>({});
  const styles = useStyles();
  const { colors } = useTheme();

  // Keep the active pill in view when it changes by swiping.
  useEffect(() => {
    const x = xs.current[value];
    if (x != null) scroll.current?.scrollTo({ x: Math.max(0, x - spacing(10)), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bar}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            onLayout={(e) => (xs.current[o.key] = e.nativeEvent.layout.x)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {o.icon ? <Ionicons name={o.icon} size={14} color={active ? colors.tint : colors.textSecondary} /> : null}
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  bar: { flexGrow: 0 },
  row: { gap: spacing(2), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.75),
    borderRadius: radii.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillActive: { backgroundColor: c.surfaceAlt, borderColor: c.primaryLight },
  label: { fontSize: font.sm + 1, fontWeight: '600', color: c.textSecondary },
  labelActive: { color: c.tint, fontWeight: '700' },
}));
