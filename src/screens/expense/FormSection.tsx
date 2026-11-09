import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { font, radii, spacing } from '../../theme/tokens';
import type { IconName } from '../../data/categories';

interface Props {
  icon: IconName;
  title: string;
  /** A link or button on the right of the title. */
  right?: React.ReactNode;
  /** Red edge: something in here needs an answer. */
  attention?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** One card of the Add expense page: an icon, a title, then its fields. */
export function FormSection({ icon, title, right, attention, style, children }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.card, attention && styles.attention, style]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={16} color={colors.tint} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
    marginBottom: spacing(4),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  attention: { borderColor: c.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5), marginBottom: spacing(3) },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: c.textPrimary },
}));
