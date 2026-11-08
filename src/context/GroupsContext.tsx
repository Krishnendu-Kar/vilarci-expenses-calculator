import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Expense, Group, GroupKind, Member, Payment, Person, Profile, Recurring } from '../types';
import {
  EMPTY_PROFILE,
  loadAll,
  saveGroups,
  saveMeMap,
  savePeople,
  savePrefs,
  saveProfile,
  saveVisits,
  type MeMap,
} from '../lib/storage';
import {
  addVisit,
  archive,
  pin,
  prunePrefs,
  pruneVisits,
  unarchive,
  unpin,
  type GroupPrefs,
  type Visits,
} from '../lib/groupFilters';
import { applyMembers, reconcilePeople, renameInGroups } from '../lib/people';
import { applyRecurring, setMonthClosed, setRecurring, withRepeat, type Month } from '../lib/months';
import { newId } from '../lib/id';
import { mergeGroups } from '../lib/backup';
import { purgeBin, type BinItem } from '../lib/bin';

interface GroupInput {
  name: string;
  kind: GroupKind;
  /** People in the group: ids of existing people, or new ids for new people. */
  members: Member[];
}

interface GroupsContextValue {
  groups: Group[];
  /** Everyone from every group (and anyone kept after their groups were deleted). */
  people: Person[];
  ready: boolean;
  createGroup: (input: GroupInput) => string;
  updateGroup: (id: string, input: GroupInput) => void;
  /** Deleted groups, kept 30 days. */
  bin: BinItem[];
  /** Deleting a group moves it to the Bin. Returns it, for the undo bar. */
  moveToBin: (id: string) => Group | undefined;
  restoreFromBin: (id: string) => void;
  /** Deletes a group in the Bin for good. */
  deleteForever: (id: string) => void;
  /** `repeat` (hostel/flat groups): the "Repeat every month" switch. */
  saveExpense: (groupId: string, expense: Expense, opts?: { repeat?: boolean }) => void;
  deleteExpense: (groupId: string, expenseId: string) => void;
  pinExpense: (groupId: string, expenseId: string, pinned: boolean) => void;
  /** Archived expenses stay saved but don't count in totals or balances. */
  archiveExpense: (groupId: string, expenseId: string, archived: boolean) => void;
  /** Adds several expenses at once, and any new members they mention. */
  addExpenses: (groupId: string, expenses: Expense[], newMembers?: Member[]) => void;
  addPayment: (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) => Payment;
  deletePayment: (groupId: string, paymentId: string) => void;
  restorePayment: (groupId: string, payment: Payment) => void;
  setClosed: (groupId: string, month: Month, closed: boolean) => void;
  stopRecurring: (groupId: string, recurringId: string) => void;
  restoreRecurring: (groupId: string, recurring: Recurring) => void;
  /** Adds imported groups; ones with the same id replace the local copy. */
  importGroups: (incoming: Group[]) => void;
  /** Renames the person in every group. */
  renamePerson: (personId: string, name: string) => void;
  /** Only for people who aren't in any group. */
  deletePerson: (personId: string) => void;
  /** How often each group was opened on this phone (for "Most visited"). */
  visits: Visits;
  recordVisit: (groupId: string) => void;
  prefs: GroupPrefs;
  /** days: null pins for good. */
  pinGroup: (groupId: string, days: number | null) => void;
  unpinGroup: (groupId: string) => void;
  archiveGroup: (groupId: string) => void;
  unarchiveGroup: (groupId: string) => void;
  profile: Profile;
  /** Your name; renames the person you're linked to everywhere as well. */
  setProfileName: (name: string) => void;
  /** Links you to a person; `name` also sets your name (without renaming anyone). */
  linkProfile: (personId: string | null, name?: string) => void;
  /** Who "me" is in each group, when picked by hand. */
  meMap: MeMap;
  setMe: (groupId: string, memberId: string) => void;
}

