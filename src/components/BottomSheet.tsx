import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '../theme/ThemeContext';
import { font, radii, spacing } from '../theme/tokens';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Buttons pinned under the scrolling content. */
  footer?: React.ReactNode;
  /** Take most of the screen (for lists that grow) instead of fitting the content. */
  tall?: boolean;
}

/** A popup sheet from the bottom: tap outside or press Back to close. */
export function BottomSheet({ visible, title, onClose, children, footer, tall }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, tall && styles.tall, { paddingBottom: insets.bottom + spacing(4) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={[styles.scroll, tall && styles.fill]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: c.backdrop },
  sheet: {
    maxHeight: '88%',
    backgroundColor: c.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  tall: { height: '88%' },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing(4),
  },
  title: { fontSize: font.lg, fontWeight: '800', color: c.textPrimary, marginBottom: spacing(3) },
  // Shrinks to fit when the content is longer than the sheet (RN does not shrink by default).
  // Longhands only: a `flex` shorthand loses to `flexGrow` and the list collapses.
  scroll: { flexGrow: 0, flexShrink: 1 },
  fill: { flexGrow: 1, flexBasis: 0 },
  footer: { marginTop: spacing(3) },
}));
