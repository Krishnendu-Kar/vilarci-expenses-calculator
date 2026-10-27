import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { SettingsRow } from '../components/SettingsRow';
import { colors } from '../theme/colors';
import { font, radii, spacing } from '../theme/tokens';
import type { ScreenProps } from '../navigation/types';
import appConfig from '../../app.json';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Your data</SectionLabel>
        <View style={styles.group}>
          <SettingsRow
            icon="cloud-upload-outline"
            title="Export data"
            subtitle="Save a copy of all your groups"
            onPress={() => navigation.navigate('Export')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download-outline"
            title="Import data"
            subtitle="Restore a backup or open a shared group"
            onPress={() => navigation.navigate('Import')}
          />
        </View>

        <SectionLabel>App</SectionLabel>
        <View style={styles.group}>
          <SettingsRow
            icon="information-circle-outline"
            title="About"
            subtitle="What Vilarci Split does"
            onPress={() => navigation.navigate('About')}
          />
        </View>

        {/* Pushes the version to the very bottom of the screen. */}
        <View style={styles.spacer} />
        <Text style={styles.version}>
          {appConfig.expo.name} · Version {appConfig.expo.version}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing(5) },
  group: {
    marginBottom: spacing(6),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing(4) + 36 + spacing(3) },
  spacer: { flex: 1, minHeight: spacing(10) },
  version: { textAlign: 'center', fontSize: font.sm, color: colors.textSecondary, paddingVertical: spacing(2) },
});
