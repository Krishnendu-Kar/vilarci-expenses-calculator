import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

export interface SheetOption {
  key: string;
  icon: IconName;
  title: string;
  body: string;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption[];
  /** Key of the option currently working, shows a spinner on it. */
  busy?: string | null;
  onPick: (key: string) => void;
  onClose: () => void;
}

/** Bottom sheet of big, explained choices. */
export function ActionSheet({ visible, title, subtitle, options, busy, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {options.map((o) => (
          <Pressable
            key={o.key}
            disabled={!!busy}
            onPress={() => onPick(o.key)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={o.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.optionTitle}>{o.title}</Text>
              <Text style={styles.optionBody}>{o.body}</Text>
            </View>
            {busy === o.key ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(36,16,18,0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing(1) },
  subtitle: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: spacing(1),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing(3.5),
    marginTop: spacing(2.5),
  },
  pressed: { opacity: 0.8 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  optionTitle: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  optionBody: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
});
