import type { Expense } from '../types';
import { expenseShares } from './split';
import { money } from './money';

/** ["A"] → "A", ["A","B"] → "A & B", ["A","B","C"] → "A, B & C". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function payerText(e: Expense, names: Record<string, string>) {
  return joinNames(Object.keys(e.payers).map((id) => names[id] ?? '?'));
}

/** Short label for the expense list: "split with everyone", "split 3 ways", "by shares". */
export function splitShort(e: Expense, memberCount: number) {
  switch (e.splitMode) {
    case 'exact':
      return 'by exact amounts';
    case 'shares':
      return 'by shares';
    case 'percent':
      return 'by %';
    default:
      if (e.splitAmong.length === memberCount) return 'split with everyone';
      return e.splitAmong.length === 1 ? 'for one person' : `split ${e.splitAmong.length} ways`;
  }
}

/** Full sentence for reports: "for everyone" / "for A, B & C" / "A ₹600, B ₹300". */
export function splitLong(e: Expense, names: Record<string, string>, memberCount: number) {
  if (e.splitMode === 'equal') {
    return e.splitAmong.length === memberCount ? 'for everyone' : `for ${joinNames(e.splitAmong.map((id) => names[id]))}`;
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
