import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { font, spacing } from '../../theme/tokens';
import type { CategoryKey } from '../../types';

/** The categories as round icon tiles, four to a row. */
export function CategoryTiles({ value, onChange }: { value: CategoryKey; onChange: (k: CategoryKey) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
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
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing(3) },
  tile: { width: '25%', alignItems: 'center', gap: spacing(1.5), paddingHorizontal: spacing(0.5) },
  pressed: { opacity: 0.7 },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
