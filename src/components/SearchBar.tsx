import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/** A search field with a clear button. */
export function SearchBar({ value, onChangeText, placeholder }: Props) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={17} color={colors.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardAppearance={dark ? 'dark' : 'light'}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={t('common.search')}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel={t('common.clear')}>
          <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3.5),
    marginBottom: spacing(3),
  },
  input: { flex: 1, fontSize: font.md, color: c.textPrimary, paddingVertical: spacing(2.5) },
}));
