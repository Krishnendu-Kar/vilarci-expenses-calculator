import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { font, spacing } from '../../theme/tokens';
import type { CategoryKey } from '../../types';

const TILE = 64;
const GAP = spacing(2);

/** The categories as round icon tiles in one row that scrolls sideways. */
export function CategoryTiles({ value, onChange }: { value: CategoryKey; onChange: (k: CategoryKey) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);

  // Editing an expense whose category is further along: bring it into view.
  useEffect(() => {
    const i = CATEGORIES.findIndex((c) => c.key === value);
    if (i > 3) scroller.current?.scrollTo({ x: (i - 2) * (TILE + GAP), animated: false });
    // only on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
      accessibilityRole="radiogroup"
    >
      {CATEGORIES.map((c) => {
        const on = value === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.label}
          >
            <View style={[styles.circle, on && styles.circleOn]}>
              <Ionicons name={c.icon} size={20} color={on ? colors.onPrimary : colors.tint} />
            </View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  // Runs to the card's edges, so the row visibly continues past them.
  scroller: { marginHorizontal: -spacing(3) },
  row: { gap: GAP, paddingHorizontal: spacing(3), paddingVertical: 2 },
  tile: { width: TILE, alignItems: 'center', gap: spacing(1) },
  pressed: { opacity: 0.7 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  circleOn: {
    backgroundColor: c.primary,
    borderColor: c.accent,
    shadowColor: c.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  label: { fontSize: font.xs + 1, fontWeight: '600', color: c.textSecondary },
  labelOn: { color: c.tint, fontWeight: '800' },
}));
