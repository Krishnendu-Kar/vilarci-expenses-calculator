// All money is stored as integer paise (₹1 = 100) so splits never drift
// from floating-point rounding.

export type GroupKind = 'trip' | 'hostel' | 'other';

export type CategoryKey = 'food' | 'travel' | 'stay' | 'groceries' | 'fun' | 'shopping' | 'other';

/**
 * A person in a group. Members are people from the People directory: the
 * same id in every group they're in, so a rename shows up everywhere. The
 * name is kept here too so a shared group file reads on its own.
 */
export interface Member {
  id: string;
  name: string;
}

/** Someone in the People directory (this phone only). */
export interface Person {
  id: string;
  name: string;
  createdAt: number;
}

/** A UPI id ("VPA", name@bank) you get paid on, with an optional label like "GPay". */
export interface UpiId {
  vpa: string;
  label?: string;
}

/** You, on this phone only. `personId` links you to the People directory. */
export interface Profile {
  name: string;
  personId: string | null;
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
  /**
   * Hostel/flat groups: the month it counts for ('YYYY-MM') when that isn't
   * the month of `date`, like a forgotten bill from last month or next
   * month's gas bought early. Absent: the month of `date`.
   */
  month?: string;
  note?: string;
  /** The monthly repeat that added it (hostel/flat groups). */
  recurringId?: string;
  /** Pinned to the top of the group's expense list. */
  pinnedAt?: number;
  /** Archived: kept as a record, but left out of every total and balance. */
  archivedAt?: number;
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

/**
 * Hostel/flat groups: an expense added by itself every month (rent, Wi-Fi,
 * cook). Same money fields as an expense.
 */
export interface Recurring {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  payers: Record<string, number>;
  splitMode: SplitMode;
  splitAmong: string[];
  splitValues?: Record<string, number>;
  note?: string;
  /** Day of the month it's added on, 1–31 (short months use their last day). */
  day: number;
  /** The latest month it was added for, 'YYYY-MM'. */
  lastMonth: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  /**
   * Months closed in 1.1/1.2 ('YYYY-MM'). Closing was removed in 1.3 (nothing
   * is locked now); the list is still saved and loaded so no data is lost.
   */
  closedMonths?: string[];
  /** Hostel/flat groups: expenses that repeat every month. */
  recurring?: Recurring[];
  createdAt: number;
  updatedAt: number;
}
