// Google Drive backup (onlinedb.md §21): the same backup file as Export,
// kept in Drive's hidden app folder (scope drive.appdata), the newest two
// kept. The calls take a Drive access token (lib/api/google.ts).

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const BACKUP_PREFIX = 'vilarci-split-backup-';
/** How many backups stay in Drive. */
export const KEEP = 2;

export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
}

/** The backups that go once a new one is up: everything past the newest `keep`. */
export function oldBackups(files: DriveFile[], keep = KEEP): DriveFile[] {
  return [...files]
    .filter((f) => f.name.startsWith(BACKUP_PREFIX))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    .slice(keep);
}

/** A file name with the date, like the Export file: vilarci-split-backup-2026-11-11.json */
export const backupName = (now: Date) => `${BACKUP_PREFIX}${now.toISOString().slice(0, 10)}.json`;

/** Drive's multipart upload body: the file's details, then its contents. */
export function multipartBody(meta: object, json: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    json,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** Is a backup due? `intervalDays` 0 = auto backup off. */
export function backupDue(lastAt: number | null, intervalDays: number, now: number): boolean {
  if (!intervalDays) return false;
  return lastAt === null || now - lastAt >= intervalDays * 24 * 3600 * 1000;
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Google Drive ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function listBackups(token: string): Promise<DriveFile[]> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '20',
  });
  const res = await call(token, `${API}/files?${q}`);
  const data = (await res.json()) as { files?: DriveFile[] };
  return (data.files ?? []).filter((f) => f.name.startsWith(BACKUP_PREFIX));
}

/** Uploads a backup, then removes all but the newest two. Returns its size in bytes. */
export async function uploadBackup(token: string, json: string, now = new Date()): Promise<number> {
  const boundary = `vilarci-${now.getTime()}`;
  const meta = { name: backupName(now), parents: ['appDataFolder'], mimeType: 'application/json' };
  await call(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody(meta, json, boundary),
  });
  for (const f of oldBackups(await listBackups(token))) {
    await call(token, `${API}/files/${f.id}`, { method: 'DELETE' }).catch(() => {});
  }
  return new TextEncoder().encode(json).length;
}

export async function downloadBackup(token: string, id: string): Promise<string> {
  const res = await call(token, `${API}/files/${id}?alt=media`);
  return res.text();
}

// Restoring hands the downloaded file to the Import page, which shows its
// usual preview before anything changes.
let handoff: { name: string; text: string } | null = null;
export const setRestoreFile = (f: { name: string; text: string }) => {
  handoff = f;
};
export const takeRestoreFile = () => {
  const f = handoff;
  handoff = null;
  return f;
};
