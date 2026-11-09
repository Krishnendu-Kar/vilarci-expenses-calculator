import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { DISPLAY_FONT, GOLD } from '../../components/LuxeCard';
import { groupKindOf } from '../../data/categories';
import { money } from '../../lib/money';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { kindTint } from '../../theme/colors';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import { toneOf } from './PeopleOrbit';
import type { Group } from '../../types';

/** Group chips shown before "+N". */
const CHIPS = 2;

interface Props {
  name: string;
  groups: Group[];
  owed: number;
  owes: number;
  me: boolean;
  /** Signed in with an account (only ever you, for now). */
  hasAccount: boolean;
  onPress: () => void;
}

/**
 * One person on People, matching the orbit above: the ring round their face
 * is the same colour as their dot there (green gets back, red owes, grey
 * settled), and you wear the same gold "You" tag. Their groups show as
 * small coloured chips; the amount sits on the right, then a chevron.
 */
export function PersonCard({ name, groups, owed, owes, me, hasAccount, onPress }: Props) {
  const styles = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  const net = owed - owes;
  const tone = toneOf(net);
  const toneColor = tone === 'up' ? colors.success : tone === 'down' ? colors.danger : colors.border;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, me && styles.cardMe, pressed && styles.pressed]}>
      <View style={styles.face}>
        <View style={[styles.ring, { borderColor: toneColor }]}>
          <Avatar name={name} size={44} />
        </View>
        {me ? <Text style={styles.youTag}>{t('common.you')}</Text> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {hasAccount ? (
            <Ionicons name="checkmark-circle" size={15} color={colors.success} accessibilityLabel={t('people.account')} />
          ) : (
            <Text style={styles.guest}>{t('people.guest')}</Text>
          )}
        </View>
        {groups.length ? (
          <View style={styles.chips}>
            {groups.slice(0, CHIPS).map((g) => {
              const tint = kindTint(g.kind, dark);
              return (
                <View key={g.id} style={[styles.chip, { backgroundColor: tint.bg }]}>
                  <Ionicons name={groupKindOf(g.kind).icon} size={11} color={tint.fg} />
                  <Text style={[styles.chipText, { color: tint.fg }]} numberOfLines={1}>
                    {g.name}
                  </Text>
                </View>
              );
            })}
            {groups.length > CHIPS ? <Text style={styles.moreChips}>+{groups.length - CHIPS}</Text> : null}
          </View>
        ) : (
          <Text style={styles.noGroups} numberOfLines={1}>
            {t('groupForm.noGroupsYet')}
          </Text>
        )}
      </View>

      {tone !== 'even' ? (
        <View style={styles.amountCol}>
          <Text style={[styles.amount, { color: toneColor }]} numberOfLines={1}>
            {money(Math.abs(net))}
          </Text>
          <Text style={[styles.amountLabel, { color: toneColor }]}>{tone === 'up' ? t('common.getsBack') : t('common.owes')}</Text>
        </View>
      ) : groups.length ? (
        <View style={styles.settled}>
          <Ionicons name="checkmark-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.settledText}>{t('common.settled')}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.chevron} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginHorizontal: spacing(4),
    marginBottom: spacing(2.5),
    paddingVertical: spacing(3.5),
    paddingLeft: spacing(3.5),
    paddingRight: spacing(2),
    borderRadius: radii.lg + 2,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardMe: { borderColor: 'rgba(251,191,36,0.55)' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  face: { alignItems: 'center' },
  ring: { padding: 2, borderRadius: 26, borderWidth: 2 },
  // The orbit's tag, hanging off the bottom of your face.
  youTag: {
    position: 'absolute',
    bottom: -6,
    color: '#241012',
    backgroundColor: GOLD,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  name: { flexShrink: 1, fontSize: font.md + 1, fontWeight: '800', color: c.textPrimary },
  guest: { flexShrink: 0, fontSize: font.xs, fontWeight: '600', color: c.textSecondary },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: spacing(1.5) },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  chipText: { flexShrink: 1, fontSize: font.xs, fontWeight: '700' },
  moreChips: { flexShrink: 0, fontSize: font.xs, fontWeight: '700', color: c.textSecondary },
  noGroups: { fontSize: font.sm, color: c.textSecondary, marginTop: spacing(1) },
  amountCol: { alignItems: 'flex-end', marginLeft: spacing(1) },
  amount: { fontFamily: DISPLAY_FONT, fontSize: font.lg, fontWeight: '700' },
  amountLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 1, opacity: 0.85 },
  settled: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: spacing(1) },
  settledText: { fontSize: font.xs, fontWeight: '700', color: c.textSecondary },
  chevron: { marginLeft: -spacing(1) },
}));
