import type { Group, Member, Person, Profile } from '../types';
import type { BinItem } from './bin';
import { remapGroup } from './legacyIds';
import { computeBalances, isSettled, peopleIn } from './split';

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
    // A guest linked to an account is that account now: its old row doesn't bring it back.
    for (const m of peopleIn(g)) {
      if (byId.has(m.id)) continue;
      const p = { id: m.id, name: m.name, createdAt: g.createdAt };
      byId.set(m.id, p);
      added.push(p);
    }
  }
  // A live group keeps the names it has: they're the group's, shared with
  // everyone in it, not this phone's nicknames.
  const synced = groups.map((g) =>
    g.online || g.members.every((m) => (byId.get(m.id)?.name ?? m.name) === m.name)
      ? g
      : { ...g, members: g.members.map((m) => ({ ...m, name: byId.get(m.id)?.name ?? m.name })) },
  );
  return { groups: synced, people: added.length ? [...people, ...added] : people };
}

/**
 * Members coming from a group form or "Many at once": new ids become new
 * people, and a changed name renames that person in every local group.
 * Live groups aren't touched here: their names belong to the group (a
 * guest is renamed in its own group by `updateGroup`, an account never).
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
      nextGroups = nextGroups.map((g) => (g.online ? g : renameInGroups([g], m.id, m.name)[0]));
    }
  }
  return { groups: nextGroups, people: added.length ? [...nextPeople, ...added] : nextPeople };
}

/**
 * Every group that has this person in it (a linked guest's old row doesn't
 * count). Empty: they can be removed from People.
 */
export function groupsWith(groups: Group[], personId: string) {
  return groups.filter((g) => peopleIn(g).some((m) => m.id === personId));
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
 * Who "you" are in a group: the member picked for it, else the person your
 * profile is linked to, else the one member with exactly your name.
 */
export function resolveMe(group: Group, profile: Profile, picked?: string | null): string | null {
  // A guest linked to an account is that account now, never you.
  const members = peopleIn(group);
  const isMember = (id?: string | null): id is string => !!id && members.some((m) => m.id === id);
  if (isMember(picked)) return picked;
  if (isMember(profile.personId)) return profile.personId;
  const n = profile.name.trim().toLowerCase();
  if (!n) return null;
  const same = members.filter((m) => m.name.toLowerCase() === n);
  return same.length === 1 ? same[0].id : null;
}

/** WhatsApp style: the mark before the name of an account you haven't saved. */
export const UNSAVED_MARK = '~';

export interface Names {
  /** A group member, as this phone shows them. */
  of(member: Pick<Member, 'id' | 'name'>): string;
  /** Every member of a group: id → the name shown. */
  all(group: Group): Record<string, string>;
  /** Someone in the People directory, as shown. */
  person(p: Person): string;
  /** Someone with an account you haven't saved a name for. */
  unsaved(id: string): boolean;
  /** The name someone with an account gave themselves (as their live group has it). */
  own(id: string): string | undefined;
}

/**
 * The names this phone shows. Someone with an account shows as "~" + the
 * name they gave themselves until you save a name for them, like an unsaved
 * number in WhatsApp. A saved name is yours: it stays on this phone (and in
 * your backups) and never goes to the group. Guests and you show as they
 * are. Reports keep the group's names, since they go to other people.
 */
export function makeNames(groups: Group[], people: Person[], me: ReadonlySet<string>): Names {
  const saved = new Map(people.filter((p) => p.saved).map((p) => [p.id, p.name]));
  const own = new Map<string, string>();
  for (const g of groups) {
    if (!g.online) continue;
    for (const m of g.members) if (m.account && !own.has(m.id)) own.set(m.id, m.name);
  }
  const unsaved = (id: string) => own.has(id) && !saved.has(id) && !me.has(id);
  const of = (m: Pick<Member, 'id' | 'name'>) =>
    me.has(m.id) ? m.name : (saved.get(m.id) ?? (own.has(m.id) ? UNSAVED_MARK + m.name : m.name));
  // The same map for the same group, so screens can memoise on it.
  const maps = new WeakMap<Group, Record<string, string>>();
  return {
    of,
    all: (g) => {
      let map = maps.get(g);
      if (!map) maps.set(g, (map = Object.fromEntries(g.members.map((m) => [m.id, of(m)]))));
      return map;
    },
    person: (p) => (unsaved(p.id) ? UNSAVED_MARK + p.name : p.name),
    unsaved,
    own: (id) => own.get(id),
  };
}

/** A name saved on this phone for someone with an account (backups carry them). */
export interface SavedName {
  id: string;
  name: string;
}

export const savedNames = (people: Person[]): SavedName[] =>
  people.filter((p) => p.saved).map((p) => ({ id: p.id, name: p.name }));

/**
 * Names from a backup: a name already saved here wins, the rest are saved.
 * Someone not on this phone yet is kept for when their group comes down.
 */
export function restoreSavedNames(people: Person[], names: SavedName[], now = Date.now()): Person[] {
  if (!names.length) return people;
  const byId = new Map(names.map((n) => [n.id, n.name]));
  const next = people.map((p) => (!p.saved && byId.has(p.id) ? { ...p, name: byId.get(p.id)!, saved: true } : p));
  const added = names
    .filter((n) => !people.some((p) => p.id === n.id))
    .map((n): Person => ({ id: n.id, name: n.name, createdAt: now, saved: true }));
  return next.some((p, i) => p !== people[i]) || added.length ? [...next, ...added] : people;
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
    for (const m of peopleIn(group)) {
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
