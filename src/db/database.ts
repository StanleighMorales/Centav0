import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

const DB_NAME = 'centav0.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
      // Migrations run with foreign_keys OFF so table rebuilds (drop + rename)
      // don't trip FK checks; enforcement turns on for the app session after.
      await runMigrations(db);
      await db.execAsync(`PRAGMA foreign_keys = ON;`);
      return db;
    })();
  }
  return dbPromise;
}
