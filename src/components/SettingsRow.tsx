import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Current choice shown on the right, e.g. "Dark". */
  value?: string;
  /** A tick instead of the chevron: for pick-one lists. */
  checked?: boolean;
  onPress: () => void;
}

/** One tappable line in the Settings menu: icon, title, short hint, chevron. */
export function SettingsRow({ icon, title, subtitle, value, checked, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.tint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {checked === undefined ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : checked ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.tint} />
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={colors.border} />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    backgroundColor: c.surface,
  },
  pressed: { backgroundColor: c.surfaceAlt },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: font.md + 1, fontWeight: '600', color: c.textPrimary },
  subtitle: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  value: { fontSize: font.sm + 1, color: c.textSecondary, fontWeight: '600' },
}));
