import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}

export function Chip({ label, selected, onPress, icon }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.selected]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? colors.onPrimary : colors.tint} /> : null}
      {!icon && selected ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  selected: { backgroundColor: c.primary, borderColor: c.primary },
  label: { fontSize: font.sm + 1, fontWeight: '600', color: c.textPrimary },
  labelSelected: { color: c.onPrimary },
}));
