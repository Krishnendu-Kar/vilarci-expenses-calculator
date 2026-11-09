import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isFiltered, type ExpenseFilter } from '../../lib/months';
import { monthLabel } from '../../lib/format';
import { categoryOf, type IconName } from '../../data/categories';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';

/** The active filter as chips; tapping one takes it off. Nothing when there's no filter. */
export function FilterChips({ filter, onChange }: { filter: ExpenseFilter; onChange: (f: ExpenseFilter) => void }) {
  const styles = useStyles();
  if (!isFiltered(filter)) return null;
  return (
    <View style={styles.row}>
      {filter.month ? (
        <Removable icon="calendar-outline" label={monthLabel(filter.month)} onRemove={() => onChange({ ...filter, month: null })} />
      ) : null}
      {filter.categories.map((k) => {
        const cat = categoryOf(k);
        return (
          <Removable
            key={k}
            icon={cat.icon}
            label={cat.label}
            onRemove={() => onChange({ ...filter, categories: filter.categories.filter((c) => c !== k) })}
          />
        );
      })}
    </View>
  );
}

function Removable({ icon, label, onRemove }: { icon: IconName; label: string; onRemove: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onRemove}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={t('filter.remove', { name: label })}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={14} color={colors.onPrimary} />
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="close" size={15} color={colors.onPrimary} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(3) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingLeft: spacing(3),
    paddingRight: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: radii.pill,
    backgroundColor: c.primary,
  },
  pressed: { opacity: 0.8 },
  label: { fontSize: font.sm, fontWeight: '700', color: c.onPrimary },
}));
