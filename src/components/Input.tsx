import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        keyboardAppearance={dark ? 'dark' : 'light'}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { marginBottom: spacing(4) },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: c.textSecondary,
    marginBottom: spacing(1.5),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: font.md + 1,
    color: c.textPrimary,
  },
  inputError: { borderColor: c.danger },
  error: { color: c.danger, fontSize: font.sm, marginTop: spacing(1) },
}));
