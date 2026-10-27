import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Expense, Group, GroupKind, Member, Payment } from '../types';
import { loadGroups, saveGroups } from '../lib/storage';
import { newId } from '../lib/id';

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
  addPayment: (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  deletePayment: (groupId: string, paymentId: string) => void;
}

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);
  // If the stored data can't be read, don't overwrite it with an empty list.
  const loadFailed = useRef(false);

  useEffect(() => {
    loadGroups()
      .then(setGroups)
      .catch((e) => {
        loadFailed.current = true;
        console.warn('Could not load saved groups', e);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || loadFailed.current) return;
    saveGroups(groups).catch((e) => console.warn('Could not save groups', e));
  }, [groups, ready]);

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

  const value = useMemo(
    () => ({
      groups,
      ready,
      createGroup,
      updateGroup,
      deleteGroup,
      saveExpense,
      deleteExpense,
      addPayment,
      deletePayment,
    }),
    [groups, ready, createGroup, updateGroup, deleteGroup, saveExpense, deleteExpense, addPayment, deletePayment],
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
