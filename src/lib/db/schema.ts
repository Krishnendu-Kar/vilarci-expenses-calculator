// The SQLite tables. Money is integer paise, times are milliseconds since
// 1970, dates are local 'YYYY-MM-DD' and months 'YYYY-MM'. Everything that
// belongs to a group is deleted with it (foreign keys, ON DELETE CASCADE).
//
// To change the tables later, add a step to MIGRATIONS; never edit one that
// has shipped. `PRAGMA user_version` records how many have run.

const V1 = `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

-- The People directory: the same person in every group they're in.
CREATE TABLE people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

-- binned_at is set while the group is in the Bin.
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  binned_at INTEGER
) STRICT;

-- The name is kept here too, so a shared group file reads on its own.
CREATE TABLE members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pos INTEGER NOT NULL,
  PRIMARY KEY (group_id, person_id)
) STRICT;

CREATE TABLE expenses (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  recurring_id TEXT,
  pinned_at INTEGER,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, id)
) STRICT;

-- Hostel/flat groups: expenses added by themselves every month.
CREATE TABLE recurring (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  note TEXT,
  day INTEGER NOT NULL,
  last_month TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, id)
) STRICT;

-- Who paid, for an expense or a monthly repeat (parent_id).
CREATE TABLE payers (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  pos INTEGER NOT NULL,
  PRIMARY KEY (group_id, parent_id, person_id)
) STRICT;

-- Who it's split among, in order (the order decides who gets a leftover
-- paisa). value: paise for exact, a share count, or basis points for %.
CREATE TABLE splits (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  pos INTEGER NOT NULL,
  value INTEGER,
  PRIMARY KEY (group_id, parent_id, person_id)
) STRICT;

CREATE TABLE payments (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, id)
) STRICT;

CREATE TABLE closed_months (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  PRIMARY KEY (group_id, month)
) STRICT;

-- This phone only, never exported: pins and archive, open counts, who "me"
-- is per group, and unsaved Add-expense forms (JSON).
CREATE TABLE group_prefs (
  group_id TEXT PRIMARY KEY,
  pinned_at INTEGER,
  pin_until INTEGER,
  archived_at INTEGER
) STRICT;

CREATE TABLE visits (
  group_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  last INTEGER NOT NULL
) STRICT;

CREATE TABLE me (
  group_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL
) STRICT;

CREATE TABLE drafts (
  group_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
) STRICT;

-- Ids from before 1.2 and the UUIDs they became.
CREATE TABLE legacy_ids (
  old_id TEXT PRIMARY KEY,
  new_id TEXT NOT NULL
) STRICT;
`;

// 1.3: an expense can count for another month than its date's (hostel groups).
const V2 = `
ALTER TABLE expenses ADD COLUMN month TEXT;
`;

// 1.3: a group can be locked on this phone. Its own step, because test
// builds had already run V2 without it.
const V3 = `
ALTER TABLE group_prefs ADD COLUMN locked_at INTEGER;
`;

// 2.0: live groups (onlinedb.md §9). Which groups are online and your place
// in them, the changes waiting to be uploaded, and the Activity lines that
// came down. Members of a live group have a role, may have an account, and
// stay listed after they leave.
const V4 = `
ALTER TABLE members ADD COLUMN role TEXT;
ALTER TABLE members ADD COLUMN account INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN gone TEXT;

-- cursor: the last change number of the group this phone has.
CREATE TABLE online_groups (
  group_id TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  cursor INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  status TEXT NOT NULL,
  edit_info TEXT NOT NULL,
  add_expenses TEXT NOT NULL,
  add_guests TEXT NOT NULL,
  require_approval INTEGER NOT NULL,
  deleted_at INTEGER
) STRICT;

-- One line per item changed here and not uploaded yet. The item itself is
-- read from its table when it goes, so this never holds a stale copy.
-- updated_at: when it was changed, in server time (last write wins).
CREATE TABLE outbox (
  tbl TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  row_id TEXT NOT NULL,
  op TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  PRIMARY KEY (tbl, group_id, row_id)
) STRICT;

-- data: JSON, as the server wrote it.
CREATE TABLE events (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (group_id, id)
) STRICT;
`;

export const MIGRATIONS: string[] = [V1, V2, V3, V4];
