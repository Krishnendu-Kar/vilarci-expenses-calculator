import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import { monthLabel } from '../lib/format';

interface Props {
  /** The month showing, or null for all months together. */
  month: string | null;
  closed: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Close/reopen the month, repeats, all months. */
  onMenu: () => void;
}

/** Hostel/flat groups: ‹ October 2026 › with a lock when the month is closed. */
export function MonthBar({ month, closed, canPrev, canNext, onPrev, onNext, onMenu }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      <Pressable onPress={onPrev} disabled={!canPrev} hitSlop={8} style={styles.arrow} accessibilityLabel={t('month.previous')}>
        <Ionicons name="chevron-back" size={20} color={canPrev ? colors.tint : colors.border} />
      </Pressable>
      <Pressable onPress={onMenu} style={styles.center} accessibilityRole="button">
        {closed ? <Ionicons name="lock-closed" size={14} color={colors.textSecondary} /> : null}
        <Text style={styles.label} numberOfLines={1}>
          {month ? monthLabel(month) : t('month.all')}
        </Text>
        {closed ? <Text style={styles.closed}>{t('month.closed')}</Text> : null}
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>
      <Pressable onPress={onNext} disabled={!canNext} hitSlop={8} style={styles.arrow} accessibilityLabel={t('month.next')}>
        <Ionicons name="chevron-forward" size={20} color={canNext ? colors.tint : colors.border} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    marginBottom: spacing(3),
  },
  arrow: { paddingHorizontal: spacing(3.5), paddingVertical: spacing(2.5) },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1.5) },
  label: { fontSize: font.md, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
  closed: {
    fontSize: font.xs,
    fontWeight: '700',
    color: c.textSecondary,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
}));
