import type { Group, Person, Profile, UpiId } from '../../types';
import { sanitizeGroups, sanitizePeople } from '../migrate';
import { sanitizePrefs, sanitizeVisits, type GroupPrefs, type Visits } from '../groupFilters';
import { sanitizeBin, type BinItem } from '../bin';
import { sanitizeUpiIds } from '../upi';
import { idMapper, oldIds, remapDraft, remapGroup } from '../legacyIds';
import type { ExpenseDraft } from '../drafts';
import { MIGRATIONS } from './schema';
import { SELECTS, assembleGroups, insertRows, planGroups, type GroupTables, type SQLValue, type Saved, type Statement } from './rows';

// Everything the app saves lives in one SQLite database. This module only
// needs a small `Db` (expo-sqlite on the phone, node:sqlite in the tests)
// and a way to read what older versions kept in AsyncStorage.

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SQLValue[]): Promise<void>;
  all<T>(sql: string, params?: SQLValue[]): Promise<T[]>;
  /** Commits if `fn` resolves, rolls back if it throws. */
  transaction(fn: () => Promise<void>): Promise<void>;
}

/** Group id → the member who is "me" in it. */
export type MeMap = Record<string, string>;

export const EMPTY_PROFILE: Profile = { name: '', personId: null };

export interface Everything {
  groups: Group[];
  bin: BinItem[];
  people: Person[];
  visits: Visits;
  prefs: GroupPrefs;
  profile: Profile;
  meMap: MeMap;
  /** Your UPI ids, on this phone. */
  upiIds: UpiId[];
}

/** AsyncStorage keys used before 1.2. The data there is left as it was. */
export const LEGACY_KEYS = {
  groups: 'vilarci-split:groups',
  lastBackup: 'vilarci-split:last-backup',
  visits: 'vilarci-split:visits',
  prefs: 'vilarci-split:group-prefs',
  people: 'vilarci-split:people',
  profile: 'vilarci-split:profile',
  me: 'vilarci-split:me',
  bin: 'vilarci-split:bin',
  theme: 'vilarci-split:theme',
  language: 'vilarci-split:language',
  drafts: 'vilarci-split:expense-drafts',
} as const;

export type LegacyData = Partial<Record<keyof typeof LEGACY_KEYS, string | null>>;

const SETTING = {
  theme: 'theme',
  language: 'language',
  lastBackup: 'last_backup',
  profileName: 'profile_name',
  profilePerson: 'profile_person_id',
  upiIds: 'upi_ids',
  imported: 'legacy_imported_at',
} as const;

export type SettingKey = 'theme' | 'language';

const parseJson = (raw: string | null | undefined): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valid profile from anything. */
function cleanProfile(p: unknown): Profile {
  const r = isObj(p) ? p : {};
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 30) : '',
    personId: typeof r.personId === 'string' && r.personId ? r.personId : null,
  };
}

function cleanMeMap(raw: unknown): MeMap {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as MeMap;
}

// A group can be in the list and in the Bin at once for a moment (a file of a
// binned group was imported). One row per group: the one in the list wins.
function savedList(groups: Group[], bin: BinItem[]): Saved[] {
  const live = new Set(groups.map((g) => g.id));
  return [
    ...groups.map((group) => ({ group, binnedAt: null })),
    ...bin.filter((b) => !live.has(b.group.id)).map((b) => ({ group: b.group, binnedAt: b.binnedAt })),
  ];
}

const toMap = (list: Saved[]) => new Map(list.map((s) => [s.group.id, s]));

