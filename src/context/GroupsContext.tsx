import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Expense, Group, GroupKind, Member, Payment } from '../types';
import { loadGroups, loadVisits, saveGroups, saveVisits } from '../lib/storage';
import { addVisit, pruneVisits, type Visits } from '../lib/groupFilters';
import { newId } from '../lib/id';
import { mergeGroups } from '../lib/backup';

interface GroupInput {
  name: string;
  kind: GroupKind;
  members: Member[];
}

interface GroupsContextValue {
  groups: Group[];
  ready: boolean;
  createGroup: (input: GroupInput) => string;
  updateGroup: (id: string, input: GroupInput) => void;
  deleteGroup: (id: string) => void;
  saveExpense: (groupId: string, expense: Expense) => void;
  deleteExpense: (groupId: string, expenseId: string) => void;
  /** Adds several expenses at once, and any new members they mention. */
  addExpenses: (groupId: string, expenses: Expense[], newMembers?: Member[]) => void;
  addPayment: (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  deletePayment: (groupId: string, paymentId: string) => void;
  /** Adds imported groups; ones with the same id replace the local copy. */
  importGroups: (incoming: Group[]) => void;
  /** How often each group was opened on this phone (for "Most visited"). */
  visits: Visits;
  recordVisit: (groupId: string) => void;
}

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);
  // If the stored data can't be read, don't overwrite it with an empty list.
  const loadFailed = useRef(false);
  const [visits, setVisits] = useState<Visits>({});
  const [visitsReady, setVisitsReady] = useState(false);

  useEffect(() => {
    loadGroups()
      .then(setGroups)
      .catch((e) => {
        loadFailed.current = true;
        console.warn('Could not load saved groups', e);
      })
      .finally(() => setReady(true));
    loadVisits()
      .then(setVisits)
      .catch((e) => console.warn('Could not load visit counts', e))
      .finally(() => setVisitsReady(true));
  }, []);

  useEffect(() => {
    if (!ready || loadFailed.current) return;
    saveGroups(groups).catch((e) => console.warn('Could not save groups', e));
  }, [groups, ready]);

  // Pruned on save, so deleted groups drop out of the counts.
  useEffect(() => {
    if (!ready || !visitsReady || loadFailed.current) return;
    saveVisits(pruneVisits(visits, groups)).catch((e) => console.warn('Could not save visit counts', e));
  }, [visits, groups, ready, visitsReady]);

  const recordVisit = useCallback((groupId: string) => {
    setVisits((v) => addVisit(v, groupId));
  }, []);

  const editGroup = useCallback((id: string, fn: (g: Group) => Group) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...fn(g), updatedAt: Date.now() } : g)));
  }, []);

  const createGroup = useCallback((input: GroupInput) => {
    const now = Date.now();
    const group: Group = { id: newId(), ...input, expenses: [], payments: [], createdAt: now, updatedAt: now };
    setGroups((gs) => [group, ...gs]);
    return group.id;
  }, []);

  const updateGroup = useCallback(
    (id: string, input: GroupInput) => editGroup(id, (g) => ({ ...g, ...input })),
    [editGroup],
  );

  const deleteGroup = useCallback((id: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== id));
  }, []);

  const saveExpense = useCallback(
    (groupId: string, expense: Expense) =>
      editGroup(groupId, (g) => {
        const exists = g.expenses.some((e) => e.id === expense.id);
        return {
          ...g,
          expenses: exists ? g.expenses.map((e) => (e.id === expense.id ? expense : e)) : [expense, ...g.expenses],
        };
      }),
    [editGroup],
  );

  const deleteExpense = useCallback(
    (groupId: string, expenseId: string) =>
      editGroup(groupId, (g) => ({ ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) })),
    [editGroup],
  );

  const addExpenses = useCallback(
    (groupId: string, expenses: Expense[], newMembers: Member[] = []) =>
      editGroup(groupId, (g) => ({
        ...g,
        members: [...g.members, ...newMembers],
        expenses: [...expenses, ...g.expenses],
      })),
    [editGroup],
  );

  const addPayment = useCallback(
    (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) =>
      editGroup(groupId, (g) => ({
        ...g,
        payments: [{ ...payment, id: newId(), createdAt: Date.now() }, ...g.payments],
      })),
    [editGroup],
  );

  const deletePayment = useCallback(
    (groupId: string, paymentId: string) =>
      editGroup(groupId, (g) => ({ ...g, payments: g.payments.filter((p) => p.id !== paymentId) })),
    [editGroup],
  );

  const importGroups = useCallback((incoming: Group[]) => {
    setGroups((gs) => mergeGroups(gs, incoming));
  }, []);

  const value = useMemo(
    () => ({
      groups,
      ready,
      createGroup,
      updateGroup,
      deleteGroup,
      saveExpense,
      deleteExpense,
      addExpenses,
      addPayment,
      deletePayment,
      importGroups,
      visits,
      recordVisit,
    }),
    [
      groups,
      ready,
      createGroup,
      updateGroup,
      deleteGroup,
      saveExpense,
      deleteExpense,
      addExpenses,
      addPayment,
      deletePayment,
      importGroups,
      visits,
      recordVisit,
    ],
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be used inside GroupsProvider');
  return ctx;
}

export function useGroup(id: string) {
  return useGroups().groups.find((g) => g.id === id);
}
