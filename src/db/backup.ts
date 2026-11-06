import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from './database';
import { runMigrations, SCHEMA_VERSION } from './migrations';
import { setSetting } from '../repositories';
import { attachmentDest, LAST_BACKUP_KEY } from '../utils/backupRules';
import { nowIso } from '../utils/date';

const STAGING_NAME = 'centav0-restore-staging.db';

function backupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `centav0-backup-${stamp}-schema${SCHEMA_VERSION}.db`;
}

/** Copy every attached file into the snapshot, one at a time so memory peaks at a single file. */
async function embedAttachments(snapshotDb: SQLite.SQLiteDatabase): Promise<void> {
  await snapshotDb.execAsync(`CREATE TABLE _attachments (uri TEXT PRIMARY KEY, data BLOB NOT NULL);`);
  // Soft-deleted rows count, so a restored archive keeps its receipts.
  const rows = await snapshotDb.getAllAsync<{ uri: string }>(
    `SELECT receiptUri AS uri FROM transactions WHERE receiptUri IS NOT NULL
     UNION SELECT uri FROM investment_documents`,
  );
  for (const { uri } of rows) {
    const file = new File(uri);
    if (!file.exists) continue;
    await snapshotDb.runAsync(`INSERT INTO _attachments (uri, data) VALUES (?, ?)`, [uri, await file.bytes()]);
  }
  // The snapshot inherits WAL mode, and these rows must be in the .db file before it's shared.
  await snapshotDb.execAsync(`PRAGMA wal_checkpoint(TRUNCATE);`);
}

/**
 * Snapshot the live database via SQLite's own online-backup API (safe under WAL —
 * no raw file copy, so a write mid-export can't tear the file), add the attached
 * files, and hand it to the OS share sheet.
 */
export async function exportBackup(): Promise<void> {
  const db = await getDatabase();
  const name = backupFileName();
  const file = new File(Paths.cache, name);
  try {
    const snapshotDb = await SQLite.openDatabaseAsync(name, undefined, Paths.cache.uri);
    try {
      await SQLite.backupDatabaseAsync({
        sourceDatabase: db,
        sourceDatabaseName: 'main',
        destDatabase: snapshotDb,
        destDatabaseName: 'main',
      });
      await embedAttachments(snapshotDb);
    } finally {
      await snapshotDb.closeAsync();
    }
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Save Centav0 backup' });
    // ponytail: shareAsync can't say if the file was saved, so a cancelled sheet counts as a backup.
    await setSetting(LAST_BACKUP_KEY, nowIso());
  } finally {
    if (file.exists) file.delete();
  }
}

export class InvalidBackupError extends Error {}

/**
 * Write the backup's files to disk and point the staged rows at them, since the new phone's
 * storage path can differ. Drops the table so the live database never carries the blobs.
 */
async function extractAttachments(stagedDb: SQLite.SQLiteDatabase): Promise<void> {
  const table = await stagedDb.getFirstAsync(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_attachments'`,
  );
  if (!table) return; // made before backups carried attachments
  const rows = await stagedDb.getAllAsync<{ uri: string }>(`SELECT uri FROM _attachments`);
  for (const { uri } of rows) {
    const dest = attachmentDest(uri);
    if (!dest) continue;
    const row = await stagedDb.getFirstAsync<{ data: Uint8Array }>(`SELECT data FROM _attachments WHERE uri = ?`, [uri]);
    if (!row) continue;
    const file = new File(Paths.document, dest.folder, dest.name);
    file.create({ intermediates: true, overwrite: true });
    file.write(row.data);
    await stagedDb.runAsync(`UPDATE transactions SET receiptUri = ? WHERE receiptUri = ?`, [file.uri, uri]);
    await stagedDb.runAsync(`UPDATE investment_documents SET uri = ? WHERE uri = ?`, [file.uri, uri]);
  }
  await stagedDb.execAsync(`DROP TABLE _attachments; VACUUM;`);
}

/**
 * Pick a `.db` file, validate it's a Centav0 backup this app build can read, then
 * copy its contents into the live database via the same backup API in reverse —
 * never touching centav0.db's raw file, so there's no half-restored file on disk
 * to clean up if something goes wrong partway.
 */
export async function restoreBackup(): Promise<'restored' | 'cancelled'> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return 'cancelled';

  const staged = new File(Paths.cache, STAGING_NAME);
  if (staged.exists) staged.delete();
  const pickedFile = new File(picked.assets[0].uri);
  await pickedFile.copy(staged);

  let stagedDb: SQLite.SQLiteDatabase | null = null;
  try {
    stagedDb = await SQLite.openDatabaseAsync(STAGING_NAME, undefined, Paths.cache.uri);
    const rows = await stagedDb.getAllAsync<{ name: string }>(
      `SELECT name FROM _migrations`,
    ).catch(() => {
      throw new InvalidBackupError('That file is not a Centav0 backup.');
    });
    if (rows.length > SCHEMA_VERSION) {
      throw new InvalidBackupError(
        'This backup was made with a newer version of Centav0. Update the app before restoring it.',
      );
    }

    await extractAttachments(stagedDb);

    const db = await getDatabase();
    await SQLite.backupDatabaseAsync({
      sourceDatabase: stagedDb,
      sourceDatabaseName: 'main',
      destDatabase: db,
      destDatabaseName: 'main',
    });
    // Same as at startup: a migration's table rebuild mustn't trip FK checks.
    await db.execAsync(`PRAGMA foreign_keys = OFF;`);
    try {
      await runMigrations(db);
    } finally {
      await db.execAsync(`PRAGMA foreign_keys = ON;`);
    }
    await setSetting(LAST_BACKUP_KEY, nowIso());
    return 'restored';
  } finally {
    await stagedDb?.closeAsync();
    if (staged.exists) staged.delete();
  }
}
