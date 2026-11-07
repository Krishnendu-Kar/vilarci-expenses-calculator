import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';

// "Expense deleted · Undo": after anything is deleted, a bar at the bottom
// offers to put it back for a few seconds. It lives above the navigator so
// it stays up when the screen that deleted the thing closes.

interface UndoValue {
  showUndo: (message: string, undo: () => void) => void;
}

const UndoContext = createContext<UndoValue>({ showUndo: () => {} });

const SHOW_MS = 6000;

interface Item {
  id: number;
  message: string;
  undo: () => void;
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<Item | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const showUndo = useCallback((message: string, undo: () => void) => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setItem({ id, message, undo });
    timer.current = setTimeout(() => setItem((cur) => (cur?.id === id ? null : cur)), SHOW_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ showUndo }), [showUndo]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {item ? (
        <Snackbar
          key={item.id}
          message={item.message}
          onUndo={() => {
            clearTimeout(timer.current);
            setItem(null);
            item.undo();
          }}
          onClose={() => setItem(null)}
        />
      ) : null}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}

function Snackbar({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    // Above the tab bar and the floating button, so neither is covered.
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + spacing(32) }]}>
      <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={styles.bar}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <Pressable onPress={onUndo} hitSlop={8} style={styles.undo} accessibilityRole="button">
          <Ionicons name="arrow-undo" size={16} color={colors.accent} />
          <Text style={styles.undoText}>{t('common.undo')}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={18} color={colors.white} style={styles.close} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: spacing(4), right: spacing(4) },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: c.snackbar,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: { flex: 1, color: c.white, fontSize: font.sm + 1, fontWeight: '600' },
  undo: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  undoText: { color: c.accent, fontWeight: '800', fontSize: font.sm + 1, textTransform: 'uppercase' },
  close: { opacity: 0.7 },
}));
