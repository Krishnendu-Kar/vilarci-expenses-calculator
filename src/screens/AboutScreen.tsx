import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import appConfig from '../../app.json';

const LOGO = require('../../assets/logo.png');
const WEBSITE = 'https://vilarci.in';

const POINTS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'people-outline', text: 'Split trip, hostel and flat costs with any number of people.' },
  { icon: 'swap-horizontal-outline', text: 'See who pays whom, with the fewest payments.' },
  { icon: 'phone-portrait-outline', text: 'Works offline. Your data stays on this phone unless you share or export it.' },
];

export function AboutScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.name}>{appConfig.expo.name}</Text>
        <Text style={styles.version}>Version {appConfig.expo.version}</Text>

        <View style={styles.card}>
          {POINTS.map((p) => (
            <View key={p.icon} style={styles.point}>
              <Ionicons name={p.icon} size={18} color={colors.primary} />
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => Linking.openURL(WEBSITE)} style={styles.link} accessibilityRole="link">
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <Text style={styles.linkText}>vilarci.in</Text>
        </Pressable>
        <Text style={styles.by}>Made by Vilarci</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: radii.xl, marginTop: spacing(4) },
  name: { fontSize: font.xxl, fontWeight: '800', color: colors.textPrimary, marginTop: spacing(4) },
  version: { fontSize: font.sm + 1, color: colors.textSecondary, marginTop: spacing(1) },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginTop: spacing(6),
    gap: spacing(3.5),
  },
  point: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: font.md, color: colors.textPrimary, lineHeight: 20 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: spacing(6), padding: spacing(2) },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: font.md },
  by: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing(1) },
});
