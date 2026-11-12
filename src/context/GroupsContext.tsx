import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Expense, Group, GroupKind, Member, Payment, Person, Profile, Recurring, UpiId } from '../types';
import {
  EMPTY_PROFILE,
  loadAll,
  saveGroups,
  saveMeMap,
  savePeople,
  savePrefs,
  saveProfile,
  saveUpiIds,
  saveVisits,
  adoptRemote,
  type MeMap,
} from '../lib/storage';
import {
  addVisit,
  archive,
  lock,
  pin,
  prunePrefs,
  pruneVisits,
  unarchive,
  unlock,
  unpin,
  type GroupPrefs,
  type Visits,
} from '../lib/groupFilters';
import {
  adoptAccountId,
  applyMembers,
  groupsWith,
  makeNames,
  reconcilePeople,
  renameInGroups,
  restoreSavedNames,
  type Names,
  type SavedName,
} from '../lib/people';
import { dropRepeats } from '../lib/months';
import { newId } from '../lib/id';
import { mergeGroups } from '../lib/backup';
import { purgeBin, type BinItem } from '../lib/bin';
import { can, type Action } from '../lib/permissions';
import { rebase } from '../lib/sync/merge';
import { remapGroup } from '../lib/legacyIds';

// Monthly repeats are gone from the app: old ones are cleared wherever you may
// edit expenses (in a live group that syncs as a delete).
const repeatsGone = (g: Group) => (g.recurring?.length && can('edit_expenses', g) ? dropRepeats(g) : g);

