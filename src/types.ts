// All money is stored as integer paise (₹1 = 100) so splits never drift
// from floating-point rounding.

export type GroupKind = 'trip' | 'hostel' | 'other';

export type CategoryKey = 'food' | 'travel' | 'stay' | 'groceries' | 'fun' | 'shopping' | 'other';

export interface Member {
  id: string;
  name: string;
}

/**
 * equal: amount is divided evenly among `splitAmong`.
 * exact: each person in `splitAmong` owes `exactShares[id]`.
 */
export type SplitMode = 'equal' | 'exact';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  paidBy: string;
  splitMode: SplitMode;
  splitAmong: string[];
  exactShares?: Record<string, number>;
  createdAt: number;
}

/** A settle-up payment one member made to another outside the app. */
export interface Payment {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  createdAt: number;
  updatedAt: number;
}
