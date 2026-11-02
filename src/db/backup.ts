import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from './database';
import { runMigrations, SCHEMA_VERSION } from './migrations';

const STAGING_NAME = 'centav0-restore-staging.db';

function backupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `centav0-backup-${stamp}-schema${SCHEMA_VERSION}.db`;
}

/**
 * Snapshot the live database via SQLite's own online-backup API (safe under WAL —
 * no raw file copy, so a write mid-export can't tear the file) and hand it to the
 * OS share sheet.
 */
export async function exportBackup(): Promise<void> {
  const db = await getDatabase();
  const name = backupFileName();
  const snapshotDb = await SQLite.openDatabaseAsync(name, undefined, Paths.cache.uri);
  await SQLite.backupDatabaseAsync({
    sourceDatabase: db,
    sourceDatabaseName: 'main',
    destDatabase: snapshotDb,
    destDatabaseName: 'main',
  });
  await snapshotDb.closeAsync();

  const file = new File(Paths.cache, name);
  try {
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Save Centav0 backup' });
  } finally {
    if (file.exists) file.delete();
  }
}

export class InvalidBackupError extends Error {}

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

    const db = await getDatabase();
    await SQLite.backupDatabaseAsync({
      sourceDatabase: stagedDb,
      sourceDatabaseName: 'main',
      destDatabase: db,
      destDatabaseName: 'main',
    });
    await runMigrations(db);
    return 'restored';
  } finally {
    await stagedDb?.closeAsync();
    if (staged.exists) staged.delete();
  }
}
