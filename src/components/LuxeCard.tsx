import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

// The Vilarci member-card look, shared with the Vilarci buyer app: a maroon
// field (deeper in dark mode), a gold hairline, a permanent diagonal gloss
// and a highlight that sweeps across every 7 seconds. Type on it is white,
// accents are GOLD.

export const GOLD = '#FBBF24';
export const CARD_FIELD_DARK = ['#1C0509', '#4A0F1C', '#7B1C2E'] as const;
export const CARD_FIELD_LIGHT = ['#5E0D19', '#941427', '#AB172D'] as const;

/** Serif for the brand and names on the card; the phone's own, nothing to download. */
export const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

// Bundled, so it works offline.
const LOGO = require('../../assets/logo.png');

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** The logo, faint, on the right. */
  watermark?: boolean;
  /** 'deep': the darkest maroon in both themes (the guest card). */
  field?: 'auto' | 'deep';
}

export function LuxeCard({ children, style, watermark, field = 'auto' }: Props) {
  const { dark } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });

  // One pass, then rest; native-driven so it never touches the JS thread.
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1500, delay: 5500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const w = size.w || 400;
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.75, w * 0.95] });
  const opacity = sweep.interpolate({ inputRange: [0, 0.15, 0.5, 0.85, 1], outputRange: [0, 0.6, 1, 0.6, 0] });

  return (
    <View style={[styles.card, style]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <LinearGradient colors={dark || field === 'deep' ? CARD_FIELD_DARK : CARD_FIELD_LIGHT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {watermark && size.h ? (
        <View style={styles.wmClip} pointerEvents="none">
          <Image
            source={LOGO}
            style={[styles.wm, { width: size.h, height: size.h, borderRadius: size.h * 0.16, opacity: dark ? 0.18 : 0.12 }]}
            resizeMode="contain"
          />
        </View>
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.16)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gloss}
        pointerEvents="none"
      />
      <Animated.View style={[styles.sweep, { opacity, transform: [{ translateX }, { rotate: '18deg' }] }]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.20)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    padding: spacing(5),
    borderWidth: 1,
    // The gold hairline makes it read as a card, not a panel.
    borderColor: 'rgba(251,191,36,0.30)',
  },
  gloss: { position: 'absolute', top: -40, bottom: -40, left: '18%', width: '34%', transform: [{ rotate: '18deg' }] },
  sweep: { position: 'absolute', top: -40, bottom: -40, left: 0, width: 64 },
  wmClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'center' },
  wm: { marginRight: -spacing(2) },
});
