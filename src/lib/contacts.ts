import type { Member, Person } from '../types';

// Adding people from the phone's contacts (group form). Only names are
// read, they stay on the phone, and only the ones picked are saved, as
// people (guests) like anyone typed in. A name already in your People is
// that person, not a new one.

/** Same limit as a typed name. */
export const NAME_MAX = 30;

const key = (s: string) => s.toLowerCase();

/**
 * Names fit to show and save: trimmed, single spaces, cut to 30, each once
 * (whatever the letter case), and none that's only a phone number.
 */
export function cleanContactNames(raw: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const name = (r ?? '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX).trim();
    if (!name || /^[\d\s+()./-]+$/.test(name) || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * The members to add for the picked names: someone in your People with that
 * name is reused, anyone else is a new guest. Names already in the group are
 * skipped and returned, so the form can say so.
 */
export function membersFromContacts(
  names: string[],
  people: Person[],
  inGroup: Member[],
  newId: () => string,
): { add: Member[]; already: string[] } {
  const taken = new Set(inGroup.map((m) => key(m.name)));
  const byName = new Map(people.map((p) => [key(p.name), p]));
  const add: Member[] = [];
  const already: string[] = [];
  for (const name of names) {
    if (taken.has(key(name))) {
      already.push(name);
      continue;
    }
    taken.add(key(name));
    const known = byName.get(key(name));
    add.push(known ? { id: known.id, name: known.name } : { id: newId(), name });
  }
  return { add, already };
}
