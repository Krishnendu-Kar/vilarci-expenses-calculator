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
            {o.icon ? <Ionicons name={o.icon} size={12} color={active ? colors.onPrimary : colors.textSecondary} /> : null}
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  bar: { flexGrow: 0 },
  row: { gap: spacing(1.5), paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.25),
    borderRadius: radii.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
    shadowColor: c.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  label: { fontSize: font.sm, fontWeight: '600', color: c.textSecondary },
  labelActive: { color: c.onPrimary, fontWeight: '700' },
}));
