import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { dayLabel, fromISODate, longDate, toISODate } from '../lib/format';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props {
  value: string;
  onChange: (iso: string) => void;
}

export function DateField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const styles = useStyles();
  const { colors, dark } = useTheme();
  // Dates are written in the app's language; re-render when it changes.
  useI18n();

  // The native picker has no web build; browsers get their own date input.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        <Ionicons name="calendar-outline" size={18} color={colors.tint} />
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: font.md + 1,
            color: colors.textPrimary,
            fontFamily: 'inherit',
            colorScheme: dark ? 'dark' : 'light',
          }}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen((o) => !o)}>
        <Ionicons name="calendar-outline" size={18} color={colors.tint} />
        <Text style={styles.value}>{dayLabel(value)}</Text>
        <Text style={styles.sub}>{longDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={fromISODate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant={dark ? 'dark' : 'light'}
          // Not `onChange`: deprecated in datetimepicker 9.1, and it was also
          // what closed the picker on cancel, so dismiss needs its own handler.
          onValueChange={(_event, selected) => {
            // Android's dialog has already closed itself; iOS stays inline
            // until the field is tapped again.
            setOpen(Platform.OS === 'ios');
            if (selected) onChange(toISODate(selected));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginBottom: spacing(5),
  },
  value: { fontSize: font.md + 1, fontWeight: '600', color: c.textPrimary },
  sub: { fontSize: font.sm, color: c.textSecondary, marginLeft: 'auto' },
}));
