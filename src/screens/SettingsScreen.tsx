import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { SettingsRow } from '../components/SettingsRow';
import { useGroups } from '../context/GroupsContext';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { LANGS } from '../i18n';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';
import appConfig from '../../app.json';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const styles = useStyles();
  const { bin } = useGroups();
  const { pref } = useTheme();
  const { t, lang } = useI18n();
  const themeName = { system: t('appearance.system'), light: t('appearance.light'), dark: t('appearance.dark') }[pref];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>{t('settings.data')}</SectionLabel>
        <View style={styles.group}>
          <SettingsRow
            icon="cloud-upload-outline"
            title={t('export.title')}
            subtitle={t('settings.exportSub')}
            onPress={() => navigation.navigate('Export')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download-outline"
            title={t('import.title')}
            subtitle={t('settings.importSub')}
            onPress={() => navigation.navigate('Import')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            title={t('bin.title')}
            subtitle={t('bin.settingsSub')}
            value={bin.length ? String(bin.length) : undefined}
            onPress={() => navigation.navigate('Bin')}
          />
        </View>

        <SectionLabel>{t('settings.app')}</SectionLabel>
        <View style={styles.group}>
          <SettingsRow
            icon="contrast-outline"
            title={t('appearance.title')}
            value={themeName}
            onPress={() => navigation.navigate('Appearance')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="language-outline"
            title={t('language.title')}
            value={LANGS.find((l) => l.code === lang)?.name}
            onPress={() => navigation.navigate('Language')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="information-circle-outline"
            title={t('about.title')}
            subtitle={t('settings.aboutSub')}
            onPress={() => navigation.navigate('About')}
          />
        </View>

        {/* Pushes the version to the very bottom of the screen. */}
        <View style={styles.spacer} />
        <Text style={styles.version}>{t('settings.version', { name: appConfig.expo.name, version: appConfig.expo.version })}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((c) => ({
  content: { flexGrow: 1, padding: spacing(5) },
  group: {
    marginBottom: spacing(6),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing(4) + 36 + spacing(3) },
  spacer: { flex: 1, minHeight: spacing(10) },
  version: { textAlign: 'center', fontSize: font.sm, color: c.textSecondary, paddingVertical: spacing(2) },
}));
