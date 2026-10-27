import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { font, spacing } from '../theme/tokens';

// Bundled (not the remote URL) so the header works offline.
const LOGO = require('../../assets/logo.png');

/** Logo + app name, for the home screen header. */
export function BrandTitle() {
  return (
    <View style={styles.row}>
      <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={styles.name}>Vilarci Split</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  name: { color: colors.white, fontSize: font.lg + 1, fontWeight: '800', letterSpacing: 0.2 },
});
