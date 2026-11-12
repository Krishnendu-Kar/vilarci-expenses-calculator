import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { SearchBar } from '../../components/SearchBar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { readContactNames, type ContactNames } from '../../lib/deviceContacts';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';

/** Rows drawn at once; search finds the rest (a phone can hold thousands). */
const SHOWN = 100;

interface Props {
  /** Names ticked so far (the form adds them on "Add"). */
  picked: string[];
  onToggle: (name: string) => void;
  /** Lower-case names already in the group, and in your People. */
  inGroup: Set<string>;
  known: Set<string>;
  onBack: () => void;
}

/**
 * Group form → Add people → From contacts: the phone's contacts by name,
 * searchable, tick several. Reads names only, when opened; the ones added
 * become guests (or the person already in your People with that name).
 */
export function ContactPicker({ picked, onToggle, inGroup, known, onBack }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [result, setResult] = useState<ContactNames | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setResult(null);
    void readContactNames().then(setResult);
  }, []);
  useEffect(load, [load]);

  const q = query.trim().toLowerCase();
  const names = result?.status === 'ok' ? result.names : [];
  const found = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  const chosen = new Set(picked.map((n) => n.toLowerCase()));

  let body: React.ReactNode;
  if (!result) {
    body = <Text style={styles.note}>{t('contacts.loading')}</Text>;
  } else if (result.status === 'unavailable') {
    body = <Text style={styles.note}>{t('contacts.unavailable')}</Text>;
  } else if (result.status === 'denied') {
    body = (
      <View style={styles.ask}>
        <Ionicons name="people-circle-outline" size={40} color={colors.tint} />
        <Text style={styles.askText}>{t('contacts.denied')}</Text>
        {/* After "don't ask again" only the phone's settings can allow it. */}
        <PrimaryButton
          label={result.canAskAgain ? t('contacts.allow') : t('contacts.openSettings')}
          onPress={result.canAskAgain ? load : () => void Linking.openSettings()}
          style={styles.askBtn}
        />
      </View>
    );
  } else if (!names.length) {
    body = <Text style={styles.note}>{t('contacts.none')}</Text>;
  } else {
    body = (
      <>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('contacts.search')} />
        {found.length ? null : <Text style={styles.note}>{t('contacts.noMatch', { query: query.trim() })}</Text>}
        {found.slice(0, SHOWN).map((name) => {
          const lower = name.toLowerCase();
          const already = inGroup.has(lower);
          const on = chosen.has(lower);
          return (
            <Pressable
              key={name}
              disabled={already}
              onPress={() => onToggle(name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on || already, disabled: already }}
              style={({ pressed }) => [styles.row, already && styles.rowOff, pressed && styles.pressed]}
            >
              <Avatar name={name} size={30} />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {already ? (
                  <Text style={styles.sub}>{t('contacts.inGroup')}</Text>
                ) : known.has(lower) ? (
                  <Text style={styles.sub}>{t('contacts.inPeople')}</Text>
                ) : null}
              </View>
              <Ionicons
                name={on || already ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={already ? colors.textSecondary : on ? colors.tint : colors.border}
              />
            </Pressable>
          );
        })}
        {found.length > SHOWN ? <Text style={styles.note}>{t('contacts.more', { shown: SHOWN, count: found.length })}</Text> : null}
      </>
    );
  }

  return (
    <View>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.tint} />
        <Text style={styles.backText}>{t('contacts.back')}</Text>
      </Pressable>
      <Text style={styles.privacy}>{t('contacts.privacy')}</Text>
      {body}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), alignSelf: 'flex-start', marginBottom: spacing(2) },
  backText: { fontSize: font.md, fontWeight: '700', color: c.tint },
  privacy: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18, marginBottom: spacing(3) },
  note: { fontSize: font.sm, color: c.textSecondary, textAlign: 'center', marginVertical: spacing(4), lineHeight: 18 },
  ask: { alignItems: 'center', gap: spacing(3), paddingVertical: spacing(4) },
  askText: { fontSize: font.sm + 1, color: c.textPrimary, textAlign: 'center', lineHeight: 20 },
  askBtn: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(1),
    borderRadius: radii.md,
  },
  rowOff: { opacity: 0.55 },
  pressed: { backgroundColor: c.surfaceAlt },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
  sub: { fontSize: font.sm - 1, color: c.textSecondary, marginTop: 1 },
}));
