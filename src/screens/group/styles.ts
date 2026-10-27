import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { font, radii, spacing } from '../../theme/tokens';

/** Row/card styles shared by the group screen's tabs. */
export const tabStyles = StyleSheet.create({
  list: { padding: spacing(4), paddingBottom: spacing(28) },
  explain: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing(3), lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.md + 1, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: spacing(2) },
  rowAmount: { fontSize: font.md + 1, fontWeight: '800', color: colors.textPrimary },
  small: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  bold: { fontWeight: '700' },
  pos: { color: colors.success },
  neg: { color: colors.danger },
});