interface Db {
  groups: Group[];
  people: Person[];
  bin: BinItem[];
}

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db>({ groups: [], people: [], bin: [] });
  const [ready, setReady] = useState(false);
  // If the stored groups can't be read, don't overwrite them with an empty list.
  const loadFailed = useRef(false);
  const [visits, setVisits] = useState<Visits>({});
  const [prefs, setPrefs] = useState<GroupPrefs>({});
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [meMap, setMeMap] = useState<MeMap>({});
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    loadAll()
      .then(({ groups, bin: storedBin, people, visits: v, prefs: p, profile: prof, meMap: me }) => {
        // Older data has no People directory yet: it's built from the groups.
        const now = new Date();
        const reconciled = reconcilePeople(groups, people);
        // Groups 30 days in the Bin are deleted for good here.
        const bin = purgeBin(storedBin, now.getTime());
        setDb({ ...reconciled, groups: reconciled.groups.map((g) => applyRecurring(g, now, newId)), bin });
        setVisits(v);
        // Pins of binned groups are kept, so restoring brings them back.
        setPrefs(prunePrefs(p, [...groups, ...bin.map((b) => b.group)]));
        setProfile(prof);
        setMeMap(me);
      })
      .catch((e) => {
        loadFailed.current = true;
        console.warn('Could not load saved data', e);
      })
      .finally(() => setReady(true));
  }, []);

  const canSave = ready && !loadFailed.current;
  // Groups and the Bin are saved together: moving to the Bin is one change.
  useEffect(() => {
    if (canSave) saveGroups(db.groups, db.bin).catch((e) => console.warn('Could not save groups', e));
  }, [db.groups, db.bin, canSave]);
  useEffect(() => {
    if (canSave) savePeople(db.people).catch((e) => console.warn('Could not save people', e));
  }, [db.people, canSave]);
  // Pruned on save, so deleted groups drop out of the counts.
  useEffect(() => {
    if (!canSave) return;
    saveVisits(pruneVisits(visits, [...db.groups, ...db.bin.map((b) => b.group)])).catch((e) =>
      console.warn('Could not save visit counts', e),
    );
  }, [visits, db.groups, db.bin, canSave]);
  useEffect(() => {
    if (canSave) savePrefs(prefs).catch((e) => console.warn('Could not save pins', e));
  }, [prefs, canSave]);
  useEffect(() => {
    if (canSave) saveProfile(profile).catch((e) => console.warn('Could not save profile', e));
  }, [profile, canSave]);
  useEffect(() => {
    if (canSave) saveMeMap(meMap).catch((e) => console.warn('Could not save who is me', e));
  }, [meMap, canSave]);

  // Monthly repeats come due while the app sits in the background, so check
  // again whenever it comes back.
  useEffect(() => {
    if (!ready) return;
    const run = () =>
      setDb((d) => {
        const now = new Date();
        const groups = d.groups.map((g) => applyRecurring(g, now, newId));
        return groups.some((g, i) => g !== d.groups[i]) ? { ...d, groups } : d;
      });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [ready]);

  const editGroup = useCallback((id: string, fn: (g: Group) => Group) => {
    setDb((d) => ({ ...d, groups: d.groups.map((g) => (g.id === id ? { ...fn(g), updatedAt: Date.now() } : g)) }));
  }, []);

  const recordVisit = useCallback((groupId: string) => {
    setVisits((v) => addVisit(v, groupId));
  }, []);

  const createGroup = useCallback((input: GroupInput) => {
    const now = Date.now();
    const group: Group = { id: newId(), ...input, expenses: [], payments: [], createdAt: now, updatedAt: now };
    setDb((d) => ({ ...d, ...applyMembers([group, ...d.groups], d.people, input.members, now) }));
    return group.id;
  }, []);

  const updateGroup = useCallback((id: string, input: GroupInput) => {
    setDb((d) => {
      const groups = d.groups.map((g) => (g.id === id ? { ...g, ...input, updatedAt: Date.now() } : g));
      return { ...d, ...applyMembers(groups, d.people, input.members) };
    });
  }, []);

  const groupsRef = useRef(db.groups);
  groupsRef.current = db.groups;

  const moveToBin = useCallback((id: string) => {
    const removed = groupsRef.current.find((g) => g.id === id);
    setDb((d) => {
      const group = d.groups.find((g) => g.id === id);
      if (!group) return d;
      return {
        ...d,
        groups: d.groups.filter((g) => g.id !== id),
        bin: [{ group, binnedAt: Date.now() }, ...d.bin.filter((b) => b.group.id !== id)],
      };
    });
    return removed;
  }, []);

  const restoreFromBin = useCallback((id: string) => {
    setDb((d) => {
      const item = d.bin.find((b) => b.group.id === id);
      if (!item) return d;
      const bin = d.bin.filter((b) => b.group.id !== id);
      if (d.groups.some((g) => g.id === id)) return { ...d, bin };
      return { ...reconcilePeople([item.group, ...d.groups], d.people), bin };
    });
  }, []);

  const deleteForever = useCallback((id: string) => {
    setDb((d) => ({ ...d, bin: d.bin.filter((b) => b.group.id !== id) }));
  }, []);

  const saveExpense = useCallback(
    (groupId: string, expense: Expense, opts?: { repeat?: boolean }) =>
      editGroup(groupId, (g) => {
        let e = expense;
        let next = g;
        if (g.kind === 'hostel' && opts?.repeat !== undefined) {
          const r = withRepeat(g, expense, opts.repeat, newId);
          e = r.expense;
          next = setRecurring(g, r.recurring);
        }
        const exists = next.expenses.some((x) => x.id === e.id);
        next = { ...next, expenses: exists ? next.expenses.map((x) => (x.id === e.id ? e : x)) : [e, ...next.expenses] };
        // A repeat started in an earlier month catches up straight away.
        return applyRecurring(next, new Date(), newId);
      }),
    [editGroup],
  );

  const deleteExpense = useCallback(
    (groupId: string, expenseId: string) =>
      editGroup(groupId, (g) => ({ ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) })),
    [editGroup],
  );

  const setExpense = useCallback(
    (groupId: string, expenseId: string, fn: (e: Expense) => Expense) =>
      editGroup(groupId, (g) => ({ ...g, expenses: g.expenses.map((e) => (e.id === expenseId ? fn(e) : e)) })),
    [editGroup],
  );

  const pinExpense = useCallback(
    (groupId: string, expenseId: string, pinned: boolean) =>
      setExpense(groupId, expenseId, ({ pinnedAt: _old, ...e }) => (pinned ? { ...e, pinnedAt: Date.now() } : e)),
    [setExpense],
  );

  // Archiving also unpins: an archived expense moves out of the way.
  const archiveExpense = useCallback(
    (groupId: string, expenseId: string, archived: boolean) =>
      setExpense(groupId, expenseId, ({ archivedAt: _old, pinnedAt: _pin, ...e }) =>
        archived ? { ...e, archivedAt: Date.now() } : e,
      ),
    [setExpense],
  );

  const addExpenses = useCallback((groupId: string, expenses: Expense[], newMembers: Member[] = []) => {
    setDb((d) => {
      const groups = d.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              members: [...g.members, ...newMembers.filter((m) => !g.members.some((x) => x.id === m.id))],
              expenses: [...expenses, ...g.expenses],
              updatedAt: Date.now(),
            }
          : g,
      );
      return { ...d, ...applyMembers(groups, d.people, newMembers) };
    });
  }, []);

  const addPayment = useCallback(
    (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) => {
      const p: Payment = { ...payment, id: newId(), createdAt: Date.now() };
      editGroup(groupId, (g) => ({ ...g, payments: [p, ...g.payments] }));
      return p;
    },
    [editGroup],
  );

  const deletePayment = useCallback(
    (groupId: string, paymentId: string) =>
      editGroup(groupId, (g) => ({ ...g, payments: g.payments.filter((p) => p.id !== paymentId) })),
    [editGroup],
  );

  const restorePayment = useCallback(
    (groupId: string, payment: Payment) =>
      editGroup(groupId, (g) =>
        g.payments.some((p) => p.id === payment.id)
          ? g
          : { ...g, payments: [payment, ...g.payments].sort((a, b) => b.createdAt - a.createdAt) },
      ),
    [editGroup],
  );

  const setClosed = useCallback(
    (groupId: string, month: Month, closed: boolean) => editGroup(groupId, (g) => setMonthClosed(g, month, closed)),
    [editGroup],
  );

  const stopRecurring = useCallback(
    (groupId: string, recurringId: string) =>
      editGroup(groupId, (g) => setRecurring(g, (g.recurring ?? []).filter((r) => r.id !== recurringId))),
    [editGroup],
  );

  const restoreRecurring = useCallback(
    (groupId: string, recurring: Recurring) =>
      editGroup(groupId, (g) =>
        (g.recurring ?? []).some((r) => r.id === recurring.id) ? g : setRecurring(g, [...(g.recurring ?? []), recurring]),
      ),
    [editGroup],
  );

  const importGroups = useCallback((incoming: Group[]) => {
    // Names already in the directory win, so imported groups use yours.
    setDb((d) => ({ ...d, ...reconcilePeople(mergeGroups(d.groups, incoming), d.people) }));
  }, []);

  const renamePerson = useCallback((personId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setDb((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === personId ? { ...p, name: n } : p)),
      groups: renameInGroups(d.groups, personId, n),
    }));
    if (profileRef.current.personId === personId) setProfile((p) => ({ ...p, name: n }));
  }, []);

  const deletePerson = useCallback((personId: string) => {
    setDb((d) =>
      d.groups.some((g) => g.members.some((m) => m.id === personId))
        ? d
        : { ...d, people: d.people.filter((p) => p.id !== personId) },
    );
    if (profileRef.current.personId === personId) setProfile((p) => ({ ...p, personId: null }));
  }, []);

  const pinGroup = useCallback((groupId: string, days: number | null) => setPrefs((p) => pin(p, groupId, days)), []);
  const unpinGroup = useCallback((groupId: string) => setPrefs((p) => unpin(p, groupId)), []);
  const archiveGroup = useCallback((groupId: string) => setPrefs((p) => archive(p, groupId)), []);
  const unarchiveGroup = useCallback((groupId: string) => setPrefs((p) => unarchive(p, groupId)), []);

  const setProfileName = useCallback(
    (name: string) => {
      const n = name.trim().slice(0, 30);
      setProfile((p) => ({ ...p, name: n }));
      const linked = profileRef.current.personId;
      if (linked && n) renamePerson(linked, n);
    },
    [renamePerson],
  );

  const linkProfile = useCallback(
    (personId: string | null, name?: string) => setProfile((p) => ({ name: name ?? p.name, personId })),
    [],
  );

  const setMe = useCallback(
    (groupId: string, memberId: string) => setMeMap((m) => (m[groupId] === memberId ? m : { ...m, [groupId]: memberId })),
    [],
  );

  const value = useMemo(
    () => ({
      groups: db.groups,
      people: db.people,
      bin: db.bin,
      ready,
      createGroup,
      updateGroup,
      moveToBin,
      restoreFromBin,
      deleteForever,
      saveExpense,
      deleteExpense,
      pinExpense,
      archiveExpense,
      addExpenses,
      addPayment,
      deletePayment,
      restorePayment,
      setClosed,
      stopRecurring,
      restoreRecurring,
      importGroups,
      renamePerson,
      deletePerson,
      visits,
      recordVisit,
      prefs,
      pinGroup,
      unpinGroup,
      archiveGroup,
      unarchiveGroup,
      profile,
      setProfileName,
      linkProfile,
      meMap,
      setMe,
    }),
    [
      db,
      ready,
      createGroup,
      updateGroup,
      moveToBin,
      restoreFromBin,
      deleteForever,
      saveExpense,
      deleteExpense,
      pinExpense,
      archiveExpense,
      addExpenses,
      addPayment,
      deletePayment,
      restorePayment,
      setClosed,
      stopRecurring,
      restoreRecurring,
      importGroups,
      renamePerson,
      deletePerson,
      visits,
      recordVisit,
      prefs,
      pinGroup,
      unpinGroup,
      archiveGroup,
      unarchiveGroup,
      profile,
      setProfileName,
      linkProfile,
      meMap,
      setMe,
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
