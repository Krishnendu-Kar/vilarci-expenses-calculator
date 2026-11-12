import type { Group, Member, Person, Profile } from '../types';
import type { BinItem } from './bin';
import { remapGroup } from './legacyIds';
import { computeBalances, isSettled } from './split';

// The People directory: everyone from every group, once. A member's id is
// their person id, so the same friend in two groups is the same person and a
// rename shows up everywhere. Groups keep a copy of each name (so a shared
// group file reads on its own); it's refreshed from the directory here.

/**
 * Adds anyone in a group who isn't in the directory yet (older data,
 * imported files) and refreshes every group's member names from it. The
 * directory's name wins. Unchanged groups keep their identity.
 */
export function reconcilePeople(groups: Group[], people: Person[]): { groups: Group[]; people: Person[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const added: Person[] = [];
  for (const g of groups) {
    for (const m of g.members) {
      if (byId.has(m.id)) continue;
      const p = { id: m.id, name: m.name, createdAt: g.createdAt };
      byId.set(m.id, p);
      added.push(p);
    }
  }
  // A live group keeps the names it has: they're the group's, shared with
  // everyone in it, not this phone's nicknames.
  const synced = groups.map((g) =>
    g.online || g.members.every((m) => byId.get(m.id)!.name === m.name)
      ? g
      : { ...g, members: g.members.map((m) => ({ ...m, name: byId.get(m.id)!.name })) },
  );
  return { groups: synced, people: added.length ? [...people, ...added] : people };
}

/**
 * Members coming from a group form or "Many at once": new ids become new
 * people, and a changed name renames that person in every group.
 */
export function applyMembers(
  groups: Group[],
  people: Person[],
  members: Member[],
  now = Date.now(),
): { groups: Group[]; people: Person[] } {
  let nextGroups = groups;
  let nextPeople = people;
  const added: Person[] = [];
  for (const m of members) {
    const p = nextPeople.find((x) => x.id === m.id);
    if (!p) {
      if (!added.some((x) => x.id === m.id)) added.push({ id: m.id, name: m.name, createdAt: now });
    } else if (p.name !== m.name) {
      nextPeople = nextPeople.map((x) => (x.id === m.id ? { ...x, name: m.name } : x));
      nextGroups = renameInGroups(nextGroups, m.id, m.name);
    }
  }
  return { groups: nextGroups, people: added.length ? [...nextPeople, ...added] : nextPeople };
}

/** Every group that has this person in it. */
export function groupsWith(groups: Group[], personId: string) {
  return groups.filter((g) => g.members.some((m) => m.id === personId));
}

/** Renames the person in every group they're in. */
export function renameInGroups(groups: Group[], personId: string, name: string): Group[] {
  return groups.map((g) =>
    g.members.some((m) => m.id === personId && m.name !== name)
      ? { ...g, members: g.members.map((m) => (m.id === personId ? { ...m, name } : m)) }
      : g,
  );
}

/**
 * Names must differ inside a group, so a rename can't take a name someone
 * else already has in one of the person's groups. Returns that group.
 */
export function nameTakenIn(groups: Group[], personId: string, name: string): Group | undefined {
  const n = name.trim().toLowerCase();
  return groupsWith(groups, personId).find((g) =>
    g.members.some((m) => m.id !== personId && m.name.toLowerCase() === n),
  );
}

/**
 * Who "you" are in a group: the member picked for it, else the person your
 * profile is linked to, else the one member with exactly your name.
 */
export function resolveMe(group: Group, profile: Profile, picked?: string | null): string | null {
  const isMember = (id?: string | null): id is string => !!id && group.members.some((m) => m.id === id);
  if (isMember(picked)) return picked;
  if (isMember(profile.personId)) return profile.personId;
  const n = profile.name.trim().toLowerCase();
  if (!n) return null;
  const same = group.members.filter((m) => m.name.toLowerCase() === n);
  return same.length === 1 ? same[0].id : null;
}

export interface PeopleState {
  groups: Group[];
  bin: BinItem[];
  people: Person[];
  meMap: Record<string, string>;
  profile: Profile;
}

/**
 * Signed in: the person you are on this phone takes your account id, in every
 * group, the Bin, the directory and "who is me" (onlinedb.md §11.4). Live
 * groups know you by that id, so a group must have it before it goes online.
 * A group that somehow has both ids is left alone, and so is a live group
 * (the server already knows everyone in it by id). Unchanged parts keep
 * their identity.
 */
export function adoptAccountId(s: PeopleState, personId: string, accountId: string): PeopleState {
  if (personId === accountId) return s;
  const idFor = (id: string) => (id === personId ? accountId : id);
  const move = (g: Group) =>
    !g.online && g.members.some((m) => m.id === personId) && !g.members.some((m) => m.id === accountId)
      ? remapGroup(g, idFor)
      : g;
  const taken = s.people.some((p) => p.id === accountId);
  return {
    groups: s.groups.map(move),
    bin: s.bin.map((b) => {
      const group = move(b.group);
      return group === b.group ? b : { ...b, group };
    }),
    people: taken ? s.people.filter((p) => p.id !== personId) : s.people.map((p) => (p.id === personId ? { ...p, id: accountId } : p)),
    meMap: Object.values(s.meMap).includes(personId)
      ? Object.fromEntries(Object.entries(s.meMap).map(([g, m]) => [g, idFor(m)]))
      : s.meMap,
    profile: s.profile.personId === personId ? { ...s.profile, personId: accountId } : s.profile,
  };
}

/**
 * The person "You" stands for when adding yourself to a group: your linked
 * person, else someone in the directory with your name (the one in the most
 * groups). Null means a new person should be made.
 */
export function personForProfile(profile: Profile, people: Person[], groups: Group[]): Person | null {
  const linked = people.find((p) => p.id === profile.personId);
  if (linked) return linked;
  const n = profile.name.trim().toLowerCase();
  if (!n) return null;
  const same = people.filter((p) => p.name.toLowerCase() === n);
  if (same.length <= 1) return same[0] ?? null;
  return [...same].sort((a, b) => groupsWith(groups, b.id).length - groupsWith(groups, a.id).length)[0];
}

export interface GroupNet {
  group: Group;
  /** > 0: the group owes them. < 0: they owe the group. */
  net: number;
}

/** The person's balance in each of their groups. */
export function netsFor(groups: Group[], personId: string): GroupNet[] {
  return groupsWith(groups, personId).map((group) => ({
    group,
    net: computeBalances(group).find((b) => b.memberId === personId)?.net ?? 0,
  }));
}

/**
 * Everyone's balance in each of their groups, working each group out once
 * (netsFor per person would redo a group for every member in it).
 */
export function netsByPerson(groups: Group[]): Map<string, GroupNet[]> {
  const out = new Map<string, GroupNet[]>();
  for (const group of groups) {
    const balances = new Map(computeBalances(group).map((b) => [b.memberId, b.net]));
    for (const m of group.members) {
      const list = out.get(m.id) ?? [];
      list.push({ group, net: balances.get(m.id) ?? 0 });
      out.set(m.id, list);
    }
  }
  return out;
}

export interface MyNet {
  group: Group;
  /** Who you are in this group; null when the app can't tell. */
  me: string | null;
  /** Your balance there; null when the app can't tell who you are. */
  net: number | null;
}

/** Your balance in each group, for Home and Profile. */
export function myNets(groups: Group[], profile: Profile, meMap: Record<string, string>): MyNet[] {
  return groups.map((group) => {
    const me = resolveMe(group, profile, meMap[group.id]);
    const net = me ? (computeBalances(group).find((b) => b.memberId === me)?.net ?? 0) : null;
    return { group, me, net };
  });
}

/** Adds up balances: what others owe this person, and what they owe. Under ₹1 counts as settled. */
export function totals(nets: { net: number }[]) {
  let owed = 0;
  let owes = 0;
  for (const { net } of nets) {
    if (isSettled(net)) continue;
    if (net > 0) owed += net;
    else owes -= net;
  }
  return { owed, owes };
}
