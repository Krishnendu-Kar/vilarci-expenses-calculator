import type { Group } from '../types';
import { SCHEMA_VERSION, localCopy, sanitizeGroups, type SanitizeResult } from './migrate';
import { translate } from '../i18n';

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
    throw new Error(translate('backup.unreadable'));
  }
  const d = data as { app?: unknown; version?: unknown; exportedAt?: unknown; groups?: unknown };
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.groups)) {
    throw new Error(translate('backup.notOurs'));
  }
  if (typeof d.version === 'number' && d.version > SCHEMA_VERSION) {
    throw new Error(translate('backup.newer'));
  }
  const result = sanitizeGroups(d.groups);
  if (result.groups.length === 0) throw new Error(translate('backup.empty'));
  // A file of a live group is a local copy on the phone that opens it.
  return {
    ...result,
    groups: result.groups.map(localCopy),
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : undefined,
  };
}

export interface ImportPlan {
  added: Group[];
  replaced: { incoming: Group; local: Group; localIsNewer: boolean }[];
  /** Copies of groups that are live on this phone: the live group stays as it is. */
  keptLive: Group[];
}

/** What importing `incoming` would do, so the user can see it before saying yes. */
export function planImport(existing: Group[], incoming: Group[]): ImportPlan {
  const byId = new Map(existing.map((g) => [g.id, g]));
  const plan: ImportPlan = { added: [], replaced: [], keptLive: [] };
  for (const g of incoming) {
    const local = byId.get(g.id);
    if (local?.online) plan.keptLive.push(g);
    else if (local) plan.replaced.push({ incoming: g, local, localIsNewer: local.updatedAt > g.updatedAt });
    else plan.added.push(g);
  }
  return plan;
}

/**
 * Imported groups replace local ones with the same id; the rest are added.
 * A live group is never replaced by a file: the server has its real copy.
 */
export function mergeGroups(existing: Group[], incoming: Group[]) {
  const live = new Set(existing.filter((g) => g.online).map((g) => g.id));
  const taken = incoming.filter((g) => !live.has(g.id));
  const incomingIds = new Set(taken.map((g) => g.id));
  return [...taken, ...existing.filter((g) => !incomingIds.has(g.id))];
}
