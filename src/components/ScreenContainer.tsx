import React from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { makeStyles } from '../theme/ThemeContext';

// Top inset is intentionally skipped: the header already occupies the safe
// area, so adding it again here double-pads the screen. Screens in the bottom
// tab bar pass `tabs`: the bar already sits above the bottom inset.
const STACK_EDGES: Edge[] = ['bottom', 'left', 'right'];
const TAB_EDGES: Edge[] = ['left', 'right'];

export function ScreenContainer({ children, tabs }: { children: React.ReactNode; tabs?: boolean }) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={tabs ? TAB_EDGES : STACK_EDGES}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Android draws edge to edge (Expo SDK 54+), so the window no longer shrinks for the keyboard: pad on both. */}
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
}));
