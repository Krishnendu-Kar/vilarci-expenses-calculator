import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Avatar } from './Avatar';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props {
  name: string;
  value: string;
  onChangeText: (t: string) => void;
  prefix?: string;
  suffix?: string;
  /** Small text under the name, e.g. what a share works out to. */
  hint?: string;
  integer?: boolean;
}

/** One person + a number field: used for multiple payers and custom splits. */
export function PersonAmountRow({ name, value, onChangeText, prefix, suffix, hint, integer }: Props) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  return (
    <View style={styles.row}>
      <Avatar name={name} size={30} />
      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(integer ? /[^0-9]/g : /[^0-9.]/g, ''))}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        keyboardAppearance={dark ? 'dark' : 'light'}
        maxLength={10}
        selectTextOnFocus
      />
      {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingVertical: spacing(2),
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  nameCol: { flex: 1 },
  name: { fontSize: font.md, color: c.textPrimary, fontWeight: '600' },
  hint: { fontSize: font.xs + 1, color: c.textSecondary, marginTop: 1 },
  affix: { fontSize: font.md, color: c.textSecondary },
  input: {
    width: 92,
    textAlign: 'right',
    fontSize: font.md + 1,
    color: c.textPrimary,
    backgroundColor: c.background,
    borderRadius: radii.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
  },
}));
