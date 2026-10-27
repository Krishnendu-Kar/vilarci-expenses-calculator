import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

/** One tappable line in the Settings menu: icon, title, short hint, chevron. */
export function SettingsRow({ icon, title, subtitle, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: font.md + 1, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
});