/** Someone with an account, in one of your live groups. */
const isAccount = (groups: Group[], id: string) => groups.some((g) => g.online && g.members.some((m) => m.id === id && m.account));

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
  saveExpense: (groupId: string, expense: Expense) => void;
  deleteExpense: (groupId: string, expenseId: string) => void;
  pinExpense: (groupId: string, expenseId: string, pinned: boolean) => void;
  /** Archived expenses stay saved but don't count in totals or balances. */
  archiveExpense: (groupId: string, expenseId: string, archived: boolean) => void;
  /** Adds several expenses at once, and any new members they mention. */
  addExpenses: (groupId: string, expenses: Expense[], newMembers?: Member[]) => void;
  addPayment: (groupId: string, payment: Omit<Payment, 'id' | 'createdAt'>) => Payment;
  deletePayment: (groupId: string, paymentId: string) => void;
  restorePayment: (groupId: string, payment: Payment) => void;
  /** Adds imported groups; ones with the same id replace the local copy. `contacts`: saved names from your backup. */
  importGroups: (incoming: Group[], contacts?: SavedName[]) => void;
  /** Renames the person in every group. For someone with an account, saves the name on this phone. */
  renamePerson: (personId: string, name: string) => void;
  /** Someone with an account goes back to "~" + their own name. */
  forgetName: (personId: string) => void;
  /** The names this phone shows ("~Name" for accounts you haven't saved). */
  names: Names;
  /** Only for people who aren't in any group. */
  /** False when they're still in a group (nothing is removed). */
  deletePerson: (personId: string) => boolean;
  /** How often each group was opened on this phone (for "Most visited"). */
  visits: Visits;
  recordVisit: (groupId: string) => void;
  prefs: GroupPrefs;
  /** days: null pins for good. */
  pinGroup: (groupId: string, days: number | null) => void;
  unpinGroup: (groupId: string) => void;
  archiveGroup: (groupId: string) => void;
  unarchiveGroup: (groupId: string) => void;
  /** Call only after the fingerprint or screen lock said yes. */
  lockGroup: (groupId: string) => void;
  unlockGroup: (groupId: string) => void;
  profile: Profile;
  /** Your UPI ids, on this phone (up to 3). */
  upiIds: UpiId[];
  setUpiIds: (ids: UpiId[]) => void;
  /** Your name; renames the person you're linked to everywhere as well. */
  setProfileName: (name: string) => void;
  /** Links you to a person; `name` also sets your name (without renaming anyone). */
  linkProfile: (personId: string | null, name?: string) => void;
  /** Who "me" is in each group, when picked by hand. */
  meMap: MeMap;
  setMe: (groupId: string, memberId: string) => void;
  /** Live groups: what a sync changed, put on screen keeping edits made meanwhile. */
  applySync: (touched: Map<string, { base: Group; next: Group }>) => void;
  /**
   * Signed in: the person who is you takes your account id in your local
   * groups (onlinedb.md §11.4). Returns the groups as they are now.
   */
  adoptAccount: (accountId: string, personId: string) => Group[];
  /** A group the server now has, saved as it has it. `uploaded`: the version that went up. */
  markOnline: (uploaded: Group, live: Group, cursor: number) => Promise<void>;
  /** A local group under a new id (a copy of it is already online). Returns it. */
  giveNewId: (groupId: string) => Group | undefined;
  /** Takes groups off this phone only (live groups, after logging out). */
  dropGroups: (ids: string[]) => void;
  /** The groups right now, including changes not rendered yet. */
  peekGroups: () => Group[];
  /** Live groups this phone doesn't have yet (signed in on a new phone): saved empty, to download whole. */
  addLiveGroups: (groups: Group[]) => Promise<void>;
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
  const [upiIds, setUpiIds] = useState<UpiId[]>([]);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const dbRef = useRef(db);
  dbRef.current = db;
  const meMapRef = useRef(meMap);
  meMapRef.current = meMap;

  useEffect(() => {
    loadAll()
      .then(({ groups, bin: storedBin, people, visits: v, prefs: p, profile: prof, meMap: me, upiIds: upi }) => {
        // Older data has no People directory yet: it's built from the groups.
        const now = new Date();
        const reconciled = reconcilePeople(groups, people);
        // Groups 30 days in the Bin are deleted for good here.
        const bin = purgeBin(storedBin, now.getTime());
        setDb({ ...reconciled, groups: reconciled.groups.map(repeatsGone), bin });
        setVisits(v);
        // Pins of binned groups are kept, so restoring brings them back.
        setPrefs(prunePrefs(p, [...groups, ...bin.map((b) => b.group)]));
        setProfile(prof);
        setMeMap(me);
        setUpiIds(upi);
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
    if (canSave) saveUpiIds(upiIds).catch((e) => console.warn('Could not save UPI ids', e));
  }, [upiIds, canSave]);
  useEffect(() => {
    if (canSave) saveMeMap(meMap).catch((e) => console.warn('Could not save who is me', e));
  }, [meMap, canSave]);

  // A phone on an older version can still sync a repeat in: cleared again
  // whenever the app comes back.
  useEffect(() => {
    if (!ready) return;
    const run = () =>
      setDb((d) => {
        const groups = d.groups.map(repeatsGone);
        return groups.some((g, i) => g !== d.groups[i]) ? { ...d, groups } : d;
      });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [ready]);

  // In a live group a change happens only when your role allows it (§9.10):
  // the app never saves what the server would refuse.
  const editGroup = useCallback((id: string, fn: (g: Group) => Group, action: Action = 'edit_expenses') => {
    setDb((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.id === id && can(action, g) ? { ...fn(g), updatedAt: Date.now() } : g)),
    }));
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
      const groups = d.groups.map((g) => {
        if (g.id !== id) return g;
        if (!g.online) return { ...g, ...input, updatedAt: Date.now() };
        // Live: name and type with "Edit group info", new and renamed guests
        // with "Add guests"; nobody is removed here (leaving and removing are §17).
        const guests = can('add_guests', g);
        const named = new Map(input.members.map((m) => [m.id, m.name]));
        const members = [
          ...g.members.map((m) => (guests && !m.account && named.get(m.id) && named.get(m.id) !== m.name ? { ...m, name: named.get(m.id)! } : m)),
          ...(guests ? input.members.filter((m) => !g.members.some((x) => x.id === m.id)) : []),
        ];
        const info = can('edit_info', g) ? { name: input.name, kind: input.kind } : {};
        return { ...g, ...info, members, updatedAt: Date.now() };
      });
      // In a live group the form holds the group's names for people with
      // accounts: those must not overwrite the names saved on this phone.
      const live = d.groups.find((g) => g.id === id && g.online);
      const named = live ? input.members.filter((m) => !live.members.some((x) => x.id === m.id && x.account)) : input.members;
      return { ...d, ...applyMembers(groups, d.people, named) };
    });
  }, []);

  const groupsRef = useRef(db.groups);
  groupsRef.current = db.groups;

  const moveToBin = useCallback((id: string) => {
    const removed = groupsRef.current.find((g) => g.id === id);
    setDb((d) => {
      const group = d.groups.find((g) => g.id === id);
      // You leave a live group (step 6); its copy goes only once you're out of it.
      if (!group || group.online?.status === 'active') return d;
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
    (groupId: string, e: Expense) =>
      editGroup(groupId, (g) => {
        const exists = g.expenses.some((x) => x.id === e.id);
        return { ...g, expenses: exists ? g.expenses.map((x) => (x.id === e.id ? e : x)) : [e, ...g.expenses] };
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
        g.id === groupId && can('edit_expenses', g) && (!newMembers.length || can('add_guests', g))
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

  const importGroups = useCallback((incoming: Group[], contacts: SavedName[] = []) => {
    // Names already in the directory win, so imported groups use yours.
    setDb((d) => ({ ...d, ...reconcilePeople(mergeGroups(d.groups, incoming), restoreSavedNames(d.people, contacts)) }));
  }, []);

  const renamePerson = useCallback((personId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setDb((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id !== personId ? p : { ...p, name: n, ...(isAccount(d.groups, personId) ? { saved: true } : {}) },
      ),
      // In a live group only a guest can be renamed (by whoever may add guests);
      // people with accounts keep the name they gave themselves.
      groups: d.groups.map((g) =>
        g.online && (!can('add_guests', g) || g.members.find((m) => m.id === personId)?.account)
          ? g
          : renameInGroups([g], personId, n)[0],
      ),
    }));
    if (profileRef.current.personId === personId) setProfile((p) => ({ ...p, name: n }));
  }, []);

  const forgetName = useCallback((personId: string) => {
    setDb((d) => {
      const own = makeNames(d.groups, [], new Set()).own(personId);
      if (!own) return d;
      return {
        ...d,
        people: d.people.map((p) => {
          if (p.id !== personId) return p;
          const { saved: _saved, ...rest } = p;
          return { ...rest, name: own };
        }),
        groups: d.groups.map((g) => (g.online ? g : renameInGroups([g], personId, own)[0])),
      };
    });
  }, []);

  // The same rule as the Person page's Remove button: in no group (locked ones
  // included; a linked guest's old row doesn't count).
  const deletePerson = useCallback((personId: string) => {
    if (groupsWith(dbRef.current.groups, personId).length) return false;
    setDb((d) => (groupsWith(d.groups, personId).length ? d : { ...d, people: d.people.filter((p) => p.id !== personId) }));
    if (profileRef.current.personId === personId) setProfile((p) => ({ ...p, personId: null }));
    return true;
  }, []);

  const pinGroup = useCallback((groupId: string, days: number | null) => setPrefs((p) => pin(p, groupId, days)), []);
  const unpinGroup = useCallback((groupId: string) => setPrefs((p) => unpin(p, groupId)), []);
  const archiveGroup = useCallback((groupId: string) => setPrefs((p) => archive(p, groupId)), []);
  const unarchiveGroup = useCallback((groupId: string) => setPrefs((p) => unarchive(p, groupId)), []);
  const lockGroup = useCallback((groupId: string) => setPrefs((p) => lock(p, groupId)), []);
  const unlockGroup = useCallback((groupId: string) => setPrefs((p) => unlock(p, groupId)), []);

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

  const applySync = useCallback((touched: Map<string, { base: Group; next: Group }>) => {
    if (!touched.size) return;
    setDb((d) => {
      const groups = d.groups.map((g) => {
        const t = touched.get(g.id);
        return t ? rebase(g, t.base, t.next) : g;
      });
      // New people in a live group join the People directory.
      return { ...d, ...reconcilePeople(groups, d.people) };
    });
  }, []);

  const adoptAccount = useCallback((accountId: string, personId: string) => {
    const d = dbRef.current;
    const s = adoptAccountId(
      { groups: d.groups, bin: d.bin, people: d.people, meMap: meMapRef.current, profile: profileRef.current },
      personId,
      accountId,
    );
    const next = { groups: s.groups, bin: s.bin, people: s.people };
    // Read right away by the caller (put online), before the next render.
    dbRef.current = next;
    setDb(next);
    setMeMap(s.meMap);
    setProfile(s.profile);
    return s.groups;
  }, []);

  const markOnline = useCallback(async (uploaded: Group, live: Group, cursor: number) => {
    await adoptRemote([live], { [live.id]: cursor });
    // Changed here while it went up: those changes are saved next, and so
    // they're queued and go up with the first sync.
    setDb((d) => ({
      ...d,
      groups: d.groups.map((g) =>
        g.id !== live.id
          ? g
          : g === uploaded
            ? live
            : { ...g, online: live.online, members: g.members.map((m) => live.members.find((x) => x.id === m.id) ?? m) },
      ),
    }));
  }, []);

  const giveNewId = useCallback((groupId: string) => {
    const d = dbRef.current;
    const fresh = newId();
    const old = d.groups.find((g) => g.id === groupId);
    if (!old) return undefined;
    const moved = remapGroup(old, (id) => (id === groupId ? fresh : id));
    const next = { ...d, groups: d.groups.map((g) => (g.id === groupId ? moved : g)) };
    dbRef.current = next;
    setDb(next);
    const move = <T,>(r: Record<string, T>) => {
      if (!(groupId in r)) return r;
      const { [groupId]: v, ...rest } = r;
      return { ...rest, [fresh]: v };
    };
    setMeMap(move);
    setPrefs(move);
    setVisits(move);
    return moved;
  }, []);

  const peekGroups = useCallback(() => dbRef.current.groups, []);

  const names = useMemo(
    () => makeNames(db.groups, db.people, new Set([profile.personId, ...Object.values(meMap)].filter((x): x is string => !!x))),
    [db.groups, db.people, profile.personId, meMap],
  );

  const addLiveGroups = useCallback(async (groups: Group[]) => {
    if (!groups.length) return;
    // Bookmark 0: the next sync brings everything in them.
    await adoptRemote(groups, Object.fromEntries(groups.map((g) => [g.id, 0])));
    setDb((d) => ({ ...d, groups: [...groups.filter((g) => !d.groups.some((x) => x.id === g.id)), ...d.groups] }));
  }, []);

  const dropGroups = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setDb((d) => ({
      ...d,
      groups: d.groups.filter((g) => !ids.includes(g.id)),
      bin: d.bin.filter((b) => !ids.includes(b.group.id)),
    }));
  }, []);

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
      importGroups,
      renamePerson,
      forgetName,
      names,
      deletePerson,
      visits,
      recordVisit,
      prefs,
      pinGroup,
      unpinGroup,
      archiveGroup,
      unarchiveGroup,
      lockGroup,
      unlockGroup,
      profile,
      upiIds,
      setUpiIds,
      setProfileName,
      linkProfile,
      meMap,
      setMe,
      applySync,
      adoptAccount,
      markOnline,
      giveNewId,
      dropGroups,
      peekGroups,
      addLiveGroups,
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
      importGroups,
      renamePerson,
      forgetName,
      names,
      deletePerson,
      visits,
      recordVisit,
      prefs,
      pinGroup,
      unpinGroup,
      archiveGroup,
      unarchiveGroup,
      lockGroup,
      unlockGroup,
      profile,
      upiIds,
      setUpiIds,
      setProfileName,
      linkProfile,
      meMap,
      setMe,
      applySync,
      adoptAccount,
      markOnline,
      giveNewId,
      dropGroups,
      peekGroups,
      addLiveGroups,
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
