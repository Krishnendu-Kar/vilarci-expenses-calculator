import type { Expense, Group, Recurring } from '../types';
import type { ExpenseDraft } from './drafts';

// Before 1.2 ids were short strings ("lq8x3k9abc12"). Now every id is a
// UUID: saved data is converted once when the app first opens SQLite, and
// files exported by older versions are converted when they're imported. The
// old → new pairs are kept, so the same old id always becomes the same UUID
// (an old backup of a group still replaces that group).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (id: string) => UUID_RE.test(id);

/** Old id → UUID. Gets the same answer for the same id. */
export type IdFor = (id: string) => string;

const keys = <T,>(r: Record<string, T>, idFor: IdFor) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [idFor(k), v])) as Record<string, T>;

function money<T extends Expense | Recurring>(e: T, idFor: IdFor): T {
  return {
    ...e,
    id: idFor(e.id),
    payers: keys(e.payers, idFor),
    splitAmong: e.splitAmong.map(idFor),
    ...(e.splitValues ? { splitValues: keys(e.splitValues, idFor) } : {}),
  };
}

/** Every id in a group: its own, members, expenses, payments and repeats. */
export function remapGroup(g: Group, idFor: IdFor): Group {
  return {
    ...g,
    id: idFor(g.id),
    members: g.members.map((m) => ({ ...m, id: idFor(m.id) })),
    expenses: g.expenses.map((e) => ({
      ...money(e, idFor),
      ...(e.recurringId ? { recurringId: idFor(e.recurringId) } : {}),
    })),
    payments: g.payments.map((p) => ({ ...p, id: idFor(p.id), from: idFor(p.from), to: idFor(p.to) })),
    ...(g.recurring ? { recurring: g.recurring.map((r) => money(r, idFor)) } : {}),
  };
}

/** Old ids in the groups that aren't UUIDs yet, each once. */
export function oldIds(groups: Group[]): string[] {
  const found = new Set<string>();
  const note: IdFor = (id) => {
    if (!isUuid(id)) found.add(id);
    return id;
  };
  groups.forEach((g) => remapGroup(g, note));
  return [...found];
}

/** Maps every old id it's given to a new UUID; UUIDs stay as they are. */
export function idMapper(newId: () => string, known: Map<string, string> = new Map()) {
  const idFor: IdFor = (id) => {
    if (isUuid(id)) return id;
    let next = known.get(id);
    if (!next) {
      next = newId();
      known.set(id, next);
    }
    return next;
  };
  // For data that only points at ids (pins, drafts): unknown strings are left alone.
  const lookup: IdFor = (id) => known.get(id) ?? id;
  return { idFor, lookup, map: known };
}

/** An unsaved Add-expense form: member ids in the payer, splits and name matches. */
export function remapDraft(d: ExpenseDraft, lookup: IdFor): ExpenseDraft {
  const one = d.one && {
    ...d.one,
    payer: lookup(d.one.payer),
    payerTexts: keys(d.one.payerTexts ?? {}, lookup),
    selected: (d.one.selected ?? []).map(lookup),
    values: {
      exact: keys(d.one.values?.exact ?? {}, lookup),
      shares: keys(d.one.values?.shares ?? {}, lookup),
      percent: keys(d.one.values?.percent ?? {}, lookup),
    },
  };
  const many = d.many && {
    ...d.many,
    names: Object.fromEntries(Object.entries(d.many.names ?? {}).map(([k, v]) => [k, lookup(v)])),
    rows: Object.fromEntries(
      Object.entries(d.many.rows ?? {}).map(([k, r]) => [
        k,
        {
          ...r,
          ...(r.payer !== undefined ? { payer: lookup(r.payer) } : {}),
          ...(r.among !== undefined ? { among: r.among && r.among.map(lookup) } : {}),
        },
      ]),
    ),
  };
  return { ...d, ...(one ? { one } : {}), ...(many ? { many } : {}) };
}
