import { makeStyles } from '../../theme/ThemeContext';
import { font, radii, spacing } from '../../theme/tokens';

/** Row/card styles shared by the group screen's tabs. */
export const useTabStyles = makeStyles((c) => ({
  list: { padding: spacing(4), paddingBottom: spacing(28) },
  explain: { fontSize: font.sm, color: c.textSecondary, marginBottom: spacing(3), lineHeight: 18 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: spacing(3.5),
    marginBottom: spacing(2.5),
    borderWidth: 1,
    borderColor: c.border,
  },
  rowMe: { borderColor: c.primaryLight },
  pressed: { opacity: 0.8 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.md + 1, fontWeight: '700', color: c.textPrimary },
  rowMeta: { fontSize: font.sm, color: c.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: spacing(2) },
  rowAmount: { fontSize: font.md + 1, fontWeight: '800', color: c.textPrimary },
  small: { fontSize: font.xs, color: c.textSecondary, marginTop: 2 },
  bold: { fontWeight: '700' },
  pos: { color: c.success },
  neg: { color: c.danger },
  youTag: {
    flexShrink: 0,
    fontSize: font.xs,
    fontWeight: '700',
    color: c.tint,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing(2),
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
}));
