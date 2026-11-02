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

// Every entity table with user data — add new tables here as they're introduced,
// so reset-all-data never silently misses one.
const RESETTABLE_TABLES = [
  'investment_documents', 'investment_updates', 'investments',
  'debt_payments', 'lending_payments', 'transactions', 'lendings',
  'allocations', 'debts', 'accounts', 'account_types', 'categories',
  'lending_people', 'recurring_transactions', 'settings',
];

export async function resetAppData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const table of RESETTABLE_TABLES) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
  });
}
