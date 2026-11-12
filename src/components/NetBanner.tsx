import React, { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnection } from '../lib/network';
import { useI18n } from '../i18n/I18nContext';
import { font, spacing } from '../theme/tokens';

// Warning yellow, the same in both themes, with dark text that reads on it.
const YELLOW = '#FACC15';
const INK = '#3F2A00';

/**
 * The whole app, with a narrow yellow "No internet" / "Slow internet" bar at
 * the very bottom: under the bottom nav bar on the tabs, at the foot of the
 * screen elsewhere. It takes the phone's bottom inset itself, so the app above
 * it (the tab bar included) lays out as if the screen ended at the bar. Hidden
 * while the keyboard is up. The tree inside never changes shape, so showing
 * or hiding the bar never resets a page.
 */
export function NetBannerLayout({ children }: { children: React.ReactNode }) {
  const connection = useConnection();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const shown = connection !== 'ok' && !keyboard;
  const offline = connection === 'offline';
  return (
    <View style={styles.fill}>
      <SafeAreaInsetsContext.Provider value={shown ? { ...insets, bottom: 0 } : insets}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      {shown ? (
        <View style={[styles.bar, { paddingBottom: 3 + insets.bottom }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name={offline ? 'cloud-offline-outline' : 'speedometer-outline'} size={13} color={INK} />
          <Text style={styles.text}>{t(offline ? 'net.offline' : 'net.slow')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    backgroundColor: YELLOW,
    paddingTop: 3,
    paddingHorizontal: spacing(3),
  },
  text: { color: INK, fontSize: font.xs + 1, fontWeight: '700' },
});
