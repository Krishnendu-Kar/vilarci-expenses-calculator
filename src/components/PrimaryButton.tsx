import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { font, radii } from '../theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, disabled, variant = 'solid', style }: Props) {
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

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: { opacity: 0.5 },
  label: { color: colors.white, fontSize: font.md + 1, fontWeight: '700', letterSpacing: 0.3 },
  labelOutline: { color: colors.primary },
  labelDanger: { color: colors.danger },
});
