import React from 'react';
import { Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';
import { font, radii } from '../theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, disabled, variant = 'solid', style }: Props) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.button, variant === 'outline' && styles.outline, variant === 'danger' && styles.danger, disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, variant === 'outline' && styles.labelOutline, variant === 'danger' && styles.labelDanger]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const useStyles = makeStyles((c) => ({
  button: {
    backgroundColor: c.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  outline: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.tint,
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.danger,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: { opacity: 0.5 },
  label: { color: c.onPrimary, fontSize: font.md + 1, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  labelOutline: { color: c.tint },
  labelDanger: { color: c.danger },
}));
