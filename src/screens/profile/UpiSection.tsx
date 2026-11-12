import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useGroups } from '../../context/GroupsContext';
import { useUndo } from '../../context/UndoContext';
import { notify } from '../../lib/confirm';
import { cleanVpa, isVpa, MAX_UPI, sameVpa } from '../../lib/upi';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';

/**
 * Profile: up to 3 UPI ids people can pay you on, each with Copy and Remove.
 * The ? by the heading shows what they're for; trying to add a 4th warns.
 */
export function UpiSection() {
  const { upiIds, setUpiIds } = useGroups();
  const { showUndo, showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [help, setHelp] = useState(false);
  const [vpa, setVpa] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAdding(false);
    setVpa('');
    setLabel('');
    setError(null);
  };

  const add = () => {
    const v = cleanVpa(vpa);
    if (!isVpa(v)) return setError(t('upi.invalid'));
    if (upiIds.some((u) => sameVpa(u.vpa, v))) return setError(t('upi.duplicate'));
    const l = label.trim().slice(0, 20);
    setUpiIds([...upiIds, l ? { vpa: v, label: l } : { vpa: v }]);
    close();
  };

  const startAdding = () => {
    if (upiIds.length >= MAX_UPI) notify(t('upi.limitTitle'), t('upi.limitBody', { count: MAX_UPI }));
    else setAdding(true);
  };

  const copy = async (v: string) => {
    try {
      await Clipboard.setStringAsync(v);
      showNote(t('upi.copied', { id: v }));
    } catch {
      // Nothing was copied; the id can still be selected and copied by hand.
    }
  };

  const remove = (v: string) => {
    const before = upiIds;
    setUpiIds(upiIds.filter((u) => u.vpa !== v));
    showUndo(t('upi.removed', { id: v }), () => setUpiIds(before));
  };

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('upi.title')}</Text>
        <Pressable
          onPress={() => setHelp((h) => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('upi.help')}
          accessibilityState={{ expanded: help }}
        >
          <Ionicons name={help ? 'help-circle' : 'help-circle-outline'} size={17} color={help ? colors.tint : colors.textSecondary} />
        </Pressable>
      </View>
      {help ? <Text style={styles.help}>{t('upi.explain')}</Text> : null}
      <View style={styles.list}>
        {upiIds.map((u, i) => (
          <View key={u.vpa} style={[styles.row, i > 0 && styles.rowLine]}>
            <Ionicons name="wallet-outline" size={19} color={colors.tint} />
            <View style={styles.flex}>
              <Text style={styles.vpa} numberOfLines={1} selectable>
                {u.vpa}
              </Text>
              {u.label ? <Text style={styles.small}>{u.label}</Text> : null}
            </View>
            <Pressable onPress={() => copy(u.vpa)} hitSlop={8} accessibilityLabel={t('upi.copy', { id: u.vpa })} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={18} color={colors.tint} />
            </Pressable>
            <Pressable onPress={() => remove(u.vpa)} hitSlop={8} accessibilityLabel={t('upi.remove', { id: u.vpa })} style={styles.iconBtn}>
              <Ionicons name="close" size={19} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}

        {adding ? (
          <View style={[styles.form, upiIds.length > 0 && styles.rowLine]}>
            <Input
              label={t('upi.idLabel')}
              placeholder={t('upi.idPlaceholder')}
              value={vpa}
              onChangeText={(v) => {
                setVpa(v);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
              maxLength={100}
              error={error ?? undefined}
            />
            <Input
              label={t('upi.nameLabel')}
              placeholder={t('upi.namePlaceholder')}
              value={label}
              onChangeText={setLabel}
              maxLength={20}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            <View style={styles.formButtons}>
              <PrimaryButton label={t('common.cancel')} variant="outline" onPress={close} style={styles.flex} />
              <PrimaryButton label={t('upi.save')} onPress={add} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={startAdding}
            style={({ pressed }) => [styles.row, upiIds.length > 0 && styles.rowLine, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color={colors.tint} />
            <Text style={styles.addText}>{t('upi.add')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(6),
    marginBottom: spacing(2.5),
    marginLeft: spacing(1),
  },
  label: {
    fontSize: font.xs + 1,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  help: {
    fontSize: font.sm,
    color: c.textSecondary,
    lineHeight: 18,
    backgroundColor: c.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2.5),
  },
  list: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
    paddingVertical: spacing(3),
    minHeight: 54,
  },
  rowLine: { borderTopWidth: 1, borderTopColor: c.background },
  vpa: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
  small: { fontSize: font.sm, color: c.textSecondary, marginTop: 1 },
  iconBtn: { padding: spacing(2) },
  addText: { color: c.tint, fontWeight: '700', fontSize: font.md },
  form: { padding: spacing(4) },
  formButtons: { flexDirection: 'row', gap: spacing(3) },
}));
