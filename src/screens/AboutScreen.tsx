import React from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../components/ScreenContainer';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { IconName } from '../data/categories';
import appConfig from '../../app.json';

const LOGO = require('../../assets/logo.png');
const WEBSITE = 'https://dev.vilarci.in';

const POINTS: { icon: IconName; text: Key }[] = [
  { icon: 'people-outline', text: 'about.point1' },
  { icon: 'swap-horizontal-outline', text: 'about.point2' },
  { icon: 'phone-portrait-outline', text: 'about.point3' },
];

export function AboutScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.name}>{appConfig.expo.name}</Text>
        <Text style={styles.version}>{t('about.version', { version: appConfig.expo.version })}</Text>

        <View style={styles.card}>
          {POINTS.map((p) => (
            <View key={p.icon} style={styles.point}>
              <Ionicons name={p.icon} size={18} color={colors.tint} />
              <Text style={styles.pointText}>{t(p.text)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.by}>{t('about.by')}</Text>
        <Pressable onPress={() => Linking.openURL(WEBSITE).catch(() => {})} style={styles.link} accessibilityRole="link">
          <Ionicons name="globe-outline" size={16} color={colors.tint} />
          <Text style={styles.linkText}>dev.vilarci.in</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5), alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: radii.xl, marginTop: spacing(4) },
  name: { fontSize: font.xxl, fontWeight: '800', color: c.textPrimary, marginTop: spacing(4) },
  version: { fontSize: font.sm + 1, color: c.textSecondary, marginTop: spacing(1) },
  card: {
    alignSelf: 'stretch',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
    marginTop: spacing(6),
    gap: spacing(3.5),
  },
  point: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: font.md, color: c.textPrimary, lineHeight: 20 },
  by: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(6) },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: spacing(1), padding: spacing(2) },
  linkText: { color: c.tint, fontWeight: '700', fontSize: font.md },
}));
