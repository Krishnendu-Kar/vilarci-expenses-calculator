// All money is stored as integer paise (₹1 = 100) so splits never drift
// from floating-point rounding.

export type GroupKind = 'trip' | 'hostel' | 'other';

export type CategoryKey = 'food' | 'travel' | 'stay' | 'groceries' | 'fun' | 'shopping' | 'other';

export interface Member {
  id: string;
  name: string;
}

/**
 * equal:   amount is divided evenly among `splitAmong`.
 * exact:   splitValues[id] is the paise that person owes.
 * shares:  splitValues[id] is a share count (2 = double portion).
 * percent: splitValues[id] is a percentage in basis points (33.5% = 3350).
 */
export type SplitMode = 'equal' | 'exact' | 'shares' | 'percent';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  /** Who paid and how much. Always adds up to `amount`. */
  payers: Record<string, number>;
  splitMode: SplitMode;
  splitAmong: string[];
  splitValues?: Record<string, number>;
  /** Day the money was spent, local YYYY-MM-DD. */
  date: string;
  note?: string;
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
