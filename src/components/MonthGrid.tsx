import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { thisMonth, type Month } from '../lib/months';
import { fromISODate, monthLabel } from '../lib/format';
import { dateLocale } from '../i18n';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props {
  /** The picked month, if any. */
  value: Month | null;
  onPick: (m: Month) => void;
  /** Months that get a dot, e.g. the ones with expenses. */
  marked?: Set<Month>;
  /** Later months can't be picked. */
  max?: Month;
}

/** A year at a time: ‹ 2026 › over its 12 months. Opens on the picked month's year. */
export function MonthGrid({ value, onPick, marked, max }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const current = thisMonth();
  const [year, setYear] = useState(() => Number((value ?? current).slice(0, 4)));
  const lastYear = max ? Number(max.slice(0, 4)) : Infinity;
  const months = Array.from({ length: 12 }, (_, i): Month => `${year}-${String(i + 1).padStart(2, '0')}`);
  const short = (m: Month) => fromISODate(`${m}-01`).toLocaleDateString(dateLocale(), { month: 'short' });
  const yearText = fromISODate(`${year}-01-01`).toLocaleDateString(dateLocale(), { year: 'numeric' });

  return (
    <View>
      <View style={styles.yearRow}>
        <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={12} accessibilityLabel={t('month.prevYear')} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={colors.tint} />
        </Pressable>
        <Text style={styles.year}>{yearText}</Text>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          disabled={year >= lastYear}
          hitSlop={12}
          accessibilityLabel={t('month.nextYear')}
          style={styles.arrow}
        >
          <Ionicons name="chevron-forward" size={20} color={year >= lastYear ? colors.border : colors.tint} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {months.map((m) => {
          const selected = m === value;
          const disabled = !!max && m > max;
          return (
            <View key={m} style={styles.cellWrap}>
              <Pressable
                onPress={() => onPick(m)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={monthLabel(m)}
                accessibilityState={{ selected, disabled }}
                style={({ pressed }) => [
                  styles.cell,
                  m === current && styles.current,
                  selected && styles.selected,
                  disabled && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.label, selected && styles.labelSelected]}>{short(m)}</Text>
                <View style={[styles.dot, marked?.has(m) && (selected ? styles.dotOnSelected : styles.dotOn)]} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  arrow: { padding: spacing(2) },
  year: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(1) },
  cellWrap: { width: '33.333%', padding: spacing(1) },
  cell: {
    alignItems: 'center',
    paddingTop: spacing(2.5),
    paddingBottom: spacing(1.5),
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  current: { borderColor: c.tint },
  selected: { backgroundColor: c.primary, borderColor: c.primary },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  label: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  labelSelected: { color: c.onPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: spacing(1), backgroundColor: 'transparent' },
  dotOn: { backgroundColor: c.tint },
  dotOnSelected: { backgroundColor: c.onPrimary },
}));
