import type { Expense, Group, SplitMode } from '../../types';

export function member(id: string) {
  return { id, name: `Person ${id}` };
}

export function expense(
  id: string,
  rupees: number,
  payers: Record<string, number> | string,
  splitAmong: string[],
  opts: { mode?: SplitMode; values?: Record<string, number>; date?: string } = {},
): Expense {
  const amount = rupees * 100;
  return {
    id,
    title: id,
    amount,
    category: 'other',
    payers: typeof payers === 'string' ? { [payers]: amount } : payers,
    splitMode: opts.mode ?? 'equal',
    splitAmong,
    ...(opts.values ? { splitValues: opts.values } : {}),
    date: opts.date ?? '2026-10-27',
    createdAt: 0,
  };
}

export function group(memberIds: string[], expenses: Expense[], id = 'g1'): Group {
  return {
    id,
    name: 'Test',
    kind: 'trip',
    members: memberIds.map(member),
    expenses,
    payments: [],
    createdAt: 0,
    updatedAt: 0,
  };
}
