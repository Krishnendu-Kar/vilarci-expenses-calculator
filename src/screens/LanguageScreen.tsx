import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SettingsRow } from '../components/SettingsRow';
import { makeStyles } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { LANGS } from '../i18n';
import { font, radii, spacing } from '../theme/tokens';

/** The app's language. Reports and messages you share use it too. */
export function LanguageScreen() {
  const styles = useStyles();
  const { t, lang, setLang } = useI18n();
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.explain}>{t('language.explain')}</Text>
        <View style={styles.group}>
          {LANGS.map((l, i) => (
            <React.Fragment key={l.code}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <SettingsRow
                icon="language-outline"
                title={l.name}
                subtitle={l.code === 'en' ? undefined : l.english}
                checked={lang === l.code}
                onPress={() => setLang(l.code)}
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
