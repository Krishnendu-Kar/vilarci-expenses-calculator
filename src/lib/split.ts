import type { CategoryKey, Expense, Group } from '../types';

/**
 * Split `amount` paise in proportion to `weights`, using largest remainders so
 * the parts always add up exactly. Ties go to whoever comes first.
 */
export function allocate(amount: number, weights: [string, number][]): Record<string, number> {
  const out: Record<string, number> = {};
  const total = weights.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return out;

  let given = 0;
  const rems: { id: string; rem: number; order: number }[] = [];
  weights.forEach(([id, w], order) => {
    const exact = (amount * w) / total;
    const base = Math.floor(exact);
    out[id] = base;
    given += base;
    rems.push({ id, rem: exact - base, order });
  });
  rems.sort((a, b) => b.rem - a.rem || a.order - b.order);
  for (let i = 0; i < amount - given; i++) out[rems[i % rems.length].id] += 1;
  return out;
}

/** What each person owes for one expense, in paise. */
export function expenseShares(e: Expense): Record<string, number> {
  switch (e.splitMode) {
    case 'exact': {
      const out: Record<string, number> = {};
      for (const id of e.splitAmong) out[id] = e.splitValues?.[id] ?? 0;
      return out;
    }
    case 'shares':
    case 'percent':
      return allocate(
        e.amount,
        e.splitAmong.map((id) => [id, e.splitValues?.[id] ?? 0]),
      );
    default:
      return allocate(
        e.amount,
        e.splitAmong.map((id) => [id, 1]),
      );
  }
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
    for (const [id, amt] of Object.entries(e.payers)) {
      const b = map.get(id);
      if (b) b.paid += amt;
    }
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

/** Newest day first; same day, newest entry first. */
export function sortExpenses(expenses: Expense[]) {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function categoryTotals(group: Group): { key: CategoryKey; amount: number; count: number }[] {
  const map = new Map<CategoryKey, { amount: number; count: number }>();
  for (const e of group.expenses) {
    const t = map.get(e.category) ?? { amount: 0, count: 0 };
    t.amount += e.amount;
    t.count += 1;
    map.set(e.category, t);
  }
  return [...map.entries()].map(([key, t]) => ({ key, ...t })).sort((a, b) => b.amount - a.amount);
}

/** Spending per day, oldest first. */
export function dailyTotals(group: Group): { date: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of group.expenses) map.set(e.date, (map.get(e.date) ?? 0) + e.amount);
  return [...map.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
}

/** True when removing the member would break an expense or payment. */
export function memberIsInvolved(group: Group, memberId: string) {
  return (
    group.expenses.some((e) => memberId in e.payers || e.splitAmong.includes(memberId)) ||
    group.payments.some((p) => p.from === memberId || p.to === memberId)
  );
}
