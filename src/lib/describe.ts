import type { Expense } from '../types';
import { expenseShares, isSettled } from './split';
import { money } from './money';
import { translate } from '../i18n';

/** ["A"] → "A", ["A","B"] → "A & B", ["A","B","C"] → "A, B & C". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}${translate('list.and')}${names[names.length - 1]}`;
}

export function payerText(e: Expense, names: Record<string, string>) {
  return joinNames(Object.keys(e.payers).map((id) => names[id] ?? '?'));
}

/** Short label for the expense list: "split with everyone", "split 3 ways", "by shares". */
export function splitShort(e: Pick<Expense, 'splitMode' | 'splitAmong'>, memberCount: number) {
  switch (e.splitMode) {
    case 'exact':
      return translate('split.byExact');
    case 'shares':
      return translate('split.byShares');
    case 'percent':
      return translate('split.byPercent');
    default:
      if (e.splitAmong.length === memberCount) return translate('split.withEveryone');
      return e.splitAmong.length === 1 ? translate('split.forOne') : translate('split.ways', { count: e.splitAmong.length });
  }
}

/** Full sentence for reports: "for everyone" / "for A, B & C" / "A ₹600, B ₹300". */
export function splitLong(e: Expense, names: Record<string, string>, memberCount: number) {
  if (e.splitMode === 'equal') {
    return e.splitAmong.length === memberCount
      ? translate('split.forEveryone')
      : translate('split.forNames', { names: joinNames(e.splitAmong.map((id) => names[id])) });
  }
  const shares = expenseShares(e);
  return e.splitAmong.map((id) => `${names[id]} ${money(shares[id])}`).join(', ');
}

/** "A ₹2,000 + B ₹1,000" when several people paid. */
export function payerLong(e: Expense, names: Record<string, string>) {
  const ids = Object.keys(e.payers);
  if (ids.length === 1) return names[ids[0]] ?? '?';
  return ids.map((id) => `${names[id]} ${money(e.payers[id])}`).join(' + ');
}

/** "gets back ₹200" / "owes ₹50" / "settled", under ₹1 counting as settled. */
export function balanceWords(net: number) {
  if (isSettled(net)) return translate('balance.settled');
  return net > 0 ? translate('balance.getsBack', { amount: money(net) }) : translate('balance.owes', { amount: money(-net) });
}
