import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { MonthGrid } from '../../components/MonthGrid';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SectionLabel } from '../../components/SectionLabel';
import {
  lastPickableMonth,
  matchesFilter,
  monthsWithExpenses,
  NO_FILTER,
  thisMonth,
  type ExpenseFilter,
} from '../../lib/months';
import { counted } from '../../lib/split';
import { CATEGORIES } from '../../data/categories';
import { makeStyles } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, spacing } from '../../theme/tokens';
import type { CategoryKey, Group } from '../../types';

interface Props {
  visible: boolean;
  group: Group;
  value: ExpenseFilter;
  onApply: (f: ExpenseFilter) => void;
  onClose: () => void;
}

/** Month and categories for the Expenses list and Stats. Changes apply on "Show". */
export function FilterSheet({ visible, group, value, onApply, onClose }: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const marked = useMemo(() => monthsWithExpenses(group), [group]);
  const count = group.expenses.filter((e) => counted(e) && matchesFilter(e, draft)).length;
  const current = thisMonth();

  const toggleCategory = (k: CategoryKey) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(k) ? d.categories.filter((c) => c !== k) : [...d.categories, k],
    }));

  return (
    <BottomSheet
      visible={visible}
      title={t('filter.title')}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <PrimaryButton label={t('filter.reset')} variant="outline" onPress={() => setDraft(NO_FILTER)} style={styles.reset} />
          <PrimaryButton
            label={t('filter.show', { count })}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.show}
          />
        </View>
      }
    >
      <SectionLabel>{t('filter.month')}</SectionLabel>
      <View style={styles.chips}>
        <Chip label={t('filter.allMonths')} selected={draft.month === null} onPress={() => setDraft((d) => ({ ...d, month: null }))} />
        <Chip label={t('filter.thisMonth')} selected={draft.month === current} onPress={() => setDraft((d) => ({ ...d, month: current }))} />
      </View>
      <MonthGrid
        value={draft.month}
        // Tapping the picked month again goes back to all months.
        onPick={(m) => setDraft((d) => ({ ...d, month: d.month === m ? null : m }))}
        marked={marked}
        max={lastPickableMonth()}
      />
      <Text style={styles.hint}>{t('filter.monthHint')}</Text>

      <SectionLabel>{t('filter.category')}</SectionLabel>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={c.label}
            icon={c.icon}
            selected={draft.categories.includes(c.key)}
            onPress={() => toggleCategory(c.key)}
          />
        ))}
      </View>
      <Text style={styles.hint}>{t('filter.categoryHint')}</Text>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(3) },
  hint: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(1), marginBottom: spacing(5), lineHeight: 18 },
  footer: { flexDirection: 'row', gap: spacing(3) },
  reset: { flex: 1 },
  show: { flex: 2 },
}));
