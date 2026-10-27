import type { Expense, Group } from '../types';

/**
 * What each person owes for one expense, in paise. Equal splits hand the
 * leftover paise to the first few people so the shares always add up.
 */
export function expenseShares(e: Expense): Record<string, number> {
  const out: Record<string, number> = {};
  if (e.splitMode === 'exact') {
    for (const id of e.splitAmong) out[id] = e.exactShares?.[id] ?? 0;
    return out;
  }
  const n = e.splitAmong.length;
  if (n === 0) return out;
  const base = Math.floor(e.amount / n);
  let rem = e.amount - base * n;
  for (const id of e.splitAmong) {
    out[id] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
}

export interface MemberBalance {
  memberId: string;
  /** Total this member paid for the group. */
  paid: number;
  /** This member's fair share of everything. */
  share: number;
  /** Settle-up money sent / received so far. */
  sent: number;
  received: number;
  /** > 0: the group owes them. < 0: they owe the group. */
  net: number;
}

export function computeBalances(group: Group): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const m of group.members) {
    map.set(m.id, { memberId: m.id, paid: 0, share: 0, sent: 0, received: 0, net: 0 });
  }
  for (const e of group.expenses) {
    const payer = map.get(e.paidBy);
    if (payer) payer.paid += e.amount;
    for (const [id, amt] of Object.entries(expenseShares(e))) {
      const b = map.get(id);
      if (b) b.share += amt;
    }
  }
  for (const p of group.payments) {
    const from = map.get(p.from);
    const to = map.get(p.to);
    if (from) from.sent += p.amount;
    if (to) to.received += p.amount;
  }
  for (const b of map.values()) b.net = b.paid - b.share + b.sent - b.received;
  return [...map.values()];
}

/**
 * Balances under ₹1 count as settled. Equal splits leave odd paise behind
 * (₹5000 / 6), and nobody should be told to send ₹0.01.
 */
export const DUST = 100;

export function isSettled(net: number) {
  return Math.abs(net) < DUST;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Fewest-ish payments to settle everyone: repeatedly match whoever owes the
 * most with whoever is owed the most. Never needs more than (people - 1).
 */
export function suggestTransfers(balances: MemberBalance[]): Transfer[] {
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.memberId, amt: -b.net }));
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.memberId, amt: b.net }));
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amt, creditors[j].amt);
    if (amount >= DUST) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amt -= amount;
    creditors[j].amt -= amount;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

export function groupTotal(group: Group) {
  return group.expenses.reduce((sum, e) => sum + e.amount, 0);
}

/** True when removing the member would break an expense or payment. */
export function memberIsInvolved(group: Group, memberId: string) {
  return (
    group.expenses.some((e) => e.paidBy === memberId || e.splitAmong.includes(memberId)) ||
    group.payments.some((p) => p.from === memberId || p.to === memberId)
  );
}
