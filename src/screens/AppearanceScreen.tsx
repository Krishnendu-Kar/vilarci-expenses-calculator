import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SettingsRow } from '../components/SettingsRow';
import { makeStyles, useTheme, type ThemePref } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { font, radii, spacing } from '../theme/tokens';
import type { Key } from '../i18n';
import type { IconName } from '../data/categories';

const OPTIONS: { key: ThemePref; icon: IconName; title: Key; sub: Key }[] = [
  { key: 'system', icon: 'phone-portrait-outline', title: 'appearance.system', sub: 'appearance.systemSub' },
  { key: 'light', icon: 'sunny-outline', title: 'appearance.light', sub: 'appearance.lightSub' },
  { key: 'dark', icon: 'moon-outline', title: 'appearance.dark', sub: 'appearance.darkSub' },
];

/** Light, dark, or whatever the phone uses. */
export function AppearanceScreen() {
  const styles = useStyles();
  const { pref, setPref } = useTheme();
  const { t } = useI18n();
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>{t('appearance.explain')}</Text>
        <View style={styles.group}>
          {OPTIONS.map((o, i) => (
            <React.Fragment key={o.key}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <SettingsRow
                icon={o.icon}
                title={t(o.title)}
                subtitle={t(o.sub)}
                checked={pref === o.key}
                onPress={() => setPref(o.key)}
              />
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing(5) },
  explain: { fontSize: font.md, color: c.textSecondary, lineHeight: 21, marginBottom: spacing(5) },
  group: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing(4) + 36 + spacing(3) },
}));
