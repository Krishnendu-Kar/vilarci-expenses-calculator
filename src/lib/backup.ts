import type { Group } from '../types';
import { SCHEMA_VERSION, sanitizeGroups, type SanitizeResult } from './migrate';

// Backup files are plain JSON so they survive WhatsApp, Drive and email.
// The same format carries a full backup or a single shared group.
export const BACKUP_APP = 'vilarci-split';

export function buildBackup(groups: Group[]) {
  return JSON.stringify(
    { app: BACKUP_APP, version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), groups },
    null,
    2,
  );
}

export interface ParsedBackup extends SanitizeResult {
  exportedAt?: string;
}

/** Throws an Error with a message fit to show the user. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file can't be read. Pick a .json file exported from Vilarci Split.");
  }
  const d = data as { app?: unknown; version?: unknown; exportedAt?: unknown; groups?: unknown };
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.groups)) {
    throw new Error("This isn't a Vilarci Split backup. Pick a file exported from the app.");
  }
  if (typeof d.version === 'number' && d.version > SCHEMA_VERSION) {
    throw new Error('This file is from a newer version of Vilarci Split. Update the app, then try again.');
  }
  const result = sanitizeGroups(d.groups);
  if (result.groups.length === 0) throw new Error('No usable groups were found in this file.');
  return { ...result, exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : undefined };
}

export interface ImportPlan {
  added: Group[];
  replaced: { incoming: Group; local: Group; localIsNewer: boolean }[];
}

/** What importing `incoming` would do, so the user can see it before saying yes. */
export function planImport(existing: Group[], incoming: Group[]): ImportPlan {
  const byId = new Map(existing.map((g) => [g.id, g]));
  const plan: ImportPlan = { added: [], replaced: [] };
  for (const g of incoming) {
    const local = byId.get(g.id);
    if (local) plan.replaced.push({ incoming: g, local, localIsNewer: local.updatedAt > g.updatedAt });
    else plan.added.push(g);
  }
  return plan;
}

/** Imported groups replace local ones with the same id; the rest are added. */
export function mergeGroups(existing: Group[], incoming: Group[]) {
  const incomingIds = new Set(incoming.map((g) => g.id));
  return [...incoming, ...existing.filter((g) => !incomingIds.has(g.id))];
}
