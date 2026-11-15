import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '../../components/BottomSheet';
import { Input } from '../../components/Input';
import { MoreButton } from '../../components/MoreButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useGroups } from '../../context/GroupsContext';
import { useMenu, type MenuAnchor } from '../../context/MenuContext';
import { useUndo } from '../../context/UndoContext';
import { confirmAction, notify } from '../../lib/confirm';
import { cleanVpa, isVpa, MAX_UPI, sameVpa } from '../../lib/upi';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { font, radii, spacing } from '../../theme/tokens';
import type { UpiId } from '../../types';

/**
 * Profile: up to 3 UPI ids people can pay you on. + Add sits by the heading;
 * adding and editing happen in a popup; each row has Copy and a ⋮ with Edit
 * and Remove (Remove asks first). The ? by the heading shows what they're
 * for; trying to add a 4th warns.
 */
export function UpiSection() {
  const { upiIds, setUpiIds } = useGroups();
  const { openMenu } = useMenu();
  const { showNote } = useUndo();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [help, setHelp] = useState(false);
  // The popup: null closed, -1 adding, else the index being edited.
  const [editing, setEditing] = useState<number | null>(null);
  const [vpa, setVpa] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (index: number) => {
    const u = upiIds[index];
    setVpa(u?.vpa ?? '');
    setLabel(u?.label ?? '');
    setError(null);
    setEditing(index);
  };

  const startAdding = () => {
    if (upiIds.length >= MAX_UPI) notify(t('upi.limitTitle'), t('upi.limitBody', { count: MAX_UPI }));
    else open(-1);
  };

  const save = () => {
    if (editing === null) return;
    const v = cleanVpa(vpa);
    if (!isVpa(v)) return setError(t('upi.invalid'));
    if (upiIds.some((u, i) => i !== editing && sameVpa(u.vpa, v))) return setError(t('upi.duplicate'));
    const l = label.trim().slice(0, 20);
    const entry: UpiId = l ? { vpa: v, label: l } : { vpa: v };
    setUpiIds(editing === -1 ? [...upiIds, entry] : upiIds.map((u, i) => (i === editing ? entry : u)));
    setEditing(null);
  };

  const copy = async (v: string) => {
    try {
      await Clipboard.setStringAsync(v);
      showNote(t('upi.copied', { id: v }));
    } catch {
      // Nothing was copied; the id can still be selected and copied by hand.
    }
  };

  const remove = (v: string) =>
    confirmAction(t('upi.removeTitle', { id: v }), t('upi.removeBody'), t('upi.removeItem'), () => {
      setUpiIds(upiIds.filter((u) => u.vpa !== v));
      showNote(t('upi.removed', { id: v }));
    });

  const more = (anchor: MenuAnchor, index: number) =>
    openMenu(
      anchor,
      [
        { key: 'edit', icon: 'create-outline', title: t('upi.edit') },
        { key: 'remove', icon: 'trash-outline', title: t('upi.removeItem'), danger: true },
      ],
      (key) => (key === 'edit' ? open(index) : remove(upiIds[index].vpa)),
    );

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
        <View style={styles.flex} />
        <Pressable
          onPress={startAdding}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('upi.add')}
          style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={colors.tint} />
          <Text style={styles.addText}>{t('upi.addShort')}</Text>
        </Pressable>
      </View>
      {help ? <Text style={styles.help}>{t('upi.explain')}</Text> : null}
      <View style={styles.list}>
        {upiIds.map((u, i) => (
          <Pressable
            key={u.vpa}
            onPress={() => open(i)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
            accessibilityLabel={t('upi.editTitle')}
          >
            <Ionicons name="wallet-outline" size={19} color={colors.tint} />
            <View style={styles.flex}>
              <Text style={styles.vpa} numberOfLines={1}>
                {u.vpa}
              </Text>
              {u.label ? <Text style={styles.small}>{u.label}</Text> : null}
            </View>
            <Pressable onPress={() => copy(u.vpa)} hitSlop={8} accessibilityLabel={t('upi.copy', { id: u.vpa })} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={18} color={colors.tint} />
            </Pressable>
            <MoreButton onOpen={(anchor) => more(anchor, i)} style={styles.iconBtn} />
          </Pressable>
        ))}
        {upiIds.length === 0 ? (
          <Pressable onPress={startAdding} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name="wallet-outline" size={19} color={colors.textSecondary} />
            <Text style={[styles.small, styles.flex]}>{t('upi.empty')}</Text>
          </Pressable>
        ) : null}
      </View>

      <BottomSheet
        visible={editing !== null}
        title={editing === -1 ? t('upi.add') : t('upi.editTitle')}
        onClose={() => setEditing(null)}
        footer={
          <View style={styles.formButtons}>
            <PrimaryButton label={t('common.cancel')} variant="outline" onPress={() => setEditing(null)} style={styles.flex} />
            <PrimaryButton label={t('upi.save')} onPress={save} style={styles.flex} />
          </View>
        }
      >
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
          onSubmitEditing={save}
          returnKeyType="done"
        />
      </BottomSheet>
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
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingLeft: spacing(2),
    paddingRight: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radii.pill,
    backgroundColor: c.surface,
  },
  addText: { color: c.tint, fontWeight: '700', fontSize: font.sm },
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
  formButtons: { flexDirection: 'row', gap: spacing(3) },
}));
