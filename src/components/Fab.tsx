import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <Ionicons name="add" size={22} color={colors.onPrimary} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  fab: {
    position: 'absolute',
    right: spacing(5),
    bottom: spacing(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: c.primary,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3.5),
    borderRadius: radii.pill,
    shadowColor: c.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  label: { color: c.onPrimary, fontSize: font.md, fontWeight: '700' },
}));
