import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={34} color={colors.tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: 'center', paddingVertical: spacing(12), paddingHorizontal: spacing(8) },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '700', color: c.textPrimary, marginBottom: spacing(1.5), textAlign: 'center' },
  body: { fontSize: font.md, color: c.textSecondary, textAlign: 'center', lineHeight: 21 },
}));
