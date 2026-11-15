import { loadRawGroups } from './storage';
import { buildBackup } from './backup';
import { sanitizeGroups } from './migrate';
import { shareTextFile } from './files';
import { todayISO } from './format';

/**
 * Shares every saved group as a backup file, straight from storage: for the
 * error page (the app's own state may be what broke) and the Update needed
 * page (the app can't be used). False when nothing is saved.
 */
export async function exportSavedData(): Promise<boolean> {
  const raw = await loadRawGroups();
  if (!raw) return false;
  let content = raw;
  try {
    const groups = sanitizeGroups(JSON.parse(raw)?.groups).groups;
    if (groups.length) content = buildBackup(groups);
  } catch {
    // Unreadable: share it exactly as stored so nothing is lost.
  }
  await shareTextFile(`vilarci-e-split-backup-${todayISO()}.json`, content, 'application/json');
  return true;
}