export function createStore(open: () => Promise<Db>, readLegacy: () => Promise<LegacyData>, newId: () => string) {
  let opened: Promise<Db> | null = null;
  // One thing at a time: a transaction must never interleave with another query.
  let queue: Promise<unknown> = Promise.resolve();
  // What the database holds now, to save only what changed.
  let savedGroups = new Map<string, Saved>();
  let savedPeople = new Map<string, Person>();

  function serial<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const run = queue.then(async () => fn(await (opened ??= init())));
    queue = run.catch(() => {});
    return run;
  }

  async function runAll(db: Db, statements: Statement[]) {
    for (const s of statements) await db.run(s.sql, s.params);
  }

  async function init(): Promise<Db> {
    const db = await open();
    await db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const [{ user_version: version }] = await db.all<{ user_version: number }>('PRAGMA user_version');
    for (let v = version; v < MIGRATIONS.length; v++) {
      await db.transaction(() => db.exec(`${MIGRATIONS[v]}\nPRAGMA user_version = ${v + 1};`));
    }
    const done = await db.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING.imported]);
    if (!done.length) await importLegacy(db, await readLegacy());
    return db;
  }

  /** First start on SQLite: copy what AsyncStorage held, with every id turned into a UUID. */
  async function importLegacy(db: Db, raw: LegacyData) {
    // Unreadable groups throw: nothing is written, the old data stays put,
    // and the next start tries again.
    const groups = raw.groups ? sanitizeGroups((JSON.parse(raw.groups) as { groups?: unknown })?.groups).groups : [];
    const bin = sanitizeBin(parseJson(raw.bin));
    const people = sanitizePeople(parseJson(raw.people));

    const { idFor, lookup, map } = idMapper(newId);
    const g2 = groups.map((g) => remapGroup(g, idFor));
    const b2 = bin.map((b) => ({ ...b, group: remapGroup(b.group, idFor) }));
    const p2 = people.map((p) => ({ ...p, id: idFor(p.id) }));
    const byGroup = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [lookup(k), v]));

    const profile = cleanProfile(parseJson(raw.profile));
    const me = Object.fromEntries(Object.entries(cleanMeMap(parseJson(raw.me))).map(([g, m]) => [lookup(g), lookup(m)]));
    const drafts = parseJson(raw.drafts);

    await db.transaction(async () => {
      await runAll(db, planGroups(new Map(), savedList(g2, b2)));
      await runAll(db, insertRows('people', ['id', 'name', 'created_at'], p2.map((p) => [p.id, p.name, p.createdAt])));
      await writePrefs(db, byGroup(sanitizePrefs(parseJson(raw.prefs))));
      await writeVisits(db, byGroup(sanitizeVisits(parseJson(raw.visits))));
      await writeMe(db, me);
      if (isObj(drafts)) {
        const rows = Object.entries(drafts as Record<string, ExpenseDraft>)
          .filter(([, d]) => isObj(d))
          .map(([g, d]) => [lookup(g), JSON.stringify(remapDraft(d, lookup))]);
        await runAll(db, insertRows('drafts', ['group_id', 'data'], rows));
      }
      const settings: [string, string][] = [
        ...(profile.name ? [[SETTING.profileName, profile.name] as [string, string]] : []),
        ...(profile.personId ? [[SETTING.profilePerson, lookup(profile.personId)] as [string, string]] : []),
        ...(raw.theme ? [[SETTING.theme, raw.theme] as [string, string]] : []),
        ...(raw.language ? [[SETTING.language, raw.language] as [string, string]] : []),
        ...(raw.lastBackup && Number(raw.lastBackup) ? [[SETTING.lastBackup, raw.lastBackup] as [string, string]] : []),
        [SETTING.imported, String(Date.now())],
      ];
      await runAll(db, insertRows('settings', ['key', 'value'], settings));
      await runAll(db, insertRows('legacy_ids', ['old_id', 'new_id'], [...map].map(([o, n]) => [o, n])));
    });
  }

  async function writePrefs(db: Db, prefs: GroupPrefs) {
    await db.run('DELETE FROM group_prefs', []);
    const rows = Object.entries(prefs).map(([g, p]) => [
      g,
      p.pinnedAt ?? null,
      p.pinnedAt != null ? (p.pinUntil ?? null) : null,
      p.archivedAt ?? null,
      p.lockedAt ?? null,
    ]);
    await runAll(db, insertRows('group_prefs', ['group_id', 'pinned_at', 'pin_until', 'archived_at', 'locked_at'], rows));
  }

  async function writeVisits(db: Db, visits: Visits) {
    await db.run('DELETE FROM visits', []);
    const rows = Object.entries(visits).map(([g, v]) => [g, v.count, v.last]);
    await runAll(db, insertRows('visits', ['group_id', 'count', 'last'], rows));
  }

  async function writeMe(db: Db, me: MeMap) {
    await db.run('DELETE FROM me', []);
    await runAll(db, insertRows('me', ['group_id', 'member_id'], Object.entries(me)));
  }

  async function readGroups(db: Db): Promise<Saved[]> {
    const tables = Object.fromEntries(
      await Promise.all(Object.entries(SELECTS).map(async ([t, sql]) => [t, await db.all(sql)] as const)),
    ) as unknown as GroupTables;
    const saved = assembleGroups(tables);
    // Checked like an imported file: anything broken is left out, not half-loaded.
    const clean = new Map(sanitizeGroups(saved.map((s) => s.group)).groups.map((g) => [g.id, g]));
    return saved.flatMap((s) => {
      const group = clean.get(s.group.id);
      return group ? [{ group, binnedAt: s.binnedAt }] : [];
    });
  }

  async function getSetting(db: Db, key: string): Promise<string | null> {
    const rows = await db.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
  }

  async function setSetting(db: Db, key: string, value: string | null) {
    if (value === null) await db.run('DELETE FROM settings WHERE key = ?', [key]);
    else await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  return {
    /** Everything at once, when the app starts. */
    loadAll: () =>
      serial(async (db): Promise<Everything> => {
        const saved = await readGroups(db);
        savedGroups = toMap(saved);
        const people = sanitizePeople(await db.all('SELECT id, name, created_at AS createdAt FROM people ORDER BY created_at, rowid'));
        savedPeople = new Map(people.map((p) => [p.id, p]));
        const prefRows = await db.all<{
          group_id: string;
          pinned_at: number | null;
          pin_until: number | null;
          archived_at: number | null;
          locked_at: number | null;
        }>('SELECT * FROM group_prefs');
        const prefs = sanitizePrefs(
          Object.fromEntries(
            prefRows.map((r) => [
              r.group_id,
              {
                ...(r.pinned_at !== null ? { pinnedAt: r.pinned_at, pinUntil: r.pin_until } : {}),
                ...(r.archived_at !== null ? { archivedAt: r.archived_at } : {}),
                ...(r.locked_at !== null ? { lockedAt: r.locked_at } : {}),
              },
            ]),
          ),
        );
        const visitRows = await db.all<{ group_id: string; count: number; last: number }>('SELECT * FROM visits');
        const visits = sanitizeVisits(Object.fromEntries(visitRows.map((r) => [r.group_id, { count: r.count, last: r.last }])));
        const meRows = await db.all<{ group_id: string; member_id: string }>('SELECT * FROM me');
        return {
          groups: saved.filter((s) => s.binnedAt === null).map((s) => s.group),
          bin: saved
            .filter((s) => s.binnedAt !== null)
            .sort((a, b) => b.binnedAt! - a.binnedAt!)
            .map((s) => ({ group: s.group, binnedAt: s.binnedAt! })),
          people,
          visits,
          prefs,
          profile: {
            name: (await getSetting(db, SETTING.profileName)) ?? '',
            personId: await getSetting(db, SETTING.profilePerson),
          },
          meMap: Object.fromEntries(meRows.map((r) => [r.group_id, r.member_id])),
          upiIds: sanitizeUpiIds(parseJson(await getSetting(db, SETTING.upiIds))),
        };
      }),

    /** Groups and the Bin together: moving a group to the Bin is one change. */
    saveGroups: (groups: Group[], bin: BinItem[]) =>
      serial(async (db) => {
        const next = savedList(groups, bin);
        const statements = planGroups(savedGroups, next);
        if (statements.length) await db.transaction(() => runAll(db, statements));
        savedGroups = toMap(next);
      }),

    savePeople: (people: Person[]) =>
      serial(async (db) => {
        const changed = people.filter((p) => savedPeople.get(p.id) !== p);
        const ids = new Set(people.map((p) => p.id));
        const gone = [...savedPeople.keys()].filter((id) => !ids.has(id));
        if (changed.length || gone.length) {
          await db.transaction(async () => {
            for (const id of gone) await db.run('DELETE FROM people WHERE id = ?', [id]);
            await runAll(db, insertRows('people', ['id', 'name', 'created_at'], changed.map((p) => [p.id, p.name, p.createdAt])));
          });
        }
        savedPeople = new Map(people.map((p) => [p.id, p]));
      }),

    savePrefs: (prefs: GroupPrefs) => serial((db) => db.transaction(() => writePrefs(db, prefs))),
    saveVisits: (visits: Visits) => serial((db) => db.transaction(() => writeVisits(db, visits))),
    saveMeMap: (me: MeMap) => serial((db) => db.transaction(() => writeMe(db, me))),
    saveProfile: (profile: Profile) =>
      serial((db) =>
        db.transaction(async () => {
          await setSetting(db, SETTING.profileName, profile.name);
          await setSetting(db, SETTING.profilePerson, profile.personId);
        }),
      ),
    saveUpiIds: (ids: UpiId[]) => serial((db) => setSetting(db, SETTING.upiIds, ids.length ? JSON.stringify(ids) : null)),

    loadSetting: (key: SettingKey) => serial((db) => getSetting(db, SETTING[key])),
    saveSetting: (key: SettingKey, value: string) => serial((db) => setSetting(db, SETTING[key], value)),
    getLastBackup: () =>
      serial(async (db) => {
        const v = Number(await getSetting(db, SETTING.lastBackup));
        return v > 0 ? v : null;
      }),
    setLastBackup: (ts: number) => serial((db) => setSetting(db, SETTING.lastBackup, String(ts))),

    loadDraft: (groupId: string) =>
      serial(async (db) => {
        const rows = await db.all<{ data: string }>('SELECT data FROM drafts WHERE group_id = ?', [groupId]);
        return rows.length ? parseJson(rows[0].data) : null;
      }),
    saveDraft: (groupId: string, draft: ExpenseDraft) =>
      serial((db) => db.run('INSERT OR REPLACE INTO drafts (group_id, data) VALUES (?, ?)', [groupId, JSON.stringify(draft)])),
    clearDraft: (groupId: string) => serial((db) => db.run('DELETE FROM drafts WHERE group_id = ?', [groupId])),

    /**
     * Groups from a file: ids from before 1.2 become the UUIDs they became
     * on this phone (or new ones, remembered for next time), so a file of a
     * group you already have still replaces it.
     */
    adoptIds: (groups: Group[]) =>
      serial(async (db) => {
        const old = oldIds(groups);
        if (!old.length) return groups;
        const known = new Map<string, string>();
        for (let i = 0; i < old.length; i += 500) {
          const chunk = old.slice(i, i + 500);
          const rows = await db.all<{ old_id: string; new_id: string }>(
            `SELECT old_id, new_id FROM legacy_ids WHERE old_id IN (${chunk.map(() => '?').join(', ')})`,
            chunk,
          );
          rows.forEach((r) => known.set(r.old_id, r.new_id));
        }
        const fresh = old.filter((id) => !known.has(id));
        const { idFor } = idMapper(newId, known);
        const out = groups.map((g) => remapGroup(g, idFor));
        if (fresh.length) {
          await db.transaction(() => runAll(db, insertRows('legacy_ids', ['old_id', 'new_id'], fresh.map((o) => [o, known.get(o)!]))));
        }
        return out;
      }),

    /** The groups as saved, read fresh, for rescuing data from the error screen. */
    dumpGroups: () => serial(async (db) => (await readGroups(db)).filter((s) => s.binnedAt === null).map((s) => s.group)),
  };
}

export type Store = ReturnType<typeof createStore>;
