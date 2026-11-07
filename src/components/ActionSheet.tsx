import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';
import type { IconName } from '../data/categories';

export interface SheetOption {
  key: string;
  icon: IconName;
  title: string;
  body?: string;
  /** Red, for things like Delete. */
  danger?: boolean;
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
  /** Extra content under the options (e.g. a number field). */
  children?: React.ReactNode;
}

/** Bottom sheet of big, explained choices. */
export function ActionSheet({ visible, title, subtitle, options, busy, onPick, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
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
            <View style={[styles.iconWrap, o.danger && styles.iconDanger]}>
              <Ionicons name={o.icon} size={22} color={o.danger ? colors.danger : colors.tint} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.optionTitle, o.danger && styles.danger]}>{o.title}</Text>
              {o.body ? <Text style={styles.optionBody}>{o.body}</Text> : null}
            </View>
            {busy === o.key ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
          </Pressable>
        ))}
        {children}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  sheet: {
    backgroundColor: c.background,
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
    backgroundColor: c.border,
    marginBottom: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary, paddingHorizontal: spacing(1) },
  subtitle: {
    fontSize: font.sm,
    color: c.textSecondary,
    marginTop: spacing(1),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    padding: spacing(3.5),
    marginTop: spacing(2.5),
  },
  pressed: { opacity: 0.8 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: { backgroundColor: c.dangerBg },
  body: { flex: 1 },
  optionTitle: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  danger: { color: c.danger },
  optionBody: { fontSize: font.sm, color: c.textSecondary, marginTop: 2, lineHeight: 17 },
}));
