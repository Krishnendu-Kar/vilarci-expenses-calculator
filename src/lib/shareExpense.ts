import type { Expense, Group } from '../types';
import { buildExpenseText } from './report';
import { shareLink } from './expenseLink';
import { shareMessage } from './files';
import { notify } from './confirm';
import { translate } from '../i18n';

/**
 * ⋮ → Share on an expense (and the share button on its page): the message
 * with its details, plus the link for people in a live group, through the
 * phone's share sheet.
 */
export async function shareExpense(group: Group, e: Expense) {
  try {
    await shareMessage(buildExpenseText(group, e, shareLink(group, e.id)));
  } catch (err) {
    notify(translate('detail.shareFailed'), err instanceof Error ? err.message : String(err));
  }
}
