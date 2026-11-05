export const ATTACHMENT_FOLDERS = ['receipts', 'contracts'] as const;
export const LAST_BACKUP_KEY = 'lastBackupAt';

const BACKUP_STALE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a file from a backup belongs under the documents folder, or null to skip it. Only the name is used:
 * backups come from outside the app, and receipts from before the scan feature sit in the picker's cache folder.
 */
export function attachmentDest(uri: string): { folder: (typeof ATTACHMENT_FOLDERS)[number]; name: string } | null {
  const name = uri.split('/').pop() ?? '';
  const match = /^[\w-]+\.(jpe?g|png|webp|heic|pdf)$/i.exec(name);
  if (!match) return null;
  return { folder: match[1].toLowerCase() === 'pdf' ? 'contracts' : 'receipts', name };
}

/** With no backup yet the clock starts at the oldest transaction, so a new user isn't nagged on day one. */
export function backupIsStale(
  lastBackupAt: string | null,
  oldestTransactionDate: string | null,
  now: Date = new Date(),
): boolean {
  const since = lastBackupAt ?? oldestTransactionDate;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() >= BACKUP_STALE_DAYS * DAY_MS;
}

export function backupAgeLabel(lastBackupAt: string | null, now: Date = new Date()): string {
  if (!lastBackupAt) return 'No backup yet';
  const days = Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / DAY_MS);
  if (days <= 0) return 'Last backup: today';
  return `Last backup: ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
