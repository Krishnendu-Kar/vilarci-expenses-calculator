import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useGroups } from '../../context/GroupsContext';
import { useUndo } from '../../context/UndoContext';
import type { MenuItem } from '../../context/MenuContext';
import { counted } from '../../lib/split';
import { can } from '../../lib/permissions';
import { shareLink } from '../../lib/expenseLink';
import { shareExpense } from '../../lib/shareExpense';
import { useI18n } from '../../i18n/I18nContext';
import type { Expense, Group } from '../../types';

/**
 * The ⋮ menu of an expense, the same in the group's list and on the
 * expense's own page. Info, Share and Copy link (live groups) for everyone
 * who can see it; Make a copy, Pin, Archive and Delete only where you may
 * change expenses. `onDeleted` runs before the delete (the page closes
 * itself), and Undo brings it back.
 */
export function useExpenseMenu(group: Group | undefined, onDeleted?: () => void) {
  const navigation = useNavigation();
  const { deleteExpense, saveExpense, pinExpense, archiveExpense } = useGroups();
  const { showUndo, showNote } = useUndo();
  const { t } = useI18n();
  const editable = !!group && can('edit_expenses', group);

  const items = (e: Expense): MenuItem[] => (!group ? [] : [
    { key: 'info', icon: 'information-circle-outline', title: t('expMenu.info') },
    { key: 'share', icon: 'share-social-outline', title: t('expMenu.share') },
    ...(shareLink(group, e.id) ? [{ key: 'link', icon: 'link-outline' as const, title: t('invite.copy') }] : []),
    ...(editable
      ? [
          { key: 'duplicate', icon: 'copy-outline' as const, title: t('expMenu.duplicate') },
          ...(counted(e)
            ? [
                e.pinnedAt != null
                  ? { key: 'unpin', icon: 'remove-circle-outline' as const, title: t('expMenu.unpin') }
                  : { key: 'pin', icon: 'pin-outline' as const, title: t('expMenu.pin') },
              ]
            : []),
          counted(e)
            ? { key: 'archive', icon: 'archive-outline' as const, title: t('expMenu.archive') }
            : { key: 'unarchive', icon: 'arrow-undo-outline' as const, title: t('expMenu.unarchive') },
          { key: 'delete', icon: 'trash-outline' as const, title: t('expMenu.delete'), danger: true },
        ]
      : []),
  ]);

  const pick = (e: Expense, key: string) => {
    if (!group) return;
    if (key === 'info') return navigation.navigate('ExpenseInfo', { groupId: group.id, expenseId: e.id });
    if (key === 'share') return void shareExpense(group, e);
    if (key === 'link') {
      const link = shareLink(group, e.id);
      if (link) {
        Clipboard.setStringAsync(link)
          .then(() => showNote(t('invite.copied')))
          .catch(() => {});
      }
      return;
    }
    if (key === 'duplicate') return navigation.navigate('ExpenseForm', { groupId: group.id, copyFrom: e.id });
    if (key === 'pin' || key === 'unpin') return pinExpense(group.id, e.id, key === 'pin');
    if (key === 'archive') {
      archiveExpense(group.id, e.id, true);
      showUndo(t('expenses.archivedDone', { name: e.title }), () => archiveExpense(group.id, e.id, false));
    } else if (key === 'unarchive') archiveExpense(group.id, e.id, false);
    else if (key === 'delete') {
      onDeleted?.();
      deleteExpense(group.id, e.id);
      showUndo(t('expense.deleted', { name: e.title }), () => saveExpense(group.id, e));
    }
  };

  return { items, pick, editable };
}
