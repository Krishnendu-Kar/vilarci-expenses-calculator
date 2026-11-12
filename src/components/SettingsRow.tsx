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
  /** An action, not a page (Log out): no chevron. */
  action?: boolean;
  /** Red, for things like Delete account. */
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** One tappable line in the Settings menu: icon, title, short hint, chevron. */
export function SettingsRow({ icon, title, subtitle, value, checked, action, danger, disabled, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.tint} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {action || danger ? null : checked === undefined ? (
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
  disabled: { opacity: 0.5 },
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
