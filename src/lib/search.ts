import type { CategoryKey, Expense, Member } from '../types';

// Search boxes on the group's Expenses and Members tabs. Every word typed
// has to match somewhere, in any order: "rice krish" finds Krish's rice.

const words = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Matches an expense's title, note, category, who paid, who it was for (when
 * not everyone) and its amount ("120" finds ₹120 and ₹1,200).
 */
export function searchExpenses(
  expenses: Expense[],
  query: string,
  names: Record<string, string>,
  memberCount: number,
  categoryLabel: (key: CategoryKey) => string,
): Expense[] {
  const ws = words(query).map((w) => w.replace(/[₹,]/g, '')).filter(Boolean);
  if (!ws.length) return expenses;
  return expenses.filter((e) => {
    const people = [
      ...Object.keys(e.payers),
      // Everyone is in an "everyone" split, so names only narrow the rest.
      ...(e.splitAmong.length < memberCount ? e.splitAmong : []),
    ].map((id) => names[id] ?? '');
    const hay = [e.title, e.note ?? '', categoryLabel(e.category), ...people, String(e.amount / 100)]
      .join(' ')
      .toLowerCase();
    return ws.every((w) => hay.includes(w));
  });
}

export function searchMembers<T extends Pick<Member, 'name'>>(members: T[], query: string): T[] {
  const ws = words(query);
  if (!ws.length) return members;
  return members.filter((m) => ws.every((w) => m.name.toLowerCase().includes(w)));
}
