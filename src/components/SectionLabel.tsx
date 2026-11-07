import React from 'react';
import { Text } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

const useStyles = makeStyles((c) => ({
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: c.textSecondary,
    marginBottom: spacing(2),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
}));
